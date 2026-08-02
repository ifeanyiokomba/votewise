// VoteWise — Chapter 11 Fraud Detection Engine
//
// Analyzes IntegrityEvents and detects suspicious behavior across 8 categories:
//   Identity Fraud, Login Abuse, OTVP Abuse, Session Abuse, Shared Device,
//   Network Anomaly, Vote Timing, Administrative Abuse
//
// When fraud is detected, an incident is created and the event is flagged.

import { db } from '@/lib/db'
import { recordEvent } from './event-collector'
import { createIncident } from './incident-manager'
import type { IncidentCategory, IncidentSeverity } from './types'

// Risk score weights per detection type
const RISK_WEIGHTS = {
  DUPLICATE_IDENTITY: 30,
  FAILED_LOGIN_BURST: 20,
  OTVP_ABUSE: 25,
  IMPOSSIBLE_TRAVEL: 35,
  SHARED_DEVICE_HIGH: 20,
  VPN_DETECTED: 10,
  TOR_DETECTED: 25,
  DATACENTER_IP: 15,
  VOTE_BURST: 40,
  TURNOUT_SPIKE: 35,
  ADMIN_DURING_ELECTION: 45,
  RULE_CHANGE_AFTER_LIVE: 50,
  OBSERVER_EXCESS_EXPORTS: 15,
} as const

/**
 * Main fraud detection entry point. Called after each event is recorded.
 * Analyzes the event in context and creates incidents for suspicious patterns.
 */
export async function detectFraud(eventId: string): Promise<void> {
  const event = await db.integrityEvent.findUnique({ where: { id: eventId } })
  if (!event) return

  const detections: Promise<void>[] = []

  // Run all applicable detectors based on event type
  switch (event.eventType) {
    case 'LOGIN_FAILED':
      detections.push(detectLoginAbuse(event))
      break
    case 'OTVP_GENERATED':
      detections.push(detectOtpAbuse(event))
      break
    case 'VOTE_SUBMITTED':
      detections.push(detectVoteTiming(event))
      detections.push(detectSharedDevice(event))
      detections.push(detectTurnoutAnomaly(event))
      break
    case 'CANDIDATE_DELETED':
    case 'POSITION_DELETED':
    case 'RULES_CHANGED':
    case 'SETTINGS_CHANGED':
      detections.push(detectAdminAbuse(event))
      break
    case 'OBSERVER_EXPORT':
      detections.push(detectObserverAbuse(event))
      break
    case 'VOTER_IMPORTED':
      detections.push(detectVoterImportAbuse(event))
      detections.push(detectIdentityFraud(event))
      break
  }

  // Always check network + device patterns for events with IP
  if (event.ipAddress) {
    detections.push(detectNetworkAnomaly(event))
  }

  await Promise.all(detections)
}

// ---------------------------------------------------------------------------
// Login Abuse Detection
// ---------------------------------------------------------------------------

async function detectLoginAbuse(event: any): Promise<void> {
  // Check for 5+ failed logins from same IP in 5 minutes
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000)
  const recentFailures = await db.integrityEvent.count({
    where: {
      eventType: 'LOGIN_FAILED',
      ipAddress: event.ipAddress,
      createdAt: { gte: fiveMinAgo },
    },
  })

  if (recentFailures >= 5) {
    await flagEvent(event.id, {
      title: `Brute force login attempt from ${event.ipAddress}`,
      description: `${recentFailures} failed login attempts from IP ${event.ipAddress} in 5 minutes. Possible password spraying or brute force attack.`,
      category: 'LOGIN_ABUSE' as IncidentCategory,
      severity: (recentFailures >= 10 ? 'CRITICAL' : 'HIGH') as IncidentSeverity,
      riskScore: RISK_WEIGHTS.FAILED_LOGIN_BURST,
    })
  }
}

// ---------------------------------------------------------------------------
// OTVP Abuse Detection
// ---------------------------------------------------------------------------

