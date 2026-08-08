import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { readAccessToken, verifyAccessToken } from '@/lib/auth'
import { verifyReauth } from '@/lib/reauth'
import { json, errorJson, writeAudit, getClientIp, recordSecurityEvent } from '@/lib/election'

export const dynamic = 'force-dynamic'

// Chapter 3: disabling 2FA is a critical action per the directive's
// "reauthentication before dangerous operations" requirement. A valid
// access token alone used to be sufficient — meaning a stolen token, with
// no knowledge of the account's password or current TOTP code, could
// strip MFA protection from a privileged account. See src/lib/reauth.ts
// for the actual check and its tests.
export async function POST(req: NextRequest) {
  const payload = await verifyAccessToken(readAccessToken(req))
  if (!payload) return errorJson('Unauthorized', 401)

  const body = await req.json().catch(() => ({}))

  const official = await db.electionOfficial.findUnique({ where: { id: payload.sub } })
  if (!official) return errorJson('Unauthorized', 401)

  const reauth = verifyReauth(official, { password: body.password, totp: body.totp })
  if (!reauth.ok) {
    await recordSecurityEvent({
      severity: 'HIGH', category: 'AUTH_FAILURE',
      actorId: official.id, actorEmail: official.email, ipAddress: getClientIp(req),
      message: `Reauthentication failed on 2FA-disable attempt (${reauth.reason})`,
    })
    const message = reauth.reason === 'MISSING_TOTP' || reauth.reason === 'WRONG_TOTP'
      ? 'Your current 2FA code is required to disable two-factor authentication.'
      : 'Current password is required to disable two-factor authentication.'
    return errorJson(message, 401)
  }

  await db.electionOfficial.update({
    where: { id: payload.sub },
    data: { totpEnabled: false, totpSecret: null, backupCodes: null },
  })
  await writeAudit({ actorId: payload.sub, actorRole: payload.role, actorName: payload.name, action: '2FA_DISABLED', ip: getClientIp(req) })
  return json({ ok: true })
}
