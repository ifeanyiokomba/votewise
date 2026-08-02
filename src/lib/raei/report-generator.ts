// VoteWise — Chapter 13 Report Generator
//
// Generates executive reports, certification packages, and custom reports.
// Supports PDF, Excel, CSV, JSON, and Print formats.

import { dbReplica as db } from '@/lib/infra/db-replica'
import { sha256, hmacSign } from '@/lib/crypto'
import { getElectionDashboard, getOrgDashboard, getHistoricalComparison, getAIInsights } from './analytics-engine'
import { getVerification } from '@/lib/sve'
import { getIncidentStats } from '@/lib/eifdirs'
import { getDeliveryStats } from '@/lib/cnse'
import type { ReportConfig, ReportResult, CertificationPackage } from './types'

/**
 * Generate a report based on the config.
 */
export async function generateReport(config: ReportConfig): Promise<ReportResult> {
  let data: any

  switch (config.type) {
    case 'ELECTION_SUMMARY':
      data = await generateElectionSummary(config.electionId!)
      break
    case 'TURNOUT_REPORT':
      data = await generateTurnoutReport(config.organizationId!, config.electionId)
      break
    case 'CANDIDATE_REPORT':
      data = await generateCandidateReport(config.electionId!)
      break
    case 'SECURITY_REPORT':
      data = await generateSecurityReport(config.organizationId!, config.electionId)
      break
    case 'OBSERVER_REPORT':
      data = await generateObserverReport(config.electionId!)
      break
    case 'COMMUNICATION_REPORT':
      data = await generateCommunicationReport(config.organizationId!, config.electionId)
      break
    case 'AUDIT_REPORT':
      data = await generateAuditReport(config.electionId!)
      break
    case 'CERTIFICATION_PACKAGE':
      data = await generateCertificationPackage(config.electionId!)
      break
    default:
      throw new Error(`Unknown report type: ${config.type}`)
  }

  return {
    id: `RPT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: config.type,
    format: config.format,
    generatedAt: new Date().toISOString(),
    data,
  }
}

/**
 * Generate the full certification package for an election.
 * Contains: results, integrity certificate, observer reports, audit logs,
 * communication summary, incident summary, analytics summary.
 */
export async function generateCertificationPackage(electionId: string): Promise<CertificationPackage> {
  const election = await db.electionSession.findUnique({
    where: { id: electionId },
    select: { id: true, name: true, organizationId: true, startTime: true, endTime: true, status: true },
  })
  if (!election) throw new Error('Election not found')

  const [
    dashboard, verification, incidentStats, communicationStats, auditLogs,
    observerEvents, timeline,
  ] = await Promise.all([
    getElectionDashboard(electionId),
    getVerification(electionId),
    getIncidentStats({ electionId }),
    getDeliveryStats({ electionId }),
    db.auditLog.findMany({ where: { electionId }, orderBy: { createdAt: 'asc' }, take: 1000 }),
    db.electionEvent.findMany({ where: { electionId, eventType: 'OBSERVER_ASSIGNED' }, select: { actorName: true, description: true, createdAt: true } }),
    db.electionEvent.findMany({ where: { electionId }, orderBy: { createdAt: 'asc' }, select: { eventType: true, description: true, actorName: true, createdAt: true } }),
  ])

  // Compute audit hash
  const auditData = auditLogs.map((a) => `${a.id}|${a.action}|${a.createdAt.toISOString()}`).join('|')
  const auditHash = sha256(`certification|${electionId}|${auditData}`)
  const signature = hmacSign(`certification:${auditHash}`)

  return {
    electionId,
    electionName: election.name,
    generatedAt: new Date().toISOString(),
    sections: {
      results: dashboard?.candidateResults || [],
      integrity: verification || { message: 'Not yet certified' },
      observerReports: observerEvents.map((e) => ({
        observer: e.actorName,
        report: e.description,
        timestamp: e.createdAt.toISOString(),
      })),
      auditLogs: auditLogs.map((a) => ({
        timestamp: a.createdAt.toISOString(),
        actor: a.actorName,
        role: a.actorRole,
        action: a.action,
        details: a.details,
        hash: a.hash?.slice(0, 16) + '...',
      })),
      communicationSummary: {
        totalMessages: communicationStats.total,
        delivered: communicationStats.delivered,
        failed: communicationStats.failed,
        deliveryRate: communicationStats.deliveryRate,
      },
      incidentSummary: {
        totalIncidents: incidentStats.total,
        resolved: incidentStats.resolved,
        critical: incidentStats.critical,
        falsePositives: incidentStats.falsePositives,
        bySeverity: incidentStats.bySeverity,
        byCategory: incidentStats.byCategory,
      },
      analyticsSummary: {
        turnout: dashboard?.turnoutPct || 0,
        eligibleVoters: dashboard?.eligibleVoters || 0,
        votesCast: dashboard?.votesCast || 0,
        participationFunnel: dashboard?.participationFunnel,
        demographicBreakdown: dashboard?.demographicBreakdown,
      },
    },
    auditHash,
    signature,
  }
}

// ---------------------------------------------------------------------------
// Individual report generators
// ---------------------------------------------------------------------------

async function generateElectionSummary(electionId: string) {
  const dashboard = await getElectionDashboard(electionId)
  if (!dashboard) throw new Error('Election not found')

  return {
    title: 'Election Summary Report',
    election: {
      name: dashboard.name,
      status: dashboard.status,
      votingWindow: { start: dashboard.startTime, end: dashboard.endTime },
    },
    summary: {
      eligibleVoters: dashboard.eligibleVoters,
      votesCast: dashboard.votesCast,
      turnoutPct: dashboard.turnoutPct,
      remaining: dashboard.remaining,
      incidents: dashboard.incidents,
    },
    results: dashboard.candidateResults,
    participation: dashboard.participationFunnel,
    demographic: dashboard.demographicBreakdown,
  }
}

async function generateTurnoutReport(organizationId: string, electionId?: string) {
  if (electionId) {
    const dashboard = await getElectionDashboard(electionId)
    return {
      title: 'Turnout Report',
      scope: dashboard?.name || 'Election',
      turnoutPct: dashboard?.turnoutPct || 0,
      eligibleVoters: dashboard?.eligibleVoters || 0,
      votesCast: dashboard?.votesCast || 0,
      demographicBreakdown: dashboard?.demographicBreakdown || [],
      participationFunnel: dashboard?.participationFunnel,
    }
  }

  const dashboard = await getOrgDashboard(organizationId)
  const historical = await getHistoricalComparison(organizationId)

  return {
    title: 'Organization Turnout Report',
    scope: 'Organization',
    currentTurnout: dashboard.turnoutPct,
    historicalTrend: historical.elections.map((e) => ({
      election: e.name,
      date: e.date,
      turnout: e.turnoutPct,
    })),
    averages: historical.averages,
    demographicBreakdown: dashboard.demographicBreakdown,
  }
}

async function generateCandidateReport(electionId: string) {
  const dashboard = await getElectionDashboard(electionId)
  if (!dashboard) throw new Error('Election not found')

  return {
    title: 'Candidate Report',
    election: dashboard.name,
    positions: dashboard.candidateResults.map((pos) => ({
      position: pos.title,
      candidates: pos.candidates.map((c) => ({
        name: c.name,
        votes: c.votes,
        percentage: c.percentage,
        winner: c.isWinner,
      })),
    })),
  }
}

async function generateSecurityReport(organizationId: string, electionId?: string) {
  const stats = await getIncidentStats({ organizationId, electionId })

  return {
    title: 'Security Report',
    scope: electionId ? 'Election' : 'Organization',
    summary: stats,
    recommendations: [
      stats.critical > 0 ? 'Investigate critical incidents immediately' : 'No critical incidents',
      stats.open > 5 ? 'Consider assigning more investigators' : 'Incident load is manageable',
      stats.falsePositives > stats.total * 0.3 ? 'Review detection rules — high false positive rate' : 'Detection rules are working well',
    ],
  }
}

async function generateObserverReport(electionId: string) {
  const events = await db.electionEvent.findMany({
    where: { electionId, eventType: { in: ['OBSERVER_ASSIGNED', 'OBSERVER_REMOVED', 'VOTE_CAST'] } },
    orderBy: { createdAt: 'asc' },
    select: { eventType: true, description: true, actorName: true, createdAt: true },
  })

  return {
    title: 'Observer Report',
    electionId,
    observerActivity: events.map((e) => ({
      type: e.eventType,
      description: e.description,
      observer: e.actorName,
      timestamp: e.createdAt.toISOString(),
    })),
  }
}

async function generateCommunicationReport(organizationId: string, electionId?: string) {
  const stats = await getDeliveryStats({ organizationId, electionId })

  return {
    title: 'Communication Report',
    scope: electionId ? 'Election' : 'Organization',
    summary: stats,
    recommendations: [
      stats.deliveryRate < 95 ? 'Delivery rate below 95% — check recipient contact info' : 'Delivery rate is healthy',
      stats.failed > 10 ? `${stats.failed} messages failed — investigate delivery providers` : 'No significant delivery failures',
    ],
  }
}

async function generateAuditReport(electionId: string) {
  const logs = await db.auditLog.findMany({
    where: { electionId },
    orderBy: { createdAt: 'asc' },
    take: 1000,
    select: { id: true, actorId: true, actorRole: true, actorName: true, action: true, details: true, ip: true, hash: true, prevHash: true, createdAt: true },
  })

  // Verify chain
  let chainIntact = true
  for (let i = 1; i < logs.length; i++) {
    if (logs[i].prevHash !== logs[i - 1].hash) {
      chainIntact = false
      break
    }
  }

  return {
    title: 'Audit Report',
    electionId,
    totalEntries: logs.length,
    chainIntact,
    entries: logs.map((l) => ({
      timestamp: l.createdAt.toISOString(),
      actor: l.actorName,
      role: l.actorRole,
      action: l.action,
      details: l.details,
      ip: l.ip,
      hash: l.hash?.slice(0, 32) + '...',
    })),
  }
}
