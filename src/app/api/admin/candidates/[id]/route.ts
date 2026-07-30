import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson, getClientIp, writeAudit } from '@/lib/election'
import { requireOfficial } from '@/lib/guards'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOfficial(req, 'candidate.screen')
  if (auth instanceof Response) return auth
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const allowed = ['fullName', 'facultyId', 'departmentId', 'level', 'slogan', 'manifesto', 'campaignVideoUrl', 'photoUrl', 'status', 'displayOrder', 'politicalPartyId', 'screeningStatus', 'screeningNotes', 'cgpa']
  const data: Record<string, unknown> = {}
  for (const k of allowed) if (k in body) data[k] = body[k] ?? null
  if (body.screeningStatus) { data.screenedById = (auth as any).official.id; data.screenedAt = new Date() }
  if (data.fullName) data.slug = String(data.fullName).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Math.random().toString(36).slice(2, 6)
  const candidate = await db.candidate.update({ where: { id }, data })
  await writeAudit({ actorId: (auth as any).official.id, actorRole: (auth as any).official.role, actorName: (auth as any).official.name, action: 'CANDIDATE_UPDATE', details: { candidateId: id, fields: Object.keys(data) }, ip: getClientIp(req) })
  return json({ ok: true, candidate })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOfficial(req, 'candidate.screen')
  if (auth instanceof Response) return auth
  const { id } = await params
  await db.candidate.delete({ where: { id } })
  await writeAudit({ actorId: (auth as any).official.id, actorRole: (auth as any).official.role, actorName: (auth as any).official.name, action: 'CANDIDATE_DELETE', details: { candidateId: id }, ip: getClientIp(req) })
  return json({ ok: true })
}
