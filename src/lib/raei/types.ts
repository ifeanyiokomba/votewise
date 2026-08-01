// VoteWise — Chapter 13 RAEI Types
// Reporting, Analytics & Election Intelligence

export type DashboardLevel = 'PLATFORM' | 'ORGANIZATION' | 'ELECTION'
export type ReportType =
  | 'ELECTION_SUMMARY' | 'TURNOUT_REPORT' | 'CANDIDATE_REPORT'
  | 'SECURITY_REPORT' | 'OBSERVER_REPORT' | 'COMMUNICATION_REPORT'
  | 'AUDIT_REPORT' | 'CERTIFICATION_PACKAGE' | 'CUSTOM'
export type ExportFormat = 'PDF' | 'EXCEL' | 'CSV' | 'JSON' | 'PRINT'
export type TrendDirection = 'UP' | 'DOWN' | 'FLAT'

// Platform-level dashboard
export interface PlatformDashboard {
  organizations: number
  activeElections: number
  votesToday: number
  platformHealth: number  // uptime %
  revenue: number
  integrityScore: number
  totalVoters: number
  totalVotesCast: number
  electionsByStatus: Record<string, number>
  votesTimeline: Array<{ date: string; count: number }>
  topOrganizations: Array<{ id: string; name: string; elections: number; voters: number; turnout: number }>
  recentActivity: Array<{ type: string; description: string; timestamp: string }>
  kpis: PlatformKPIs
}

export interface PlatformKPIs {
  avgTurnout: number
  avgVotingTime: number  // minutes
  avgIncidentCount: number
  avgResponseTime: number  // minutes
  avgOtpDeliveryRate: number
  electionSuccessRate: number  // % of elections completed without critical issues
}

// Organization-level dashboard
export interface OrgDashboard {
  elections: number
  eligibleVoters: number
  votesCast: number
  turnoutPct: number
  openIncidents: number
  supportTickets: number
  integrityScore: number
  electionsByStatus: Record<string, number>
  turnoutTrend: Array<{ electionId: string; name: string; turnoutPct: number; date: string }>
  participationFunnel: ParticipationFunnel
  communicationStats: CommunicationStats
  securityStats: SecurityStats
  supportStats: SupportStats
  demographicBreakdown: Array<{ label: string; eligible: number; voted: number; turnoutPct: number }>
  votesPerHour: Array<{ hour: string; count: number }>
}

export interface ParticipationFunnel {
  invited: number
  eligible: number
  accredited: number
  otvpSent: number
  otvpVerified: number
  ballotsStarted: number
  votesCompleted: number
}

export interface CommunicationStats {
  totalSent: number
  delivered: number
  failed: number
  deliveryRate: number
  openRate: number
  clickRate: number
  byChannel: Record<string, { sent: number; delivered: number; failed: number }>
}

export interface SecurityStats {
  threatLevel: string
  totalIncidents: number
  openIncidents: number
  criticalIncidents: number
  resolvedIncidents: number
  blockedAttempts: number
  integrityScore: number
}

export interface SupportStats {
  totalTickets: number
  openTickets: number
  avgResponseTime: number  // minutes
  avgResolutionTime: number  // hours
  topIssues: Array<{ category: string; count: number }>
  satisfactionScore: number  // 0-100 (future)
}

// Election-level dashboard
export interface ElectionDashboard {
  electionId: string
  name: string
  status: string
  startTime: string
  endTime: string
  eligibleVoters: number
  votesCast: number
  turnoutPct: number
  remaining: number
  otvpDeliveryRate: number
  votesPerMinute: number
  activeSessions: number
  ballotsGenerated: number
  incidents: number
  participationFunnel: ParticipationFunnel
  votesTimeline: Array<{ timestamp: string; count: number }>
  candidateResults: Array<{
    positionId: string
    title: string
    candidates: Array<{ name: string; votes: number; percentage: number; isWinner: boolean }>
  }>
  demographicBreakdown: Array<{ label: string; eligible: number; voted: number; turnoutPct: number }>
}

// Historical comparison
export interface HistoricalComparison {
  elections: Array<{
    electionId: string
    name: string
    date: string
    turnoutPct: number
    totalVotes: number
    eligibleVoters: number
    incidents: number
    duration: number  // hours
  }>
  trends: {
    turnout: TrendDirection
    participation: TrendDirection
    incidents: TrendDirection
  }
  averages: {
    turnout: number
    votes: number
    incidents: number
    duration: number
  }
}

// Report
export interface ReportConfig {
  type: ReportType
  format: ExportFormat
  electionId?: string
  organizationId?: string
  dateRange?: { start: string; end: string }
  fields?: string[]
  filters?: Record<string, any>
}

export interface ReportResult {
  id: string
  type: ReportType
  format: ExportFormat
  generatedAt: string
  data: any
  downloadUrl?: string
}

// Certification Package
export interface CertificationPackage {
  electionId: string
  electionName: string
  generatedAt: string
  sections: {
    results: any
    integrity: any
    observerReports: any[]
    auditLogs: any[]
    communicationSummary: any
    incidentSummary: any
    analyticsSummary: any
  }
  auditHash: string
  signature: string
}

// AI Insight
export interface AIInsight {
  type: 'POSITIVE' | 'WARNING' | 'NEGATIVE' | 'INFORMATIONAL'
  category: string
  title: string
  description: string
  recommendation?: string
  confidence: number  // 0-100
}

// Election Replay Studio
export interface ReplayEvent {
  id: string
  timestamp: string
  type: 'ELECTION_OPENED' | 'FIRST_VOTE' | 'TURNOUT_MILESTONE' | 'REMINDER_SENT'
    | 'INCIDENT_DETECTED' | 'INCIDENT_RESOLVED' | 'VOTE_SPIKE' | 'OTVP_SPIKE'
    | 'ELECTION_CLOSED' | 'COUNTING_STARTED' | 'RESULTS_CERTIFIED' | 'CUSTOM'
  title: string
  description: string
  severity?: string
  metadata?: Record<string, any>
}
