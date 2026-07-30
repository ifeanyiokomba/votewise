import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson, getClientIp, writeAudit, logVoterActivity } from '@/lib/election'
import { requireOfficial } from '@/lib/guards'
import { generateOtp } from '@/lib/crypto'
import { RATE_LIMITS } from '@/lib/ratelimit'

export const dynamic = 'force-dynamic'

// POST /api/admin/voters/[id]/resend-otp — admin triggers an OTP resend for a voter.
// Body: { channel?: string }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOfficial(req, 'voter.manage')
  if (auth instanceof Response) return auth
  const official = (auth as any).official
  const { id } = await params

  const body = await req.json().catch(() => ({}))
  const channel = String(body.channel || 'EMAIL').toUpperCase() as 'EMAIL' | 'SMS' | 'WHATSAPP'

  const voter = await db.voter.findUnique({ where: { id }, select: { id: true, matric: true, fullName: true, institutionEmail: true, personalEmail: true, phone: true, hasVoted: true, lockedUntil: true } })
  if (!voter) return errorJson('Voter not found', 404)
  if (voter.hasVoted) return errorJson('Voter has already voted', 409)
  if (voter.lockedUntil && voter.lockedUntil > new Date()) return errorJson('Voter account is locked. Please unlock first.', 423)

  const { settings } = await (await import('@/lib/election')).getElectionContext()
  const ttl = settings?.otpTtlSeconds ?? 600

  const otp = generateOtp(6)
  await db.voter.update({
    where: { id },
    data: {
      otpCode: otp,
      otpExpiresAt: new Date(Date.now() + ttl * 1000),
      otpIssuedAt: new Date(),
      otpAttempts: 0,
      otpChannel: channel,
      lockedUntil: null, // unlock on admin resend
      failedOtpAttempts: 0,
    },
  })

  const dest = channel === 'EMAIL' ? (voter.institutionEmail || voter.personalEmail) : voter.phone
  console.log(`[ADMIN OTP RESEND] ${official.name} triggered ${channel} -> ${dest || voter.matric}: ${otp}`)

  await logVoterActivity({
    voterId: id,
    actionById: official.id,
    action: 'OTP_RESEND_BY_ADMIN',
    details: { channel, matric: voter.matric },
    ipAddress: getClientIp(req),
  })
  await writeAudit({
    actorId: official.id, actorRole: official.role, actorName: official.name,
    action: 'ADMIN_OTP_RESEND',
    details: { voterId: id, matric: voter.matric, channel },
    ip: getClientIp(req),
  })

  return json({
    ok: true,
    message: `OTP resent via ${channel} to the voter's registered contact.`,
    devOtp: process.env.NODE_ENV === 'production' ? undefined : otp,
    channel,
    maskedDestination: channel === 'EMAIL'
      ? maskEmail(voter.institutionEmail || voter.personalEmail || '')
      : maskPhone(voter.phone || ''),
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
