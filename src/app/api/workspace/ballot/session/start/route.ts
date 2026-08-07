import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson, getClientIp } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { startVotingSession, getActiveSession } from '@/lib/sve'
import { verifyAccessToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// POST /api/workspace/ballot/session/start — Start a secure voting session.
//
// A vote only exists inside a valid voting session. This endpoint creates a
// VotingSession (30-minute expiry) for a voter + election. The session:
// - Tracks the voter, election, device, IP, start/expiry.
// - Is revoked after the vote is cast (single-use).
// - Is used to validate ballot generation + vote submission.
//
// This is SEPARATE from the voter's login session. The login authenticates;
// the voting session authorizes a specific voting transaction.
//
// Body: { electionId, voterId? }
// Auth: x-voter-token (voter session) OR access token (admin acting on behalf)
// Returns: { sessionId, sessionToken, expiresAt, accredited, hasVoted }
export async function POST(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  const body = await req.json().catch(() => ({}))
  const { electionId, voterId } = body
  if (!electionId) return errorJson('Election ID is required', 400)

  // Verify election belongs to org + is live.
  const election = await db.electionSession.findUnique({
    where: { id: electionId },
    select: { id: true, organizationId: true, status: true, startTime: true, endTime: true, settings: true },
  })
  if (!election || election.organizationId !== org.id) {
    return errorJson('Election not found', 404)
  }

  const now = new Date()
  const isOpen = now >= election.startTime && now < election.endTime && election.status === 'LIVE'
  if (!isOpen) {
    return errorJson(`Election is ${election.status.toLowerCase()}. Voting is not open.`, 403)
  }

  // Resolve the voter.
  let resolvedVoterId = voterId as string | undefined

  // Option 1: voter token header (legacy voter session).
  const voterToken = req.headers.get('x-voter-token')
  if (!resolvedVoterId && voterToken) {
    const voter = await db.voter.findFirst({
      where: { OR: [{ sessionToken: voterToken }, { otpCode: voterToken }], organizationId: org.id },
    })
    if (voter) resolvedVoterId = voter.id
  }

  // Option 2: access token (admin/observer starting session for a voter).
  if (!resolvedVoterId) {
    const auth = verifyAccessToken(req)
    if (auth) {
      const member = await db.organizationMember.findFirst({
        where: { email: auth.email, organizationId: org.id },
      })
      if (member && voterId) {
        // Admin is starting a session for a specific voter.
        const voter = await db.voter.findFirst({ where: { id: voterId, organizationId: org.id } })
        if (voter) resolvedVoterId = voter.id
      }
    }
  }

  if (!resolvedVoterId) {
    return errorJson('Voter could not be identified. Provide a voter ID or voter token.', 401)
  }

  // Validate voter is eligible.
  const voter = await db.voter.findUnique({
    where: { id: resolvedVoterId },
    select: { id: true, hasVoted: true, flagged: true, status: true, fullName: true, organizationId: true },
  })
  if (!voter || voter.organizationId !== org.id) return errorJson('Voter not found', 404)
  if (voter.hasVoted) return errorJson('You have already voted in this election', 409)
  if (voter.flagged || voter.status === 'SUSPENDED') {
    return errorJson('Your account has been flagged — contact the electoral committee', 403)
  }

  // Check for an existing active session (reuse if valid).
  const existing = await getActiveSession(resolvedVoterId, electionId)
  if (existing) {
    return json({
      ...existing,
      reused: true,
      message: 'Active session found. You can proceed to generate your ballot.',
    })
  }

  // Start a new session. election and voter org membership were both already
  // verified above; startVotingSession's own check is defense in depth and
  // should not be reachable here, but is still handled rather than left to
  // become an unhandled 500 if it ever is.
  let session: Awaited<ReturnType<typeof startVotingSession>>
  try {
    session = await startVotingSession({
      electionId,
      voterId: resolvedVoterId,
      organizationId: org.id,
      req,
    })
  } catch (e: any) {
    if (e.message === 'VOTER_ORGANIZATION_MISMATCH' || e.message === 'ELECTION_ORGANIZATION_MISMATCH') {
      return errorJson('Voter not found', 404)
    }
    throw e
  }

  // Audit: record the session start.
  await db.voterTimelineEvent.create({
    data: {
      organizationId: org.id,
      voterId: resolvedVoterId,
      electionId,
      eventType: 'VOTING_SESSION_STARTED',
      description: `Voting session started for ${voter.fullName || 'voter'}`,
      actorId: resolvedVoterId,
      metadata: JSON.stringify({ sessionId: session.sessionId, ip: getClientIp(req) }),
    },
  }).catch(() => {})

  return json({
    ...session,
    reused: false,
    message: 'Voting session started. You have 30 minutes to cast your vote.',
  })
}
