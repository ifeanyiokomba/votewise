import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken } from '@/lib/auth'
import { startMaintenance, endMaintenance, getActiveMaintenance } from '@/lib/paoem'

export const dynamic = 'force-dynamic'

// GET /api/paoem/maintenance — List active maintenance
export async function GET(req: NextRequest) {
  const auth = verifyAccessToken(req)
  if (!auth || (auth.role !== 'SUPER_ADMIN' && auth.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }
  const maintenance = await getActiveMaintenance()
  return json({ maintenance })
}

// POST /api/paoem/maintenance — Start maintenance
// Body: { level: 'PLATFORM'|'ORGANIZATION'|'MODULE', organizationId?, module?, reason }
export async function POST(req: NextRequest) {
  const auth = verifyAccessToken(req)
  if (!auth || (auth.role !== 'SUPER_ADMIN' && auth.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }

  const body = await req.json().catch(() => ({}))
  if (!body.level || !body.reason) return errorJson('level and reason are required', 400)

  const maintenance = await startMaintenance({
    level: body.level,
    organizationId: body.organizationId,
    module: body.module,
    reason: body.reason,
    adminId: auth.sub,
    adminName: auth.email,
  })
  return json({ ok: true, maintenance })
}

// PATCH /api/paoem/maintenance — End maintenance
// Body: { maintenanceId }
export async function PATCH(req: NextRequest) {
  const auth = verifyAccessToken(req)
  if (!auth || (auth.role !== 'SUPER_ADMIN' && auth.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }

  const body = await req.json().catch(() => ({}))
  if (!body.maintenanceId) return errorJson('maintenanceId is required', 400)

  await endMaintenance(body.maintenanceId, auth.sub, auth.email)
  return json({ ok: true, message: 'Maintenance ended' })
}