async function detectOtpAbuse(event: any): Promise<void> {
  // Check for 5+ OTVP requests from same voter in 10 minutes
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000)
  const recentOtps = await db.integrityEvent.count({
    where: {
      eventType: 'OTVP_GENERATED',
      voterId: event.voterId,
      createdAt: { gte: tenMinAgo },
    },
  })

  if (recentOtps >= 5) {
    await flagEvent(event.id, {
      title: `OTVP abuse: ${recentOtps} requests in 10 minutes`,
      description: `Voter ${event.actorName || event.voterId} requested ${recentOtps} OTVPs in 10 minutes. Possible OTP abuse or automated requests.`,
      category: 'OTVP_ABUSE' as IncidentCategory,
      severity: (recentOtps >= 10 ? 'HIGH' : 'MEDIUM') as IncidentSeverity,
      riskScore: RISK_WEIGHTS.OTVP_ABUSE,
    })
  }
}

// ---------------------------------------------------------------------------
// Vote Timing Analysis
// ---------------------------------------------------------------------------

async function detectVoteTiming(event: any): Promise<void> {
  if (!event.electionId) return

  // Check for vote burst: 50+ votes in 30 seconds
  const thirtySecAgo = new Date(Date.now() - 30 * 1000)
  const recentVotes = await db.integrityEvent.count({
    where: {
      eventType: 'VOTE_SUBMITTED',
      electionId: event.electionId,
      createdAt: { gte: thirtySecAgo },
    },
  })

  if (recentVotes >= 50) {
    await flagEvent(event.id, {
      title: `Vote burst detected: ${recentVotes} votes in 30 seconds`,
      description: `${recentVotes} votes were submitted in 30 seconds for election ${event.electionId}. This is a statistical anomaly — possible automated voting or coordinated fraud.`,
      category: 'VOTE_TIMING' as IncidentCategory,
      severity: 'CRITICAL' as IncidentSeverity,
      riskScore: RISK_WEIGHTS.VOTE_BURST,
    })
  }
}

// ---------------------------------------------------------------------------
// Administrative Abuse Detection
// ---------------------------------------------------------------------------

async function detectAdminAbuse(event: any): Promise<void> {
  if (!event.electionId) return

  // Check if election is LIVE
  const election = await db.electionSession.findUnique({
    where: { id: event.electionId },
    select: { status: true, name: true },
  })
  if (!election || election.status !== 'LIVE') return

  const actionDesc = event.eventType.replace(/_/g, ' ').toLowerCase()
  await flagEvent(event.id, {
    title: `Admin action during live election: ${actionDesc}`,
    description: `${event.actorName || 'An administrator'} performed '${actionDesc}' during the live election '${election.name}'. This requires investigation — configuration changes during voting can affect integrity.`,
    category: 'ADMIN_ABUSE' as IncidentCategory,
    severity: 'CRITICAL' as IncidentSeverity,
    riskScore: event.eventType === 'RULES_CHANGED' || event.eventType === 'SETTINGS_CHANGED'
      ? RISK_WEIGHTS.RULE_CHANGE_AFTER_LIVE
      : RISK_WEIGHTS.ADMIN_DURING_ELECTION,
  })
}

// ---------------------------------------------------------------------------
// Observer Abuse Detection
// ---------------------------------------------------------------------------

async function detectObserverAbuse(event: any): Promise<void> {
  // Check for 10+ exports by same observer in 1 hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const recentExports = await db.integrityEvent.count({
    where: {
      eventType: 'OBSERVER_EXPORT',
      actorId: event.actorId,
      createdAt: { gte: oneHourAgo },
    },
  })

  if (recentExports >= 10) {
    await flagEvent(event.id, {
      title: `Excessive exports by observer: ${recentExports} in 1 hour`,
      description: `Observer ${event.actorName || event.actorId} performed ${recentExports} data exports in 1 hour. Possible data exfiltration or misuse of observer privileges.`,
      category: 'OBSERVER_ABUSE' as IncidentCategory,
      severity: 'MEDIUM' as IncidentSeverity,
      riskScore: RISK_WEIGHTS.OBSERVER_EXCESS_EXPORTS,
    })
  }
}

// ---------------------------------------------------------------------------
// Voter Import Abuse Detection
// ---------------------------------------------------------------------------

