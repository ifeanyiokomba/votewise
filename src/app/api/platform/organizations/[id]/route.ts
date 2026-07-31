import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson } from '@/lib/election'
import { getCurrentOfficial } from '@/lib/guards'

export const dynamic = 'force-dynamic'

// GET /api/platform/organizations/[id] — platform super-admin only.
// Full detail of a single organization including members, workspaces, voter groups.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const official = await getCurrentOfficial(req)
  if (!official) return errorJson('Unauthorized', 401)
  if (official.role !== 'SUPER_ADMIN' && official.role !== 'PLATFORM_SUPER_ADMIN')
    return errorJson('Forbidden — platform super admin only', 403)

  const { id } = await params
  const org = await db.organization.findUnique({
    where: { id },
    include: {
      terminology: true,
      members: { orderBy: { createdAt: 'asc' } },
      workspaces: {
        orderBy: { name: 'asc' },
        include: { _count: { select: { voterGroups: true } } },
      },
      voterGroups: { orderBy: { name: 'asc' } },
      elections: { orderBy: { createdAt: 'desc' }, take: 10 },
    },
  })
  if (!org) return errorJson('Organization not found', 404)
  return json({ organization: org })
}
