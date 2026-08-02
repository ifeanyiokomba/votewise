// VoteWise — Chapter 11 Automated Response Engine
//
// When the Fraud Detector creates an incident, this module determines the
// appropriate automated response based on the incident's risk score and
// the organization's configured response rules.
//
// Default response matrix:
//   MEDIUM (21-40)  → Notify observer
//   HIGH (41-70)    → Notify observer + temporarily suspend session
//   CRITICAL (71+)  → Pause voting + require reverification + notify platform admin
//
// Organizations can customize these through the Rules Engine (Chapter 9).

import { db } from '@/lib/db'
import { recordEvent } from './event-collector'
import type { IncidentSeverity } from './types'

export type AutoResponseType =
  | 'NOTIFY_OBSERVER'
  | 'NOTIFY_ADMIN'
  | 'NOTIFY_PLATFORM_ADMIN'
  | 'SUSPEND_SESSION'
  | 'REQUIRE_REVERIFICATION'
  | 'PAUSE_VOTING'
  | 'RATE_LIMIT_IP'
  | 'LOCK_ACCOUNT'

export interface AutoResponseRule {
  severity: IncidentSeverity
  minRiskScore: number
  responses: AutoResponseType[]
}

// Default rules — organizations can override via Rules Engine
const DEFAULT_RULES: AutoResponseRule[] = [
  {
    severity: 'LOW',
    minRiskScore: 0,
    responses: [], // Low risk = just record, no auto-action
  },
  {
    severity: 'MEDIUM',
    minRiskScore: 21,
    responses: ['NOTIFY_OBSERVER'],
  },
  {
    severity: 'HIGH',
    minRiskScore: 41,
    responses: ['NOTIFY_OBSERVER', 'NOTIFY_ADMIN', 'SUSPEND_SESSION'],
  },
  {
    severity: 'CRITICAL',
    minRiskScore: 71,
    responses: ['NOTIFY_OBSERVER', 'NOTIFY_ADMIN', 'NOTIFY_PLATFORM_ADMIN', 'PAUSE_VOTING', 'REQUIRE_REVERIFICATION'],
  },
]

/**
 * Execute automated responses for a newly created incident.
 * Called by the incident manager after createIncident().
 */
export async function executeAutoResponses(incidentId: string): Promise<void> {
  const incident = await db.fraudIncident.findUnique({ where: { id: incidentId } })
  if (!incident) return

  // Find the matching rule
  const rule = DEFAULT_RULES.find(
    (r) => r.severity === incident.severity && incident.riskScore >= r.minRiskScore,
  ) || DEFAULT_RULES.find((r) => r.severity === incident.severity)

  if (!rule || rule.responses.length === 0) return

  // Execute each response
  for (const response of rule.responses) {
    try {
      await executeResponse(response, incident)
    } catch (e) {
      console.error(`[eifdirs/auto-response] Failed to execute ${response}:`, e)
    }
  }
}

async function executeResponse(response: AutoResponseType, incident: any): Promise<void> {
  switch (response) {
    case 'NOTIFY_OBSERVER':
      await notifyObservers(incident)
      break
    case 'NOTIFY_ADMIN':
      await notifyAdmin(incident)
      break
    case 'NOTIFY_PLATFORM_ADMIN':
      await notifyPlatformAdmin(incident)
      break
    case 'SUSPEND_SESSION':
      await suspendSession(incident)
      break
    case 'REQUIRE_REVERIFICATION':
      await requireReverification(incident)
      break
    case 'PAUSE_VOTING':
      await pauseVoting(incident)
      break
    case 'RATE_LIMIT_IP':
      await rateLimitIp(incident)
      break
    case 'LOCK_ACCOUNT':
      await lockAccount(incident)
      break
  }
}

// ---------------------------------------------------------------------------
// Response implementations
// ---------------------------------------------------------------------------

