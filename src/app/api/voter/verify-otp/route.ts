import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { randomToken } from '@/lib/crypto'
import { json, errorJson, getElectionContext, getClientIp, writeAudit, recordSecurityEvent } from '@/lib/election'
import { deviceFromRequest } from '@/lib/device'

export const dynamic = 'force-dynamic'

// POST /api/voter/verify-otp  body: { matric, otp }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const matric = String(body.matric || '').trim().toUpperCase()
  const otp = String(body.otp || '').trim()
  if (!matric || !otp) return errorJson('Matriculation number and OTP are required', 400)

  const { settings } = await getElectionContext()
  const maxAttempts = settings?.maxOtpAttempts ?? 5

  const voter = await db.voter.findUnique({ where: { matric } })
  if (!voter) return errorJson('Voter not found', 404)
  if (voter.hasVoted) return errorJson('You have already voted', 409)
  if (voter.lockedUntil && voter.lockedUntil > new Date()) return errorJson('Account temporarily locked.', 423)
  if (!voter.otpCode || !voter.otpExpiresAt) return errorJson('No OTP was issued. Please request a new code.', 400)
  if (voter.otpExpiresAt < new Date()) return errorJson('OTP has expired. Please request a new code.', 410)
  if (voter.otpAttempts >= maxAttempts) {
    // Lock the voter for 15 min after too many attempts.
    await db.voter.update({ where: { id: voter.id }, data: { lockedUntil: new Date(Date.now() + 15 * 60 * 1000), otpCode: null, otpExpiresAt: null } })
    await recordSecurityEvent({ severity: 'HIGH', category: 'OTP_BURST', actorId: voter.id, ipAddress: getClientIp(req), message: `Voter ${matric} locked after ${maxAttempts} failed OTP attempts` })
    return errorJson('Too many incorrect attempts. Account locked for 15 minutes.', 423)
  }

  if (voter.otpCode !== otp) {
    await db.voter.update({ where: { id: voter.id }, data: { otpAttempts: { increment: 1 } } })
    const remaining = maxAttempts - (voter.otpAttempts + 1)
    return errorJson(`Incorrect code. ${remaining} attempt(s) remaining.`, 401)
  }

  // Success — issue a session token + record the device.
  const token = randomToken(32)
  const expiresAt = new Date(Date.now() + (settings?.sessionTtlMinutes ?? 30) * 60 * 1000)
  const deviceInfo = deviceFromRequest(req)
  const device = await db.device.upsert({
    where: { voterId_fingerprint: { voterId: voter.id, fingerprint: deviceInfo.fingerprint } },
    create: { voterId: voter.id, fingerprint: deviceInfo.fingerprint, label: deviceInfo.label, userAgent: deviceInfo.userAgent, ipAddress: deviceInfo.ipAddress, trusted: true },
    update: { lastSeen: new Date(), ipAddress: deviceInfo.ipAddress },
  })
  await db.voter.update({
    where: { id: voter.id },
    data: {
      otpCode: null, otpExpiresAt: null, otpAttempts: 0, otpIssuedAt: null,
      sessionToken: token, sessionExpiresAt: expiresAt, sessionDeviceId: device.id,
      verifiedAt: new Date(), failedOtpAttempts: 0,
    },
  })
  const fullVoter = await db.voter.findUnique({
    where: { id: voter.id },
    include: { faculty: { select: { name: true } }, department: { select: { name: true } } },
  })

  await writeAudit({
    actorId: voter.id, actorRole: 'VOTER', actorName: voter.fullName,
    action: 'VOTER_VERIFIED', details: { matric, device: deviceInfo.label }, ip: getClientIp(req),
  })
  return json({
    ok: true,
    token,
    expiresAt,
    voter: {
      fullName: voter.fullName, matric: voter.matric,
      faculty: fullVoter?.faculty?.name,
      department: fullVoter?.department?.name,
      level: voter.level,
    },
  })
}
