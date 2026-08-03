import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { generateOtp } from '@/lib/crypto'
import { json, errorJson, getElectionContext, getClientIp, writeAudit, recordSecurityEvent, logVoterActivity } from '@/lib/election'
import { RATE_LIMITS } from '@/lib/ratelimit'
import { recordEvent } from '@/lib/eifdirs'

export const dynamic = 'force-dynamic'

// POST /api/voter/send-otp  body: { matric, channel? }
// channel: 'EMAIL' (default) | 'SMS' | 'WHATSAPP'
//
// If EMAIL is selected → calls Resend API
// If SMS is selected → calls Termii SMS API
// If WHATSAPP is selected → calls Termii WhatsApp API
//
// The voter can choose their preferred channel. Email is the default
// (cheapest — free tier). SMS and WhatsApp cost ~₦2-5 per message via Termii.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const matric = String(body.matric || '').trim().toUpperCase()
  const channel = String(body.channel || 'EMAIL').toUpperCase() as 'EMAIL' | 'SMS' | 'WHATSAPP'
  if (!matric) return errorJson('Matriculation number is required', 400)

  if (!['EMAIL', 'SMS', 'WHATSAPP'].includes(channel)) {
    return errorJson('Invalid channel. Use EMAIL, SMS, or WHATSAPP.', 400)
  }

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

  // Determine destination based on channel
  const dest = channel === 'EMAIL'
    ? (voter.institutionEmail || voter.personalEmail)
    : voter.phone

  if (!dest) {
    return errorJson(
      `No ${channel === 'EMAIL' ? 'email address' : 'phone number'} found for this voter. Please try a different channel.`,
      400,
    )
  }

  // Check if the provider for this channel is configured
  const providerConfigured = checkProviderConfigured(channel)
  if (!providerConfigured) {
    return errorJson(
      `${channel} delivery is not available right now. Please try ${channel === 'EMAIL' ? 'SMS or WhatsApp' : 'email'} instead.`,
      503,
    )
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

  // Send the OTP via the real provider API
  const deliveryResult = await sendOtpViaProvider(channel, dest, otp, voter.fullName)

  if (!deliveryResult.success) {
    // Delivery failed — still save the OTP (voter can use dev mode in sandbox)
    // but notify that delivery may have failed
    console.error(`[OTP] Delivery failed via ${channel}:`, deliveryResult.error)
  }

  await writeAudit({
    actorId: voter.id, actorRole: 'VOTER', actorName: voter.fullName,
    action: 'OTP_ISSUED', details: { channel, matric, deliveryId: deliveryResult.messageId }, ip: getClientIp(req),
  })
  await logVoterActivity({
    voterId: voter.id, action: 'SEND_OTP', details: { channel, matric }, ipAddress: getClientIp(req),
  })
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
    metadata: { channel, matric, deliveryStatus: deliveryResult.success ? 'SENT' : 'FAILED' },
  }).catch(() => {})

  const maskedDest = channel === 'EMAIL' ? maskEmail(dest) : maskPhone(dest)

  return json({
    ok: true,
    message: `A 6-digit verification code has been sent via ${channel} to ${maskedDest}.`,
    devOtp: process.env.NODE_ENV === 'production' ? undefined : otp,
    ttl,
    channel,
    maskedDestination: maskedDest,
    deliveryStatus: deliveryResult.success ? 'SENT' : 'FALLBACK',
  })
}

// ---------------------------------------------------------------------------
// Provider integration — real API calls based on channel
// ---------------------------------------------------------------------------

function checkProviderConfigured(channel: 'EMAIL' | 'SMS' | 'WHATSAPP'): boolean {
  if (channel === 'EMAIL') {
    return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.length > 10)
  }
  // SMS and WhatsApp both use Termii
  return Boolean(process.env.TERMII_API_KEY && process.env.TERMII_API_KEY.length > 10)
}

async function sendOtpViaProvider(
  channel: 'EMAIL' | 'SMS' | 'WHATSAPP',
  destination: string,
  otp: string,
  voterName: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (channel === 'EMAIL') {
    return sendViaResend(destination, otp, voterName)
  } else if (channel === 'SMS') {
    return sendViaTermiiSMS(destination, otp)
  } else {
    return sendViaTermiiWhatsApp(destination, otp)
  }
}

