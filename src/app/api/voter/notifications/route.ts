import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson } from '@/lib/election'

export const dynamic = 'force-dynamic'

// GET /api/voter/notifications — fetch notifications for the authenticated voter.
export async function GET(req: NextRequest) {
  const token =
    req.headers.get('x-voter-token') ||
    req.headers.get('x-session-token') ||
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return errorJson('No voter session', 401)
  const voter = await db.voter.findUnique({ where: { sessionToken: token }, select: { id: true } })
  if (!voter) return errorJson('Voter not found', 401)
  const notifications = await db.notification.findMany({
    where: { voterId: voter.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
  const unread = await db.notification.count({ where: { voterId: voter.id, readAt: null } })
  return json({ notifications, unread })
}

// POST /api/voter/notifications/mark-read — mark all as read.
export async function POST(req: NextRequest) {
  const token =
    req.headers.get('x-voter-token') ||
    req.headers.get('x-session-token') ||
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return errorJson('No voter session', 401)
  const voter = await db.voter.findUnique({ where: { sessionToken: token }, select: { id: true } })
  if (!voter) return errorJson('Voter not found', 401)
  await db.notification.updateMany({ where: { voterId: voter.id, readAt: null }, data: { readAt: new Date() } })
  return json({ ok: true })
}
