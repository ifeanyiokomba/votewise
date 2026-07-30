import { NextRequest } from 'next/server'
import { json, errorJson, getClientIp, writeAudit } from '@/lib/election'
import { verifyPassword } from '@/lib/crypto'
import { signToken } from '@/lib/auth'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// POST /api/observer/login  body: { email, password }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const email = String(body.email || '').trim().toLowerCase()
  const password = String(body.password || '')
  if (!email || !password) return errorJson('Email and password are required', 400)
  const observer = await db.observer.findUnique({ where: { email } })
  if (!observer || !verifyPassword(password, observer.passwordHash)) return errorJson('Invalid credentials', 401)
  const token = signToken({ sub: observer.id, role: 'OBSERVER', name: observer.name, email: observer.email })
  await writeAudit({ actorId: observer.id, actorRole: 'OBSERVER', actorName: observer.name, action: 'OBSERVER_LOGIN', ip: getClientIp(req) })
  return json({ ok: true, token, observer: { id: observer.id, name: observer.name, email: observer.email, organization: observer.organization } })
}
