import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'

export const dynamic = 'force-dynamic'

// GET /api/workspace/elections/[id]/notifications/[notificationId]/deliveries
// Returns all delivery records for a specific notification.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; notificationId: string }> }) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  const { id: electionId, notificationId } = await params

  // Verify election belongs to org
  const election = await db.electionSession.findUnique({
    where: { id: electionId },
    select: { organizationId: true },
  })
  if (!election || election.organizationId !== org.id) {
    return errorJson('Election not found', 404)
  }

  const deliveries = await db.notificationDelivery.findMany({
    where: { notificationId },
    orderBy: { createdAt: 'desc' },
  })

  // Get voter names for the deliveries (masked)
  const voterIds = [...new Set(deliveries.map((d) => d.voterId).filter(Boolean))] as string[]
  const voters = await db.voter.findMany({
    where: { id: { in: voterIds } },
    select: { id: true, fullName: true, email: true, phone: true },
  })
  const voterMap = new Map(voters.map((v) => [v.id, v]))

  const stats = {
    total: deliveries.length,
    pending: deliveries.filter((d) => d.status === 'PENDING').length,
    sent: deliveries.filter((d) => d.status === 'SENT').length,
    delivered: deliveries.filter((d) => d.status === 'DELIVERED').length,
    read: deliveries.filter((d) => d.status === 'READ').length,
    failed: deliveries.filter((d) => d.status === 'FAILED' || d.status === 'BOUNCED').length,
  }

  return json({
    deliveries: deliveries.map((d) => {
      const voter = d.voterId ? voterMap.get(d.voterId) : null
      return {
        id: d.id,
        channel: d.channel,
        status: d.status,
        recipientAddress: d.recipientAddress,
        recipientName: voter?.fullName || 'Unknown',
        sentAt: d.sentAt?.toISOString() || null,
        deliveredAt: d.deliveredAt?.toISOString() || null,
        readAt: d.readAt?.toISOString() || null,
        errorCode: d.errorCode,
        errorMessage: d.errorMessage,
        attempts: d.attempts,
        createdAt: d.createdAt.toISOString(),
      }
    }),
    stats,
  })
}
