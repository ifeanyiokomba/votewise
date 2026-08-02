import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'

export const dynamic = 'force-dynamic'

// GET /api/eifdirs/forensic-replay/[electionId] — Forensic timeline replay
// Reconstructs every significant event in chronological order for investigation.
export async function GET(req: NextRequest, { params }: { params: Promise<{ electionId: string }> }) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error

  const { electionId } = await params

  const election = await db.electionSession.findUnique({
    where: { id: electionId },
    select: { id: true, name: true, status: true, startTime: true, endTime: true, organizationId: true },
  })
  if (!election || election.organizationId !== orgResult.id) {
    return errorJson('Election not found', 404)
  }

  // Get all integrity events + election events + audit logs in chronological order
  const [integrityEvents, electionEvents, auditLogs, incidents, votes] = await Promise.all([
    db.integrityEvent.findMany({
      where: { electionId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, eventType: true, category: true, severity: true, description: true, actorName: true, detected: true, riskScore: true, createdAt: true },
    }),
    db.electionEvent.findMany({
      where: { electionId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, eventType: true, description: true, actorName: true, createdAt: true },
    }),
    db.auditLog.findMany({
      where: { electionId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, action: true, actorName: true, actorRole: true, ip: true, createdAt: true },
    }),
    db.fraudIncident.findMany({
      where: { electionId },
      orderBy: { detectedAt: 'asc' },
      select: { id: true, incidentNumber: true, title: true, severity: true, status: true, detectedAt: true, resolvedAt: true },
    }),
    db.voteRecord.findMany({
      where: { electionId, isSimulation: false },
      orderBy: { createdAt: 'asc' },
      select: { id: true, createdAt: true, receiptCode: true },
      take: 1000, // cap for performance
    }),
  ])

  // Merge into a single timeline
  const timeline: Array<{
    timestamp: string
    type: string
    category: string
    description: string
    actor?: string
    severity?: string
    detected?: boolean
    riskScore?: number
    incidentNumber?: string
  }> = []

  for (const e of integrityEvents) {
    timeline.push({
      timestamp: e.createdAt.toISOString(),
      type: 'INTEGRITY_EVENT',
      category: e.category,
      description: e.description,
      actor: e.actorName || undefined,
      severity: e.severity,
      detected: e.detected,
      riskScore: e.riskScore,
    })
  }

  for (const e of electionEvents) {
    timeline.push({
      timestamp: e.createdAt.toISOString(),
      type: 'ELECTION_EVENT',
      category: 'ELECTION',
      description: e.description || e.eventType,
      actor: e.actorName || undefined,
    })
  }

  for (const a of auditLogs) {
    timeline.push({
      timestamp: a.createdAt.toISOString(),
      type: 'AUDIT_LOG',
      category: 'AUDIT',
      description: a.action,
      actor: a.actorName || undefined,
      severity: a.actorRole,
    })
  }

  for (const i of incidents) {
    timeline.push({
      timestamp: i.detectedAt.toISOString(),
      type: 'INCIDENT_DETECTED',
      category: 'INCIDENT',
      description: i.title,
      incidentNumber: i.incidentNumber,
      severity: i.severity,
    })
    if (i.resolvedAt) {
      timeline.push({
        timestamp: i.resolvedAt.toISOString(),
        type: 'INCIDENT_RESOLVED',
        category: 'INCIDENT',
        description: `${i.incidentNumber} resolved`,
        incidentNumber: i.incidentNumber,
        severity: i.severity,
      })
    }
  }

  // Add vote markers (summarized, not individual votes)
  if (votes.length > 0) {
    timeline.push({
      timestamp: votes[0].createdAt.toISOString(),
      type: 'FIRST_VOTE',
      category: 'VOTING',
      description: `First vote cast`,
    })
    timeline.push({
      timestamp: votes[votes.length - 1].createdAt.toISOString(),
      type: 'LAST_VOTE',
      category: 'VOTING',
      description: `Last vote cast (total: ${votes.length})`,
    })
  }

  // Sort by timestamp
  timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  return json({
    election: {
      id: election.id,
      name: election.name,
      status: election.status,
      votingWindow: { start: election.startTime, end: election.endTime },
    },
    timeline,
    summary: {
      totalEvents: timeline.length,
      integrityEvents: integrityEvents.length,
      electionEvents: electionEvents.length,
      auditLogs: auditLogs.length,
      incidents: incidents.length,
      votes: votes.length,
    },
  })
}
