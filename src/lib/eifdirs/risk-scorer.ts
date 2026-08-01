// VoteWise — Chapter 11 Risk Scoring Engine
//
// Aggregates event severity into a risk score (0-100) for actors, elections,
// and organizations. The score determines the threat level and triggers
// automated responses.

import { db } from '@/lib/db'
import type { RiskAssessment, ThreatLevel } from './types'

const ONE_HOUR = 60 * 60 * 1000
const ONE_DAY = 24 * ONE_HOUR

/**
 * Get the aggregate risk score for an election (0-100).
 * Based on events in the last 24 hours.
 */
export async function getElectionRiskScore(electionId: string): Promise<RiskAssessment> {
  const since = new Date(Date.now() - ONE_DAY)
  const events = await db.integrityEvent.findMany({
    where: { electionId, createdAt: { gte: since } },
    select: { riskScore: true, severity: true, eventType: true, detected: true },
  })

  const factors: Array<{ factor: string; points: number; description: string }> = []
  let totalScore = 0

  for (const e of events) {
    if (e.riskScore > 0) {
      totalScore += e.riskScore
      factors.push({
        factor: e.eventType,
        points: e.riskScore,
        description: `${e.eventType} event with risk score ${e.riskScore}`,
      })
    }
  }

  // Cap at 100
  const score = Math.min(100, totalScore)
  const level = score <= 20 ? 'NORMAL' : score <= 40 ? 'OBSERVE' : score <= 70 ? 'INVESTIGATE' : 'CRITICAL'
  const threatLevel = score <= 20 ? 'LOW' : score <= 40 ? 'MODERATE' : score <= 60 ? 'ELEVATED' : score <= 80 ? 'HIGH' : 'CRITICAL'

  return { score, level: level as any, threatLevel, factors: factors.slice(-20) }
}

/**
 * Get the aggregate risk score for an organization (0-100).
 */
export async function getOrgRiskScore(organizationId: string): Promise<RiskAssessment> {
  const since = new Date(Date.now() - ONE_DAY)
  const events = await db.integrityEvent.findMany({
    where: { organizationId, createdAt: { gte: since } },
    select: { riskScore: true, eventType: true },
  })

  const factors: Array<{ factor: string; points: number; description: string }> = []
  let totalScore = 0

  for (const e of events) {
    if (e.riskScore > 0) {
      totalScore += e.riskScore
      factors.push({
        factor: e.eventType,
        points: e.riskScore,
        description: `${e.eventType} event with risk score ${e.riskScore}`,
      })
    }
  }

  const score = Math.min(100, totalScore)
  const level = score <= 20 ? 'NORMAL' : score <= 40 ? 'OBSERVE' : score <= 70 ? 'INVESTIGATE' : 'CRITICAL'
  const threatLevel = score <= 20 ? 'LOW' : score <= 40 ? 'MODERATE' : score <= 60 ? 'ELEVATED' : score <= 80 ? 'HIGH' : 'CRITICAL'

  return { score, level: level as any, threatLevel, factors: factors.slice(-20) }
}

/**
 * Get the platform-wide risk score (0-100).
 */
export async function getPlatformRiskScore(): Promise<RiskAssessment> {
  const since = new Date(Date.now() - ONE_DAY)
  const events = await db.integrityEvent.findMany({
    where: { createdAt: { gte: since } },
    select: { riskScore: true, eventType: true },
  })

  const factors: Array<{ factor: string; points: number; description: string }> = []
  let totalScore = 0

  for (const e of events) {
    if (e.riskScore > 0) {
      totalScore += e.riskScore
      factors.push({
        factor: e.eventType,
        points: e.riskScore,
        description: `${e.eventType} event with risk score ${e.riskScore}`,
      })
    }
  }

  const score = Math.min(100, Math.floor(totalScore / Math.max(1, events.length / 10)))
  const level = score <= 20 ? 'NORMAL' : score <= 40 ? 'OBSERVE' : score <= 70 ? 'INVESTIGATE' : 'CRITICAL'
  const threatLevel = score <= 20 ? 'LOW' : score <= 40 ? 'MODERATE' : score <= 60 ? 'ELEVATED' : score <= 80 ? 'HIGH' : 'CRITICAL'

  return { score, level: level as any, threatLevel, factors: factors.slice(-20) }
}

/**
 * Calculate the integrity score (inverse of risk) for an election.
 * integrityScore = 100 - riskScore (clamped to 0-100).
 */
export async function getElectionIntegrityScore(electionId: string): Promise<number> {
  const risk = await getElectionRiskScore(electionId)
  return Math.round((100 - risk.score) * 100) / 100
}

/**
 * Get threat level from a numeric score.
 */
export function scoreToThreatLevel(score: number): ThreatLevel {
  if (score <= 20) return 'LOW'
  if (score <= 40) return 'MODERATE'
  if (score <= 60) return 'ELEVATED'
  if (score <= 80) return 'HIGH'
  return 'CRITICAL'
}
