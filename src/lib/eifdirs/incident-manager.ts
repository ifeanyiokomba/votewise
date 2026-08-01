// VoteWise — Chapter 11 Incident Manager
//
// Every anomaly becomes an incident with a full lifecycle:
//   Detected → Open → Assigned → Investigating → Containment → Resolved → Closed → Archived
//
// Incidents store evidence, investigation notes, chain of custody, and
// resolution details. Nothing is ever deleted.

import { db } from '@/lib/db'
import { sha256, hmacSign } from '@/lib/crypto'
import type { FraudIncidentInput, InvestigationNote, EvidenceItem, CustodyStep } from './types'

let incidentCounter = 0

/**
 * Generate the next incident number in INC-000001 format.
 */
async function generateIncidentNumber(): Promise<string> {
  const count = await db.fraudIncident.count()
  return `INC-${String(count + 1).padStart(6, '0')}`
}

/**
 * Create a new fraud incident.
 */
export async function createIncident(input: FraudIncidentInput): Promise<string> {
  const incidentNumber = await generateIncidentNumber()

  const incident = await db.fraudIncident.create({
    data: {
      incidentNumber,
      organizationId: input.organizationId || null,
      electionId: input.electionId || null,
      title: input.title,
      description: input.description,
      category: input.category,
      severity: input.severity || 'MEDIUM',
      riskScore: input.riskScore || 0,
      detectedBy: input.detectedBy || 'SYSTEM',
      status: 'DETECTED',
      evidence: JSON.stringify([]),
      investigationNotes: JSON.stringify([]),
      relatedEventIds: JSON.stringify(input.relatedEventIds || []),
      chainOfCustody: JSON.stringify([
        {
          action: 'Incident detected',
          actor: input.detectedBy || 'SYSTEM',
          timestamp: new Date().toISOString(),
        },
      ]),
    },
  })

  // Link related events to this incident
  if (input.relatedEventIds && input.relatedEventIds.length > 0) {
    await db.integrityEvent.updateMany({
      where: { id: { in: input.relatedEventIds } },
      data: { incidentId: incident.id, detected: true },
    })
  }

  return incident.id
}

/**
 * Get an incident by ID with all details.
 */
export async function getIncident(incidentId: string) {
  const incident = await db.fraudIncident.findUnique({ where: { id: incidentId } })
  if (!incident) return null

  return {
    ...incident,
    evidence: incident.evidence ? JSON.parse(incident.evidence) : [],
    investigationNotes: incident.investigationNotes ? JSON.parse(incident.investigationNotes) : [],
    relatedEventIds: incident.relatedEventIds ? JSON.parse(incident.relatedEventIds) : [],
    chainOfCustody: incident.chainOfCustody ? JSON.parse(incident.chainOfCustody) : [],
  }
}

/**
 * List incidents with filtering.
 */
export async function listIncidents(opts: {
  electionId?: string
  organizationId?: string
  status?: string
  severity?: string
  category?: string
  limit?: number
  offset?: number
}) {
  const where: any = {}
  if (opts.electionId) where.electionId = opts.electionId
  if (opts.organizationId) where.organizationId = opts.organizationId
  if (opts.status) where.status = opts.status
  if (opts.severity) where.severity = opts.severity
  if (opts.category) where.category = opts.category

  const limit = opts.limit || 50
  const offset = opts.offset || 0

  const [incidents, total] = await Promise.all([
    db.fraudIncident.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    db.fraudIncident.count({ where }),
  ])

  return { incidents, total }
}

/**
 * Assign an incident to an investigator.
 */
export async function assignIncident(incidentId: string, assignedToId: string, assignedToName: string): Promise<void> {
  await db.fraudIncident.update({
    where: { id: incidentId },
    data: { status: 'ASSIGNED', assignedToId, assignedToName },
  })
  await addCustodyStep(incidentId, `Assigned to ${assignedToName}`, assignedToName, assignedToId)
}

/**
 * Update incident status.
 */
export async function updateIncidentStatus(
  incidentId: string,
  status: string,
  updatedBy: string,
  updatedById?: string,
  resolution?: string,
): Promise<void> {
  const data: any = { status }
  if (status === 'RESOLVED' || status === 'CLOSED') {
    data.resolvedAt = new Date()
    data.resolvedById = updatedById
    data.resolvedByName = updatedBy
    if (resolution) data.resolution = resolution
  }
  await db.fraudIncident.update({ where: { id: incidentId }, data })
  await addCustodyStep(incidentId, `Status changed to ${status}`, updatedBy, updatedById)
}

/**
 * Add an investigation note.
 */
