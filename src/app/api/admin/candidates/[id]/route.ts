import { NextRequest } from 'next/server'
import { json, errorJson, getClientIp, writeAudit } from '@/lib/election'
import { requireAdmin } from '@/lib/guards'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// PATCH /api/admin/candidates/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req)
  if (auth instanceof Response) return auth
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const allowed = ['fullName', 'facultyId', 'departmentId', 'level', 'slogan', 'manifesto', 'photoUrl', 'status', 'displayOrder']
  const data: Record<string, unknown> = {}
  for (const k of allowed) if (k in body) data[k] = body[k] ?? null
  if (data.fullName) {
    data.slug = String(data.fullName).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Math.random().toString(36).slice(2, 6)
  }
  const candidate = await db.candidate.update({ where: { id }, data })
  await writeAudit({ actorId: auth.admin!.id, actorRole: auth.admin!.role, actorName: auth.admin!.name, action: 'CANDIDATE_UPDATE', details: { candidateId: id, fields: Object.keys(data) }, ip: getClientIp(req) })
  return json({ ok: true, candidate })
}

// DELETE /api/admin/candidates/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req)
  if (auth instanceof Response) return auth
  const { id } = await params
  await db.candidate.delete({ where: { id } })
  await writeAudit({ actorId: auth.admin!.id, actorRole: auth.admin!.role, actorName: auth.admin!.name, action: 'CANDIDATE_DELETE', details: { candidateId: id }, ip: getClientIp(req) })
  return json({ ok: true })
}
