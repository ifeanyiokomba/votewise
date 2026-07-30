import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json } from '@/lib/election'

export const dynamic = 'force-dynamic'

// GET /api/voter/session
export async function GET(req: NextRequest) {
  const token =
    req.headers.get('x-voter-token') ||
    req.headers.get('x-session-token') ||
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return json({ valid: false }, 401)
  const voter = await db.voter.findUnique({
    where: { sessionToken: token },
    include: { faculty: { select: { name: true, code: true } }, department: { select: { name: true, code: true } } },
  })
  if (!voter || !voter.sessionExpiresAt || voter.sessionExpiresAt < new Date()) return json({ valid: false }, 401)
  return json({
    valid: true, hasVoted: voter.hasVoted, votedAt: voter.votedAt,
    voter: {
      fullName: voter.fullName, matric: voter.matric,
      faculty: voter.faculty?.name, department: voter.department?.name, level: voter.level,
    },
  })
}

// POST /api/voter/session — clear the voter session.
export async function POST(req: NextRequest) {
  const token =
    req.headers.get('x-voter-token') ||
    req.headers.get('x-session-token') ||
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (token) {
    await db.voter.updateMany({ where: { sessionToken: token }, data: { sessionToken: null, sessionExpiresAt: null, sessionDeviceId: null } })
  }
  return json({ ok: true })
}
