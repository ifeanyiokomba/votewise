// VoteWise — Chapter 16 Webhook Engine
//
// Delivers signed event notifications to external systems instead of
// requiring polling. Each webhook delivery includes an HMAC-SHA256 signature,
// timestamp, and event ID for replay protection.

import { db } from '@/lib/db'
import { hmacSign, sha256, randomToken } from '@/lib/crypto'
import type { WebhookEvent, WebhookCreate } from './types'

/**
 * Create a new webhook endpoint for an organization.
 */
export async function createWebhook(organizationId: string, input: WebhookCreate) {
  const secret = randomToken(32)
  const webhook = await db.webhook.create({
    data: {
      organizationId,
      url: input.url,
      name: input.name,
      secret,
      events: JSON.stringify(input.events),
      isActive: true,
    },
  })
  return {
    ...webhook,
    events: JSON.parse(webhook.events),
    secret, // only returned once on creation
    lastSentAt: null,
    createdAt: webhook.createdAt.toISOString(),
    updatedAt: webhook.updatedAt.toISOString(),
  }
}

/**
 * List webhooks for an organization (without the secret).
 */
export async function listWebhooks(organizationId: string) {
  const webhooks = await db.webhook.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, url: true, name: true, events: true, isActive: true,
      totalSent: true, totalDelivered: true, totalFailed: true,
      lastSentAt: true, lastStatus: true, createdAt: true,
    },
  })
  return webhooks.map((w) => ({
    ...w,
    events: JSON.parse(w.events),
    lastSentAt: w.lastSentAt?.toISOString() || null,
    createdAt: w.createdAt.toISOString(),
  }))
}

/**
 * Delete a webhook.
 */
export async function deleteWebhook(organizationId: string, webhookId: string) {
  const webhook = await db.webhook.findUnique({ where: { id: webhookId } })
  if (!webhook || webhook.organizationId !== organizationId) throw new Error('Webhook not found')
  await db.webhook.delete({ where: { id: webhookId } })
}

/**
 * Trigger a webhook event — finds all active webhooks for the org that are
 * subscribed to this event, creates delivery records, and attempts delivery.
 */
export async function triggerWebhookEvent(organizationId: string, eventType: WebhookEvent, payload: Record<string, any>): Promise<void> {
  const webhooks = await db.webhook.findMany({
    where: { organizationId, isActive: true },
  })

  for (const webhook of webhooks) {
    const events: string[] = JSON.parse(webhook.events)
    if (!events.includes(eventType)) continue

    const eventId = randomToken(16)
    const timestamp = new Date().toISOString()
    const fullPayload = JSON.stringify({
      event: eventType,
      eventId,
      timestamp,
      organizationId,
      data: payload,
    })

    const signature = hmacSign(`webhook:${eventId}:${timestamp}:${fullPayload}`)

    await db.webhookDelivery.create({
      data: {
        webhookId: webhook.id,
        eventId,
        eventType,
        payload: fullPayload,
        signature,
        status: 'PENDING',
      },
    })

    // Attempt delivery (async — don't block the trigger)
    deliverWebhook(webhook.id, webhook.url, webhook.secret, fullPayload, signature, eventId).catch(() => {})
  }
}

/**
 * Attempt to deliver a webhook payload to the endpoint.
 */
async function deliverWebhook(webhookId: string, url: string, secret: string, payload: string, signature: string, eventId: string): Promise<void> {
  const delivery = await db.webhookDelivery.findFirst({
    where: { webhookId, eventId },
    orderBy: { createdAt: 'desc' },
  })
  if (!delivery) return

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-VoteWise-Signature': signature,
        'X-VoteWise-Event': delivery.eventType,
        'X-VoteWise-Event-Id': eventId,
        'X-VoteWise-Timestamp': delivery.createdAt.toISOString(),
      },
      body: payload,
      signal: AbortSignal.timeout(10000),
    })

    if (response.ok) {
      await db.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'DELIVERED',
          responseCode: response.status,
          responseBody: (await response.text()).slice(0, 1000),
          deliveredAt: new Date(),
        },
      })
      await db.webhook.update({
        where: { id: webhookId },
        data: {
          totalSent: { increment: 1 },
          totalDelivered: { increment: 1 },
          lastSentAt: new Date(),
          lastStatus: response.status,
        },
      })
    } else {
      await markFailed(webhookId, delivery.id, response.status, await response.text())
    }
  } catch (e: any) {
    await markFailed(webhookId, delivery.id, 0, e.message)
  }
}

async function markFailed(webhookId: string, deliveryId: string, code: number, body: string): Promise<void> {
  const delivery = await db.webhookDelivery.findUnique({ where: { id: deliveryId } })
  if (!delivery) return

  const attempts = delivery.attempts + 1
  const shouldRetry = attempts < delivery.maxAttempts

  await db.webhookDelivery.update({
    where: { id: deliveryId },
    data: {
      status: shouldRetry ? 'RETRYING' : 'FAILED',
      attempts,
      responseCode: code,
      responseBody: body.slice(0, 1000),
      nextRetryAt: shouldRetry ? new Date(Date.now() + Math.pow(2, attempts) * 60 * 1000) : null,
    },
  })

  await db.webhook.update({
    where: { id: webhookId },
    data: {
      totalSent: { increment: 1 },
      totalFailed: { increment: 1 },
      lastSentAt: new Date(),
      lastStatus: code,
    },
  })
}

/**
 * Get webhook delivery history.
 */
export async function getWebhookDeliveries(organizationId: string, webhookId?: string, limit = 50) {
  const where: any = {}
  if (webhookId) {
    where.webhookId = webhookId
  } else {
    // Get deliveries for all org's webhooks
    const webhookIds = (await db.webhook.findMany({ where: { organizationId }, select: { id: true } })).map((w) => w.id)
    where.webhookId = { in: webhookIds }
  }

  const deliveries = await db.webhookDelivery.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true, webhookId: true, eventId: true, eventType: true, status: true,
      attempts: true, responseCode: true, deliveredAt: true, createdAt: true,
    },
  })

  return deliveries.map((d) => ({
    ...d,
    deliveredAt: d.deliveredAt?.toISOString() || null,
    createdAt: d.createdAt.toISOString(),
  }))
}

/**
 * Test a webhook by sending a test event.
 */
export async function testWebhook(organizationId: string, webhookId: string): Promise<void> {
  await triggerWebhookEvent(organizationId, 'organization.updated' as WebhookEvent, {
    test: true,
    message: 'This is a test webhook delivery from VoteWise.',
    timestamp: new Date().toISOString(),
  })
}
