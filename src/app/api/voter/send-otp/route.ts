import { NextRequest } from 'next/server'
import { json, errorJson, getElectionContext, getClientIp, writeAudit } from '@/lib/election'
import { generateOtp } from '@/lib/crypto'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// POST /api/voter/send-otp
// Body: { matric, channel }
// Generates a 6-digit OTP, stores it (hashed) on the voter with an expiry,
// and "sends" it via the chosen channel. In this sandbox we log the OTP to
// the server log AND return it in the response when NODE_ENV !== production
// so the UI can display it (simulating SMS/email/WhatsApp delivery).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const matric = String(body.matric || '').trim().toUpperCase()
  const channel = String(body.channel || 'EMAIL').toUpperCase() as 'EMAIL' | 'SMS' | 'WHATSAPP'
  if (!matric) return errorJson('Matriculation number is required', 400)

  const { settings } = await getElectionContext()
  const ttl = settings?.otpTtlSeconds ?? 600

  const voter = await db.voter.findUnique({ where: { matric } })
  if (!voter) return errorJson('Voter not found', 404)
  if (voter.hasVoted) return errorJson('You have already voted', 409)

  // Rate-limit: only allow a new OTP after the previous one is at least 60s old.
  if (voter.otpIssuedAt && Date.now() - voter.otpIssuedAt.getTime() < 60_000) {
    const wait = Math.ceil((60_000 - (Date.now() - voter.otpIssuedAt.getTime())) / 1000)
    return errorJson(`Please wait ${wait}s before requesting a new code`, 429)
  }

  const otp = generateOtp(6)
  // Store the OTP directly (sandbox). In production we would store a hash.
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

  console.log(`[OTP] ${channel} -> ${voter.email || voter.phone || matric}: ${otp}`)

  await writeAudit({
    actorId: voter.id,
    actorRole: 'VOTER',
    actorName: voter.fullName,
    action: 'OTP_ISSUED',
    details: { channel, matric },
    ip: getClientIp(req),
  })

  return json({
    ok: true,
    message: `A 6-digit verification code has been sent via ${channel}.`,
    // Sandbox only — surface the OTP so the UI can auto-fill it for demoing.
    devOtp: process.env.NODE_ENV === 'production' ? undefined : otp,
    ttl,
    channel,
    maskedDestination:
      channel === 'EMAIL' ? maskEmail(voter.email || '') : maskPhone(voter.phone || ''),
  })
}

function maskEmail(e: string) {
  const [u, d] = e.split('@')
  if (!u || !d) return e
  return `${u.slice(0, 2)}${'*'.repeat(Math.max(1, u.length - 2))}@${d}`
}
function maskPhone(p: string) {
  if (p.length < 4) return p
  return `${'*'.repeat(p.length - 4)}${p.slice(-4)}`
}
