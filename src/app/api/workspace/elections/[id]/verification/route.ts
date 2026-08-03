import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { getVerification, tallyElection } from '@/lib/sve'
import { getCurrentOfficial } from '@/lib/guards'

export const dynamic = 'force-dynamic'

// GET /api/workspace/elections/[id]/verification — Post-election verification package.
//
// Every election gets a verification package after tallying:
//   Total Eligible | Total Votes | Invalid Votes | Blank Votes | Turnout %
//   Audit Hash | Integrity Signature
//
// The auditHash is sha256 of all vote records (sorted). Any change to the
// votes changes this hash. The integritySignature is HMAC-SHA256(auditHash),
// proving the tally was produced by VoteWise.
//
// This can be published publicly for independent verification.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Auth check — closes the endpoint authentication gap (audit finding)
  const official = await getCurrentOfficial(req)
  if (!official) return errorJson('Unauthorized', 401)
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  const { id: electionId } = await params
  const election = await db.electionSession.findUnique({
    where: { id: electionId },
    select: { id: true, organizationId: true, name: true, status: true },
  })
  if (!election || election.organizationId !== org.id) {
    return errorJson('Election not found', 404)
  }

  // Try the stored verification package first.
  const stored = await getVerification(electionId)
  if (stored) {
    // Enrich with the full tally (decrypted results).
    const tally = await tallyElection(electionId, { simulation: false })
    return json({
      ...stored,
      electionName: election.name,
      generatedAt: stored.generatedAt.toISOString(),
      resultsByPosition: tally.resultsByPosition,
    })
  }

  // No stored package — compute a live tally (for in-progress elections).
  const tally = await tallyElection(electionId, { simulation: false })
  return json({
    ...tally,
    electionName: election.name,
    message: election.status === 'LIVE'
      ? 'Election is still in progress. This is a live tally — final verification will be generated after voting closes.'
      : 'Verification package has not been persisted yet. Run POST /api/workspace/elections/[id]/tally to lock results.',
  })
}
