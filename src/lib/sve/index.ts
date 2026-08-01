// VoteWise — Secure Voting Engine (SVE) — Chapter 10
//
// The heart of VoteWise. An independent service module with clearly defined
// APIs for secure, auditable, real-time voting.
//
// Public API:
//   buildBallot()         — generate a secure ballot dynamically
//   castVote()            — record a vote atomically (8-step validation + txn)
//   verifyReceipt()       — verify a receipt without revealing choices
//   startVotingSession()  — create a secure voting session
//   runSimulation()       — ballot preview + test vote (no real data)
//   resetSimulation()     — clear simulation data
//   tallyElection()       — post-election count + verification package
//   getLiveStats()        — real-time turnout + vote count (cached)
//   runValidationPipeline()— the 8-step validation (used internally)
//
// Every vote passes through:
//   Login → Eligibility → Rules → Accreditation → OTVP → Ballot → Cast
//        → Validate → Record → Audit → Confirm
//
// No shortcuts.

export * from './types'
export * from './crypto'
export { buildBallot } from './ballot-builder'
export type { BuildBallotOptions, BuildBallotResult } from './ballot-builder'
export { runValidationPipeline } from './validation-pipeline'
export { castVote, CastVoteError } from './vote-recorder'
export type { CastVoteOptions } from './vote-recorder'
export { verifyReceipt, generateReceiptCode } from './receipt'
export { startVotingSession, getActiveSession, validateSession, accreditSession } from './session'
export type { StartSessionOptions, VotingSessionInfo } from './session'
export { getLiveStats, getAllLiveStats, incrementLiveCount, clearLiveCache } from './live-counter'
export { runSimulation, resetSimulation, previewBallot, listSimulations } from './simulation'
export { tallyElection, persistVerification, getVerification } from './tally'
export type { TallyOptions, TallyResult } from './tally'
