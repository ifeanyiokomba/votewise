import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/crypto'
import { json, errorJson, writeAudit, getClientIp, recordSecurityEvent } from '@/lib/election'

export const dynamic = 'force-dynamic'

// POST /api/auth/password-reset/confirm  body: { token, password }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const token = String(body.token || '')
  const password = String(body.password || '')
  if (!token || password.length < 8) return errorJson('Token and a password of at least 8 characters are required', 400)

  const official = await db.electionOfficial.findFirst({ where: { passwordResetToken: token } })
  if (!official || !official.passwordResetExpiresAt || official.passwordResetExpiresAt < new Date()) {
    return errorJson('Reset token is invalid or expired', 400)
  }

  await db.electionOfficial.update({
    where: { id: official.id },
    data: {
      passwordHash: hashPassword(password),
      passwordResetToken: null, passwordResetExpiresAt: null,
      failedAttempts: 0, lockedUntil: null,
    },
  })
  // Revoke all refresh tokens for this official.
  await db.refreshToken.updateMany({ where: { officialId: official.id, revokedAt: null }, data: { revokedAt: new Date() } })
  await writeAudit({ actorId: official.id, actorRole: official.role, actorName: official.name, action: 'PASSWORD_RESET', ip: getClientIp(req) })
  await recordSecurityEvent({ severity: 'MEDIUM', category: 'SUSPICIOUS', actorId: official.id, actorEmail: official.email, ipAddress: getClientIp(req), message: 'Password reset completed' })
  return json({ ok: true, message: 'Password reset. Please sign in.' })
}