async function notifyObservers(incident: any): Promise<void> {
  if (!incident.electionId) return

  // Find observers assigned to this election
  const observerEvents = await db.electionEvent.findMany({
    where: { electionId: incident.electionId, eventType: 'OBSERVER_ASSIGNED' },
    select: { actorId: true, actorName: true },
  })

  for (const obs of observerEvents) {
    // Create a notification for the observer
    await db.notification.create({
      data: {
        electionSessionId: incident.electionId,
        officialId: obs.actorId,
        title: `Security Alert: ${incident.incidentNumber}`,
        message: `A ${incident.severity} severity incident was detected: ${incident.title}`,
        type: incident.severity === 'CRITICAL' ? 'SECURITY' : 'WARNING',
      },
    }).catch(() => {})
  }

  await recordEvent({
    electionId: incident.electionId || undefined,
    organizationId: incident.organizationId || undefined,
    eventType: 'OBSERVER_REPORT',
    category: 'OBSERVER',
    severity: 'INFO',
    description: `Observers notified about incident ${incident.incidentNumber}`,
    actorRole: 'SYSTEM',
    actorName: 'SYSTEM',
  })
}

async function notifyAdmin(incident: any): Promise<void> {
  if (!incident.organizationId) return

  // Find org admins
  const admins = await db.organizationMember.findMany({
    where: { organizationId: incident.organizationId, role: { in: ['ORG_OWNER', 'ORG_ADMIN'] } },
    select: { id: true, email: true, name: true },
  })

  for (const admin of admins) {
    await db.notification.create({
      data: {
        electionSessionId: incident.electionId || null,
        officialId: admin.id,
        title: `Security Alert: ${incident.incidentNumber} (${incident.severity})`,
        message: `A ${incident.severity} incident was detected: ${incident.title}. Risk score: ${incident.riskScore}.`,
        type: 'SECURITY',
      },
    }).catch(() => {})
  }
}

async function notifyPlatformAdmin(incident: any): Promise<void> {
  // Find platform super admins
  const admins = await db.official.findMany({
    where: { role: 'SUPER_ADMIN' },
    select: { id: true, email: true, name: true },
  })

  for (const admin of admins) {
    await db.notification.create({
      data: {
        electionSessionId: incident.electionId || null,
        officialId: admin.id,
        title: `CRITICAL Security Alert: ${incident.incidentNumber}`,
        message: `A CRITICAL incident was detected: ${incident.title}. Risk score: ${incident.riskScore}. Immediate investigation required.`,
        type: 'SECURITY',
      },
    }).catch(() => {})
  }

  await recordEvent({
    electionId: incident.electionId || undefined,
    organizationId: incident.organizationId || undefined,
    eventType: 'SYSTEM_ERROR',
    category: 'INFRASTRUCTURE',
    severity: 'CRITICAL',
    description: `Platform admins notified about critical incident ${incident.incidentNumber}`,
    actorRole: 'SYSTEM',
    actorName: 'SYSTEM',
  })
}

async function suspendSession(incident: any): Promise<void> {
  if (!incident.electionId) return

  // Suspend active voting sessions for the flagged voter (if voter-related)
  const relatedEvents = incident.relatedEventIds ? JSON.parse(incident.relatedEventIds) : []
  if (relatedEvents.length > 0) {
    const events = await db.integrityEvent.findMany({
      where: { id: { in: relatedEvents } },
      select: { voterId: true },
    })
    const voterIds = [...new Set(events.map((e) => e.voterId).filter(Boolean))] as string[]

    for (const voterId of voterIds) {
      // Expire any active voting sessions for this voter
      await db.votingSession.updateMany({
        where: { voterId, electionId: incident.electionId, hasVoted: false },
        data: { expiresAt: new Date() }, // expire immediately
      }).catch(() => {})
    }
  }

  await recordEvent({
    electionId: incident.electionId || undefined,
    organizationId: incident.organizationId || undefined,
    eventType: 'SESSION_EXPIRED',
    category: 'AUTHENTICATION',
    severity: 'HIGH',
    description: `Session suspended due to incident ${incident.incidentNumber}`,
    actorRole: 'SYSTEM',
    actorName: 'SYSTEM',
  })
}

