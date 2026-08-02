import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import { listPilotElections, createPilotElection, getPilotStats, ensurePilotsSeeded } from '@/lib/tqasgr'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth || (auth.role !== 'SUPER_ADMIN' && auth.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }
  await ensurePilotsSeeded().catch(() => {})
  const url = new URL(req.url)
  const status = url.searchParams.get('status') || undefined
  const [pilots, stats] = await Promise.all([listPilotElections(status), getPilotStats()])
  return json({ pilots, stats })
}

export async function POST(req: NextRequest) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth || (auth.role !== 'SUPER_ADMIN' && auth.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }
  const body = await req.json().catch(() => ({}))
  if (!body.name || !body.organizationId) return errorJson('name and organizationId required', 400)
  const pilot = await createPilotElection({ ...body, createdBy: auth.sub, createdByName: auth.email })
  return json({ pilot, message: 'Pilot election created' })
}
