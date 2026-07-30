// Route-level auth guards for admin & observer API routes.
import { NextRequest } from 'next/server'
import { verifyToken, readTokenFromRequest, SessionPayload } from '@/lib/auth'
import { db } from '@/lib/db'

export interface AuthContext {
  payload: SessionPayload
  admin?: { id: string; email: string; name: string; role: string }
  observer?: { id: string; email: string; name: string }
}

export async function requireAdmin(req: NextRequest): Promise<AuthContext | Response> {
  const token = readTokenFromRequest(req)
  const payload = verifyToken(token)
  if (!payload || (payload.role !== 'ADMIN' && payload.role !== 'SUPER_ADMIN')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })
  }
  const admin = await db.admin.findUnique({ where: { email: payload.email } })
  if (!admin) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })
  }
  return { payload, admin }
}

export async function requireObserver(req: NextRequest): Promise<AuthContext | Response> {
  const token = readTokenFromRequest(req)
  const payload = verifyToken(token)
  if (!payload || payload.role !== 'OBSERVER') {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })
  }
  const observer = await db.observer.findUnique({ where: { email: payload.email } })
  if (!observer) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })
  }
  return { payload, observer }
}

// Voter session guard (DB-backed session token on the Voter row).
export async function requireVoter(req: NextRequest) {
  const token = req.headers.get('x-voter-token') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return { error: new Response(JSON.stringify({ error: 'No voter session' }), { status: 401, headers: { 'content-type': 'application/json' } }) }
  const voter = await db.voter.findUnique({ where: { sessionToken: token } })
  if (!voter || !voter.sessionExpiresAt || voter.sessionExpiresAt < new Date()) {
    return { error: new Response(JSON.stringify({ error: 'Voter session expired' }), { status: 401, headers: { 'content-type': 'application/json' } }) }
  }
  if (voter.hasVoted) {
    return { error: new Response(JSON.stringify({ error: 'You have already voted' }), { status: 403, headers: { 'content-type': 'application/json' } }) }
  }
  return { voter }
}
