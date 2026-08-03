import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const VALID_TYPES = ['VOTER_INTIMIDATION', 'SYSTEM_MALFUNCTION', 'IRREGULARITY', 'DISPUTE', 'TECHNICAL_ISSUE', 'OTHER']

async function getOrgElection(orgId: string, electionId: string) {
  const election = await db.electionSession.findUnique({
    where: { id: electionId },
    select: { id: true, name: true, organizationId: true, status: true },
  })
  if (!election || election.organizationId !== orgId) return null
  return election
}

// GET /api/workspace/elections/[id]/incidents/stats
// Returns real-time incident stats for the observer dashboard. Org-scoped via
// requireOrganization. Stats:
//   { total, bySeverity, byStatus, byType, recent: [last 5 incidents], criticalCount }
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Auth check — closes the endpoint authentication gap (audit finding)
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth) return errorJson('Unauthorized', 401)
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult
  const { id: electionId } = await params

  const election = await getOrgElection(org.id, electionId)
  if (!election) return errorJson('Election not found', 404)

  const allIncidents = await db.electionIncident.findMany({
    where: { electionId, organizationId: org.id },
    select: {
      id: true, type: true, severity: true, status: true,
      title: true, description: true, location: true,
      reportedByName: true, createdAt: true, resolvedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  const bySeverity = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 }
  const byStatus = { OPEN: 0, INVESTIGATING: 0, RESOLVED: 0, ESCALATED: 0, DISMISSED: 0 }
  const byType: Record<string, number> = VALID_TYPES.reduce((acc, t) => { acc[t] = 0; return acc }, {} as Record<string, number>)

  for (const i of allIncidents) {
    if (i.severity in bySeverity) bySeverity[i.severity as keyof typeof bySeverity]++
    if (i.status in byStatus) byStatus[i.status as keyof typeof byStatus]++
    if (i.type in byType) byType[i.type]++
  }

  const criticalCount = bySeverity.CRITICAL
  const openCount = byStatus.OPEN
  const resolvedCount = byStatus.RESOLVED + byStatus.DISMISSED

  const recent = allIncidents.slice(0, 5).map((i) => ({
    ...i,
    createdAt: i.createdAt instanceof Date ? i.createdAt.toISOString() : String(i.createdAt),
    resolvedAt: i.resolvedAt instanceof Date ? i.resolvedAt.toISOString() : (i.resolvedAt ? String(i.resolvedAt) : null),
  }))

  return json({
    total: allIncidents.length,
    open: openCount,
    critical: criticalCount,
    resolved: resolvedCount,
    escalated: byStatus.ESCALATED,
    bySeverity,
    byStatus,
    byType,
    recent,
    electionId,
    electionName: election.name,
    electionStatus: election.status,
  })
}
