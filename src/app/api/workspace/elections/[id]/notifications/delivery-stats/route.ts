import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { getCurrentOfficial } from '@/lib/guards'

export const dynamic = 'force-dynamic'

// GET /api/workspace/elections/[id]/notifications/delivery-stats
// Returns aggregate delivery stats across all notifications for this election.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Auth check — closes the endpoint authentication gap (audit finding)
  const official = await getCurrentOfficial(req)
  if (!official) return errorJson('Unauthorized', 401)
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  const { id: electionId } = await params

  const election = await db.electionSession.findUnique({
    where: { id: electionId },
    select: { organizationId: true },
  })
  if (!election || election.organizationId !== org.id) {
    return errorJson('Election not found', 404)
  }

  // Get all notification IDs for this election
  const notifications = await db.notification.findMany({
    where: { electionSessionId: electionId },
    select: { id: true },
  })
  const notificationIds = notifications.map((n) => n.id)

  if (notificationIds.length === 0) {
    return json({
      totalNotifications: 0,
      totalRecipients: 0,
      deliveryRate: 0,
      readRate: 0,
      failureRate: 0,
      byChannel: { EMAIL: { total: 0, delivered: 0, read: 0, failed: 0 }, SMS: { total: 0, delivered: 0, read: 0, failed: 0 }, WHATSAPP: { total: 0, delivered: 0, read: 0, failed: 0 }, IN_APP: { total: 0, delivered: 0, read: 0, failed: 0 } },
      recentFailures: [],
    })
  }

  const deliveries = await db.notificationDelivery.findMany({
    where: { notificationId: { in: notificationIds } },
    orderBy: { createdAt: 'desc' },
    take: 500,
  })

  const total = deliveries.length
  const delivered = deliveries.filter((d) => d.status === 'DELIVERED' || d.status === 'READ').length
  const read = deliveries.filter((d) => d.status === 'READ').length
  const failed = deliveries.filter((d) => d.status === 'FAILED' || d.status === 'BOUNCED').length

  const byChannel: Record<string, { total: number; delivered: number; read: number; failed: number }> = {}
  for (const ch of ['EMAIL', 'SMS', 'WHATSAPP', 'IN_APP']) {
    const channelDeliveries = deliveries.filter((d) => d.channel === ch)
    byChannel[ch] = {
      total: channelDeliveries.length,
      delivered: channelDeliveries.filter((d) => d.status === 'DELIVERED' || d.status === 'READ').length,
      read: channelDeliveries.filter((d) => d.status === 'READ').length,
      failed: channelDeliveries.filter((d) => d.status === 'FAILED' || d.status === 'BOUNCED').length,
    }
  }

  const recentFailures = deliveries
    .filter((d) => d.status === 'FAILED' || d.status === 'BOUNCED')
    .slice(0, 5)
    .map((d) => ({
      id: d.id,
      channel: d.channel,
      recipientAddress: d.recipientAddress,
      errorCode: d.errorCode,
      errorMessage: d.errorMessage,
      createdAt: d.createdAt.toISOString(),
    }))

  return json({
    totalNotifications: notificationIds.length,
    totalRecipients: total,
    deliveryRate: total > 0 ? Math.round((delivered / total) * 10000) / 100 : 0,
    readRate: total > 0 ? Math.round((read / total) * 10000) / 100 : 0,
    failureRate: total > 0 ? Math.round((failed / total) * 10000) / 100 : 0,
    byChannel,
    recentFailures,
  })
}
