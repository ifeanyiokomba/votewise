// VoteWise — Chapter 11 Integrity Certificate Generator
//
// After certification, generates a signed report containing:
//   Election Summary, Integrity Score, Threat Summary, Incident Summary,
//   Observer Report, Security Events, System Availability, OTVP Stats,
//   Audit Hash, Certification Signature
//
// Downloadable as PDF. A public Transparency Report version is also available.

import { db } from '@/lib/db'
import { sha256, hmacSign } from '@/lib/crypto'
import { getIncidentStats } from './incident-manager'
import { getEventStats } from './event-collector'
import { getElectionRiskScore, getElectionIntegrityScore, scoreToThreatLevel } from './risk-scorer'

/**
 * Generate an Integrity Certificate for a certified election.
 * Stores it in the IntegrityCertificate table.
 */
export async function generateIntegrityCertificate(electionId: string, certifiedById?: string, certifiedByName?: string) {
  const election = await db.electionSession.findUnique({
    where: { id: electionId },
    select: {
      id: true, name: true, organizationId: true, status: true,
      startTime: true, endTime: true, certificationDate: true,
      _count: { select: { voters: true, positions: true, candidates: true } },
    },
  })
  if (!election) throw new Error('Election not found')

  // Get stats
  const [incidentStats, eventStats, riskAssessment, integrityScore, totalVotes, tallies] = await Promise.all([
    getIncidentStats({ electionId }),
    getEventStats({ electionId }),
    getElectionRiskScore(electionId),
    getElectionIntegrityScore(electionId),
    db.voteRecord.count({ where: { electionId, isSimulation: false } }),
    db.candidateTally.findMany({ where: { electionId }, select: { count: true } }),
  ])

  const totalEligible = election._count.voters
  const turnoutPct = totalEligible > 0 ? Math.round((totalVotes / totalEligible) * 10000) / 100 : 0
  const threatLevel = scoreToThreatLevel(riskAssessment.score)

  // Observer stats
  const observerEvents = await db.integrityEvent.count({
    where: { electionId, actorRole: 'OBSERVER' },
  })

  // Compute audit hash (SHA-256 of all integrity events)
  const events = await db.integrityEvent.findMany({
    where: { electionId },
    select: { id: true, eventType: true, createdAt: true, detected: true },
    orderBy: { createdAt: 'asc' },
  })
  const eventData = events.map((e) => `${e.id}|${e.eventType}|${e.detected}|${e.createdAt.toISOString()}`).join('|')
  const auditHash = sha256(`integrity|${electionId}|${eventData}`)
  const certificationSignature = hmacSign(`certificate:${auditHash}`)

  // Build the full report data
  const reportData = {
    election: {
      id: election.id,
      name: election.name,
      status: election.status,
      votingWindow: { start: election.startTime, end: election.endTime },
      certifiedAt: election.certificationDate || new Date(),
    },
    summary: {
      totalEligible,
      totalVotes,
      turnoutPct,
      positions: election._count.positions,
      candidates: election._count.candidates,
    },
    integrity: {
      score: integrityScore,
      threatLevel,
      riskScore: riskAssessment.score,
      riskFactors: riskAssessment.factors,
    },
    incidents: {
      total: incidentStats.total,
      resolved: incidentStats.resolved,
      critical: incidentStats.critical,
      falsePositives: incidentStats.falsePositives,
      bySeverity: incidentStats.bySeverity,
      byCategory: incidentStats.byCategory,
    },
    securityEvents: {
      total: eventStats.total,
      detected: eventStats.detected,
      byCategory: eventStats.byCategory,
    },
    observers: {
      actions: observerEvents,
    },
    blockedAttempts: eventStats.detected,
    systemAvailability: 100, // TODO: track actual uptime
    otvpDeliveryRate: 100, // TODO: track actual delivery rate
    auditHash,
    certificationSignature,
    certifiedBy: { id: certifiedById, name: certifiedByName },
    generatedAt: new Date().toISOString(),
  }

  // Store the certificate
  const certificate = await db.integrityCertificate.upsert({
    where: { electionId },
    create: {
      electionId,
      organizationId: election.organizationId || null,
      electionName: election.name,
      totalEligible,
      totalVotes,
      turnoutPct,
      integrityScore,
      threatLevel,
      totalIncidents: incidentStats.total,
      resolvedIncidents: incidentStats.resolved,
      criticalIncidents: incidentStats.critical,
      falsePositives: incidentStats.falsePositives,
      totalEvents: eventStats.total,
      detectedEvents: eventStats.detected,
      blockedAttempts: eventStats.detected,
      observersAssigned: 0, // TODO: count from observer assignments
      observerActions: observerEvents,
      systemAvailability: 100,
      otvpDeliveryRate: 100,
      auditHash,
      certificationSignature,
      certifiedById,
      certifiedByName,
      reportData: JSON.stringify(reportData),
    },
    update: {
      totalEligible, totalVotes, turnoutPct, integrityScore, threatLevel,
      totalIncidents: incidentStats.total, resolvedIncidents: incidentStats.resolved,
      criticalIncidents: incidentStats.critical, falsePositives: incidentStats.falsePositives,
      totalEvents: eventStats.total, detectedEvents: eventStats.detected,
      blockedAttempts: eventStats.detected, observerActions: observerEvents,
      auditHash, certificationSignature,
      certifiedById, certifiedByName,
      reportData: JSON.stringify(reportData),
    },
  })

  return { certificate, reportData }
}

/**
 * Get the integrity certificate for an election.
 */
export async function getIntegrityCertificate(electionId: string) {
  const cert = await db.integrityCertificate.findUnique({ where: { electionId } })
  if (!cert) return null
  return {
    ...cert,
    reportData: cert.reportData ? JSON.parse(cert.reportData) : null,
  }
}

/**
 * Generate a public Transparency Report (no sensitive info).
 */
export async function generateTransparencyReport(electionId: string) {
  const cert = await getIntegrityCertificate(electionId)
  if (!cert) return null

  return {
    electionName: cert.electionName,
    totalEligible: cert.totalEligible,
    totalVotes: cert.totalVotes,
    turnoutPct: cert.turnoutPct,
    integrityScore: cert.integrityScore,
    threatLevel: cert.threatLevel,
    totalIncidents: cert.totalIncidents,
    resolvedIncidents: cert.resolvedIncidents,
    certifiedAt: cert.certifiedAt.toISOString(),
    // No: IP addresses, actor names, event details, evidence, etc.
  }
}
