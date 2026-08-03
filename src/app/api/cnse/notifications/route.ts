import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { getCurrentOfficial } from '@/lib/guards'

export const dynamic = 'force-dynamic'

// GET /api/cnse/notifications — Notification center inbox
export async function GET(req: NextRequest) {
  // Auth check — closes the endpoint authentication gap (audit finding)
  const official = await getCurrentOfficial(req)
  if (!official) return errorJson('Unauthorized', 401)
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  const { searchParams } = new URL(req.url)
  const filter = searchParams.get('filter') || 'all' // all | unread | read | archived

  // Get notifications for this org's officials
  const where: any = {}
  if (filter === 'unread') where.readAt = null
  if (filter === 'read') where.readAt = { not: null }

  const notifications = await db.notification.findMany({
    where: {
      ...where,
      OR: [
        { electionSession: { organizationId: org.id } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  const unreadCount = await db.notification.count({
    where: {
      readAt: null,
      OR: [{ electionSession: { organizationId: org.id } }],
    },
  })

  return json({
    notifications: notifications.map((n) => ({
      ...n,
      createdAt: n.createdAt.toISOString(),
      readAt: n.readAt?.toISOString() || null,
    })),
    unreadCount,
  })
}

// PATCH /api/cnse/notifications — Mark as read
export async function PATCH(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error

  const body = await req.json().catch(() => ({}))
  const { notificationId, action } = body // action: 'read' | 'archive' | 'markAllRead'

  if (action === 'markAllRead') {
    await db.notification.updateMany({
      where: { readAt: null },
      data: { readAt: new Date() },
    })
    return json({ ok: true, message: 'All notifications marked as read' })
  }

  if (!notificationId) return errorJson('notificationId is required', 400)

  if (action === 'read') {
    await db.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    })
  }

  return json({ ok: true })
}
