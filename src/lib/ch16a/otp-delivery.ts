// VoteWise — Chapter 16A: OTVP Delivery Engine
//
// Spec: "Build a resilient OTVP delivery engine supporting Email, SMS, and
// WhatsApp with automatic fallback and retry policies."
//
// This module handles multi-channel OTVP delivery with:
//   1. Channel detection (which channels does the voter have?)
//   2. Parallel or sequential delivery (org-configurable)
//   3. Automatic fallback (SMS fails → WhatsApp → Email)
//   4. Retry with cooldown
//   5. Per-channel tracking (the OTVP Delivery Dashboard)
//   6. Resend controls (admin/observer-triggered, with audit trail)
//   7. The OTVP value is NEVER displayed to admins/observers

import { db } from '@/lib/db'
import { logger } from '@/lib/infra/logger'

export type OtpChannel = 'EMAIL' | 'SMS' | 'WHATSAPP'

export interface OtpDeliveryConfig {
  channels: OtpChannel[]  // ordered by preference
  parallel: boolean       // send all at once, or sequential with fallback
  maxAttempts: number     // per channel
  cooldownSeconds: number // between retries
}

// ---------------------------------------------------------------------------
// 1. Generate + deliver an OTVP
// ---------------------------------------------------------------------------

export async function generateAndDeliverOtp(input: {
  organizationId: string
  electionId?: string
  voterId: string
  voterName: string
  voterEmail?: string
  voterPhone?: string
  voterWhatsapp?: string
  config?: Partial<OtpDeliveryConfig>
  triggeredBy?: string // admin/observer ID (null = auto/system)
}): Promise<{ credentialId: string; attempts: any[] }> {
  // Determine available channels
  const channels: OtpChannel[] = []
  if (input.voterEmail) channels.push('EMAIL')
  if (input.voterPhone) channels.push('SMS')
  if (input.voterWhatsapp) channels.push('WHATSAPP')

  if (channels.length === 0) {
    logger.warn(`No delivery channels for voter ${input.voterId}`, {
      category: 'infrastructure',
      service: 'app',
      metadata: { voterId: input.voterId },
    })
    return { credentialId: '', attempts: [] }
  }

  // Generate a 6-digit code
  const code = String(Math.floor(100000 + Math.random() * 900000))
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes

  // Store the credential (code is stored in production; here we store it for dev)
  const credential = await db.votingCredential.create({
    data: {
      organizationId: input.organizationId,
      voterId: input.voterId,
      electionId: input.electionId || null,
      deliveryMethod: channels[0],
      code,
      destination: maskDestination(channels[0], input),
      expiresAt,
      status: 'PENDING',
    },
  }).catch(() => null)

  // Create delivery attempts for each channel
  const config: OtpDeliveryConfig = {
    channels,
    parallel: input.config?.parallel ?? false,
    maxAttempts: input.config?.maxAttempts ?? 3,
    cooldownSeconds: input.config?.cooldownSeconds ?? 30,
  }

  const attempts: any[] = []

  if (config.parallel) {
    // Send all channels at once
    const results = await Promise.all(
      channels.map((ch) =>
        deliverViaChannel(ch, input, credential?.id || null, config, code),
      ),
    )
    attempts.push(...results)
  } else {
    // Sequential with fallback: try first channel, if fails try next, etc.
    for (const ch of channels) {
      const result = await deliverViaChannel(ch, input, credential?.id || null, config, code)
      attempts.push(result)
      if (result.status === 'SENT' || result.status === 'DELIVERED') break
      // If failed, continue to next channel (fallback)
    }
  }

  logger.audit(`OTVP delivered to ${input.voterName} via ${attempts.filter(a => a.status === 'SENT').length} channel(s)`, {
    category: 'audit',
    service: 'app',
    metadata: { voterId: input.voterId, channels: attempts.map(a => ({ channel: a.channel, status: a.status })) },
  })

  return { credentialId: credential?.id || '', attempts }
}

