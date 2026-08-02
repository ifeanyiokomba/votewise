// VoteWise — Chapter 11 Election Lock Manager
//
// When voting begins, critical configuration is automatically locked.
// Any attempt to modify locked configuration creates an incident unless
// an Emergency Override is used (which requires reason + audit + notification).

import { db } from '@/lib/db'
import { recordEvent } from './event-collector'
import { createIncident } from './incident-manager'

/**
 * Lock an election when it goes live. Called when status changes to LIVE.
 */
export async function lockElection(electionId: string, lockedById?: string, lockedByName?: string): Promise<void> {
  const existing = await db.electionLock.findUnique({ where: { electionId } })
  if (existing) return // already locked

  const election = await db.electionSession.findUnique({
    where: { id: electionId },
    select: { organizationId: true },
  })

  await db.electionLock.create({
    data: {
      electionId,
      organizationId: election?.organizationId || null,
      lockedById,
      lockedByName,
      candidatesLocked: true,
      positionsLocked: true,
      rulesLocked: true,
      eligibilityLocked: true,
      ballotLocked: true,
      settingsLocked: true,
    },
  })

  await recordEvent({
    organizationId: election?.organizationId || undefined,
    electionId,
    actorId: lockedById,
    actorName: lockedByName || 'SYSTEM',
    actorRole: 'SYSTEM',
    eventType: 'ELECTION_PUBLISHED',
    category: 'ADMIN',
    severity: 'INFO',
    description: `Election locked — configuration is now immutable (candidates, positions, rules, eligibility, ballot, settings)`,
    ipAddress: 'system',
  })
}

/**
 * Check if an election is locked.
 */
export async function isElectionLocked(electionId: string): Promise<boolean> {
  const lock = await db.electionLock.findUnique({ where: { electionId } })
  return !!lock
}

/**
 * Get the lock status for an election.
 */
export async function getElectionLock(electionId: string) {
  const lock = await db.electionLock.findUnique({ where: { electionId } })
  if (!lock) return null
  return {
    electionId: lock.electionId,
    lockedAt: lock.lockedAt.toISOString(),
    lockedByName: lock.lockedByName || 'SYSTEM',
    candidatesLocked: lock.candidatesLocked,
    positionsLocked: lock.positionsLocked,
    rulesLocked: lock.rulesLocked,
    eligibilityLocked: lock.eligibilityLocked,
    ballotLocked: lock.ballotLocked,
    settingsLocked: lock.settingsLocked,
    emergencyOverrides: lock.emergencyOverrides,
    lockedDown: lock.lockedDown,
    lockedDownReason: lock.lockedDownReason || undefined,
  }
}

/**
 * Check if a specific configuration type is locked, and if so, whether an
 * emergency override is needed.
 */
export async function checkLock(electionId: string, configType: 'candidates' | 'positions' | 'rules' | 'eligibility' | 'ballot' | 'settings'): Promise<{
  locked: boolean
  requiresOverride: boolean
}> {
  const lock = await db.electionLock.findUnique({ where: { electionId } })
  if (!lock) return { locked: false, requiresOverride: false }

  const fieldMap: Record<string, keyof typeof lock> = {
    candidates: 'candidatesLocked',
    positions: 'positionsLocked',
    rules: 'rulesLocked',
    eligibility: 'eligibilityLocked',
    ballot: 'ballotLocked',
    settings: 'settingsLocked',
  }

  const isLocked = lock[fieldMap[configType]] as boolean
  return { locked: isLocked, requiresOverride: isLocked }
}

/**
 * Execute an emergency override to modify locked configuration.
 * Requires reason + actor. Creates an incident + audit entry.
 */
