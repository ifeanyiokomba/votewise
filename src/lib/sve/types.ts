// VoteWise — Secure Voting Engine (SVE) — Chapter 10
// Shared types for the voting engine.
//
// The SVE is an independent service module with clearly defined APIs.
// Every vote passes through: Authenticate → Eligibility → Rules → Accreditation
// → OTVP → Ballot Generation → Cast → Validate → Record → Audit → Confirm.

// ---------------------------------------------------------------------------
// Ballot
// ---------------------------------------------------------------------------

export interface BallotCandidate {
  id: string
  name: string
  photo?: string | null
  slogan?: string | null
  manifesto?: string | null
  politicalGroup?: string | null
  biography?: string | null
}

export interface BallotPosition {
  positionId: string
  title: string
  description?: string | null
  maximumVotes: number // 1 = single choice, >1 = multiple choice
  scope: string // ORGANIZATION | WORKSPACE | VOTER_GROUP | UNIVERSITY | FACULTY | DEPARTMENT
  candidates: BallotCandidate[]
  allowNota: boolean // None of the above
  allowAbstain: boolean
}

export interface BallotContent {
  electionId: string
  electionName: string
  electionDescription?: string | null
  votingMethod: string // Single Choice | Multiple Choice | Ranked Choice | Approval | Weighted
  positions: BallotPosition[]
  rulesHash: string // hash of the rules/version at generation time — detect mid-vote changes
  generatedAt: string
}

export interface GeneratedBallot {
  ballotId: string
  content: BallotContent
  integrityToken: string
  digitalSignature: string
  version: number
  expiresAt: string
  isSimulation: boolean
  sessionId?: string
  voter: {
    fullName: string
    eligiblePositions: number
  }
  election: {
    name: string
    votingOpen: boolean
    closesAt: string
    timeRemainingMs: number
  }
}

// ---------------------------------------------------------------------------
// Validation Pipeline
// ---------------------------------------------------------------------------

export interface ValidationContext {
  electionId: string
  voterId?: string
  sessionId?: string
  ballotId?: string
  selections: Record<string, string | string[]> // positionId -> candidateId | candidateId[] | 'NOTA'
  isSimulation: boolean
  ip: string
  device: string
}

export interface ValidationCheck {
  name: string
  passed: boolean
  message?: string
  severity: 'BLOCK' | 'WARN'
}

export interface ValidationResult {
  passed: boolean
  checks: ValidationCheck[]
  voterHash?: string
  election?: any
  ballot?: any
  voter?: any
  session?: any
  failedChecks: ValidationCheck[]
}

// ---------------------------------------------------------------------------
// Vote Recording
// ---------------------------------------------------------------------------

export interface CastVoteResult {
  ok: boolean
  receipts: Array<{
    positionId: string
    positionTitle: string
    receiptCode: string
  }>
  votedAt: string
  isSimulation: boolean
  electionId: string
  totalVotesInElection: number
  turnoutPct: number
}

// ---------------------------------------------------------------------------
// Receipt Verification
// ---------------------------------------------------------------------------

export interface ReceiptVerification {
  valid: boolean
  receiptCode: string
  electionName?: string
  positionTitle?: string
  recordedAt?: string
  isSimulation?: boolean
  message: string
}

// ---------------------------------------------------------------------------
// Live Monitoring
// ---------------------------------------------------------------------------

export interface LiveElectionStats {
  electionId: string
  electionName: string
  status: string
  eligibleVoters: number
  votesCast: number
  turnoutPct: number
  invalidVotes: number
  blankVotes: number
  lastVoteAt?: string
  votesByPosition: Array<{
    positionId: string
    title: string
    count: number
  }>
  votesByCandidate: Array<{
    positionId: string
    candidateId: string
    candidateName: string
    count: number
  }>
  recentActivity: Array<{
    type: string
    timestamp: string
    description: string
  }>
  systemHealth: {
    uptime: number
    activeSessions: number
    ballotsGenerated: number
    errorsToday: number
  }
}

// ---------------------------------------------------------------------------
// Post-Election Verification
// ---------------------------------------------------------------------------

export interface VerificationPackage {
  electionId: string
  electionName: string
  totalEligible: number
  totalVotes: number
  invalidVotes: number
  blankVotes: number
  turnoutPct: number
  auditHash: string
  integritySignature: string
  generatedAt: string
  resultsByPosition: Array<{
    positionId: string
    title: string
    totalVotes: number
    results: Array<{
      candidateId: string | null
      candidateName: string
      votes: number
      percentage: number
      isWinner: boolean
    }>
    tie: boolean
  }>
}

// ---------------------------------------------------------------------------
// Simulation
// ---------------------------------------------------------------------------

export interface SimulationResult {
  ballotId: string
  receipts: Array<{
    positionId: string
    positionTitle: string
    receiptCode: string
  }>
  results: Array<{
    positionId: string
    title: string
    candidates: Array<{ name: string; votes: number; percentage: number }>
  }>
  resetSupported: boolean
}
