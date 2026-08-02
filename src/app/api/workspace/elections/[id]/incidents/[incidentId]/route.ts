import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson, writeAudit, getClientIp } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { requirePermission } from '@/lib/iam'

export const dynamic = 'force-dynamic'

const VALID_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
const VALID_STATUSES = ['OPEN', 'INVESTIGATING', 'RESOLVED', 'ESCALATED', 'DISMISSED']

async function getOrgElection(orgId: string, electionId: string) {
  const election = await db.electionSession.findUnique({
    where: { id: electionId },
    select: { id: true, name: true, organizationId: true },
  })
  if (!election || election.organizationId !== orgId) return null
  return election
}

function serialize(i: any) {
  return {
    ...i,
    createdAt: i.createdAt instanceof Date ? i.createdAt.toISOString() : String(i.createdAt),
    updatedAt: i.updatedAt instanceof Date ? i.updatedAt.toISOString() : String(i.updatedAt),
    resolvedAt: i.resolvedAt instanceof Date ? i.resolvedAt.toISOString() : (i.resolvedAt ? String(i.resolvedAt) : null),
  }
}

// PATCH /api/workspace/elections/[id]/incidents/[incidentId]
// Updates a single incident. Body (all optional):
//   { status?, severity?, assignedToId?, assignedToName?, resolutionNotes? }
// - When status becomes RESOLVED or DISMISSED, sets resolvedAt = NOW.
// - When status moves away from terminal, clears resolvedAt.
// - Requires: support.handle permission (observers + officials with triage rights).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; incidentId: string }> }
) {
  const ctx = await requirePermission(req, 'support.handle')
  if (ctx instanceof Response) return ctx
  if (!ctx.org) return errorJson('Organization not found', 404)
  const { id: electionId, incidentId } = await params

  const election = await getOrgElection(ctx.org.id, electionId)
  if (!election) return errorJson('Election not found', 404)

  // Fetch the incident, scoped to (electionId, orgId) for tenant isolation.
  const incident = await db.electionIncident.findFirst({
    where: { id: incidentId, electionId, organizationId: ctx.org.id },
  })
  if (!incident) return errorJson('Incident not found', 404)

  const body = await req.json().catch(() => ({}))
  const sets: any = {}
  const changes: string[] = []
  const now = new Date()

  // Status
  if (typeof body.status === 'string' && VALID_STATUSES.includes(body.status) && body.status !== incident.status) {
    sets.status = body.status
    changes.push(`status: ${incident.status} → ${body.status}`)

    // Auto-set / clear resolvedAt.
    if (body.status === 'RESOLVED' || body.status === 'DISMISSED') {
      sets.resolvedAt = now
    } else if (incident.resolvedAt) {
      sets.resolvedAt = null
    }
  }

  // Severity
  if (typeof body.severity === 'string' && VALID_SEVERITIES.includes(body.severity) && body.severity !== incident.severity) {
    sets.severity = body.severity
    changes.push(`severity: ${incident.severity} → ${body.severity}`)
  }

  // Assignment
  if (body.assignedToId === null || (typeof body.assignedToId === 'string' && body.assignedToId.trim())) {
    const newId = body.assignedToId === null ? null : body.assignedToId.trim()
    if (newId !== incident.assignedToId) {
      sets.assignedToId = newId
      changes.push(`assignedToId: ${incident.assignedToId || '—'} → ${newId || '—'}`)
    }
  }
  if (body.assignedToName === null || (typeof body.assignedToName === 'string' && body.assignedToName.trim())) {
    const newName = body.assignedToName === null ? null : body.assignedToName.trim()
    if (newName !== incident.assignedToName) {
      sets.assignedToName = newName
      changes.push(`assignedToName: ${incident.assignedToName || '—'} → ${newName || '—'}`)
    }
  }

  // Resolution notes
  if (typeof body.resolutionNotes === 'string' && body.resolutionNotes !== (incident.resolutionNotes || '')) {
    sets.resolutionNotes = body.resolutionNotes.trim() || null
    changes.push('resolution notes updated')
  }

  if (changes.length === 0) {
    return json({ ok: true, changed: false, message: 'No changes detected.', incident: serialize(incident) })
  }

  sets.updatedAt = now
  const updated = await db.electionIncident.update({
    where: { id: incidentId },
    data: sets,
  })

  // Emit a timeline event if the status changed (escalations especially).
  if (sets.status) {
    await db.electionEvent.create({
      data: {
        electionId,
        organizationId: ctx.org.id,
        eventType: sets.status === 'ESCALATED' ? 'INCIDENT_ESCALATED' : 'INCIDENT_UPDATED',
        description: `Incident "${incident.title}" → ${sets.status}`,
        actorId: ctx.user.id,
        actorName: ctx.user.name,
        metadata: JSON.stringify({
          incidentId,
          previousStatus: incident.status,
          newStatus: sets.status,
          severity: sets.severity || incident.severity,
        }),
      },
    }).catch(() => {})
  }

  await writeAudit({
    actorId: ctx.user.id,
    actorRole: ctx.user.role,
    actorName: ctx.user.name,
    action: 'INCIDENT_UPDATED',
    details: {
      organizationId: ctx.org.id,
      electionId,
      incidentId,
      changes,
    },
    ip: getClientIp(req),
    electionId,
  }).catch(() => {})

  return json({ ok: true, changed: true, changes, incident: serialize(updated) })
}
