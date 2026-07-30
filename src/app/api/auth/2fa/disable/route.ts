import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { readAccessToken, verifyAccessToken } from '@/lib/auth'
import { json, errorJson, writeAudit, getClientIp } from '@/lib/election'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const payload = await verifyAccessToken(readAccessToken(req))
  if (!payload) return errorJson('Unauthorized', 401)
  await db.electionOfficial.update({
    where: { id: payload.sub },
    data: { totpEnabled: false, totpSecret: null, backupCodes: null },
  })
  await writeAudit({ actorId: payload.sub, actorRole: payload.role, actorName: payload.name, action: '2FA_DISABLED', ip: getClientIp(req) })
  return json({ ok: true })
}
