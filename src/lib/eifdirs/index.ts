// VoteWise — Chapter 11 EIFDIRS Public API

export * from './types'
export { recordEvent, getEventStream, getEventStats } from './event-collector'
export { detectFraud } from './fraud-detector'
export { getElectionRiskScore, getOrgRiskScore, getPlatformRiskScore, getElectionIntegrityScore, scoreToThreatLevel } from './risk-scorer'
export {
  createIncident, getIncident, listIncidents, assignIncident,
  updateIncidentStatus, addInvestigationNote, addEvidence,
  markFalsePositive, escalateIncident, getIncidentStats,
} from './incident-manager'
export {
  lockElection, isElectionLocked, getElectionLock, checkLock,
  emergencyOverride, initiateLockdown, releaseLockdown,
} from './election-lock'
export { generateIntegrityCertificate, getIntegrityCertificate, generateTransparencyReport } from './certificate-generator'
export { executeAutoResponses, getResponseRules } from './auto-responder'
export type { AutoResponseRule, AutoResponseType } from './auto-responder'