async function detectVoterImportAbuse(event: any): Promise<void> {
  if (!event.electionId) return

  const election = await db.electionSession.findUnique({
    where: { id: event.electionId },
    select: { status: true, startTime: true, name: true },
  })
  if (!election) return

  // Flag if voters imported within 5 minutes of voting start
  const fiveMinBeforeStart = new Date(election.startTime.getTime() - 5 * 60 * 1000)
  if (Date.now() >= fiveMinBeforeStart.getTime() && election.status !== 'DRAFT') {
    await flagEvent(event.id, {
      title: `Voter import near voting start`,
      description: `Voters were imported for election '${election.name}' within 5 minutes of voting start. This is suspicious — last-minute voter additions can be used to inject fraudulent voters.`,
      category: 'ADMIN_ABUSE' as IncidentCategory,
      severity: 'HIGH' as IncidentSeverity,
      riskScore: RISK_WEIGHTS.ADMIN_DURING_ELECTION,
    })
  }
}

// ---------------------------------------------------------------------------
// Network Anomaly Detection
// ---------------------------------------------------------------------------

async function detectNetworkAnomaly(event: any): Promise<void> {
  if (!event.ipAddress) return

  // Check for impossible travel: same voter, different country, < 10 min
  if (event.voterId) {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000)
    const recentEvents = await db.integrityEvent.findMany({
      where: {
        voterId: event.voterId,
        createdAt: { gte: tenMinAgo },
        ipAddress: { not: event.ipAddress },
      },
      select: { ipAddress: true, metadata: true },
      take: 5,
    })

    for (const prev of recentEvents) {
      const prevMeta = prev.metadata ? JSON.parse(prev.metadata) : {}
      const currMeta = event.metadata ? JSON.parse(event.metadata) : {}
      if (prevMeta.country && currMeta.country && prevMeta.country !== currMeta.country) {
        await flagEvent(event.id, {
          title: `Impossible travel: ${prevMeta.country} → ${currMeta.country} in <10min`,
          description: `Voter ${event.actorName || event.voterId} appeared in ${prevMeta.country} and then ${currMeta.country} within 10 minutes. Physically impossible — possible account sharing or session hijacking.`,
          category: 'NETWORK_ANOMALY' as IncidentCategory,
          severity: 'HIGH' as IncidentSeverity,
          riskScore: RISK_WEIGHTS.IMPOSSIBLE_TRAVEL,
        })
        break
      }
    }
  }

  // Check metadata for VPN/TOR/datacenter flags
  const meta = event.metadata ? JSON.parse(event.metadata) : {}
  if (meta.vpn === true || meta.isVpn === true) {
    await flagEvent(event.id, {
      title: `VPN usage detected: ${event.ipAddress}`,
      description: `IP ${event.ipAddress} appears to be a VPN endpoint. Voter ${event.actorName || 'unknown'} used a VPN during ${event.eventType}.`,
      category: 'NETWORK_ANOMALY' as IncidentCategory,
      severity: 'LOW' as IncidentSeverity,
      riskScore: RISK_WEIGHTS.VPN_DETECTED,
    })
  }
  if (meta.tor === true || meta.isTor === true) {
    await flagEvent(event.id, {
      title: `TOR exit node detected: ${event.ipAddress}`,
      description: `IP ${event.ipAddress} is a known TOR exit node. Voter ${event.actorName || 'unknown'} used TOR during ${event.eventType}.`,
      category: 'NETWORK_ANOMALY' as IncidentCategory,
      severity: 'MEDIUM' as IncidentSeverity,
      riskScore: RISK_WEIGHTS.TOR_DETECTED,
    })
  }
}

// ---------------------------------------------------------------------------
// Helper: flag an event + create incident
// ---------------------------------------------------------------------------

async function flagEvent(eventId: string, incident: {
  title: string
  description: string
  category: IncidentCategory
  severity: IncidentSeverity
  riskScore: number
}): Promise<void> {
  const event = await db.integrityEvent.findUnique({ where: { id: eventId } })
  if (!event) return

  // Mark event as detected
  await db.integrityEvent.update({
    where: { id: eventId },
    data: { detected: true, riskScore: incident.riskScore },
  })

  // Create incident
  await createIncident({
    organizationId: event.organizationId || undefined,
    electionId: event.electionId || undefined,
    title: incident.title,
    description: incident.description,
    category: incident.category,
    severity: incident.severity,
    riskScore: incident.riskScore,
    detectedBy: 'SYSTEM',
    relatedEventIds: [eventId],
  })
}

