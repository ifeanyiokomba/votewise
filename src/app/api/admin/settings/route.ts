import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json } from '@/lib/election'
import { requireOfficial } from '@/lib/guards'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireOfficial(req, 'election.manage')
  if (auth instanceof Response) return auth
  const settings = await db.electionSetting.findUnique({ where: { id: 'default' } })
  return json({ settings })
}

export async function PUT(req: NextRequest) {
  const auth = await requireOfficial(req, 'election.manage')
  if (auth instanceof Response) return auth
  const body = await req.json().catch(() => ({}))
  const allowed = ['publicLiveResults', 'showTurnout', 'requireOtp', 'requireAccreditation', 'otpTtlSeconds', 'ballotRandomization', 'notaEnabled', 'maxOtpAttempts', 'singleDeviceEnforcement', 'sessionTtlMinutes', 'accessTtlMinutes', 'refreshTtlDays']
  const data: Record<string, unknown> = {}
  for (const k of allowed) if (k in body) data[k] = body[k]
  const settings = await db.electionSetting.upsert({
    where: { id: 'default' },
    create: { id: 'default', ...(data as any) },
    update: data,
  })
  return json({ ok: true, settings })
}
