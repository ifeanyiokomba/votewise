import { NextRequest } from 'next/server'
import { json } from '@/lib/election'

export const dynamic = 'force-dynamic'

// POST /api/vote/cast — DEPRECATED.
//
// This route was the original single-tenant vote-casting endpoint. It wrote
// to the EncryptedVote table, which is NOT read by:
//   - The live-results engine (results-service reads VoteRecord)
//   - The RLA audit tool (reads VoteRecord)
//   - The export system (reads VoteRecord)
//   - The verification portal (reads VoteRecord)
//
// All vote casting MUST go through the multi-tenant workspace flow instead:
//   POST /api/workspace/ballot/submit → src/lib/sve/vote-recorder.ts → VoteRecord
//
// This endpoint now returns a 410 Gone with a redirect message. It does NOT
// accept votes. If you need to cast a vote, use the workspace flow at:
//   /workspace/elections/[id]/vote
export async function POST(req: NextRequest) {
  return json({
    error: 'This vote-casting endpoint is deprecated.',
    redirect: 'Use /workspace/elections/[id]/vote to cast your vote.',
    docs: 'The multi-tenant workspace flow writes to VoteRecord, which is read by live results, RLA, exports, and verification.',
  }, 410)
}