// ---------------------------------------------------------------------------
// Identity Fraud Detection (duplicate phone/email/matric)
// ---------------------------------------------------------------------------

async function detectIdentityFraud(event: any): Promise<void> {
  if (!event.organizationId) return

  const meta = event.metadata ? JSON.parse(event.metadata) : {}
  const { email, phone, matric } = meta

  const duplicates: string[] = []

  if (email) {
    const count = await db.voter.count({
      where: { OR: [{ email }, { institutionEmail: email }, { personalEmail: email }] },
    })
    if (count > 1) duplicates.push(`email: ${email} (${count} records)`)
  }

  if (phone) {
    const count = await db.voter.count({ where: { phone } })
    if (count > 1) duplicates.push(`phone: ${phone} (${count} records)`)
  }

  if (matric) {
    const count = await db.voter.count({ where: { matric } })
    if (count > 1) duplicates.push(`matric: ${matric} (${count} records)`)
  }

  if (duplicates.length > 0) {
    await flagEvent(event.id, {
      title: `Duplicate identity detected: ${duplicates.join(', ')}`,
      description: `Voter import detected duplicate identifiers: ${duplicates.join(', ')}. Multiple records with the same identity may indicate identity fraud or data entry errors.`,
      category: 'IDENTITY_FRAUD' as IncidentCategory,
      severity: 'HIGH' as IncidentSeverity,
      riskScore: RISK_WEIGHTS.DUPLICATE_IDENTITY,
    })
  }
}

// ---------------------------------------------------------------------------
// Shared Device Detection
// ---------------------------------------------------------------------------

async function detectSharedDevice(event: any): Promise<void> {
  if (!event.deviceFingerprint || !event.electionId) return

  // Check how many distinct voters used the same device for this election
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const deviceUsers = await db.integrityEvent.findMany({
    where: {
      deviceFingerprint: event.deviceFingerprint,
      electionId: event.electionId,
      eventType: 'VOTE_SUBMITTED',
      createdAt: { gte: oneHourAgo },
    },
    select: { voterId: true },
    distinct: ['voterId'],
  })

  const uniqueVoters = deviceUsers.filter((d) => d.voterId).length

  // Flag if 10+ different voters used the same device in 1 hour
  if (uniqueVoters >= 10) {
    await flagEvent(event.id, {
      title: `Shared device detected: ${uniqueVoters} voters on one device`,
      description: `${uniqueVoters} different voters cast votes from the same device within 1 hour. This could be a computer lab, cyber café, or coordinated fraud. Flagged for investigation — votes are NOT automatically invalidated.`,
      category: 'OTHER' as IncidentCategory,
      severity: (uniqueVoters >= 30 ? 'HIGH' : 'MEDIUM') as IncidentSeverity,
      riskScore: RISK_WEIGHTS.SHARED_DEVICE_HIGH,
    })
  }
}

// ---------------------------------------------------------------------------
// Turnout Anomaly Detection
// ---------------------------------------------------------------------------

async function detectTurnoutAnomaly(event: any): Promise<void> {
  if (!event.electionId) return

  // Check for turnout spike: 100+ votes in 1 minute
  const oneMinAgo = new Date(Date.now() - 60 * 1000)
  const recentVotes = await db.integrityEvent.count({
    where: {
      eventType: 'VOTE_SUBMITTED',
      electionId: event.electionId,
      createdAt: { gte: oneMinAgo },
    },
  })

  if (recentVotes >= 100) {
    await flagEvent(event.id, {
      title: `Turnout spike: ${recentVotes} votes in 1 minute`,
      description: `${recentVotes} votes were cast in 1 minute for this election. This is a statistical anomaly — possible coordinated voting or automation.`,
      category: 'TURNOUT_ANOMALY' as IncidentCategory,
      severity: 'CRITICAL' as IncidentSeverity,
      riskScore: RISK_WEIGHTS.TURNOUT_SPIKE,
    })
  }
}