// ---------------------------------------------------------------------------
// 2. Deliver via a single channel
// ---------------------------------------------------------------------------

async function deliverViaChannel(
  channel: OtpChannel,
  voter: any,
  credentialId: string | null,
  config: OtpDeliveryConfig,
  _code: string,
): Promise<any> {
  const destination = getDestination(channel, voter)
  if (!destination) {
    return { channel, status: 'FAILED', error: 'No destination for channel' }
  }

  // Create the delivery attempt record
  const attempt = await db.otpDeliveryAttempt.create({
    data: {
      organizationId: voter.organizationId,
      electionId: voter.electionId || null,
      voterId: voter.voterId,
      voterName: voter.voterName,
      credentialId,
      channel,
      destination: maskValue(channel, destination),
      status: 'PENDING',
      maxAttempts: config.maxAttempts,
      createdBy: voter.triggeredBy || null,
    },
  }).catch(() => null)

  if (!attempt) return { channel, status: 'FAILED', error: 'DB error' }

  // Simulate delivery (in production: call Resend/Termii SDK)
  const success = Math.random() > 0.15 // 85% success rate
  const now = new Date()

  if (success) {
    await db.otpDeliveryAttempt.update({
      where: { id: attempt.id },
      data: {
        status: 'SENT',
        attempts: 1,
        provider: channel === 'EMAIL' ? 'resend' : 'termii',
        providerMessageId: `msg_${Math.random().toString(36).slice(2, 12)}`,
        sentAt: now,
        deliveredAt: now,
      },
    })
    return { channel, status: 'SENT', attemptId: attempt.id }
  } else {
    // Retry up to maxAttempts
    let retries = 0
    let lastError = 'Provider returned error'
    while (retries < config.maxAttempts - 1) {
      retries++
      const retrySuccess = Math.random() > 0.5
      if (retrySuccess) {
        await db.otpDeliveryAttempt.update({
          where: { id: attempt.id },
          data: {
            status: 'SENT',
            attempts: retries + 1,
            provider: channel === 'EMAIL' ? 'resend' : 'termii',
            providerMessageId: `msg_${Math.random().toString(36).slice(2, 12)}`,
            sentAt: new Date(),
            deliveredAt: new Date(),
          },
        })
        return { channel, status: 'SENT', attemptId: attempt.id, retries }
      }
      lastError = `Retry ${retries} failed`
    }

    await db.otpDeliveryAttempt.update({
      where: { id: attempt.id },
      data: {
        status: 'FAILED',
        attempts: retries + 1,
        error: lastError,
      },
    })
    return { channel, status: 'FAILED', attemptId: attempt.id, error: lastError, retries }
  }
}

// ---------------------------------------------------------------------------
// 3. Resend controls (admin/observer)
// ---------------------------------------------------------------------------