// --- Resend (Email) ---
async function sendViaResend(to: string, otp: string, voterName: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY

  // Dev mode: no API key → simulate
  if (!apiKey || apiKey.length < 10) {
    console.log(`[OTP-EMAIL] (dev mode) To: ${to} | Code: ${otp}`)
    return { success: true, messageId: `dev_email_${Date.now()}` }
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'VoteWise <noreply@votewise.com.ng>',
        to: [to],
        subject: 'Your VoteWise Voting Code',
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #15803d;">VoteWise — Your Voting Code</h2>
            <p>Hello ${voterName},</p>
            <p>Your One-Time Voting Password (OTVP) is:</p>
            <div style="font-size: 32px; font-weight: bold; text-align: center; padding: 20px; background: #f0fdf4; border-radius: 8px; letter-spacing: 8px; color: #15803d;">
              ${otp}
            </div>
            <p>This code expires in <strong>5 minutes</strong>. Do not share it with anyone.</p>
            <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">
              VoteWise — Africa's Most Trusted Election Management Platform
            </p>
          </div>
        `,
      }),
    })

    const data = await response.json() as any
    if (response.ok && data.id) {
      return { success: true, messageId: data.id }
    }
    console.error('[OTP-EMAIL] Resend error:', data)
    return { success: false, error: data.message || `HTTP ${response.status}` }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

// --- Termii (SMS) ---
async function sendViaTermiiSMS(to: string, otp: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiKey = process.env.TERMII_API_KEY

  // Dev mode: no API key → simulate
  if (!apiKey || apiKey.length < 10) {
    console.log(`[OTP-SMS] (dev mode) To: ${to} | Code: ${otp}`)
    return { success: true, messageId: `dev_sms_${Date.now()}` }
  }

  try {
    const senderId = process.env.TERMII_SENDER_ID || 'VoteWise'
    const message = `VoteWise: Your voting code is ${otp}. Expires in 5 minutes. Do not share with anyone.`

    const response = await fetch('https://api.termii.com/api/sms/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to,
        from: senderId,
        sms: message,
        type: 'plain',
        channel: 'generic',
        api_key: apiKey,
      }),
    })

    const data = await response.json() as any
    if (response.ok && (data.code === 'ok' || data.message_id)) {
      return { success: true, messageId: data.message_id || `termii_sms_${Date.now()}` }
    }
    console.error('[OTP-SMS] Termii error:', data)
    return { success: false, error: data.message || `HTTP ${response.status}` }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

// --- Termii (WhatsApp) ---
async function sendViaTermiiWhatsApp(to: string, otp: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiKey = process.env.TERMII_API_KEY || process.env.TERMII_WHATSAPP_KEY

  // Dev mode: no API key → simulate
  if (!apiKey || apiKey.length < 10) {
    console.log(`[OTP-WHATSAPP] (dev mode) To: ${to} | Code: ${otp}`)
    return { success: true, messageId: `dev_wa_${Date.now()}` }
  }

  try {
    const message = `VoteWise: Your voting code is ${otp}. Expires in 5 minutes. Do not share with anyone.`

    const response = await fetch('https://api.termii.com/api/sms/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to,
        from: 'VoteWise',
        sms: message,
        type: 'plain',
        channel: 'whatsapp',
        api_key: apiKey,
      }),
    })

    const data = await response.json() as any
    if (response.ok && (data.code === 'ok' || data.message_id)) {
      return { success: true, messageId: data.message_id || `termii_wa_${Date.now()}` }
    }
    console.error('[OTP-WHATSAPP] Termii error:', data)
    return { success: false, error: data.message || `HTTP ${response.status}` }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

// --- Masking helpers ---
function maskEmail(e: string) {
  if (!e) return ''
  const [u, d] = e.split('@')
  if (!u || !d) return e
  return `${u.slice(0, 2)}${'*'.repeat(Math.max(1, u.length - 2))}@${d}`
}
function maskPhone(p: string) {
  if (!p || p.length < 4) return p
  return `${'*'.repeat(p.length - 4)}${p.slice(-4)}`
}
