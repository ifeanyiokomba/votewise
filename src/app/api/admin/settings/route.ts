import { NextRequest } from 'next/server'
import { json, getClientIp, writeAudit } from '@/lib/election'
import { requireAdmin } from '@/lib/guards'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/admin/settings
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof Response) return auth
  const settings = await db.electionSetting.findUnique({ where: { id: 'default' } })
  return json({ settings })
}

// PUT /api/admin/settings
export async function PUT(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof Response) return auth
  const body = await req.json().catch(() => ({}))
  const allowed = ['publicLiveResults', 'showTurnout', 'requireOtp', 'otpTtlSeconds', 'ballotRandomization', 'notaEnabled', 'maxOtpAttempts']
  const data: Record<string, unknown> = {}
  for (const k of allowed) if (k in body) data[k] = body[k]
  const settings = await db.electionSetting.upsert({
    where: { id: 'default' },
    create: { id: 'default', ...(data as any) },
    update: data,
  })
  await writeAudit({ actorId: auth.admin!.id, actorRole: auth.admin!.role, actorName: auth.admin!.name, action: 'SETTINGS_UPDATE', details: data, ip: getClientIp(req) })
  return json({ ok: true, settings })
}
