import { NextRequest } from 'next/server'
import { json, errorJson, getClientIp, writeAudit } from '@/lib/election'
import { requireAdmin } from '@/lib/guards'
import { hashPassword } from '@/lib/crypto'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/admin/observers
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof Response) return auth
  const observers = await db.observer.findMany({ orderBy: { createdAt: 'desc' }, select: { id: true, email: true, name: true, organization: true, createdAt: true } })
  return json({ observers })
}

// POST /api/admin/observers  body: { name, email, organization, password }
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof Response) return auth
  const body = await req.json().catch(() => ({}))
  const { name, email, organization, password } = body
  if (!name || !email || !password) return errorJson('name, email, password are required', 400)
  const exists = await db.observer.findUnique({ where: { email: String(email).toLowerCase() } })
  if (exists) return errorJson('Observer with this email already exists', 409)
  const observer = await db.observer.create({
    data: { name, email: String(email).toLowerCase(), organization: organization || null, passwordHash: hashPassword(password) },
  })
  await writeAudit({ actorId: auth.admin!.id, actorRole: auth.admin!.role, actorName: auth.admin!.name, action: 'OBSERVER_CREATE', details: { observerId: observer.id, email }, ip: getClientIp(req) })
  return json({ ok: true, observer: { id: observer.id, email: observer.email, name: observer.name } })
}
