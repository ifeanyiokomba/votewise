import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword } from '@/lib/crypto'
import { signAccessToken, newRefreshToken, setAuthCookies } from '@/lib/auth'
import { writeAudit, recordSecurityEvent, getClientIp, json, errorJson } from '@/lib/election'
import { RATE_LIMITS } from '@/lib/ratelimit'
import { requires2FA } from '@/lib/rbac'
import { recordEvent } from '@/lib/eifdirs'

export const dynamic = 'force-dynamic'

// POST /api/auth/login
// Body: { email, password, totp? }
// If 2FA is required and not yet provided, returns { needs2fa: true } WITHOUT
// issuing tokens. The client must then call /api/auth/2fa/verify.
export async function POST(req: NextRequest) {
  const ip = getClientIp(req) || 'unknown'
  const rl = RATE_LIMITS.authIp(ip)
  if (!rl.allowed) return errorJson('Too many login attempts. Please wait a minute.', 429)

  const body = await req.json().catch(() => ({}))
  const email = String(body.email || '').trim().toLowerCase()
  const password = String(body.password || '')
  const totp = body.totp ? String(body.totp) : undefined
  if (!email || !password) return errorJson('Email and password are required', 400)

  const official = await db.electionOfficial.findUnique({ where: { email } })
  if (!official || !verifyPassword(password, official.passwordHash)) {
    // Increment failed attempts (lockout after 5).
    if (official) {
      const attempts = official.failedAttempts + 1
      const lockUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null
      await db.electionOfficial.update({
        where: { id: official.id },
        data: { failedAttempts: attempts, lockedUntil: lockUntil },
      })
      await recordSecurityEvent({
        severity: attempts >= 5 ? 'HIGH' : 'LOW',
        category: 'AUTH_FAILURE',
        actorId: official.id, actorEmail: official.email, ipAddress: ip,
        message: `Failed login attempt ${attempts} for ${official.email}${lockUntil ? ' — account locked 15min' : ''}`,
      })
      // EIFDIRS: Record integrity event for fraud detection
      await recordEvent({
        actorId: official.id,
        actorName: official.email,
        actorRole: official.role,
        eventType: 'LOGIN_FAILED',
        category: 'AUTHENTICATION',
        severity: attempts >= 5 ? 'HIGH' : 'MEDIUM',
        riskScore: attempts >= 5 ? 25 : 10,
        description: `Failed login attempt ${attempts} for ${official.email}${lockUntil ? ' — account locked' : ''}`,
        ipAddress: ip,
        metadata: { attempts, locked: !!lockUntil },
      }).catch(() => {})
    }
    return errorJson('Invalid email or password', 401)
  }

  if (official.lockedUntil && official.lockedUntil > new Date()) {
    return errorJson('Account is temporarily locked. Try again later.', 423)
  }
  if (!official.emailVerified) {
    return errorJson('Please verify your email before signing in.', 403)
  }

  // 2FA gate.
  if (requires2FA(official.role as any) && official.totpEnabled) {
    if (!totp) {
      // Don't reveal whether 2FA is enabled to unauthenticated callers in
      // production — but for our dashboard UX we return a hint.
      return json({ needs2fa: true, message: 'Two-factor authentication required.' })
    }
    const { verifyTotp } = await import('@/lib/crypto')
    if (!verifyTotp(totp, official.totpSecret!)) {
      await recordSecurityEvent({
        severity: 'HIGH', category: 'AUTH_FAILURE',
        actorId: official.id, actorEmail: official.email, ipAddress: ip,
        message: 'Failed 2FA verification',
      })
      return errorJson('Invalid 2FA code', 401)
    }
  }

  // Success — issue access + refresh tokens, set cookies, persist refresh.
  const access = await signAccessToken({
    sub: official.id, role: official.role, name: official.name, email: official.email,
    scopeFacultyId: official.scopeFacultyId, scopeDepartmentId: official.scopeDepartmentId,
  })
  const refresh = newRefreshToken()
  await db.refreshToken.create({
    data: {
      officialId: official.id,
      tokenHash: refresh.tokenHash,
      family: refresh.family,
      ipAddress: ip,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  })
  await db.electionOfficial.update({
    where: { id: official.id },
    data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  })
  await setAuthCookies(access, refresh.token)
  await writeAudit({
    actorId: official.id, actorRole: official.role, actorName: official.name,
    action: 'OFFICIAL_LOGIN', ip,
  })
  // EIFDIRS: Record successful login
  await recordEvent({
    actorId: official.id,
    actorName: official.name,
    actorRole: official.role,
    eventType: 'LOGIN',
    category: 'AUTHENTICATION',
    severity: 'INFO',
    description: `Admin login: ${official.name} (${official.email})`,
    ipAddress: ip,
  }).catch(() => {})
  return json({
    ok: true,
    official: {
      id: official.id, name: official.name, email: official.email, role: official.role,
      scopeFacultyId: official.scopeFacultyId, scopeDepartmentId: official.scopeDepartmentId,
      totpEnabled: official.totpEnabled,
    },
  })
}
