import { NextRequest } from 'next/server'
import { json } from '@/lib/election'
import { verifyToken, readTokenFromRequest } from '@/lib/auth'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/admin/session
export async function GET(req: NextRequest) {
  const token = readTokenFromRequest(req)
  const payload = verifyToken(token)
  if (!payload || (payload.role !== 'ADMIN' && payload.role !== 'SUPER_ADMIN')) return json({ valid: false }, 401)
  const admin = await db.admin.findUnique({ where: { email: payload.email } })
  if (!admin) return json({ valid: false }, 401)
  return json({ valid: true, admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role } })
}

export async function POST() {
  // logout is stateless (token is HMAC) — client just discards it.
  return json({ ok: true })
}
