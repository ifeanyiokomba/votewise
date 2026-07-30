import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// POST /api/vote/verify-receipt
// Body: { receiptCode }
// Confirms a receipt code exists & was counted (without revealing the choice).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const code = String(body.receiptCode || '').trim().toUpperCase()
  if (!code) return errorJson('Receipt code is required', 400)

  const vote = await db.vote.findUnique({
    where: { receiptCode: code },
    include: {
      position: { select: { title: true, slug: true } },
      candidate: { select: { fullName: true, slug: true } },
    },
  })
  if (!vote) return json({ valid: false, message: 'Receipt code not found.' }, 404)

  return json({
    valid: true,
    counted: true,
    position: vote.position.title,
    votedAt: vote.createdAt,
    // We deliberately do NOT reveal which candidate the receipt voted for —
    // this preserves ballot secrecy while proving the vote was recorded.
    note: 'This confirms your vote was recorded and counted. The choice is kept secret to protect ballot secrecy.',
  })
}
