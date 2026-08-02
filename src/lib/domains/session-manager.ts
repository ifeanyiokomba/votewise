// VoteWise — Session Manager (Enterprise Audit Part 2)
//
// Manages LoginSession, AdminSession, ObserverSession, and TrustedDevice.
// Spec: "LoginSession, VotingSession, AdminSession, ObserverSession.
// Never mix them."

import { db } from '@/lib/db'
import { randomBytes } from 'crypto'

// ---------------------------------------------------------------------------
// LoginSession — admin/official login sessions
// ---------------------------------------------------------------------------

export async function createLoginSession(input: {
  organizationId?: string
  officialId?: string
  role: string
  ipAddress?: string
  deviceFingerprint?: string
  userAgent?: string
  mfaVerified?: boolean
  ttlMinutes?: number
}): Promise<{ id: string; sessionToken: string }> {
  const sessionToken = randomBytes(32).toString('hex')
  const session = await db.loginSession.create({
    data: {
      organizationId: input.organizationId || null,
      officialId: input.officialId || null,
      sessionToken,
      role: input.role,
      ipAddress: input.ipAddress || null,
      deviceFingerprint: input.deviceFingerprint || null,
      userAgent: input.userAgent || null,
      mfaVerified: input.mfaVerified || false,
      expiresAt: new Date(Date.now() + (input.ttlMinutes || 15) * 60 * 1000),
    },
  })
  return { id: session.id, sessionToken }
}

export async function getLoginSession(sessionToken: string) {
  const session = await db.loginSession.findUnique({ where: { sessionToken } })
  if (!session) return null
  if (session.expiresAt < new Date()) return null
  if (session.revokedAt) return null
  return session
}

export async function revokeLoginSession(sessionToken: string) {
  return db.loginSession.update({
    where: { sessionToken },
    data: { revokedAt: new Date() },
  }).catch(() => null)
}

export async function listActiveLoginSessions(organizationId?: string) {
  const where: any = {
    expiresAt: { gt: new Date() },
    revokedAt: null,
  }
  if (organizationId) where.organizationId = organizationId
  return db.loginSession.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
}

// ---------------------------------------------------------------------------
// AdminSession — admin action sessions
// ---------------------------------------------------------------------------

export async function createAdminSession(input: {
  organizationId?: string
  officialId?: string
  ipAddress?: string
  deviceFingerprint?: string
}): Promise<{ id: string; sessionToken: string }> {
  const sessionToken = randomBytes(32).toString('hex')
  const session = await db.adminSession.create({
    data: {
      organizationId: input.organizationId || null,
      officialId: input.officialId || null,
      sessionToken,
      ipAddress: input.ipAddress || null,
      deviceFingerprint: input.deviceFingerprint || null,
      expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000), // 8 hours
    },
  })
  return { id: session.id, sessionToken }
}

export async function recordAdminAction(sessionToken: string) {
  const session = await db.adminSession.findUnique({ where: { sessionToken } })
  if (!session) return null
  return db.adminSession.update({
    where: { id: session.id },
    data: {
      actions: { increment: 1 },
      lastActionAt: new Date(),
    },
  })
}

// ---------------------------------------------------------------------------
// ObserverSession — observer monitoring sessions
// ---------------------------------------------------------------------------

export async function createObserverSession(input: {
  organizationId: string
  officialId?: string
  electionId?: string
  ipAddress?: string
  deviceFingerprint?: string
}): Promise<{ id: string; sessionToken: string }> {
  const sessionToken = randomBytes(32).toString('hex')
  const session = await db.observerSession.create({
    data: {
      organizationId: input.organizationId,
      officialId: input.officialId || null,
      electionId: input.electionId || null,
      sessionToken,
      ipAddress: input.ipAddress || null,
      deviceFingerprint: input.deviceFingerprint || null,
      expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours
    },
  })
  return { id: session.id, sessionToken }
}

export async function recordObserverAction(sessionToken: string, action: 'report' | 'incident') {
  const session = await db.observerSession.findUnique({ where: { sessionToken } })
  if (!session) return null
  const data: any = { lastActionAt: new Date() }
  if (action === 'report') data.reportsFiled = { increment: 1 }
  if (action === 'incident') data.incidentsFlagged = { increment: 1 }
  return db.observerSession.update({ where: { id: session.id }, data })
}

// ---------------------------------------------------------------------------
// TrustedDevice — verified devices
// ---------------------------------------------------------------------------

export async function trustDevice(input: {
  voterId?: string
  officialId?: string
  fingerprint: string
  label?: string
  browser?: string
  os?: string
  ipAddress?: string
}) {
  // Check if already trusted
  const existing = await db.trustedDevice.findFirst({
    where: {
      fingerprint: input.fingerprint,
      revokedAt: null,
      OR: [
        { voterId: input.voterId || undefined },
        { officialId: input.officialId || undefined },
      ],
    },
  })
  if (existing) return existing

  return db.trustedDevice.create({
    data: {
      voterId: input.voterId || null,
      officialId: input.officialId || null,
      fingerprint: input.fingerprint,
      label: input.label || null,
      browser: input.browser || null,
      os: input.os || null,
      ipAddress: input.ipAddress || null,
    },
  })
}

export async function isDeviceTrusted(fingerprint: string, voterId?: string, officialId?: string) {
  const where: any = { fingerprint, revokedAt: null }
  if (voterId) where.voterId = voterId
  if (officialId) where.officialId = officialId
  const device = await db.trustedDevice.findFirst({ where })
  return Boolean(device)
}

export async function listTrustedDevices(voterId?: string, officialId?: string) {
  const where: any = { revokedAt: null }
  if (voterId) where.voterId = voterId
  if (officialId) where.officialId = officialId
  return db.trustedDevice.findMany({ where, orderBy: { lastUsedAt: 'desc' } })
}

export async function revokeTrustedDevice(id: string) {
  return db.trustedDevice.update({
    where: { id },
    data: { revokedAt: new Date() },
  })
}

// ---------------------------------------------------------------------------
// Session stats
// ---------------------------------------------------------------------------

export async function getSessionStats(organizationId?: string) {
  const where = organizationId ? { organizationId } : {}
  const now = new Date()
  const [activeLogins, activeAdmins, activeObservers, trustedDevices] = await Promise.all([
    db.loginSession.count({ where: { ...where, expiresAt: { gt: now }, revokedAt: null } }),
    db.adminSession.count({ where: { ...where, expiresAt: { gt: now } } }),
    db.observerSession.count({ where }),
    db.trustedDevice.count({ where: { revokedAt: null } }),
  ])
  return { activeLogins, activeAdmins, activeObservers, trustedDevices }
}