export async function addInvestigationNote(incidentId: string, note: string, author: string, authorId?: string): Promise<void> {
  const incident = await db.fraudIncident.findUnique({ where: { id: incidentId } })
  if (!incident) return

  const notes: InvestigationNote[] = incident.investigationNotes ? JSON.parse(incident.investigationNotes) : []
  notes.push({ note, author, authorId, timestamp: new Date().toISOString() })

  await db.fraudIncident.update({
    where: { id: incidentId },
    data: { investigationNotes: JSON.stringify(notes) },
  })
  await addCustodyStep(incidentId, `Investigation note added by ${author}`, author, authorId)
}

/**
 * Add evidence to an incident.
 */
export async function addEvidence(incidentId: string, evidence: EvidenceItem): Promise<void> {
  const incident = await db.fraudIncident.findUnique({ where: { id: incidentId } })
  if (!incident) return

  const evidenceList: EvidenceItem[] = incident.evidence ? JSON.parse(incident.evidence) : []
  evidenceList.push(evidence)

  await db.fraudIncident.update({
    where: { id: incidentId },
    data: { evidence: JSON.stringify(evidenceList) },
  })
  await addCustodyStep(incidentId, `Evidence added: ${evidence.description}`, evidence.collectedBy)
}

/**
 * Mark an incident as a false positive.
 */
export async function markFalsePositive(incidentId: string, reason: string, markedBy: string, markedById?: string): Promise<void> {
  await db.fraudIncident.update({
    where: { id: incidentId },
    data: {
      falsePositive: true,
      status: 'RESOLVED',
      resolution: `False positive: ${reason}`,
      resolvedAt: new Date(),
      resolvedById: markedById,
      resolvedByName: markedBy,
    },
  })
  await addCustodyStep(incidentId, `Marked as false positive: ${reason}`, markedBy, markedById)
}

/**
 * Escalate an incident (increase severity).
 */
export async function escalateIncident(incidentId: string, newSeverity: string, reason: string, escalatedBy: string, escalatedById?: string): Promise<void> {
  await db.fraudIncident.update({
    where: { id: incidentId },
    data: { severity: newSeverity, status: 'INVESTIGATING' },
  })
  await addCustodyStep(incidentId, `Escalated to ${newSeverity}: ${reason}`, escalatedBy, escalatedById)
}

/**
 * Add a chain of custody step.
 */
async function addCustodyStep(incidentId: string, action: string, actor: string, actorId?: string): Promise<void> {
  const incident = await db.fraudIncident.findUnique({ where: { id: incidentId } })
  if (!incident) return

  const custody: CustodyStep[] = incident.chainOfCustody ? JSON.parse(incident.chainOfCustody) : []
  custody.push({
    action,
    actor,
    actorId,
    timestamp: new Date().toISOString(),
  })

  await db.fraudIncident.update({
    where: { id: incidentId },
    data: { chainOfCustody: JSON.stringify(custody) },
  })
}

/**
 * Get incident statistics for a dashboard.
 */
export async function getIncidentStats(opts: {
  electionId?: string
  organizationId?: string
  since?: Date
}): Promise<{
  total: number
  open: number
  resolved: number
  critical: number
  falsePositives: number
  bySeverity: Record<string, number>
  byCategory: Record<string, number>
}> {
  const where: any = {}
  if (opts.electionId) where.electionId = opts.electionId
  if (opts.organizationId) where.organizationId = opts.organizationId
  if (opts.since) where.createdAt = { gte: opts.since }

  const [total, open, resolved, critical, falsePositives, incidents] = await Promise.all([
    db.fraudIncident.count({ where }),
    db.fraudIncident.count({ where: { ...where, status: { in: ['DETECTED', 'OPEN', 'ASSIGNED', 'INVESTIGATING', 'CONTAINMENT'] } } }),
    db.fraudIncident.count({ where: { ...where, status: { in: ['RESOLVED', 'CLOSED', 'ARCHIVED'] } } }),
    db.fraudIncident.count({ where: { ...where, severity: 'CRITICAL' } }),
    db.fraudIncident.count({ where: { ...where, falsePositive: true } }),
    db.fraudIncident.findMany({ where, select: { severity: true, category: true } }),
  ])

  const bySeverity: Record<string, number> = {}
  const byCategory: Record<string, number> = {}
  for (const i of incidents) {
    bySeverity[i.severity] = (bySeverity[i.severity] || 0) + 1
    byCategory[i.category] = (byCategory[i.category] || 0) + 1
  }

  return { total, open, resolved, critical, falsePositives, bySeverity, byCategory }
}