async function requireReverification(incident: any): Promise<void> {
  if (!incident.electionId) return

  // Flag voters linked to the incident for reverification
  const relatedEvents = incident.relatedEventIds ? JSON.parse(incident.relatedEventIds) : []
  if (relatedEvents.length > 0) {
    const events = await db.integrityEvent.findMany({
      where: { id: { in: relatedEvents } },
      select: { voterId: true },
    })
    const voterIds = [...new Set(events.map((e) => e.voterId).filter(Boolean))] as string[]

    for (const voterId of voterIds) {
      // Clear OTP so voter must re-verify
      await db.voter.update({
        where: { id: voterId },
        data: { otpCode: null, otpExpiresAt: null, otpAttempts: 0 },
      }).catch(() => {})
    }
  }

  await recordEvent({
    electionId: incident.electionId || undefined,
    organizationId: incident.organizationId || undefined,
    eventType: 'PASSWORD_RESET',
    category: 'AUTHENTICATION',
    severity: 'HIGH',
    description: `Reverification required due to incident ${incident.incidentNumber}`,
    actorRole: 'SYSTEM',
    actorName: 'SYSTEM',
  })
}

async function pauseVoting(incident: any): Promise<void> {
  if (!incident.electionId) return

  // Only pause if the election is LIVE
  const election = await db.electionSession.findUnique({
    where: { id: incident.electionId },
    select: { status: true, name: true },
  })
  if (!election || election.status !== 'LIVE') return

  await db.electionSession.update({
    where: { id: incident.electionId },
    data: { status: 'PAUSED' },
  })

  await recordEvent({
    electionId: incident.electionId,
    organizationId: incident.organizationId || undefined,
    eventType: 'ELECTION_PAUSED',
    category: 'ADMIN',
    severity: 'CRITICAL',
    riskScore: 50,
    description: `Voting paused automatically due to critical incident ${incident.incidentNumber}: ${incident.title}`,
    actorRole: 'SYSTEM',
    actorName: 'AUTOMATED_RESPONSE',
  })
}

async function rateLimitIp(incident: any): Promise<void> {
  // In production, this would add the IP to a rate-limit blocklist.
  // For now, just record the event.
  const relatedEvents = incident.relatedEventIds ? JSON.parse(incident.relatedEventIds) : []
  if (relatedEvents.length > 0) {
    const events = await db.integrityEvent.findMany({
      where: { id: { in: relatedEvents } },
      select: { ipAddress: true },
    })
    const ips = [...new Set(events.map((e) => e.ipAddress).filter(Boolean))]

    await recordEvent({
      electionId: incident.electionId || undefined,
      organizationId: incident.organizationId || undefined,
      eventType: 'RATE_LIMIT_HIT',
      category: 'INFRASTRUCTURE',
      severity: 'MEDIUM',
      description: `IPs rate-limited due to incident ${incident.incidentNumber}: ${ips.join(', ')}`,
      actorRole: 'SYSTEM',
      actorName: 'AUTOMATED_RESPONSE',
    })
  }
}

async function lockAccount(incident: any): Promise<void> {
  const relatedEvents = incident.relatedEventIds ? JSON.parse(incident.relatedEventIds) : []
  if (relatedEvents.length > 0) {
    const events = await db.integrityEvent.findMany({
      where: { id: { in: relatedEvents } },
      select: { voterId: true },
    })
    const voterIds = [...new Set(events.map((e) => e.voterId).filter(Boolean))] as string[]

    for (const voterId of voterIds) {
      await db.voter.update({
        where: { id: voterId },
        data: { flagged: true, status: 'SUSPENDED' },
      }).catch(() => {})
    }

    await recordEvent({
      electionId: incident.electionId || undefined,
      organizationId: incident.organizationId || undefined,
      eventType: 'VOTER_SUSPENDED',
      category: 'ADMIN',
      severity: 'HIGH',
      description: `${voterIds.length} account(s) locked due to incident ${incident.incidentNumber}`,
      actorRole: 'SYSTEM',
      actorName: 'AUTOMATED_RESPONSE',
    })
  }
}

/**
 * Get the configured response rules for an organization.
 * TODO: In the future, this will read from the Rules Engine (Chapter 9).
 */
export function getResponseRules(): AutoResponseRule[] {
  return DEFAULT_RULES
}
