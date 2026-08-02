import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import { listScheduledMaintenance, createScheduledMaintenance, getScheduledMaintenanceStats, ensureScheduledMaintenanceSeeded } from '@/lib/infra/scheduled-maintenance'

export const dynamic = 'force-dynamic'

// GET /api/pihed/maintenance-schedule — list scheduled maintenance + stats
export async function GET(req: NextRequest) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth || (auth.role !== 'SUPER_ADMIN' && auth.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }

  await ensureScheduledMaintenanceSeeded().catch(() => {})

  const url = new URL(req.url)
  const status = url.searchParams.get('status') || undefined
  const limit = Math.min(50, Number(url.searchParams.get('limit')) || 20)

  const [windows, stats] = await Promise.all([
    listScheduledMaintenance(limit, status),
    getScheduledMaintenanceStats(),
  ])

  return json({ windows, stats })
}

// POST /api/pihed/maintenance-schedule — schedule a new maintenance window
export async function POST(req: NextRequest) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth || (auth.role !== 'SUPER_ADMIN' && auth.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }

  const body = await req.json().catch(() => ({}))
  if (!body.title || !body.description || !body.scheduledStart || !body.scheduledEnd) {
    return errorJson('title, description, scheduledStart, scheduledEnd are required', 400)
  }

  try {
    const sm = await createScheduledMaintenance({
      ...body,
      scheduledStart: new Date(body.scheduledStart),
      scheduledEnd: new Date(body.scheduledEnd),
      createdBy: auth.sub,
      createdByName: auth.email,
    })
    return json({ maintenance: sm, message: 'Maintenance window scheduled' })
  } catch (e: any) {
    return errorJson(e.message || 'Failed to schedule maintenance', 400)
  }
}
