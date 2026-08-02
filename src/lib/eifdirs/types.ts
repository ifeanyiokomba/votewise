// VoteWise — Chapter 11 EIFDIRS Types
// Election Integrity, Fraud Detection & Incident Response System

// ---------------------------------------------------------------------------
// Integrity Events
// ---------------------------------------------------------------------------

export type EventCategory =
  | 'IDENTITY' | 'AUTHENTICATION' | 'VOTING' | 'ADMIN'
  | 'OBSERVER' | 'INFRASTRUCTURE' | 'NETWORK' | 'AUTOMATION'

export type EventSeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export type EventType =
  // Authentication
  | 'LOGIN' | 'LOGOUT' | 'LOGIN_FAILED' | 'LOGIN_BLOCKED'
  | 'PASSWORD_RESET' | 'SESSION_EXPIRED'
  // OTVP
  | 'OTVP_GENERATED' | 'OTVP_DELIVERED' | 'OTVP_FAILED' | 'OTVP_VERIFIED' | 'OTVP_ABUSE'
  // Voting
  | 'VOTE_STARTED' | 'VOTE_SUBMITTED' | 'VOTE_REJECTED' | 'BALLOT_GENERATED' | 'BALLOT_EXPIRED'
  // Admin
  | 'CANDIDATE_ADDED' | 'CANDIDATE_UPDATED' | 'CANDIDATE_DELETED' | 'CANDIDATE_SCREENED'
  | 'POSITION_ADDED' | 'POSITION_UPDATED' | 'POSITION_DELETED'
  | 'VOTER_IMPORTED' | 'VOTER_SUSPENDED' | 'VOTER_REACTIVATED'
  | 'ELECTION_PUBLISHED' | 'ELECTION_PAUSED' | 'ELECTION_RESUMED' | 'ELECTION_CLOSED' | 'ELECTION_CERTIFIED'
  | 'RULES_CHANGED' | 'SETTINGS_CHANGED' | 'EMERGENCY_OVERRIDE'
  // Observer
  | 'OBSERVER_LOGIN' | 'OBSERVER_EXPORT' | 'OBSERVER_SEARCH' | 'OBSERVER_REPORT'
  // Infrastructure
  | 'SYSTEM_ERROR' | 'RATE_LIMIT_HIT' | 'WEBSOCKET_DISCONNECT'
  // Network
  | 'VPN_DETECTED' | 'PROXY_DETECTED' | 'TOR_DETECTED' | 'DATACENTER_IP' | 'IMPOSSIBLE_TRAVEL'

export interface IntegrityEventInput {
  organizationId?: string
  electionId?: string
  voterId?: string
  actorId?: string
  actorName?: string
  actorRole?: string
  eventType: EventType
  category: EventCategory
  severity?: EventSeverity
  riskScore?: number
  description: string
  metadata?: Record<string, any>
  ipAddress?: string
  deviceFingerprint?: string
}

export interface IntegrityEventRecord extends IntegrityEventInput {
  id: string
  detected: boolean
  incidentId?: string
  createdAt: string
}

// ---------------------------------------------------------------------------
// Fraud Incidents
// ---------------------------------------------------------------------------

export type IncidentCategory =
  | 'IDENTITY_FRAUD' | 'LOGIN_ABUSE' | 'OTVP_ABUSE' | 'SESSION_ABUSE'
  | 'SHARED_DEVICE' | 'NETWORK_ANOMALY' | 'VOTE_TIMING' | 'TURNOUT_ANOMALY'
  | 'ADMIN_ABUSE' | 'OBSERVER_ABUSE' | 'AUTOMATION' | 'OTHER'

export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export type IncidentStatus =
  | 'DETECTED' | 'OPEN' | 'ASSIGNED' | 'INVESTIGATING'
  | 'CONTAINMENT' | 'RESOLVED' | 'CLOSED' | 'ARCHIVED'

export interface FraudIncidentInput {
  organizationId?: string
  electionId?: string
  title: string
  description: string
  category: IncidentCategory
  severity?: IncidentSeverity
  riskScore?: number
  detectedBy?: string
  relatedEventIds?: string[]
}

export interface InvestigationNote {
  note: string
  author: string
  authorId?: string
  timestamp: string
}

export interface EvidenceItem {
  type: string  // LOG | SCREENSHOT | FILE | WITNESS | SYSTEM_LOG
  description: string
  data?: string  // base64 or URL
  collectedBy: string
  collectedAt: string
}

export interface CustodyStep {
  action: string
  actor: string
  actorId?: string
  timestamp: string
  signature?: string
}

// ---------------------------------------------------------------------------
// Risk Scoring
// ---------------------------------------------------------------------------

export type ThreatLevel = 'LOW' | 'MODERATE' | 'ELEVATED' | 'HIGH' | 'CRITICAL'

export interface RiskAssessment {
  score: number  // 0-100
  level: 'NORMAL' | 'OBSERVE' | 'INVESTIGATE' | 'CRITICAL'
  threatLevel: ThreatLevel
  factors: Array<{ factor: string; points: number; description: string }>
}

// ---------------------------------------------------------------------------
// Integrity Dashboard
// ---------------------------------------------------------------------------

export interface IntegrityDashboard {
  // Overview
  activeElections: number
  threatLevel: ThreatLevel
  activeIncidents: number
  blockedAttempts: number
  integrityScore: number  // 0-100
  platformHealth: 'HEALTHY' | 'DEGRADED' | 'CRITICAL'
  // Breakdown
  incidentsBySeverity: Record<IncidentSeverity, number>
  incidentsByCategory: Record<IncidentCategory, number>
  eventsByCategory: Record<EventCategory, number>
  recentIncidents: FraudIncidentSummary[]
  recentEvents: IntegrityEventSummary[]
  // Trends
  eventsPerHour: number
  incidentsToday: number
  resolvedToday: number
}

export interface FraudIncidentSummary {
  id: string
  incidentNumber: string
  title: string
  severity: IncidentSeverity
  status: IncidentStatus
  riskScore: number
  detectedAt: string
  electionName?: string
}

export interface IntegrityEventSummary {
  id: string
  eventType: string
  category: string
  severity: string
  description: string
  actorName?: string
  detected: boolean
  createdAt: string
}

// ---------------------------------------------------------------------------
// Election Lock
// ---------------------------------------------------------------------------

export interface ElectionLockInfo {
  electionId: string
  lockedAt: string
  lockedByName: string
  candidatesLocked: boolean
  positionsLocked: boolean
  rulesLocked: boolean
  eligibilityLocked: boolean
  ballotLocked: boolean
  settingsLocked: boolean
  emergencyOverrides: number
  lockedDown: boolean
  lockedDownReason?: string
}
