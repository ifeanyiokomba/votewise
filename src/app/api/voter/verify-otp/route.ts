import { NextRequest } from 'next/server'
import { json, errorJson, getElectionContext, getClientIp, writeAudit } from '@/lib/election'
import { randomToken } from '@/lib/crypto'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// POST /api/voter/verify-otp
// Body: { matric, otp }
// Verifies the OTP, clears it, and issues a session token (stored on the voter
// row with a 30-minute expiry). The token is returned to the client and must
// be sent as `x-voter-token` on subsequent voting requests.
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
  if (!voter.otpCode || !voter.otpExpiresAt) return errorJson('No OTP was issued. Please request a new code.', 400)
  if (voter.otpExpiresAt < new Date()) return errorJson('OTP has expired. Please request a new code.', 410)
  if (voter.otpAttempts >= maxAttempts) return errorJson('Too many incorrect attempts. Please request a new code.', 429)

  if (voter.otpCode !== otp) {
    await db.voter.update({ where: { id: voter.id }, data: { otpAttempts: { increment: 1 } } })
    const remaining = maxAttempts - (voter.otpAttempts + 1)
    return errorJson(`Incorrect code. ${remaining} attempt(s) remaining.`, 401)
  }

  // Success — issue session token.
  const token = randomToken(32)
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000)
  await db.voter.update({
    where: { id: voter.id },
    data: {
      otpCode: null,
      otpExpiresAt: null,
      otpAttempts: 0,
      otpIssuedAt: null,
      sessionToken: token,
      sessionExpiresAt: expiresAt,
      verifiedAt: new Date(),
    },
  })

  // Fetch the voter WITH relations so the client can display faculty/department.
  const fullVoter = await db.voter.findUnique({
    where: { id: voter.id },
    include: {
      faculty: { select: { name: true, code: true } },
      department: { select: { name: true, code: true } },
    },
  })

  await writeAudit({
    actorId: voter.id,
    actorRole: 'VOTER',
    actorName: voter.fullName,
    action: 'VOTER_VERIFIED',
    details: { matric },
    ip: getClientIp(req),
  })

  return json({
    ok: true,
    token,
    expiresAt,
    voter: {
      fullName: voter.fullName,
      matric: voter.matric,
      faculty: fullVoter?.faculty?.name,
      department: fullVoter?.department?.name,
      level: voter.level,
    },
  })
}
