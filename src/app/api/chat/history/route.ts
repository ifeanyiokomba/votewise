import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson } from '@/lib/election'

export const dynamic = 'force-dynamic'

// GET /api/chat/history — get conversation history for the authenticated voter.
export async function GET(req: NextRequest) {
  const token =
    req.headers.get('x-voter-token') ||
    req.headers.get('x-session-token') ||
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return errorJson('No voter session', 401)
  const voter = await db.voter.findUnique({ where: { sessionToken: token }, select: { id: true } })
  if (!voter) return errorJson('Voter not found', 401)

  const messages = await db.chatMessage.findMany({
    where: { voterId: voter.id },
    orderBy: { createdAt: 'asc' },
    take: 100,
  })
  return json({ messages })
}
