import { NextRequest } from 'next/server'
import { json, errorJson, getClientIp, writeAudit } from '@/lib/election'
import { requireObserver } from '@/lib/guards'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// PATCH /api/observer/tickets/[id]  body: { status, resolution, priority }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireObserver(req)
  if (auth instanceof Response) return auth
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const data: Record<string, unknown> = {}
  if (body.status) data.status = body.status
  if (body.priority) data.priority = body.priority
  if (typeof body.resolution === 'string') data.resolution = body.resolution
  if (body.status === 'RESOLVED' || body.status === 'CLOSED') {
    data.resolvedAt = new Date()
    data.resolvedById = auth.observer!.id
  }
  const ticket = await db.supportTicket.update({ where: { id }, data })
  await writeAudit({ actorId: auth.observer!.id, actorRole: 'OBSERVER', actorName: auth.observer!.name, action: 'TICKET_UPDATE', details: { ticketId: id, fields: Object.keys(data) }, ip: getClientIp(req) })
  return json({ ok: true, ticket })
}
