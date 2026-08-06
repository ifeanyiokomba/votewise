import { NextRequest } from 'next/server'
import { errorResponse } from '@/lib/errors'

export const dynamic = 'force-dynamic'

// POST /api/v1/voting/cast — DEPRECATED, disabled 2026-08-06.
//
// This route wrote directly to VoteRecord with `candidateId` and `voterId`
// as plain-text fields on the same row, with no encryption and no check
// that the authenticated voter's organization matched the election's
// organization. It was found live and reachable — unreferenced by any
// current frontend page, but not gated or removed — during Chapter 2
// (Database and tenant isolation) work. See:
//   docs/decisions/0002-vote-storage-consolidation.md
//
// The current vote-casting path is the SVE-based workspace flow:
//   POST /api/workspace/ballot/submit → src/lib/sve/vote-recorder.ts
// which encrypts the selection and does not persist a plain-text link
// between voter identity and candidate choice.
//
// This endpoint now returns 410 Gone and accepts no votes. Do not restore
// it without addressing both defects above and adding a tenant-ownership
// check.
export async function POST(req: NextRequest) {
  return errorResponse(
    'GONE',
    'This vote-casting endpoint is deprecated and no longer accepts votes.',
    {
      redirect: 'Use the workspace ballot flow to cast a vote.',
      reason: 'Superseded by the encrypted, tenant-aware SVE vote-recording path.',
    },
  )
}
