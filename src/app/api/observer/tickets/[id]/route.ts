import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson, getClientIp, writeAudit } from '@/lib/election'
import { requireOfficial } from '@/lib/guards'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOfficial(req, 'ticket.triage')
  if (auth instanceof Response) return auth
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const data: Record<string, unknown> = {}
  if (body.status) data.status = body.status
  if (body.priority) data.priority = body.priority
  if (typeof body.resolution === 'string') data.resolution = body.resolution
  if (body.status === 'RESOLVED' || body.status === 'CLOSED') {
    data.resolvedAt = new Date()
    data.resolvedById = (auth as any).official.id
  }
  const ticket = await db.supportTicket.update({ where: { id }, data })
  await writeAudit({ actorId: (auth as any).official.id, actorRole: (auth as any).official.role, actorName: (auth as any).official.name, action: 'TICKET_UPDATE', details: { ticketId: id, fields: Object.keys(data) }, ip: getClientIp(req) })
  return json({ ok: true, ticket })
}
