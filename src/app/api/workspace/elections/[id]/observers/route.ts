import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson, writeAudit, getClientIp } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { requirePermission } from '@/lib/iam'
import { getCurrentOfficial } from '@/lib/guards'

export const dynamic = 'force-dynamic'

// Verify the election belongs to the resolved organization and return it.
async function getOrgElection(orgId: string, electionId: string) {
  const election = await db.electionSession.findUnique({
    where: { id: electionId },
    select: {
      id: true,
      name: true,
      organizationId: true,
      workspaceId: true,
      status: true,
    },
  })
  if (!election || election.organizationId !== orgId) return null
  return election
}

// GET /api/workspace/elections/[id]/observers — list observers assigned to this
// election. Observers are OrganizationMembers with role OBSERVER who have been
// explicitly assigned via an OBSERVER_ASSIGNED ElectionEvent, plus any
// UnitObserverAssignments for the election's workspace.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Auth check — closes the endpoint authentication gap (audit finding)
  const official = await getCurrentOfficial(req)
  if (!official) return errorJson('Unauthorized', 401)
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult
  const { id: electionId } = await params

  const election = await getOrgElection(org.id, electionId)
  if (!election) return errorJson('Election not found', 404)

  // 1. Election-scoped observer assignments — recorded as ElectionEvents of
  //    type OBSERVER_ASSIGNED. Removals are tracked as OBSERVER_REMOVED.
  //    We replay events to compute the current set of active observers.
  const assignEvents = await db.electionEvent.findMany({
    where: {
      electionId,
      eventType: { in: ['OBSERVER_ASSIGNED', 'OBSERVER_REMOVED'] },
    },
    orderBy: { createdAt: 'asc' },
  })

  // Build a map of observerId → latest event (so removals override assignments).
  const latestByObserver = new Map<string, { type: string; event: any }>()
  for (const ev of assignEvents) {
    let meta: any = {}
    try { meta = JSON.parse(ev.metadata || '{}') } catch {}
    const key = meta.observerId || meta.memberEmail || ev.actorId || ev.id
    latestByObserver.set(key, { type: ev.eventType, event: ev })
  }

  const activeKeys = new Set<string>()
  const eventByKey = new Map<string, any>()
  for (const [key, val] of latestByObserver.entries()) {
    if (val.type === 'OBSERVER_ASSIGNED') {
      activeKeys.add(key)
      eventByKey.set(key, val.event)
    }
  }

  // Load full member details for each assigned observer.
  const memberEmails: string[] = []
  const memberIds: string[] = []
  for (const ev of eventByKey.values()) {
    let meta: any = {}
    try { meta = JSON.parse(ev.metadata || '{}') } catch {}
    if (meta.memberEmail) memberEmails.push(String(meta.memberEmail).toLowerCase())
    if (meta.memberId) memberIds.push(meta.memberId)
  }

  const members = memberEmails.length || memberIds.length
    ? await db.organizationMember.findMany({
        where: {
          organizationId: org.id,
          role: 'OBSERVER',
          OR: [
            ...(memberIds.length ? [{ id: { in: memberIds } }] : []),
            ...(memberEmails.length ? [{ email: { in: memberEmails } }] : []),
          ],
        },
        select: {
          id: true, email: true, name: true, role: true, accountStatus: true,
          lastLoginAt: true, createdAt: true, avatarUrl: true, title: true,
        },
      })
    : []

  const memberByEmail = new Map<string, any>()
  const memberById = new Map<string, any>()
  for (const m of members) {
    memberByEmail.set(m.email.toLowerCase(), m)
    memberById.set(m.id, m)
  }

  // Activity summary: tickets handled + searches performed by each observer.
  // We approximate "tickets handled" by SupportTicket.assignedTo === observer email/id,
  // and "searches performed" by AuditLog action 'OBSERVER_VOTER_SEARCH' with actorId.
  const supportTickets = memberEmails.length
    ? await db.supportTicket.findMany({
        where: { organizationId: org.id, assignedTo: { in: memberEmails } },
        select: { assignedTo: true, status: true },
      })
    : []

  const ticketsByObserver = new Map<string, number>()
  for (const t of supportTickets) {
    if (!t.assignedTo) continue
    const key = String(t.assignedTo).toLowerCase()
    ticketsByObserver.set(key, (ticketsByObserver.get(key) || 0) + 1)
  }

  const searchLogs = memberIds.length
    ? await db.auditLog.findMany({
        where: {
          actorId: { in: memberIds },
          action: { contains: 'SEARCH' },
        },
        select: { actorId: true, createdAt: true },
      })
    : []

  const searchesByObserver = new Map<string, number>()
  const lastActiveByObserver = new Map<string, Date>()
  for (const log of searchLogs) {
    searchesByObserver.set(log.actorId, (searchesByObserver.get(log.actorId) || 0) + 1)
    const existing = lastActiveByObserver.get(log.actorId)
    if (!existing || log.createdAt > existing) lastActiveByObserver.set(log.actorId, log.createdAt)
  }

  const observers: any[] = []
  for (const [key, ev] of eventByKey.entries()) {
    let meta: any = {}
    try { meta = JSON.parse(ev.metadata || '{}') } catch {}
    const member = (meta.memberEmail && memberByEmail.get(String(meta.memberEmail).toLowerCase())) ||
      (meta.memberId && memberById.get(meta.memberId)) || null
    const email = meta.memberEmail || member?.email || ''
    const name = meta.memberName || member?.name || email
    const ticketsHandled = ticketsByObserver.get(String(email).toLowerCase()) || 0
    const searchesPerformed = (member && searchesByObserver.get(member.id)) || 0
    const lastActive = (member && lastActiveByObserver.get(member.id)) || member?.lastLoginAt || ev.createdAt
    observers.push({
      id: meta.observerId || member?.id || key,
      memberId: member?.id || meta.memberId || null,
      name,
      email,
      title: member?.title || null,
      avatarUrl: member?.avatarUrl || null,
      accountStatus: member?.accountStatus || 'PENDING',
      assignedAt: ev.createdAt,
      assignedBy: ev.actorName || null,
      scope: 'election',
      scopeLabel: 'Election-wide',
      ticketsHandled,
      searchesPerformed,
      lastActive,
      activity: buildActivityLog(ev, member, ticketsHandled, searchesPerformed, lastActive),
    })
  }

  // 2. Unit-scoped observers — UnitObserverAssignment for the election's
  //    workspace (if set). These observe at the unit level but are surfaced
  //    here so election owners can see everyone monitoring their election.
  let unitObservers: any[] = []
  if (election.workspaceId) {
    const unitAssignments = await db.unitObserverAssignment.findMany({
      where: { workspaceId: election.workspaceId, status: 'ACTIVE' },
      orderBy: { assignedAt: 'desc' },
    })
    for (const a of unitAssignments) {
      // Skip if this observer is also assigned election-wide (avoid duplicates).
      if (observers.some((o) => o.email.toLowerCase() === a.memberEmail.toLowerCase())) continue
      const ticketsHandled = ticketsByObserver.get(a.memberEmail.toLowerCase()) || 0
      const member = memberByEmail.get(a.memberEmail.toLowerCase())
      const searchesPerformed = (member && searchesByObserver.get(member.id)) || 0
      const lastActive = (member && lastActiveByObserver.get(member.id)) || member?.lastLoginAt || a.assignedAt
      unitObservers.push({
        id: a.id,
        memberId: a.memberId || member?.id || null,
        name: a.memberName,
        email: a.memberEmail,
        title: member?.title || null,
        avatarUrl: member?.avatarUrl || null,
        accountStatus: member?.accountStatus || 'ACTIVE',
        assignedAt: a.assignedAt,
        assignedBy: null,
        scope: 'unit',
        scopeLabel: 'Unit',
        ticketsHandled,
        searchesPerformed,
        lastActive,
        activity: buildActivityLog({ createdAt: a.assignedAt, actorName: null }, member, ticketsHandled, searchesPerformed, lastActive),
      })
    }
  }

  const allObservers = [...observers, ...unitObservers]
  const now = new Date()
  const activeToday = allObservers.filter((o) => {
    if (!o.lastActive) return false
    const d = new Date(o.lastActive)
    return (now.getTime() - d.getTime()) < 24 * 60 * 60 * 1000
  }).length

  const totalTickets = allObservers.reduce((s, o) => s + (o.ticketsHandled || 0), 0)

  return json({
    observers: allObservers,
    stats: {
      total: allObservers.length,
      activeToday,
      ticketsHandled: totalTickets,
    },
    election: { id: election.id, name: election.name, status: election.status },
  })
}

