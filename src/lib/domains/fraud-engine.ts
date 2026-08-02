// VoteWise — Fraud Engine Service (Enterprise Audit Part 2)
//
// Provides CRUD + business logic for the 4 new fraud models:
//   FraudRule, FraudScore, FraudEvidence, FraudDecision
//
// Spec: "Multiple device login, Duplicate IP, VPN, Bot detection, Impossible
// travel, High velocity. Everything recorded."

import { db } from '@/lib/db'

// ---------------------------------------------------------------------------
// FraudRule — configurable detection thresholds
// ---------------------------------------------------------------------------

export interface FraudRuleInput {
  organizationId?: string
  name: string
  detector: string
  threshold: number
  windowMinutes?: number
  severity?: string
  action?: string
  description?: string
  enabled?: boolean
}

export async function createFraudRule(input: FraudRuleInput) {
  return db.fraudRule.create({
    data: {
      organizationId: input.organizationId || null,
      name: input.name,
      detector: input.detector,
      threshold: input.threshold,
      windowMinutes: input.windowMinutes || 5,
      severity: input.severity || 'MEDIUM',
      action: input.action || 'ALERT',
      description: input.description || null,
      enabled: input.enabled ?? true,
    },
  })
}

export async function listFraudRules(organizationId?: string) {
  const where = organizationId
    ? { OR: [{ organizationId }, { organizationId: null }] }
    : { organizationId: null }
  return db.fraudRule.findMany({ where, orderBy: { detector: 'asc' } })
}

export async function updateFraudRule(id: string, update: Partial<FraudRuleInput>) {
  return db.fraudRule.update({ where: { id }, data: update })
}

export async function deleteFraudRule(id: string) {
  return db.fraudRule.delete({ where: { id } })
}

/**
 * Seed default fraud rules if none exist. These cover the 11 detector types
 * from the audit spec.
 */
export async function ensureFraudRulesSeeded() {
  const count = await db.fraudRule.count()
  if (count > 0) return

  const defaults: FraudRuleInput[] = [
    { name: 'Vote Flooding', detector: 'VOTE_FLOODING', threshold: 10, windowMinutes: 5, severity: 'CRITICAL', action: 'BLOCK', description: 'More than 10 votes from the same IP in 5 minutes' },
    { name: 'Geo-Anomaly (Impossible Travel)', detector: 'GEO_ANOMALY', threshold: 500, windowMinutes: 60, severity: 'HIGH', action: 'ALERT', description: 'Impossible travel: 500km in < 1 hour' },
    { name: 'Device Fingerprint Reuse', detector: 'DEVICE_REUSE', threshold: 3, windowMinutes: 60, severity: 'HIGH', action: 'ALERT', description: 'Same device used by 3+ voters in 1 hour' },
    { name: 'Velocity Check', detector: 'VELOCITY', threshold: 30, windowMinutes: 1, severity: 'HIGH', action: 'BLOCK', description: 'Voting faster than 30s per vote (bot speed)' },
    { name: 'OTVP Abuse', detector: 'OTVP_ABUSE', threshold: 5, windowMinutes: 30, severity: 'HIGH', action: 'BLOCK', description: '5+ failed OTP attempts in 30 minutes' },
    { name: 'Session Hijack', detector: 'SESSION_HIJACK', threshold: 2, windowMinutes: 60, severity: 'CRITICAL', action: 'BLOCK', description: 'Token reuse from different fingerprint' },
    { name: 'Ballot Stuffing', detector: 'BALLOT_STUFFING', threshold: 80, windowMinutes: 60, severity: 'CRITICAL', action: 'ALERT', description: 'One candidate receiving >80% of votes in a time window' },
    { name: 'Coordinated Attack', detector: 'COORDINATED_ATTACK', threshold: 10, windowMinutes: 30, severity: 'CRITICAL', action: 'LOCK_ELECTION', description: '10+ suspicious events clustered in 30 minutes' },
    { name: 'VPN Detection', detector: 'VPN', threshold: 1, windowMinutes: 60, severity: 'MEDIUM', action: 'ALERT', description: 'Voter using a known VPN/proxy IP' },
    { name: 'Bot Detection', detector: 'BOT', threshold: 0.8, windowMinutes: 5, severity: 'HIGH', action: 'BLOCK', description: 'Bot probability score > 0.8 (headless browser patterns)' },
    { name: 'Duplicate IP', detector: 'DUPLICATE_IP', threshold: 5, windowMinutes: 60, severity: 'MEDIUM', action: 'ALERT', description: '5+ voters from the same IP address' },
  ]

  await db.fraudRule.createMany({ data: defaults })
}

