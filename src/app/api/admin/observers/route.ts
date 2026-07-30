import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson, getClientIp, writeAudit } from '@/lib/election'
import { requireOfficial } from '@/lib/guards'
import { hashPassword, randomToken } from '@/lib/crypto'

export const dynamic = 'force-dynamic'

// GET /api/admin/observers — list officials (SUPER_ADMIN only).
export async function GET(req: NextRequest) {
  const auth = await requireOfficial(req, 'official.manage')
  if (auth instanceof Response) return auth
  const officials = await db.electionOfficial.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, email: true, name: true, role: true, scopeFacultyId: true, scopeDepartmentId: true, organization: true, totpEnabled: true, emailVerified: true, lastLoginAt: true, createdAt: true },
  })
  return json({ officials })
}

// POST /api/admin/observers — create official (SUPER_ADMIN only).
export async function POST(req: NextRequest) {
  const auth = await requireOfficial(req, 'official.manage')
  if (auth instanceof Response) return auth
  const body = await req.json().catch(() => ({}))
  const { name, email, role, organization, scopeFacultyId, scopeDepartmentId, password } = body
  if (!name || !email || !password || !role) return errorJson('name, email, password, role are required', 400)
  const exists = await db.electionOfficial.findUnique({ where: { email: String(email).toLowerCase() } })
  if (exists) return errorJson('Official with this email already exists', 409)
  const verifyToken = randomToken(20)
  const official = await db.electionOfficial.create({
    data: {
      name, email: String(email).toLowerCase(), role, organization: organization || null,
      scopeFacultyId: scopeFacultyId || null, scopeDepartmentId: scopeDepartmentId || null,
      passwordHash: hashPassword(password),
      emailVerified: true, // auto-verify in sandbox; in prod, email a link
      emailVerifyToken: verifyToken,
    },
  })
  await writeAudit({ actorId: (auth as any).official.id, actorRole: (auth as any).official.role, actorName: (auth as any).official.name, action: 'OFFICIAL_CREATE', details: { officialId: official.id, email, role }, ip: getClientIp(req) })
  console.log(`[official] created ${email} (role=${role}); temp password shown to admin only`)
  return json({ ok: true, official: { id: official.id, email: official.email, name: official.name, role: official.role } })
}
