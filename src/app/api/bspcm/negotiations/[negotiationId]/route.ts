import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { verifyAccessToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// PATCH /api/bspcm/negotiations/[negotiationId] — Update negotiation
// Body: { action: 'counter_offer' | 'accept' | 'reject' | 'add_message', message?, agreedAmount? }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ negotiationId: string }> }) {
  const { negotiationId } = await params
  const body = await req.json().catch(() => ({}))
  const auth = verifyAccessToken(req)
  const isAdmin = auth?.role === 'SUPER_ADMIN'

  const negotiation = await db.negotiation.findUnique({ where: { id: negotiationId } })
  if (!negotiation) return errorJson('Negotiation not found', 404)

  // Non-admins can only add messages to their own negotiations
  if (!isAdmin) {
    const orgResult = await requireOrganization(req)
    if ('error' in orgResult) return orgResult.error
    if (negotiation.organizationId !== orgResult.id) {
      return errorJson('Negotiation not found', 404)
    }
  }

  const thread = negotiation.thread ? JSON.parse(negotiation.thread) : []
  const data: any = {}

  switch (body.action) {
    case 'add_message':
      thread.push({ author: auth?.email || 'User', message: body.message, timestamp: new Date().toISOString(), role: isAdmin ? 'ADMIN' : 'ORG' })
      data.thread = JSON.stringify(thread)
      break
    case 'counter_offer':
      data.status = 'COUNTER_OFFERED'
      data.agreedAmount = body.agreedAmount || null
      data.assignedToId = auth?.sub
      data.assignedToName = auth?.email
      thread.push({ author: auth?.email || 'Admin', message: body.message || 'Counter offer', timestamp: new Date().toISOString(), role: 'ADMIN' })
      data.thread = JSON.stringify(thread)
      break
    case 'accept':
      data.status = 'ACCEPTED'
      data.agreedAmount = body.agreedAmount || negotiation.proposedAmount
      data.resolvedAt = new Date()
      data.resolvedById = auth?.sub
      data.resolvedByName = auth?.email
      break
    case 'reject':
      data.status = 'REJECTED'
      data.resolvedAt = new Date()
      data.resolvedById = auth?.sub
      data.resolvedByName = auth?.email
      break
    default:
      return errorJson(`Unknown action: ${body.action}`, 400)
  }

  const updated = await db.negotiation.update({ where: { id: negotiationId }, data })
  return json({ ok: true, negotiation: { ...updated, thread: JSON.parse(updated.thread || '[]') } })
}