// ---------------------------------------------------------------------------
// FraudScore — per-voter per-election risk score
// ---------------------------------------------------------------------------

export interface FraudScoreInput {
  organizationId: string
  electionId?: string
  voterId?: string
  score: number
  level?: string
  signals?: Array<{ detector: string; weight: number; detail: string }>
  factors?: Record<string, number>
}

export async function recordFraudScore(input: FraudScoreInput) {
  return db.fraudScore.create({
    data: {
      organizationId: input.organizationId,
      electionId: input.electionId || null,
      voterId: input.voterId || null,
      score: input.score,
      level: input.level || scoreToLevel(input.score),
      signals: input.signals ? JSON.stringify(input.signals) : null,
      factors: input.factors ? JSON.stringify(input.factors) : null,
    },
  })
}

export async function getVoterFraudScore(voterId: string, electionId?: string) {
  return db.fraudScore.findFirst({
    where: { voterId, electionId: electionId || undefined },
    orderBy: { computedAt: 'desc' },
  })
}

export async function listHighRiskScores(organizationId: string, threshold: number = 50, limit: number = 50) {
  return db.fraudScore.findMany({
    where: { organizationId, score: { gte: threshold } },
    orderBy: { score: 'desc' },
    take: limit,
  })
}

function scoreToLevel(score: number): string {
  if (score >= 80) return 'CRITICAL'
  if (score >= 60) return 'HIGH'
  if (score >= 40) return 'ELEVATED'
  if (score >= 20) return 'MODERATE'
  return 'LOW'
}

// ---------------------------------------------------------------------------
// FraudEvidence — immutable evidence attached to incidents
// ---------------------------------------------------------------------------

export interface FraudEvidenceInput {
  incidentId: string
  type: string
  description: string
  data: Record<string, any>
  collectedBy?: string
}

export async function addFraudEvidence(input: FraudEvidenceInput) {
  return db.fraudEvidence.create({
    data: {
      incidentId: input.incidentId,
      type: input.type,
      description: input.description,
      data: JSON.stringify(input.data),
      collectedBy: input.collectedBy || 'SYSTEM',
    },
  })
}

export async function listFraudEvidence(incidentId: string) {
  const evidence = await db.fraudEvidence.findMany({
    where: { incidentId },
    orderBy: { collectedAt: 'asc' },
  })
  return evidence.map((e) => ({ ...e, data: e.data ? JSON.parse(e.data) : null }))
}

// ---------------------------------------------------------------------------
// FraudDecision — audit trail of resolutions
// ---------------------------------------------------------------------------

export interface FraudDecisionInput {
  incidentId: string
  decision: string
  decidedBy: string
  decidedByName: string
  reason?: string
  actionTaken?: string
}

export async function recordFraudDecision(input: FraudDecisionInput) {
  return db.fraudDecision.create({ data: input })
}

export async function listFraudDecisions(incidentId: string) {
  return db.fraudDecision.findMany({
    where: { incidentId },
    orderBy: { createdAt: 'asc' },
  })
}

// ---------------------------------------------------------------------------
// Aggregate stats
// ---------------------------------------------------------------------------

export async function getFraudEngineStats(organizationId?: string) {
  const where = organizationId ? { organizationId } : {}
  const [rules, scores, highRisk, critical, evidence, decisions] = await Promise.all([
    db.fraudRule.count(),
    db.fraudScore.count({ where }),
    db.fraudScore.count({ where: { ...where, score: { gte: 50 } } }),
    db.fraudScore.count({ where: { ...where, score: { gte: 80 } } }),
    db.fraudEvidence.count(),
    db.fraudDecision.count(),
  ])
  return { rules, scores, highRisk, critical, evidence, decisions }
}
