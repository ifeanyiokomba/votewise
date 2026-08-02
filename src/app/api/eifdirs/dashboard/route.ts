import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { getIncidentStats } from '@/lib/eifdirs/incident-manager'
import { getEventStats } from '@/lib/eifdirs/event-collector'
import { getOrgRiskScore, scoreToThreatLevel } from '@/lib/eifdirs/risk-scorer'

export const dynamic = 'force-dynamic'

// GET /api/eifdirs/dashboard — Organization-level security dashboard
export async function GET(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  const [incidentStats, eventStats, riskAssessment, activeElections, recentIncidents, recentEvents] = await Promise.all([
    getIncidentStats({ organizationId: org.id }),
    getEventStats({ organizationId: org.id }),
    getOrgRiskScore(org.id),
    db.electionSession.count({ where: { organizationId: org.id, status: 'LIVE' } }),
    db.fraudIncident.findMany({
      where: { organizationId: org.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, incidentNumber: true, title: true, severity: true, status: true, riskScore: true, detectedAt: true },
    }),
    db.integrityEvent.findMany({
      where: { organizationId: org.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, eventType: true, category: true, severity: true, description: true, actorName: true, detected: true, createdAt: true },
    }),
  ])

  const integrityScore = Math.round((100 - riskAssessment.score) * 100) / 100
  const threatLevel = scoreToThreatLevel(riskAssessment.score)
  const platformHealth = riskAssessment.score > 70 ? 'CRITICAL' : riskAssessment.score > 40 ? 'DEGRADED' : 'HEALTHY'

  return json({
    activeElections,
    threatLevel,
    activeIncidents: incidentStats.open,
    blockedAttempts: eventStats.detected,
    integrityScore,
    platformHealth,
    incidentsBySeverity: incidentStats.bySeverity,
    incidentsByCategory: incidentStats.byCategory,
    eventsByCategory: eventStats.byCategory,
    recentIncidents: recentIncidents.map((i) => ({
      ...i,
      detectedAt: i.detectedAt.toISOString(),
    })),
    recentEvents: recentEvents.map((e) => ({
      ...e,
      createdAt: e.createdAt.toISOString(),
    })),
    eventsPerHour: eventStats.perHour,
    incidentsToday: incidentStats.total,
    resolvedToday: incidentStats.resolved,
  })
}