// POST /api/workspace/elections/[id]/observers — assign an observer to this
// election. Body: { memberEmail } | { memberId } | { memberEmail, memberName, invite?: true }
// Requires: org.members permission (org owner / admin).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePermission(req, 'org.members')
  if (ctx instanceof Response) return ctx
  if (!ctx.org) return errorJson('Organization not found', 404)
  const { id: electionId } = await params

  const election = await getOrgElection(ctx.org.id, electionId)
  if (!election) return errorJson('Election not found', 404)

  const body = await req.json().catch(() => ({}))
  const { memberEmail, memberId, memberName, invite } = body

  if (!memberEmail && !memberId) {
    return errorJson('memberEmail or memberId is required', 400)
  }

  // Resolve the target member.
  let member: any = null
  if (memberId) {
    member = await db.organizationMember.findFirst({
      where: { id: memberId, organizationId: ctx.org.id },
    })
  } else if (memberEmail) {
    const emailLower = String(memberEmail).toLowerCase().trim()
    member = await db.organizationMember.findFirst({
      where: { email: emailLower, organizationId: ctx.org.id },
    })
  }

  if (!member && !invite) {
    return errorJson('No organization member found with that email. Pass invite=true to send an invitation instead.', 404)
  }

  // If the member exists but is not an OBSERVER, upgrade them.
  if (member && member.role !== 'OBSERVER') {
    // Soft-touch: only upgrade if they're a VOTER. We never silently downgrade admins.
    if (member.role === 'VOTER' || member.role === 'GUEST') {
      await db.organizationMember.update({
        where: { id: member.id },
        data: { role: 'OBSERVER' },
      }).catch(() => {})
    }
  }

  const observerId = member?.id || `pending-${Date.now()}`
  const emailLower = String(memberEmail || member?.email || '').toLowerCase().trim()
  const displayName = memberName || member?.name || emailLower

  // Check if already assigned (latest event is OBSERVER_ASSIGNED).
  const existing = await db.electionEvent.findFirst({
    where: {
      electionId,
      eventType: { in: ['OBSERVER_ASSIGNED', 'OBSERVER_REMOVED'] },
      OR: [
        { metadata: { contains: emailLower } },
        ...(member ? [{ metadata: { contains: member.id } }] : []),
      ],
    },
    orderBy: { createdAt: 'desc' },
  })

  if (existing && existing.eventType === 'OBSERVER_ASSIGNED') {
    return errorJson('This observer is already assigned to the election.', 409)
  }

  // Create an OBSERVER_ASSIGNED event to record the assignment.
  await db.electionEvent.create({
    data: {
      electionId,
      organizationId: ctx.org.id,
      eventType: 'OBSERVER_ASSIGNED',
      description: `Observer assigned: ${displayName} <${emailLower}>`,
      actorId: ctx.user.id,
      actorName: ctx.user.name,
      metadata: JSON.stringify({
        observerId,
        memberId: member?.id || null,
        memberEmail: emailLower,
        memberName: displayName,
        scope: 'election',
        invited: !member,
      }),
    },
  })

  await writeAudit({
    actorId: ctx.user.id,
    actorRole: ctx.user.role,
    actorName: ctx.user.name,
    action: 'OBSERVER_ASSIGNED_TO_ELECTION',
    details: {
      organizationId: ctx.org.id,
      electionId,
      electionName: election.name,
      observerEmail: emailLower,
      observerName: displayName,
      invited: !member,
    },
    ip: getClientIp(req),
  }).catch(() => {})

  return json({
    ok: true,
    observer: {
      id: observerId,
      memberId: member?.id || null,
      name: displayName,
      email: emailLower,
      scope: 'election',
      invited: !member,
    },
    message: member
      ? `${displayName} is now observing this election.`
      : `Invitation sent to ${emailLower}. They'll appear here once they accept.`,
  })
}

