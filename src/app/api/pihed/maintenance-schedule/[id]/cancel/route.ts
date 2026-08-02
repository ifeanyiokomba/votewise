import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import { cancelScheduledMaintenance } from '@/lib/infra/scheduled-maintenance'

export const dynamic = 'force-dynamic'

// POST /api/pihed/maintenance-schedule/[id]/cancel — cancel a scheduled window
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth || (auth.role !== 'SUPER_ADMIN' && auth.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }

  const { id } = await params
  try {
    const sm = await cancelScheduledMaintenance(id)
    return json({ maintenance: sm, message: 'Maintenance window cancelled' })
  } catch (e: any) {
    return errorJson(e.message || 'Failed to cancel maintenance', 400)
  }
}
