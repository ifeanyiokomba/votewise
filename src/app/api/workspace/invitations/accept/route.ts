import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson, writeAudit, getClientIp } from '@/lib/election'
import { hashPassword } from '@/lib/crypto'
import { validatePassword } from '@/lib/password-policy'
import { signAccessToken, newRefreshToken, setAuthCookies } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// POST /api/workspace/invitations/accept — accept an invitation.
// Body: { token, password }
// Validates the token, enforces password policy, activates the account,
// issues auth tokens, and audits the event.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { token, password } = body

  if (!token || !password)
    return errorJson('Token and password are required', 400)

  // Validate password policy (Chapter 4: 12+ chars, upper, lower, number, special).
  const pwCheck = validatePassword(password)
  if (!pwCheck.valid) {
    return errorJson('Password does not meet requirements', 400, { errors: pwCheck.errors })
  }

  // Find the pending member by token.
  const member = await db.organizationMember.findFirst({
    where: {
      passwordResetToken: token,
      accountStatus: 'PENDING',
    },
  }).catch(() => null)

  if (!member) return errorJson('Invalid or expired invitation token', 404)

  // Check token expiry.
  if (member.passwordResetExpiresAt && member.passwordResetExpiresAt < new Date()) {
    return errorJson('Invitation has expired. Please request a new invitation.', 410)
  }

  // Activate the account: set password, clear token, set ACTIVE status.
  await db.organizationMember.update({
    where: { id: member.id },
    data: {
      passwordHash: hashPassword(password),
      passwordResetToken: null,
      passwordResetExpiresAt: null,
      accountStatus: 'ACTIVE',
      emailVerified: true,
      lastLoginAt: new Date(),
    },
  })

  // Also create a bridging ElectionOfficial so legacy cookie auth works.
  const official = await db.electionOfficial.upsert({
    where: { email: member.email },
    create: {
      email: member.email,
      name: member.name,
      role: member.role === 'ORG_OWNER' ? 'SUPER_ADMIN' : (member.role === 'ORG_ADMIN' ? 'ELECTORAL_COMMITTEE' : member.role),
      organization: member.organizationId || '',
      passwordHash: hashPassword(password),
      emailVerified: true,
    },
    update: {
      passwordHash: hashPassword(password),
      emailVerified: true,
    },
  }).catch(() => null)

  // Issue auth tokens.
  if (official) {
    const access = await signAccessToken({
      sub: official.id, role: official.role, name: official.name, email: official.email,
    })
    const refresh = newRefreshToken()
    await db.refreshToken.create({
      data: {
        officialId: official.id,
        tokenHash: refresh.tokenHash,
        family: refresh.family,
        ipAddress: getClientIp(req),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    }).catch(() => {})
    await setAuthCookies(access, refresh.token)
  }

  await writeAudit({
    actorId: member.id, actorRole: member.role, actorName: member.name,
    action: 'INVITATION_ACCEPTED',
    details: { organizationId: member.organizationId, email: member.email, role: member.role },
    ip: getClientIp(req),
  }).catch(() => {})

  return json({
    ok: true,
    member: {
      id: member.id, name: member.name, email: member.email, role: member.role,
    },
    official: official ? {
      id: official.id, name: official.name, email: official.email, role: official.role,
    } : null,
  })
}
