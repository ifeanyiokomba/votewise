// VoteWise — Communication Providers (Enterprise Audit Part 2)
//
// Manages CommunicationProvider + ProviderHealth.
// Spec: "EmailProvider, SMSProvider, WhatsAppProvider, ProviderHealth.
// Allows failover."

import { db } from '@/lib/db'

export type Channel = 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PUSH'

// ---------------------------------------------------------------------------
// Provider CRUD
// ---------------------------------------------------------------------------

export interface ProviderInput {
  organizationId?: string
  channel: Channel
  providerName: string
  displayName: string
  priority?: number
  enabled?: boolean
  credentials: Record<string, any>
  fromAddress?: string
  rateLimit?: number
}

export async function createProvider(input: ProviderInput) {
  return db.communicationProvider.create({
    data: {
      organizationId: input.organizationId || null,
      channel: input.channel,
      providerName: input.providerName,
      displayName: input.displayName,
      priority: input.priority || 1,
      enabled: input.enabled ?? true,
      credentials: JSON.stringify(input.credentials),
      fromAddress: input.fromAddress || null,
      rateLimit: input.rateLimit || 100,
    },
  })
}

export async function listProviders(organizationId?: string, channel?: Channel) {
  const where: any = {}
  if (organizationId) where.OR = [{ organizationId }, { organizationId: null }]
  if (channel) where.channel = channel
  return db.communicationProvider.findMany({
    where,
    orderBy: [{ channel: 'asc' }, { priority: 'asc' }],
  })
}

export async function updateProvider(id: string, update: Partial<ProviderInput>) {
  const data: any = { ...update }
  if (update.credentials) data.credentials = JSON.stringify(update.credentials)
  return db.communicationProvider.update({ where: { id }, data })
}

export async function deleteProvider(id: string) {
  return db.communicationProvider.delete({ where: { id } })
}

/**
 * Get the active provider for a channel, ordered by priority (failover).
 * Returns the first enabled provider. If it fails, the caller should try
 * the next one.
 */
export async function getProvidersForChannel(channel: Channel, organizationId?: string) {
  const where: any = {
    channel,
    enabled: true,
    OR: [{ organizationId: organizationId || null }, { organizationId: null }],
  }
  return db.communicationProvider.findMany({
    where,
    orderBy: { priority: 'asc' },
  })
}

// ---------------------------------------------------------------------------
// Provider Health
// ---------------------------------------------------------------------------

export async function recordHealthCheck(input: {
  providerId: string
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN'
  latencyMs?: number
  errorRate?: number
  lastError?: string
}) {
  return db.providerHealth.create({
    data: {
      providerId: input.providerId,
      status: input.status,
      latencyMs: input.latencyMs || 0,
      errorRate: input.errorRate || 0,
      lastError: input.lastError || null,
    },
  })
}

export async function getProviderHealth(providerId: string) {
  return db.providerHealth.findFirst({
    where: { providerId },
    orderBy: { checkedAt: 'desc' },
  })
}

export async function getHealthyProvider(channel: Channel, organizationId?: string) {
  const providers = await getProvidersForChannel(channel, organizationId)
  for (const p of providers) {
    const health = await getProviderHealth(p.id)
    if (!health || health.status === 'HEALTHY') return p
  }
  // If no healthy provider, return the first one (will likely fail, but
  // at least we tried all failover options)
  return providers[0] || null
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export async function getProviderStats(organizationId?: string) {
  const where = organizationId
    ? { OR: [{ organizationId }, { organizationId: null }] }
    : {}
  const [total, enabled, byChannel] = await Promise.all([
    db.communicationProvider.count({ where }),
    db.communicationProvider.count({ where: { ...where, enabled: true } }),
    db.communicationProvider.groupBy({ by: ['channel'], where, _count: true }),
  ])
  return {
    total,
    enabled,
    byChannel: Object.fromEntries(byChannel.map((c) => [c.channel, c._count])),
  }
}

/**
 * Seed default platform-level providers (Resend, Termii).
 */
export async function ensureProvidersSeeded() {
  const count = await db.communicationProvider.count()
  if (count > 0) return

  await db.communicationProvider.createMany({
    data: [
      {
        channel: 'EMAIL',
        providerName: 'resend',
        displayName: 'Resend (Primary)',
        priority: 1,
        enabled: Boolean(process.env.RESEND_API_KEY),
        credentials: JSON.stringify({ apiKey: process.env.RESEND_API_KEY || '' }),
        fromAddress: 'VoteWise <noreply@votewise.com.ng>',
        rateLimit: 100,
      },
      {
        channel: 'SMS',
        providerName: 'termii',
        displayName: 'Termii SMS (Primary)',
        priority: 1,
        enabled: Boolean(process.env.TERMII_API_KEY),
        credentials: JSON.stringify({ apiKey: process.env.TERMII_API_KEY || '', senderId: process.env.TERMII_SENDER_ID || 'VoteWise' }),
        fromAddress: process.env.TERMII_SENDER_ID || 'VoteWise',
        rateLimit: 50,
      },
      {
        channel: 'WHATSAPP',
        providerName: 'termii',
        displayName: 'Termii WhatsApp (Primary)',
        priority: 1,
        enabled: Boolean(process.env.TERMII_API_KEY),
        credentials: JSON.stringify({ apiKey: process.env.TERMII_API_KEY || '' }),
        rateLimit: 30,
      },
    ],
  })
}
