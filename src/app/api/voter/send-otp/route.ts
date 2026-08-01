import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { generateOtp } from '@/lib/crypto'
import { json, errorJson, getElectionContext, getClientIp, writeAudit, recordSecurityEvent, logVoterActivity } from '@/lib/election'
import { RATE_LIMITS } from '@/lib/ratelimit'
import { recordEvent } from '@/lib/eifdirs'

export const dynamic = 'force-dynamic'

// POST /api/voter/send-otp  body: { matric, channel }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const matric = String(body.matric || '').trim().toUpperCase()
  const channel = String(body.channel || 'EMAIL').toUpperCase() as 'EMAIL' | 'SMS' | 'WHATSAPP'
  if (!matric) return errorJson('Matriculation number is required', 400)

  const rl = RATE_LIMITS.otpSend(matric)
  if (!rl.allowed) return errorJson(`Please wait ${Math.ceil(rl.retryAfterMs / 1000)}s before requesting a new code`, 429)

  const { settings } = await getElectionContext()
  const ttl = settings?.otpTtlSeconds ?? 600
  const voter = await db.voter.findUnique({ where: { matric } })
  if (!voter) return errorJson('Voter not found', 404)
  if (voter.hasVoted) return errorJson('You have already voted', 409)
  if (voter.lockedUntil && voter.lockedUntil > new Date()) return errorJson('Account temporarily locked.', 423)

  // DB-level 60s cooldown as a backstop.
  if (voter.otpIssuedAt && Date.now() - voter.otpIssuedAt.getTime() < 60_000) {
    const wait = Math.ceil((60_000 - (Date.now() - voter.otpIssuedAt.getTime())) / 1000)
    return errorJson(`Please wait ${wait}s before requesting a new code`, 429)
  }

  const otp = generateOtp(6)
  await db.voter.update({
    where: { id: voter.id },
    data: {
      otpCode: otp,
      otpExpiresAt: new Date(Date.now() + ttl * 1000),
      otpIssuedAt: new Date(),
      otpAttempts: 0,
      otpChannel: channel,
    },
  })

  // In sandbox we log the OTP. In production this dispatches to Resend/Termii.
  const dest = channel === 'EMAIL' ? (voter.institutionEmail || voter.personalEmail) : voter.phone
  console.log(`[OTP] ${channel} -> ${dest || matric}: ${otp}`)
  // Enqueue an async "send" job (no-op transport in sandbox).
  const { enqueue } = await import('@/lib/jobs')
  enqueue('otp.send', { channel, destination: dest, otp, voterName: voter.fullName })

  await writeAudit({
    actorId: voter.id, actorRole: 'VOTER', actorName: voter.fullName,
    action: 'OTP_ISSUED', details: { channel, matric }, ip: getClientIp(req),
  })
  await logVoterActivity({
    voterId: voter.id, action: 'SEND_OTP', details: { channel, matric }, ipAddress: getClientIp(req),
  })
  // EIFDIRS: Record OTVP generation for fraud detection
  await recordEvent({
    voterId: voter.id,
    actorId: voter.id,
    actorName: voter.fullName,
    actorRole: 'VOTER',
    eventType: 'OTVP_GENERATED',
    category: 'AUTHENTICATION',
    severity: 'INFO',
    description: `OTVP generated for ${voter.fullName} via ${channel}`,
    ipAddress: getClientIp(req),
    metadata: { channel, matric },
  }).catch(() => {})
  return json({
    ok: true,
    message: `A 6-digit verification code has been sent via ${channel}.`,
    devOtp: process.env.NODE_ENV === 'production' ? undefined : otp,
    ttl,
    channel,
    maskedDestination:
      channel === 'EMAIL' ? maskEmail(voter.institutionEmail || voter.personalEmail || '') : maskPhone(voter.phone || ''),
  })
}

function maskEmail(e: string) {
  if (!e) return ''
  const [u, d] = e.split('@')
  if (!u || !d) return e
  return `${u.slice(0, 2)}${'*'.repeat(Math.max(1, u.length - 2))}@${d}`
}
function maskPhone(p: string) {
  if (p.length < 4) return p
  return `${'*'.repeat(p.length - 4)}${p.slice(-4)}`
}
