// VoteWise — SVE Voting Session Manager (Chapter 10)
//
// A vote only exists inside a valid voting session. When the voter clicks
// "Vote", we create a secure session that:
// - Tracks the voter, election, device, browser, start/expiry time.
// - Is revoked after the vote is cast (single-use).
// - Is used to validate the ballot generation + vote submission.
//
// This is SEPARATE from the voter's login session (Voter.sessionToken). The
// login session authenticates the voter; the voting session authorizes a
// specific voting transaction. This separation improves auditability and
// allows us to enforce OTVP + accreditation per-vote.

import { db } from '@/lib/db'
import { randomToken } from '@/lib/crypto'
import type { NextRequest } from 'next/server'
import { getClientIp } from '@/lib/election'

export interface StartSessionOptions {
  electionId: string
  voterId: string
  organizationId: string
  req?: NextRequest
  ttlMinutes?: number // default 30
}

export interface VotingSessionInfo {
  sessionId: string
  sessionToken: string
  electionId: string
  voterId: string
  accredited: boolean
  hasVoted: boolean
  expiresAt: string
  device?: string
  ipAddress?: string
}

/**
 * Start a secure voting session for a voter. Creates a VotingSession row with
 * a 30-minute expiry. The session is used to generate a ballot and cast a
 * vote. It is revoked after the vote is recorded.
 */
export async function startVotingSession(opts: StartSessionOptions): Promise<VotingSessionInfo> {
  const { electionId, voterId, organizationId, req, ttlMinutes = 30 } = opts
  const sessionToken = randomToken(32)
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000)
  const device = req?.headers.get('user-agent')?.slice(0, 120) || 'unknown'
  const ipAddress = req ? (getClientIp(req) || undefined) : undefined

  // Deactivate any prior active sessions for this voter + election.
  await db.votingSession.updateMany({
    where: { voterId, electionId, hasVoted: false },
    data: { expiresAt: new Date() }, // expire immediately
  })

  const session = await db.votingSession.create({
    data: {
      organizationId,
      electionId,
      voterId,
      sessionToken,
      accredited: false,
      hasVoted: false,
      deviceFingerprint: device,
      ipAddress,
      expiresAt,
    },
  })

  return {
    sessionId: session.id,
    sessionToken: session.sessionToken,
    electionId,
    voterId,
    accredited: session.accredited,
    hasVoted: session.hasVoted,
    expiresAt: session.expiresAt.toISOString(),
    device: session.deviceFingerprint || undefined,
    ipAddress: session.ipAddress || undefined,
  }
}

/**
 * Get the active voting session for a voter + election (if any).
 */
export async function getActiveSession(voterId: string, electionId: string): Promise<VotingSessionInfo | null> {
  const session = await db.votingSession.findFirst({
    where: {
      voterId,
      electionId,
      hasVoted: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  })
  if (!session) return null
  return {
    sessionId: session.id,
    sessionToken: session.sessionToken,
    electionId: session.electionId!,
    voterId: session.voterId,
    accredited: session.accredited,
    hasVoted: session.hasVoted,
    expiresAt: session.expiresAt.toISOString(),
    device: session.deviceFingerprint || undefined,
    ipAddress: session.ipAddress || undefined,
  }
}

/**
 * Validate a session token. Returns the session if valid + active, null otherwise.
 */
export async function validateSession(sessionToken: string): Promise<VotingSessionInfo | null> {
  const session = await db.votingSession.findUnique({
    where: { sessionToken },
  })
  if (!session) return null
  if (session.hasVoted) return null
  if (session.expiresAt < new Date()) return null
  return {
    sessionId: session.id,
    sessionToken: session.sessionToken,
    electionId: session.electionId!,
    voterId: session.voterId,
    accredited: session.accredited,
    hasVoted: session.hasVoted,
    expiresAt: session.expiresAt.toISOString(),
    device: session.deviceFingerprint || undefined,
    ipAddress: session.ipAddress || undefined,
  }
}

/**
 * Mark a session as accredited (voter passed accreditation check).
 */
export async function accreditSession(sessionId: string): Promise<void> {
  await db.votingSession.update({
    where: { id: sessionId },
    data: { accredited: true, accreditedAt: new Date() },
  })
}
