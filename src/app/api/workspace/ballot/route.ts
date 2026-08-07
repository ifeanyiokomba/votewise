import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { buildBallot, startVotingSession, getActiveSession } from '@/lib/sve'
import { verifyAccessToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// POST /api/workspace/ballot — Generate a secure ballot dynamically.
//
// This is the ONLY way to create a ballot. The ballot is built from:
//   Election → Positions → Candidates (eligible + approved) → Voting Rules
//
// The frontend renders whatever the backend sends — no hardcoded positions.
//
// Body: { electionId, voterId?, isSimulation?, sessionToken? }
// Returns: GeneratedBallot with positions, candidates, integrity token, signature.
//
// For real votes, the voter must have an active VotingSession (created via
// /api/workspace/ballot/session/start). For simulations, no session required.
export async function POST(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  const body = await req.json().catch(() => ({}))
  const { electionId, voterId, isSimulation, sessionToken } = body
  if (!electionId) return errorJson('Election ID is required', 400)

  // Cross-tenant gate (Chapter 2). Nothing past this point may act on an
  // election or voter outside the organization resolved from the hostname.
  // This was previously missing entirely — org.id was threaded through and
  // stored on the records created below, but never used to reject a
  // mismatched electionId/voterId. 404, not 403: don't confirm or deny that
  // the election exists under a different organization.
  const electionOrgCheck = await db.electionSession.findUnique({
    where: { id: electionId },
    select: { organizationId: true },
  })
  if (!electionOrgCheck || electionOrgCheck.organizationId !== org.id) {
    return errorJson('Election not found', 404)
  }

  // Resolve the voter. For real votes, we accept either a voterId or a sessionToken.
  let resolvedVoterId = voterId as string | undefined
  let sessionId: string | undefined

  if (!isSimulation) {
    // Try session token first (preferred path).
    if (sessionToken) {
      const { validateSession } = await import('@/lib/sve')
      const session = await validateSession(sessionToken)
      if (!session) return errorJson('Invalid or expired voting session. Please start a new one.', 401)
      resolvedVoterId = session.voterId
      sessionId = session.sessionId
    } else if (resolvedVoterId) {
      // Voter ID provided directly — find or create an active session.
      const active = await getActiveSession(resolvedVoterId, electionId)
      if (active) {
        sessionId = active.sessionId
      } else {
        // Auto-start a session for the voter (if election is live + voter eligible).
        const session = await startVotingSession({
          electionId,
          voterId: resolvedVoterId,
          organizationId: org.id,
          req,
        })
        sessionId = session.sessionId
      }
    }

    // If we still don't have a voter, try the access token (admin/observer preview).
    if (!resolvedVoterId) {
      const auth = verifyAccessToken(req)
      if (auth) {
        // Admin/observer preview — use a synthetic voter ID. This is for preview
        // only; actual vote casting requires a real voter session.
        const member = await db.organizationMember.findFirst({
          where: { email: auth.email, organizationId: org.id },
        })
        if (member) {
          // Try to find any voter in the org to preview the ballot.
          const previewVoter = await db.voter.findFirst({
            where: { organizationId: org.id },
          })
          if (previewVoter) resolvedVoterId = previewVoter.id
        }
      }
    }

    if (!resolvedVoterId) {
      return errorJson('A valid voter session or voter ID is required to generate a ballot.', 401)
    }

    // Cross-tenant gate, part two: whichever path produced resolvedVoterId
    // (session token, direct voterId, or preview), confirm that voter
    // actually belongs to this organization before a ballot is built.
    const voterOrgCheck = await db.voter.findUnique({
      where: { id: resolvedVoterId },
      select: { organizationId: true },
    })
    if (!voterOrgCheck || voterOrgCheck.organizationId !== org.id) {
      return errorJson('Voter not found', 404)
    }
  }

  try {
    const { ballot } = await buildBallot({
      electionId,
      voterId: resolvedVoterId,
      sessionId,
      isSimulation: !!isSimulation,
      shuffleCandidates: !isSimulation, // natural order for simulation preview
    })

    // Log the ballot generation (audit).
    if (!isSimulation && resolvedVoterId) {
      await db.voterTimelineEvent.create({
        data: {
          organizationId: org.id,
          voterId: resolvedVoterId,
          electionId,
          eventType: 'BALLOT_GENERATED',
          description: `Ballot generated for ${ballot.election.name} (${ballot.content.positions.length} positions)`,
          actorId: resolvedVoterId,
          metadata: JSON.stringify({ ballotId: ballot.ballotId, sessionId }),
        },
      }).catch(() => {})
    }

    return json(ballot)
  } catch (e: any) {
    if (e.message === 'ELECTION_NOT_FOUND') return errorJson('Election not found', 404)
    if (e.message === 'VOTER_NOT_FOUND') return errorJson('Voter not found', 404)
    if (e.message === 'VOTER_ORGANIZATION_MISMATCH') return errorJson('Voter not found', 404)
    console.error('[ballot/generate] error', e)
    return errorJson('Failed to generate ballot', 500)
  }
}
