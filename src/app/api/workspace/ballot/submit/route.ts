import { NextRequest } from 'next/server'
import { json, errorJson, getClientIp } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { castVote, CastVoteError } from '@/lib/sve'

export const dynamic = 'force-dynamic'

// POST /api/workspace/ballot/submit — Cast a vote.
//
// This is the most critical endpoint in VoteWise. Every step is inside an
// atomic database transaction. If ANY step fails, everything rolls back.
//
// The 8-step validation pipeline runs BEFORE the transaction:
//   1. Session valid     5. Has not voted
//   2. OTVP valid        6. Ballot valid (signature + integrity + expiry)
//   3. Election live     7. Candidate valid
//   4. Rules unchanged   8. Position valid
//
// Then inside the transaction (race-safe):
//   Re-validate → Encrypt choice → Store VoteRecord → Mark voter voted
//   → Audit log → Timeline events → Mark ballot submitted → Commit
//
// Idempotency: idempotencyKey = sha256(voterId|electionId|positionId) with a
// UNIQUE constraint. A duplicate submission collides and is rejected.
//
// Body: { ballotId, selections: { positionId: candidateId | candidateId[] | 'NOTA' } }
// Returns: { ok, receipts[], votedAt, totalVotesInElection, turnoutPct }
export async function POST(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  const body = await req.json().catch(() => ({}))
  const { ballotId, selections } = body
  if (!ballotId) return errorJson('ballotId is required', 400)
  if (!selections || Object.keys(selections).length === 0) {
    return errorJson('No selections provided. Please select at least one candidate.', 400)
  }

  try {
    const result = await castVote({
      ballotId,
      selections,
      isSimulation: false,
      ip: getClientIp(req) || '0.0.0.0',
      device: req.headers.get('user-agent')?.slice(0, 120) || 'unknown',
    }, req)

    return json(result)
  } catch (e: any) {
    if (e instanceof CastVoteError) {
      return errorJson(e.message, e.status, {
        code: e.code,
        failedChecks: e.failedChecks,
      })
    }
    console.error('[ballot/submit] unexpected error', e)
    return errorJson('Failed to record vote. Please try again.', 500)
  }
}
