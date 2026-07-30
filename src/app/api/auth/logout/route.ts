import { NextRequest } from 'next/server'
import { clearAuthCookies, readAccessToken, verifyAccessToken } from '@/lib/auth'
import { json } from '@/lib/election'
import { writeAudit, getClientIp } from '@/lib/election'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const payload = await verifyAccessToken(readAccessToken(req))
  if (payload) {
    await writeAudit({ actorId: payload.sub, actorRole: payload.role, actorName: payload.name, action: 'OFFICIAL_LOGOUT', ip: getClientIp(req) })
  }
  await clearAuthCookies()
  return json({ ok: true })
}