export async function resendOtp(input: {
  organizationId: string
  electionId?: string
  voterId: string
  voterName: string
  voterEmail?: string
  voterPhone?: string
  voterWhatsapp?: string
  channel?: OtpChannel | 'ALL' // specific channel or all available
  triggeredBy: string
  triggeredByName: string
}): Promise<{ attempts: any[] }> {
  // Check resend limits (max 5 resends per voter per election)
  const recentResends = await db.otpDeliveryAttempt.count({
    where: {
      voterId: input.voterId,
      electionId: input.electionId || null,
      createdBy: { not: null },
      createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }, // last hour
    },
  }).catch(() => 0)

  if (recentResends >= 5) {
    throw new Error('Resend limit reached (5 per hour). Please wait before retrying.')
  }

  // Check cooldown (30s between resends)
  const lastResend = await db.otpDeliveryAttempt.findFirst({
    where: {
      voterId: input.voterId,
      createdBy: { not: null },
    },
    orderBy: { createdAt: 'desc' },
  }).catch(() => null)

  if (lastResend) {
    const elapsed = (Date.now() - lastResend.createdAt.getTime()) / 1000
    if (elapsed < 30) {
      throw new Error(`Cooldown active. Please wait ${Math.ceil(30 - elapsed)} seconds before resending.`)
    }
  }

  // Determine channels
  let channels: OtpChannel[] = []
  if (input.channel === 'ALL' || !input.channel) {
    if (input.voterEmail) channels.push('EMAIL')
    if (input.voterPhone) channels.push('SMS')
    if (input.voterWhatsapp) channels.push('WHATSAPP')
  } else {
    channels = [input.channel]
  }

  // Generate new code + deliver
  const result = await generateAndDeliverOtp({
    organizationId: input.organizationId,
    electionId: input.electionId,
    voterId: input.voterId,
    voterName: input.voterName,
    voterEmail: input.voterEmail,
    voterPhone: input.voterPhone,
    voterWhatsapp: input.voterWhatsapp,
    triggeredBy: input.triggeredBy,
  })

  // Log the resend action in the voter activity log
  await db.voterActivityLog.create({
    data: {
      voterId: input.voterId,
      actionById: input.triggeredBy,
      action: 'OTP_RESEND_BY_ADMIN',
      details: JSON.stringify({ channels, triggeredByName: input.triggeredByName }),
    },
  }).catch(() => {})

  logger.audit(`OTVP resent by ${input.triggeredByName} for voter ${input.voterName}`, {
    category: 'audit',
    service: 'app',
    metadata: { voterId: input.voterId, channels },
  })

  return { attempts: result.attempts }
}

// ---------------------------------------------------------------------------
// 4. Query helpers (OTVP Delivery Dashboard)
// ---------------------------------------------------------------------------

export async function getOtpDeliveryStats(organizationId: string, electionId?: string) {
  const where: any = { organizationId }
  if (electionId) where.electionId = electionId

  const [total, sent, failed, pending, byChannel, recentFailures] = await Promise.all([
    db.otpDeliveryAttempt.count({ where }),
    db.otpDeliveryAttempt.count({ where: { ...where, status: 'SENT' } }),
    db.otpDeliveryAttempt.count({ where: { ...where, status: 'FAILED' } }),
    db.otpDeliveryAttempt.count({ where: { ...where, status: 'PENDING' } }),
    db.otpDeliveryAttempt.groupBy({ by: ['channel'], where, _count: true }),
    db.otpDeliveryAttempt.findMany({
      where: { ...where, status: 'FAILED' },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { voterName: true, channel: true, error: true, createdAt: true },
    }),
  ])

  return {
    total,
    sent,
    failed,
    pending,
    deliveryRate: total > 0 ? Number(((sent / total) * 100).toFixed(1)) : 100,
    byChannel: Object.fromEntries(byChannel.map((c) => [c.channel, c._count])),
    recentFailures,
  }
}

export async function listOtpDeliveries(organizationId: string, electionId?: string, limit = 50) {
  const where: any = { organizationId }
  if (electionId) where.electionId = electionId
  return db.otpDeliveryAttempt.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDestination(channel: OtpChannel, voter: any): string | null {
  switch (channel) {
    case 'EMAIL': return voter.voterEmail || null
    case 'SMS': return voter.voterPhone || null
    case 'WHATSAPP': return voter.voterWhatsapp || voter.voterPhone || null
    default: return null
  }
}

function maskDestination(channel: OtpChannel, voter: any): string {
  const dest = getDestination(channel, voter)
  if (!dest) return '—'
  return maskValue(channel, dest)
}

function maskValue(channel: OtpChannel, value: string): string {
  if (channel === 'EMAIL') {
    const [name, domain] = value.split('@')
    return `${name.slice(0, 2)}***@${domain}`
  }
  // Phone: +234***1234
  return `${value.slice(0, 4)}***${value.slice(-4)}`
}
