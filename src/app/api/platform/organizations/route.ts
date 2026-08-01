import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson, writeAudit, getClientIp } from '@/lib/election'
import { getCurrentOfficial } from '@/lib/guards'

export const dynamic = 'force-dynamic'

// GET /api/platform/organizations — platform super-admin only.
// Returns ALL organizations (including suspended/expired) with full metrics.
export async function GET(req: NextRequest) {
  const official = await getCurrentOfficial(req)
  if (!official) return errorJson('Unauthorized', 401)
  if (official.role !== 'SUPER_ADMIN' && official.role !== 'PLATFORM_SUPER_ADMIN')
    return errorJson('Forbidden — platform super admin only', 403)

  const orgs = await db.organization.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: {
          members: true, voterGroups: true, workspaces: true,
          elections: true,
        },
      },
    },
  })
  return json({
    organizations: orgs.map((o) => ({
      id: o.id, name: o.name, slug: o.slug, subdomain: o.subdomain,
      customDomain: o.customDomain, category: o.category,
      ownerEmail: o.ownerEmail, ownerName: o.ownerName,
      status: o.status, plan: o.plan, voterQuota: o.voterQuota,
      paidUntil: o.paidUntil, createdAt: o.createdAt,
      primaryColour: o.primaryColour, logoUrl: o.logoUrl,
      counts: o._count,
    })),
  })
}

// PATCH /api/platform/organizations — update org status (suspend/activate)
// Body: { id, status }
export async function PATCH(req: NextRequest) {
  const official = await getCurrentOfficial(req)
  if (!official) return errorJson('Unauthorized', 401)
  if (official.role !== 'SUPER_ADMIN' && official.role !== 'PLATFORM_SUPER_ADMIN')
    return errorJson('Forbidden — platform super admin only', 403)

  const body = await req.json().catch(() => ({}))
  const { id, status } = body
  if (!id || !status) return errorJson('Organization id and status are required', 400)
  if (!['TRIAL', 'ACTIVE', 'SUSPENDED', 'EXPIRED'].includes(status))
    return errorJson('Invalid status', 400)

  const org = await db.organization.update({
    where: { id },
    data: { status },
  })
  await writeAudit({
    actorId: official.id, actorRole: official.role, actorName: official.name,
    action: 'ORGANIZATION_STATUS_CHANGED',
    details: { organizationId: id, name: org.name, newStatus: status },
    ip: getClientIp(req),
  })
  return json({ ok: true, organization: { id: org.id, name: org.name, status: org.status } })
}
