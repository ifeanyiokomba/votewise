import { NextRequest } from 'next/server'
import { json, errorJson, getClientIp, writeAudit } from '@/lib/election'
import { verifyPassword } from '@/lib/crypto'
import { signToken } from '@/lib/auth'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// POST /api/admin/login  body: { email, password }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const email = String(body.email || '').trim().toLowerCase()
  const password = String(body.password || '')
  if (!email || !password) return errorJson('Email and password are required', 400)

  const admin = await db.admin.findUnique({ where: { email } })
  if (!admin) return errorJson('Invalid credentials', 401)
  if (!verifyPassword(password, admin.passwordHash)) {
    await writeAudit({
      actorId: admin.id,
      actorRole: admin.role,
      actorName: admin.name,
      action: 'ADMIN_LOGIN_FAILED',
      ip: getClientIp(req),
    })
    return errorJson('Invalid credentials', 401)
  }

  const token = signToken({ sub: admin.id, role: admin.role as 'ADMIN' | 'SUPER_ADMIN', name: admin.name, email: admin.email })
  await writeAudit({
    actorId: admin.id,
    actorRole: admin.role,
    actorName: admin.name,
    action: 'ADMIN_LOGIN',
    ip: getClientIp(req),
  })
  return json({ ok: true, token, admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role } })
}
