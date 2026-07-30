import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson } from '@/lib/election'

export const dynamic = 'force-dynamic'

// POST /api/vote/verify-receipt  body: { receiptCode }
// Confirms the receipt exists + was counted WITHOUT decrypting the choice.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const code = String(body.receiptCode || '').trim().toUpperCase()
  if (!code) return errorJson('Receipt code is required', 400)

  const vote = await db.encryptedVote.findUnique({
    where: { receiptCode: code },
    include: { position: { select: { title: true, slug: true } } },
  })
  if (!vote) return json({ valid: false, message: 'Receipt code not found.' }, 404)

  return json({
    valid: true,
    counted: true,
    position: vote.position.title,
    votedAt: vote.createdAt,
    note: 'This confirms your vote was recorded and counted. The choice is kept secret to protect ballot secrecy.',
  })
}
