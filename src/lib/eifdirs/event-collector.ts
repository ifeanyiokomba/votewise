// VoteWise — Chapter 11 Event Collector
//
// Every action in VoteWise becomes an IntegrityEvent. This is the central
// event stream for the Election SOC. Events are normalized, stored, and
// passed to the Fraud Detection Engine for analysis.
//
// Usage:
//   import { recordEvent } from '@/lib/eifdirs/event-collector'
//   await recordEvent({
//     eventType: 'LOGIN_FAILED',
//     category: 'AUTHENTICATION',
//     severity: 'MEDIUM',
//     description: 'Failed login attempt for voter@demo.com',
//     ipAddress: '1.2.3.4',
//   })

import { db } from '@/lib/db'
import type { IntegrityEventInput, IntegrityEventRecord } from './types'

/**
 * Record an integrity event. This is the SINGLE entry point for all events.
 * Every login, vote, admin action, observer action, and system event should
 * call this. The event is stored and then passed to the fraud detector.
 */
export async function recordEvent(input: IntegrityEventInput): Promise<IntegrityEventRecord> {
  const event = await db.integrityEvent.create({
    data: {
      organizationId: input.organizationId || null,
      electionId: input.electionId || null,
      voterId: input.voterId || null,
      actorId: input.actorId || null,
      actorName: input.actorName || null,
      actorRole: input.actorRole || null,
      eventType: input.eventType,
      category: input.category,
      severity: input.severity || 'INFO',
      riskScore: input.riskScore || 0,
      description: input.description,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      ipAddress: input.ipAddress || null,
      deviceFingerprint: input.deviceFingerprint || null,
      detected: false,
    },
  })

  // Pass to fraud detector (async — don't block the event recording)
  import('./fraud-detector').then(({ detectFraud }) => {
    detectFraud(event.id).catch(() => {})
  })

  return {
    ...input,
    id: event.id,
    detected: false,
    createdAt: event.createdAt.toISOString(),
  }
}

/**
 * Get the event stream for an election (or org, or platform-wide).
 */
export async function getEventStream(opts: {
  electionId?: string
  organizationId?: string
  actorId?: string
  category?: string
  severity?: string
  detected?: boolean
  limit?: number
  offset?: number
}): Promise<{ events: IntegrityEventRecord[]; total: number }> {
  const where: any = {}
  if (opts.electionId) where.electionId = opts.electionId
  if (opts.organizationId) where.organizationId = opts.organizationId
  if (opts.actorId) where.actorId = opts.actorId
  if (opts.category) where.category = opts.category
  if (opts.severity) where.severity = opts.severity
  if (opts.detected !== undefined) where.detected = opts.detected

  const limit = opts.limit || 100
  const offset = opts.offset || 0

  const [events, total] = await Promise.all([
    db.integrityEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    db.integrityEvent.count({ where }),
  ])

  return {
    events: events.map((e) => ({
      id: e.id,
      organizationId: e.organizationId || undefined,
      electionId: e.electionId || undefined,
      voterId: e.voterId || undefined,
      actorId: e.actorId || undefined,
      actorName: e.actorName || undefined,
      actorRole: e.actorRole || undefined,
      eventType: e.eventType as any,
      category: e.category as any,
      severity: e.severity as any,
      riskScore: e.riskScore,
      description: e.description,
      metadata: e.metadata ? JSON.parse(e.metadata) : undefined,
      ipAddress: e.ipAddress || undefined,
      deviceFingerprint: e.deviceFingerprint || undefined,
      detected: e.detected,
      incidentId: e.incidentId || undefined,
      createdAt: e.createdAt.toISOString(),
    })),
    total,
  }
}

/**
 * Get event statistics for a dashboard.
 */
export async function getEventStats(opts: {
  electionId?: string
  organizationId?: string
  since?: Date
}): Promise<{
  total: number
  detected: number
  byCategory: Record<string, number>
  bySeverity: Record<string, number>
  perHour: number
}> {
  const where: any = {}
  if (opts.electionId) where.electionId = opts.electionId
  if (opts.organizationId) where.organizationId = opts.organizationId
  if (opts.since) where.createdAt = { gte: opts.since }

  const [total, detected, events] = await Promise.all([
    db.integrityEvent.count({ where }),
    db.integrityEvent.count({ where: { ...where, detected: true } }),
    db.integrityEvent.findMany({ where, select: { category: true, severity: true, createdAt: true } }),
  ])

  const byCategory: Record<string, number> = {}
  const bySeverity: Record<string, number> = {}
  for (const e of events) {
    byCategory[e.category] = (byCategory[e.category] || 0) + 1
    bySeverity[e.severity] = (bySeverity[e.severity] || 0) + 1
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const perHour = events.filter((e) => e.createdAt > oneHourAgo).length

  return { total, detected, byCategory, bySeverity, perHour }
}