export async function emergencyOverride(
  electionId: string,
  configType: string,
  reason: string,
  actorId: string,
  actorName: string,
): Promise<{ allowed: boolean; incidentId?: string }> {
  const lock = await db.electionLock.findUnique({ where: { electionId } })
  if (!lock) return { allowed: true }

  // Update override tracking
  await db.electionLock.update({
    where: { electionId },
    data: {
      emergencyOverrides: { increment: 1 },
      lastOverrideAt: new Date(),
      lastOverrideReason: reason,
      lastOverrideById: actorId,
      lastOverrideByName: actorName,
    },
  })

  // Record the event
  await recordEvent({
    organizationId: lock.organizationId || undefined,
    electionId,
    actorId,
    actorName,
    actorRole: 'ADMIN',
    eventType: 'EMERGENCY_OVERRIDE',
    category: 'ADMIN',
    severity: 'CRITICAL',
    riskScore: 40,
    description: `Emergency override: ${configType} modified during live election. Reason: ${reason}`,
  })

  // Create an incident for investigation
  const incidentId = await createIncident({
    organizationId: lock.organizationId || undefined,
    electionId,
    title: `Emergency override: ${configType}`,
    description: `${actorName} used emergency override to modify ${configType} during the live election. Reason: ${reason}. This requires investigation.`,
    category: 'ADMIN_ABUSE',
    severity: 'HIGH',
    riskScore: 40,
    detectedBy: actorName,
  })

  return { allowed: true, incidentId }
}

/**
 * Initiate an emergency lockdown (platform-admin only).
 * Freezes all voting, preserves sessions, locks config, preserves evidence.
 */
export async function initiateLockdown(
  electionId: string,
  reason: string,
  adminId: string,
  adminName: string,
): Promise<void> {
  const lock = await db.electionLock.findUnique({ where: { electionId } })
  if (!lock) {
    // Create lock if it doesn't exist
    await lockElection(electionId, adminId, adminName)
  }

  await db.electionLock.update({
    where: { electionId },
    data: {
      lockedDown: true,
      lockedDownAt: new Date(),
      lockedDownById: adminId,
      lockedDownByName: adminName,
      lockedDownReason: reason,
    },
  })

  // Pause the election
  await db.electionSession.update({
    where: { id: electionId },
    data: { status: 'PAUSED' },
  })

  await recordEvent({
    electionId,
    organizationId: lock?.organizationId || undefined,
    actorId: adminId,
    actorName: adminName,
    actorRole: 'PLATFORM_ADMIN',
    eventType: 'ELECTION_PAUSED',
    category: 'ADMIN',
    severity: 'CRITICAL',
    riskScore: 50,
    description: `EMERGENCY LOCKDOWN initiated by ${adminName}. Reason: ${reason}. All voting frozen, sessions preserved, evidence secured.`,
  })

  // Create a critical incident
  await createIncident({
    electionId,
    organizationId: lock?.organizationId || undefined,
    title: `Emergency lockdown: ${reason}`,
    description: `Platform admin ${adminName} initiated an emergency lockdown. All voting is frozen. This is a critical security event requiring immediate investigation.`,
    category: 'ADMIN_ABUSE',
    severity: 'CRITICAL',
    riskScore: 50,
    detectedBy: adminName,
  })
}

/**
 * Release an emergency lockdown.
 */
export async function releaseLockdown(
  electionId: string,
  reason: string,
  adminId: string,
  adminName: string,
): Promise<void> {
  await db.electionLock.update({
    where: { electionId },
    data: {
      lockedDown: false,
      lockedDownAt: null,
      lockedDownById: null,
      lockedDownByName: null,
      lockedDownReason: null,
    },
  })

  // Resume the election
  await db.electionSession.update({
    where: { id: electionId },
    data: { status: 'LIVE' },
  })

  await recordEvent({
    electionId,
    actorId: adminId,
    actorName: adminName,
    actorRole: 'PLATFORM_ADMIN',
    eventType: 'ELECTION_RESUMED',
    category: 'ADMIN',
    severity: 'HIGH',
    description: `Emergency lockdown released by ${adminName}. Reason: ${reason}. Voting resumed.`,
  })
}