// DELETE /api/workspace/elections/[id]/observers?observerId=... — remove an
// observer assignment from this election.
// Requires: org.members permission.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePermission(req, 'org.members')
  if (ctx instanceof Response) return ctx
  if (!ctx.org) return errorJson('Organization not found', 404)
  const { id: electionId } = await params

  const election = await getOrgElection(ctx.org.id, electionId)
  if (!election) return errorJson('Election not found', 404)

  const { searchParams } = new URL(req.url)
  const observerId = searchParams.get('observerId')
  if (!observerId) return errorJson('observerId query parameter is required', 400)

  // Find the latest OBSERVER_ASSIGNED event for this observerId.
  const assigned = await db.electionEvent.findFirst({
    where: {
      electionId,
      eventType: 'OBSERVER_ASSIGNED',
      OR: [
        { metadata: { contains: observerId } },
      ],
    },
    orderBy: { createdAt: 'desc' },
  })

  if (!assigned) {
    return errorJson('Observer assignment not found.', 404)
  }

  let meta: any = {}
  try { meta = JSON.parse(assigned.metadata || '{}') } catch {}

  // Record the removal.
  await db.electionEvent.create({
    data: {
      electionId,
      organizationId: ctx.org.id,
      eventType: 'OBSERVER_REMOVED',
      description: `Observer removed: ${meta.memberName || meta.memberEmail || observerId}`,
      actorId: ctx.user.id,
      actorName: ctx.user.name,
      metadata: JSON.stringify({
        observerId,
        memberId: meta.memberId || null,
        memberEmail: meta.memberEmail || '',
        memberName: meta.memberName || '',
      }),
    },
  })

  await writeAudit({
    actorId: ctx.user.id,
    actorRole: ctx.user.role,
    actorName: ctx.user.name,
    action: 'OBSERVER_REMOVED_FROM_ELECTION',
    details: {
      organizationId: ctx.org.id,
      electionId,
      observerEmail: meta.memberEmail || '',
      observerName: meta.memberName || '',
    },
    ip: getClientIp(req),
  }).catch(() => {})

  return json({ ok: true, message: 'Observer removed from this election.' })
}

// Build a small activity log for an observer (shown when "View Activity" is
// clicked in the UI). Returns an array of { label, value } pairs.
function buildActivityLog(ev: any, member: any, ticketsHandled: number, searchesPerformed: number, lastActive: any): any[] {
  const log: { label: string; value: string; ts?: string }[] = []
  log.push({ label: 'Assigned to election', value: ev.actorName ? `by ${ev.actorName}` : 'System', ts: ev.createdAt })
  if (member?.lastLoginAt) {
    log.push({ label: 'Last sign-in', value: 'Observer signed in', ts: member.lastLoginAt })
  }
  if (searchesPerformed > 0) {
    log.push({ label: 'Voter searches', value: `${searchesPerformed} search${searchesPerformed === 1 ? '' : 'es'}` })
  }
  if (ticketsHandled > 0) {
    log.push({ label: 'Tickets handled', value: `${ticketsHandled} ticket${ticketsHandled === 1 ? '' : 's'}` })
  }
  if (lastActive) {
    log.push({ label: 'Last active', value: 'Recorded activity', ts: lastActive })
  }
  return log
}
