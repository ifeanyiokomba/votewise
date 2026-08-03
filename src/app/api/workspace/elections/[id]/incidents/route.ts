import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson, writeAudit, getClientIp } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { requirePermission } from '@/lib/iam'
import { getCurrentOfficial } from '@/lib/guards'

export const dynamic = 'force-dynamic'

const VALID_TYPES = ['VOTER_INTIMIDATION', 'SYSTEM_MALFUNCTION', 'IRREGULARITY', 'DISPUTE', 'TECHNICAL_ISSUE', 'OTHER']
const VALID_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
const VALID_STATUSES = ['OPEN', 'INVESTIGATING', 'RESOLVED', 'ESCALATED', 'DISMISSED']

// Verify the election belongs to the resolved organization and return it.
async function getOrgElection(orgId: string, electionId: string) {
  const election = await db.electionSession.findUnique({
    where: { id: electionId },
    select: { id: true, name: true, organizationId: true, status: true },
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

// GET /api/workspace/elections/[id]/incidents
// Returns all incidents for an election. Query params:
//   ?status=...&severity=...&type=...&search=...
// Returns incidents + stats (total, open, critical, resolved). Org-scoped via
// requireOrganization — anyone authenticated inside the org can view.
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

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const severity = searchParams.get('severity')
  const type = searchParams.get('type')
  const search = searchParams.get('search')?.trim()

  // Build where clause (only valid filter values accepted).
  const where: any = { electionId, organizationId: org.id }
  if (status && VALID_STATUSES.includes(status)) where.status = status
  if (severity && VALID_SEVERITIES.includes(severity)) where.severity = severity
  if (type && VALID_TYPES.includes(type)) where.type = type
  if (search) {
    where.OR = [
      { title: { contains: search } },
      { description: { contains: search } },
      { location: { contains: search } },
      { reportedByName: { contains: search } },
    ]
  }

  const incidents = await db.electionIncident.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }],
    take: 200,
  })

  // Compute stats over the entire election's incident set (independent of filters).
  const allIncidents = await db.electionIncident.findMany({
    where: { electionId, organizationId: org.id },
    select: { status: true, severity: true, type: true },
  })

  const stats = {
    total: allIncidents.length,
    open: allIncidents.filter((i) => i.status === 'OPEN').length,
    investigating: allIncidents.filter((i) => i.status === 'INVESTIGATING').length,
    resolved: allIncidents.filter((i) => i.status === 'RESOLVED' || i.status === 'DISMISSED').length,
    escalated: allIncidents.filter((i) => i.status === 'ESCALATED').length,
    critical: allIncidents.filter((i) => i.severity === 'CRITICAL').length,
    bySeverity: {
      LOW: allIncidents.filter((i) => i.severity === 'LOW').length,
      MEDIUM: allIncidents.filter((i) => i.severity === 'MEDIUM').length,
      HIGH: allIncidents.filter((i) => i.severity === 'HIGH').length,
      CRITICAL: allIncidents.filter((i) => i.severity === 'CRITICAL').length,
    },
    byStatus: {
      OPEN: allIncidents.filter((i) => i.status === 'OPEN').length,
      INVESTIGATING: allIncidents.filter((i) => i.status === 'INVESTIGATING').length,
      RESOLVED: allIncidents.filter((i) => i.status === 'RESOLVED').length,
      ESCALATED: allIncidents.filter((i) => i.status === 'ESCALATED').length,
      DISMISSED: allIncidents.filter((i) => i.status === 'DISMISSED').length,
    },
    byType: VALID_TYPES.reduce((acc, t) => {
      acc[t] = allIncidents.filter((i) => i.type === t).length
      return acc
    }, {} as Record<string, number>),
  }

  return json({
    incidents: incidents.map(serialize),
    stats,
    electionId,
    electionName: election.name,
  })
}

// POST /api/workspace/elections/[id]/incidents
// Reports a new incident. Body: { type, severity, title, description, location?, affectedVoterId? }
// Requires: support.handle permission (observers + officials with triage rights).
// Also creates an ElectionEvent for the incident so it shows up in the audit timeline.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePermission(req, 'support.handle')
  if (ctx instanceof Response) return ctx
  if (!ctx.org) return errorJson('Organization not found', 404)
  const { id: electionId } = await params

  const election = await getOrgElection(ctx.org.id, electionId)
  if (!election) return errorJson('Election not found', 404)

  const body = await req.json().catch(() => ({}))
  const type = typeof body.type === 'string' ? body.type.trim() : ''
  const severity = typeof body.severity === 'string' ? body.severity.trim() : 'MEDIUM'
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  const location = typeof body.location === 'string' && body.location.trim() ? body.location.trim() : null
  const affectedVoterId = typeof body.affectedVoterId === 'string' && body.affectedVoterId.trim() ? body.affectedVoterId.trim() : null

  if (!VALID_TYPES.includes(type)) return errorJson('A valid incident type is required', 400)
  if (!VALID_SEVERITIES.includes(severity)) return errorJson('A valid severity is required', 400)
  if (!title) return errorJson('A title is required', 400)
  if (!description) return errorJson('A description is required', 400)
  if (description.length > 10000) return errorJson('Description is too long (max 10000 chars)', 400)

  // Capture reporter + device context for forensic evidence.
  const reporterName = ctx.user.name || ctx.user.email || 'Unknown Observer'
  const meta = JSON.stringify({
    device: ctx.device,
    ip: ctx.ip,
    reportedAt: new Date().toISOString(),
  })

  const incident = await db.electionIncident.create({
    data: {
      organizationId: ctx.org.id,
      electionId,
      reportedById: ctx.user.id,
      reportedByName: reporterName,
      type,
      severity,
      status: 'OPEN',
      title,
      description,
      location,
      affectedVoterId,
      metadata: meta,
    },
  })

  // Timeline event so the incident shows up in the audit chain.
  await db.electionEvent.create({
    data: {
      electionId,
      organizationId: ctx.org.id,
      eventType: 'INCIDENT_REPORTED',
      description: `${severity} incident reported: ${title}`,
      actorId: ctx.user.id,
      actorName: reporterName,
      metadata: JSON.stringify({
        incidentId: incident.id,
        type,
        severity,
        location,
        title,
      }),
    },
  }).catch(() => {})

  await writeAudit({
    actorId: ctx.user.id,
    actorRole: ctx.user.role,
    actorName: reporterName,
    action: 'INCIDENT_REPORTED',
    details: {
      organizationId: ctx.org.id,
      electionId,
      incidentId: incident.id,
      type,
      severity,
      title,
      location,
    },
    ip: getClientIp(req),
    electionId,
  }).catch(() => {})

  return json({ ok: true, incident: serialize(incident) }, 201)
}
