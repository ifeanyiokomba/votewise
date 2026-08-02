import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson, writeAudit, getClientIp } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { requireOfficial } from '@/lib/guards'

export const dynamic = 'force-dynamic'

const VALID_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'ESCALATED', 'CLOSED']
const VALID_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']

// PATCH /api/workspace/elections/[id]/support/[ticketId]
// Updates a single support ticket. Requires `ticket.triage`.
// Body (all optional): { status?, priority?, assignedToId?, assignedToName?, resolution? }
//
// - If status becomes RESOLVED or CLOSED, set `resolvedAt` to NOW and
//   `resolvedById` to the current official.
// - Writes an audit log entry describing the change.
//
// NOTE: uses raw SQL updates because the dev server may hold a stale
// Prisma client class after `prisma db push` regenerates the client (the
// new SupportTicket.electionId / assignedToName fields may not be
// recognized until a full process restart).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; ticketId: string }> }
) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult
  const { id, ticketId } = await params

  const officialRes = await requireOfficial(req, 'ticket.triage')
  if (officialRes instanceof Response) return officialRes
  const official = officialRes.official

  // Verify the election belongs to this org.
  const election = await db.electionSession.findUnique({
    where: { id },
    select: { id: true, name: true, organizationId: true },
  })
  if (!election || election.organizationId !== org.id) {
    return errorJson('Election not found', 404)
  }

  // Fetch the ticket via raw SQL (so we don't depend on the new model fields
  // being recognized by a possibly-stale Prisma client class).
  const rows: any[] = await db.$queryRawUnsafe(
    `SELECT id, electionId, organizationId, status, priority,
            assignedTo, assignedToName, resolvedAt, resolution
     FROM SupportTicket WHERE id = ?`,
    ticketId,
  )
  const ticket = rows[0]
  if (!ticket || ticket.electionId !== id || ticket.organizationId !== org.id) {
    return errorJson('Support ticket not found', 404)
  }

  const body = await req.json().catch(() => ({}))
  const sets: string[] = []
  const args: any[] = []
  const changes: string[] = []
  const nowIso = new Date().toISOString()

  // Status
  if (typeof body.status === 'string' && VALID_STATUSES.includes(body.status) && body.status !== ticket.status) {
    sets.push('status = ?')
    args.push(body.status)
    changes.push(`status: ${ticket.status} → ${body.status}`)

    // Set resolvedAt / resolvedById when moving to a terminal state.
    if (body.status === 'RESOLVED' || body.status === 'CLOSED') {
      sets.push('resolvedAt = ?')
      args.push(nowIso)
      sets.push('resolvedById = ?')
      args.push(official.id)
    } else if (ticket.resolvedAt) {
      // Reopening a previously-resolved ticket — clear the resolved timestamp.
      sets.push('resolvedAt = NULL')
      sets.push('resolvedById = NULL')
    }
  }

  // Priority
  if (typeof body.priority === 'string' && VALID_PRIORITIES.includes(body.priority) && body.priority !== ticket.priority) {
    sets.push('priority = ?')
    args.push(body.priority)
    changes.push(`priority: ${ticket.priority} → ${body.priority}`)
  }

  // Assignment — accepts assignedToId or assignedToName (or both).
  // The UI typically sends both together when assigning a ticket.
  const currentAssignedTo = ticket.assignedTo || null
  const currentAssignedToName = ticket.assignedToName || null
  const newAssigneeId = body.assignedToId === null ? null
    : (typeof body.assignedToId === 'string' && body.assignedToId.trim() ? body.assignedToId.trim() : undefined)
  const newAssigneeName = body.assignedToName === null ? null
    : (typeof body.assignedToName === 'string' && body.assignedToName.trim() ? body.assignedToName.trim() : undefined)

  if (newAssigneeId !== undefined && newAssigneeId !== currentAssignedTo) {
    sets.push('assignedTo = ?')
    args.push(newAssigneeId)
    changes.push(`assignedTo: ${currentAssignedTo || '—'} → ${newAssigneeId || '—'}`)
  }
  if (newAssigneeName !== undefined && newAssigneeName !== currentAssignedToName) {
    sets.push('assignedToName = ?')
    args.push(newAssigneeName)
    changes.push(`assignedToName: ${currentAssignedToName || '—'} → ${newAssigneeName || '—'}`)
  }

  // Resolution note (free text)
  const currentResolution = ticket.resolution || null
  if (typeof body.resolution === 'string' && body.resolution !== currentResolution) {
    sets.push('resolution = ?')
    args.push(body.resolution.trim() || null)
    changes.push('resolution updated')
  }

  if (changes.length === 0) {
    return json({ ok: true, changed: false, message: 'No changes detected.' })
  }

  // Always bump updatedAt.
  sets.push('updatedAt = ?')
  args.push(nowIso)

  args.push(ticketId)
  await db.$executeRawUnsafe(
    `UPDATE SupportTicket SET ${sets.join(', ')} WHERE id = ?`,
    ...args,
  )

  // Re-fetch the updated row for the response.
  const updatedRows: any[] = await db.$queryRawUnsafe(
    `SELECT id, electionId, organizationId, voterId, voterName, voterMatric,
            issueType, description, status, priority, assignedTo, assignedToName,
            openedBy, category, createdAt, updatedAt, resolvedAt, resolution
     FROM SupportTicket WHERE id = ?`,
    ticketId,
  )
  const updated = updatedRows[0]

  // Audit log.
  await writeAudit({
    actorId: official.id,
    actorRole: official.role,
    actorName: official.name,
    action: 'SUPPORT_TICKET_UPDATED',
    details: {
      organizationId: org.id,
      electionId: id,
      ticketId,
      changes,
    },
    ip: getClientIp(req),
    electionId: id,
  }).catch(() => {})

  return json({
    ok: true,
    changed: true,
    changes,
    ticket: {
      ...updated,
      createdAt: updated.createdAt instanceof Date ? updated.createdAt.toISOString() : String(updated.createdAt),
      updatedAt: updated.updatedAt instanceof Date ? updated.updatedAt.toISOString() : String(updated.updatedAt),
      resolvedAt: updated.resolvedAt instanceof Date ? updated.resolvedAt.toISOString() : (updated.resolvedAt ? String(updated.resolvedAt) : null),
    },
  })
}
