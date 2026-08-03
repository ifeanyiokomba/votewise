import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword } from '@/lib/crypto'
import { signAccessToken, newRefreshToken, setAuthCookies } from '@/lib/auth'
import { writeAudit, recordSecurityEvent, getClientIp, json, errorJson } from '@/lib/election'
import { RATE_LIMITS } from '@/lib/ratelimit'
import { requires2FA } from '@/lib/rbac'
import { recordEvent } from '@/lib/eifdirs'
import { schemas, validate } from '@/lib/validation'

export const dynamic = 'force-dynamic'

// POST /api/auth/login
// Body: { email, password, totp? }
// If 2FA is required and not yet provided, returns { needs2fa: true } WITHOUT
// issuing tokens. The client must then call /api/auth/2fa/verify.
export async function POST(req: NextRequest) {
  const ip = getClientIp(req) || 'unknown'
  const rl = RATE_LIMITS.authIp(ip)
  if (!rl.allowed) return errorJson('Too many login attempts. Please wait a minute.', 429)

  const raw = await req.json().catch(() => ({}))

  // Validate input with Zod (Enterprise Audit Part 4)
  const result = validate(schemas.login, raw)
  if (!result.success) return errorJson(result.error, 400)
  const { email: emailRaw, password, mfaCode: totp } = result.data
  const email = emailRaw.trim().toLowerCase()

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

  // 2FA gate — Enterprise Audit Part 4: Platform Authentication requires MFA mandatory.
  // Spec: "MFA mandatory for VoteWise owners, super admins, support team."
  // Spec: "MFA optional/required depending on role for org staff."
  //
  // CRITICAL FIX: Previously the code said `requires2FA(role) && totpEnabled`
  // — this meant if 2FA was required but NOT enrolled, the user could login
  // without 2FA! Now: if 2FA is required and NOT enrolled, BLOCK login and
  // force enrollment first.
  if (requires2FA(official.role as any)) {
    if (!official.totpEnabled) {
      // 2FA is required for this role but not yet set up — block login
      await recordSecurityEvent({
        severity: 'HIGH', category: 'AUTH_FAILURE',
        actorId: official.id, actorEmail: official.email, ipAddress: ip,
        message: `Login blocked: 2FA required but not enrolled for ${official.email}`,
      })
      return json({
        needs2faEnrollment: true,
        message: 'Multi-factor authentication is required for your role but not yet set up. Please contact your administrator to enroll.',
        enrollmentRequired: true,
      }, 403)
    }
    // 2FA is enrolled — require the code
    if (!totp) {
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

  // IP allowlist check — Enterprise Audit Part 4: "IP monitoring"
  // Spec: "Platform Authentication requires IP monitoring."
  // Look up the org via OrganizationMember to get IP allowlist settings.
  const orgMember = await db.organizationMember.findFirst({
    where: { email: official.email },
    select: { organizationId: true },
  }).catch(() => null)

  if (orgMember?.organizationId) {
    const orgSecurity = await db.organizationSecurity.findUnique({
      where: { organizationId: orgMember.organizationId },
      select: { ipAllowlist: true },
    }).catch(() => null)

    if (orgSecurity?.ipAllowlist) {
      try {
        const allowlist: string[] = JSON.parse(orgSecurity.ipAllowlist)
        if (allowlist.length > 0 && !allowlist.includes(ip)) {
          const ipAllowed = allowlist.some((range) => {
            if (range.includes('/')) {
              const [network, bits] = range.split('/')
              const ipParts = ip.split('.').map(Number)
              const netParts = network.split('.').map(Number)
              const prefixOctets = Math.ceil(parseInt(bits) / 8)
              return ipParts.slice(0, prefixOctets).every((part, i) => part === netParts[i])
            }
            return range === ip
          })
          if (!ipAllowed) {
            await recordSecurityEvent({
              severity: 'HIGH', category: 'AUTH_FAILURE',
              actorId: official.id, actorEmail: official.email, ipAddress: ip,
              message: `Login blocked from non-allowlisted IP: ${ip}`,
            })
            return errorJson('Access denied: your IP address is not on the allowlist.', 403)
          }
        }
      } catch { /* malformed allowlist — skip check */ }
    }
  }

  // Concurrent session limit — Enterprise Audit Part 4: "Session controls"
  // Limit to 3 concurrent active sessions per user to prevent credential sharing.
  const activeSessions = await db.loginSession.count({
    where: {
      officialId: official.id,
      expiresAt: { gt: new Date() },
      revokedAt: null,
    },
  }).catch(() => 0)

  if (activeSessions >= 3) {
    // Revoke the oldest session
    const oldest = await db.loginSession.findFirst({
      where: { officialId: official.id, expiresAt: { gt: new Date() }, revokedAt: null },
      orderBy: { createdAt: 'asc' },
      select: { id: true, sessionToken: true },
    }).catch(() => null)

    if (oldest) {
      await db.loginSession.update({
        where: { id: oldest.id },
        data: { revokedAt: new Date() },
      }).catch(() => {})
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
  // Create a LoginSession for session tracking (Part 4: "Session controls")
  await db.loginSession.create({
    data: {
      officialId: official.id,
      sessionToken: access.slice(-64), // use part of the JWT as session token
      role: official.role,
      ipAddress: ip,
      userAgent: req.headers.get('user-agent') || null,
      mfaVerified: requires2FA(official.role as any),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 min (matches access token TTL)
    },
  }).catch(() => {})
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
