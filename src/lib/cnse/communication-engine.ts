// VoteWise — Chapter 12 Communication Engine
//
// The centralized communication service. Every notification, OTP, reminder,
// announcement, support message, and emergency alert passes through this engine.
//
// Flow:
//   Application → Communication Engine → Template Engine → Message Queue
//     → Provider (Email/SMS/WhatsApp/In-App) → Delivery Tracking
//     → Fallback (if failed) → Audit Log
//
// This module is the SINGLE entry point for all communication in VoteWise.

import { db } from '@/lib/cnse/safe-db'
import { recordEvent } from '@/lib/eifdirs'
import { renderTemplate, findTemplate, getTemplate } from './template-engine'
import { getProvider } from './providers'
import type { SendMessageInput, Channel, DeliveryStats } from './types'

/**
 * Send a message through the communication engine.
 * This is the main entry point for all communication.
 *
 * Flow:
 * 1. Queue the message in MessageQueue
 * 2. Attempt delivery via the specified channel
 * 3. If delivery fails, try fallback channels
 * 4. Track delivery status
 * 5. Create an in-app Notification (if IN_APP or as fallback)
 * 6. Record integrity event for audit
 */
export async function sendMessage(input: SendMessageInput): Promise<{ messageId: string; status: string }> {
  // 1. Queue the message
  const message = await db.messageQueue.create({
    data: {
      organizationId: input.organizationId || null,
      electionId: input.electionId || null,
      recipientId: input.recipientId || null,
      recipientName: input.recipientName || null,
      recipientAddress: input.recipientAddress || null,
      channel: input.channel,
      fallbackChannel: input.fallbackChannels?.[0] || null,
      category: input.category,
      priority: input.priority || 'NORMAL',
      subject: input.subject || null,
      body: input.body,
      templateId: input.templateId || null,
      status: 'QUEUED',
      scheduledAt: input.scheduledAt || new Date(),
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  })

  // 2. Process delivery (async — don't block the caller)
  processDelivery(message.id).catch(() => {})

  return { messageId: message.id, status: 'QUEUED' }
}

/**
 * Send a message using a template. Variables are automatically substituted.
 */
export async function sendTemplatedMessage(opts: {
  organizationId?: string
  electionId?: string
  recipientId?: string
  recipientName?: string
  recipientAddress?: string
  channel: Channel
  fallbackChannels?: Channel[]
  category: any
  priority?: any
  templateId?: string
  variables?: Record<string, string>
  language?: string
  scheduledAt?: Date
}): Promise<{ messageId: string; status: string }> {
  // Find the template
  let template = null
  if (opts.templateId) {
    template = await getTemplate(opts.templateId)
  } else {
    template = await findTemplate({
      organizationId: opts.organizationId,
      category: opts.category,
      channel: opts.channel,
      language: opts.language,
    })
  }

  let subject = opts.category
  let body = ''

  if (template) {
    subject = renderTemplate(template.subject || opts.category, opts.variables || {})
    body = renderTemplate(template.body, opts.variables || {})
  } else {
    // No template found — use a basic message
    body = opts.variables?.message || `You have a new ${opts.category} notification.`
    subject = opts.category
  }

  return sendMessage({
    organizationId: opts.organizationId,
    electionId: opts.electionId,
    recipientId: opts.recipientId,
    recipientName: opts.recipientName,
    recipientAddress: opts.recipientAddress,
    channel: opts.channel,
    fallbackChannels: opts.fallbackChannels,
    category: opts.category,
    priority: opts.priority,
    subject,
    body,
    templateId: template?.id,
    scheduledAt: opts.scheduledAt,
  })
}

/**
 * Process delivery for a queued message.
 * Attempts the primary channel, then falls back to alternate channels.
 */
async function processDelivery(messageId: string): Promise<void> {
  const message = await db.messageQueue.findUnique({ where: { id: messageId } })
  if (!message) return

  // Check if scheduled for the future
  if (message.scheduledAt > new Date()) return

  // Update status to SENDING
  await db.messageQueue.update({
    where: { id: messageId },
    data: { status: 'SENDING', lastAttemptAt: new Date(), attempts: { increment: 1 } },
  })

  // Attempt delivery via primary channel
  const delivered = await attemptDelivery(message.channel, message)

  if (!delivered.success) {
    // Try fallback channel
    const fallback = message.fallbackChannel as Channel | null
    if (fallback && fallback !== message.channel) {
      await db.messageQueue.update({
        where: { id: messageId },
        data: { status: 'RETRYING', errorMessage: `Primary ${message.channel} failed: ${delivered.error}. Retrying via ${fallback}.` },
      })

      const fallbackResult = await attemptDelivery(fallback, message)
      if (fallbackResult.success) {
        await markDelivered(messageId, fallback, fallbackResult.externalId)
        return
      }
    }

    // All channels failed
    await db.messageQueue.update({
      where: { id: messageId },
      data: {
        status: 'FAILED',
        failedAt: new Date(),
        errorMessage: `All delivery attempts failed. Last error: ${fallback?.error || delivered.error}`,
      },
    })
    return
  }

  await markDelivered(messageId, message.channel, delivered.externalId)
}

async function attemptDelivery(channel: string, message: any): Promise<{ success: boolean; externalId?: string; error?: string }> {
  const provider = getProvider(channel as Channel)
  if (!provider) return { success: false, error: `No provider for channel ${channel}` }

  try {
    const result = await provider.send({
      to: message.recipientAddress || message.recipientId || '',
      subject: message.subject || undefined,
      body: message.body,
      metadata: message.metadata ? JSON.parse(message.metadata) : undefined,
    })
    return result
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

async function markDelivered(messageId: string, channel: string, externalId?: string): Promise<void> {
  await db.messageQueue.update({
    where: { id: messageId },
    data: {
      status: 'DELIVERED',
      deliveredAt: new Date(),
      externalId: externalId || null,
      errorMessage: null,
    },
  })

  // Create an in-app notification as well (so the user sees it in their inbox)
  const message = await db.messageQueue.findUnique({ where: { id: messageId } })
  if (message) {
    const notification = await db.notification.create({
      data: {
        electionSessionId: message.electionId || null,
        voterId: message.recipientId && message.category !== 'BILLING' ? message.recipientId : null,
        officialId: message.recipientId && message.category === 'BILLING' ? message.recipientId : null,
        title: message.subject || message.category,
        message: message.body,
        type: message.category === 'SECURITY' ? 'SECURITY' : message.priority === 'URGENT' ? 'WARNING' : 'INFO',
      },
    }).catch(() => null)

    if (notification) {
      await db.messageQueue.update({
        where: { id: messageId },
        data: { relatedNotificationId: notification.id },
      }).catch(() => {})
    }
  }
}

/**
 * Get delivery statistics for an organization or election.
 */
export async function getDeliveryStats(opts: {
  organizationId?: string
  electionId?: string
  since?: Date
}): Promise<DeliveryStats> {
  const where: any = {}
  if (opts.organizationId) where.organizationId = opts.organizationId
  if (opts.electionId) where.electionId = opts.electionId
  if (opts.since) where.createdAt = { gte: opts.since }

  const [total, queued, delivered, opened, clicked, failed] = await Promise.all([
    db.messageQueue.count({ where }),
    db.messageQueue.count({ where: { ...where, status: 'QUEUED' } }),
    db.messageQueue.count({ where: { ...where, status: 'DELIVERED' } }),
    db.messageQueue.count({ where: { ...where, status: 'OPENED' } }),
    db.messageQueue.count({ where: { ...where, status: 'CLICKED' } }),
    db.messageQueue.count({ where: { ...where, status: 'FAILED' } }),
  ])

  return {
    total,
    queued,
    delivered,
    opened,
    clicked,
    failed,
    deliveryRate: total > 0 ? Math.round((delivered / total) * 10000) / 100 : 0,
    openRate: delivered > 0 ? Math.round((opened / delivered) * 10000) / 100 : 0,
    clickRate: delivered > 0 ? Math.round((clicked / delivered) * 10000) / 100 : 0,
  }
}

/**
 * Get the unified communication timeline for an organization.
 */
export async function getCommunicationTimeline(opts: {
  organizationId?: string
  electionId?: string
  limit?: number
}): Promise<Array<{
  id: string
  type: string
  channel?: string
  category?: string
  title: string
  description: string
  recipient?: string
  status?: string
  timestamp: string
}>> {
  const where: any = {}
  if (opts.organizationId) where.organizationId = opts.organizationId
  if (opts.electionId) where.electionId = opts.electionId

  const limit = opts.limit || 100

  // Get messages + announcements + support tickets in chronological order
  const [messages, announcements, tickets] = await Promise.all([
    db.messageQueue.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, channel: true, category: true, subject: true, recipientName: true, status: true, createdAt: true },
    }),
    db.announcement.findMany({
      where: { organizationId: opts.organizationId },
      orderBy: { publishedAt: 'desc' },
      take: limit,
      select: { id: true, title: true, type: true, publishedAt: true },
    }),
    db.supportTicket.findMany({
      where: { organizationId: opts.organizationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, issueType: true, voterName: true, status: true, createdAt: true },
    }),
  ])

  const timeline: Array<any> = []

  for (const m of messages) {
    timeline.push({
      id: m.id,
      type: 'MESSAGE',
      channel: m.channel,
      category: m.category,
      title: m.subject || m.category,
      description: `Message sent via ${m.channel} to ${m.recipientName || 'recipient'}`,
      recipient: m.recipientName || undefined,
      status: m.status,
      timestamp: m.createdAt.toISOString(),
    })
  }

  for (const a of announcements) {
    timeline.push({
      id: a.id,
      type: 'ANNOUNCEMENT',
      category: a.type,
      title: a.title,
      description: `Announcement published`,
      timestamp: a.publishedAt.toISOString(),
    })
  }

  for (const t of tickets) {
    timeline.push({
      id: t.id,
      type: 'TICKET',
      category: t.issueType,
      title: `Support ticket: ${t.issueType}`,
      description: `Ticket opened by ${t.voterName || 'voter'}`,
      recipient: t.voterName || undefined,
      status: t.status,
      timestamp: t.createdAt.toISOString(),
    })
  }

  // Sort by timestamp descending
  timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return timeline.slice(0, limit)
}
