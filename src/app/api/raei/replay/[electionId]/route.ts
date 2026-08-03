import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { getCurrentOfficial } from '@/lib/guards'

export const dynamic = 'force-dynamic'

// GET /api/raei/replay/[electionId] — Election Replay Studio
// Reconstructs the full election timeline with milestone markers.
export async function GET(req: NextRequest, { params }: { params: Promise<{ electionId: string }> }) {
  // Auth check — closes the endpoint authentication gap (audit finding)
  const official = await getCurrentOfficial(req)
  if (!official) return errorJson('Unauthorized', 401)
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

  // Gather all event sources
  const [electionEvents, integrityEvents, incidents, votes, auditLogs, announcements, tickets, messages] = await Promise.all([
    db.electionEvent.findMany({ where: { electionId }, orderBy: { createdAt: 'asc' }, select: { eventType: true, description: true, actorName: true, createdAt: true } }),
    db.integrityEvent.findMany({ where: { electionId }, orderBy: { createdAt: 'asc' }, select: { eventType: true, category: true, severity: true, description: true, actorName: true, detected: true, riskScore: true, createdAt: true } }),
    db.fraudIncident.findMany({ where: { electionId }, orderBy: { detectedAt: 'asc' }, select: { incidentNumber: true, title: true, severity: true, status: true, detectedAt: true, resolvedAt: true } }),
    db.voteRecord.findMany({ where: { electionId, isSimulation: false }, orderBy: { createdAt: 'asc' }, select: { id: true, createdAt: true }, take: 5000 }),
    db.auditLog.findMany({ where: { electionId }, orderBy: { createdAt: 'asc' }, select: { action: true, actorName: true, actorRole: true, createdAt: true } }),
    db.announcement.findMany({ where: { electionId }, orderBy: { publishedAt: 'asc' }, select: { title: true, type: true, publishedAt: true } }),
    db.supportTicket.findMany({ where: { electionId }, orderBy: { createdAt: 'asc' }, select: { issueType: true, status: true, voterName: true, createdAt: true } }),
    db.messageQueue.findMany({ where: { electionId }, orderBy: { createdAt: 'asc' }, select: { channel: true, category: true, status: true, recipientName: true, createdAt: true }, take: 500 }),
  ])

  // Build the unified timeline with milestone markers
  const timeline: Array<{
    timestamp: string
    type: string
    title: string
    description: string
    severity?: string
    actor?: string
    metadata?: Record<string, any>
  }> = []

  // Election events
  for (const e of electionEvents) {
    timeline.push({
      timestamp: e.createdAt.toISOString(),
      type: e.eventType,
      title: e.eventType.replace(/_/g, ' '),
      description: e.description || e.eventType,
      actor: e.actorName || undefined,
    })
  }

  // Integrity events (with detected flag)
  for (const e of integrityEvents) {
    timeline.push({
      timestamp: e.createdAt.toISOString(),
      type: e.detected ? 'SECURITY_ALERT' : e.eventType,
      title: e.description,
      description: e.description,
      severity: e.severity,
      actor: e.actorName || undefined,
      metadata: { detected: e.detected, riskScore: e.riskScore, category: e.category },
    })
  }

  // Incidents
  for (const i of incidents) {
    timeline.push({
      timestamp: i.detectedAt.toISOString(),
      type: 'INCIDENT_DETECTED',
      title: `${i.incidentNumber}: ${i.title}`,
      description: `Incident detected — severity: ${i.severity}`,
      severity: i.severity,
      metadata: { incidentNumber: i.incidentNumber, status: i.status },
    })
    if (i.resolvedAt) {
      timeline.push({
        timestamp: i.resolvedAt.toISOString(),
        type: 'INCIDENT_RESOLVED',
        title: `${i.incidentNumber} resolved`,
        description: `Incident ${i.incidentNumber} has been resolved.`,
        severity: i.severity,
      })
    }
  }

  // Vote milestones
  if (votes.length > 0) {
    timeline.push({
      timestamp: votes[0].createdAt.toISOString(),
      type: 'FIRST_VOTE',
      title: 'First vote cast',
      description: 'The first vote of the election was cast.',
    })

    // Turnout milestones (25%, 50%, 75%, 100%)
    const totalEligible = await db.voter.count({ where: { OR: [{ electionSessionId: electionId }, { organizationId: election.organizationId }] } })
    for (const pct of [25, 50, 75]) {
      const milestone = Math.floor((totalEligible * pct) / 100)
      if (milestone > 0 && milestone <= votes.length) {
        timeline.push({
          timestamp: votes[milestone - 1].createdAt.toISOString(),
          type: 'TURNOUT_MILESTONE',
          title: `${pct}% turnout reached`,
          description: `${milestone} votes cast — ${pct}% of eligible voters.`,
          metadata: { percentage: pct, votes: milestone },
        })
      }
    }

    // Last vote
    timeline.push({
      timestamp: votes[votes.length - 1].createdAt.toISOString(),
      type: 'LAST_VOTE',
      title: 'Last vote cast',
      description: `Total votes: ${votes.length}`,
    })
  }

  // Audit logs
  for (const a of auditLogs) {
    timeline.push({
      timestamp: a.createdAt.toISOString(),
      type: 'AUDIT_LOG',
      title: a.action,
      description: `${a.actorName || 'System'} performed: ${a.action}`,
      actor: a.actorName,
    })
  }

  // Announcements
  for (const a of announcements) {
    timeline.push({
      timestamp: a.publishedAt.toISOString(),
      type: 'ANNOUNCEMENT',
      title: a.title,
      description: `Announcement published: ${a.type}`,
    })
  }

  // Support tickets
  for (const t of tickets) {
    timeline.push({
      timestamp: t.createdAt.toISOString(),
      type: 'SUPPORT_TICKET',
      title: `Ticket: ${t.issueType}`,
      description: `Support ticket opened by ${t.voterName || 'voter'}`,
      metadata: { status: t.status },
    })
  }

  // Messages
  for (const m of messages) {
    timeline.push({
      timestamp: m.createdAt.toISOString(),
      type: 'MESSAGE_SENT',
      title: `${m.channel}: ${m.category}`,
      description: `Message sent to ${m.recipientName || 'recipient'} via ${m.channel}`,
      metadata: { channel: m.channel, status: m.status },
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
      votes: votes.length,
      incidents: incidents.length,
      auditLogs: auditLogs.length,
      announcements: announcements.length,
      tickets: tickets.length,
      messages: messages.length,
    },
  })
}
