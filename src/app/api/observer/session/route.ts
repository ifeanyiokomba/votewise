import { NextRequest } from 'next/server'
import { json } from '@/lib/election'
import { verifyToken, readTokenFromRequest } from '@/lib/auth'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = readTokenFromRequest(req)
  const payload = verifyToken(token)
  if (!payload || payload.role !== 'OBSERVER') return json({ valid: false }, 401)
  const observer = await db.observer.findUnique({ where: { email: payload.email } })
  if (!observer) return json({ valid: false }, 401)
  return json({ valid: true, observer: { id: observer.id, name: observer.name, email: observer.email, organization: observer.organization } })
}

export async function POST() {
  return json({ ok: true })
}
