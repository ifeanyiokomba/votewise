import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { verifyTotp, generateBackupCodes } from '@/lib/crypto'
import { readAccessToken, verifyAccessToken } from '@/lib/auth'
import { json, errorJson, writeAudit, getClientIp, recordSecurityEvent } from '@/lib/election'

export const dynamic = 'force-dynamic'

// POST /api/auth/2fa/verify
// Body: { code } — confirms the TOTP secret stored on the official, enables 2FA,
// and returns one-time backup codes.
export async function POST(req: NextRequest) {
  const payload = await verifyAccessToken(readAccessToken(req))
  if (!payload) return errorJson('Unauthorized', 401)
  const official = await db.electionOfficial.findUnique({ where: { id: payload.sub } })
  if (!official || !official.totpSecret) return errorJson('Set up 2FA first', 400)

  const body = await req.json().catch(() => ({}))
  const code = String(body.code || '')
  if (!verifyTotp(code, official.totpSecret)) {
    await recordSecurityEvent({
      severity: 'MEDIUM', category: 'AUTH_FAILURE',
      actorId: official.id, actorEmail: official.email, ipAddress: getClientIp(req),
      message: 'Failed 2FA setup verification',
    })
    return errorJson('Invalid 2FA code', 401)
  }

  const backup = generateBackupCodes(8)
  await db.electionOfficial.update({
    where: { id: official.id },
    data: { totpEnabled: true, backupCodes: JSON.stringify(backup.hashed) },
  })
  await writeAudit({ actorId: official.id, actorRole: official.role, actorName: official.name, action: '2FA_ENABLED', ip: getClientIp(req) })
  return json({ ok: true, backupCodes: backup.plain, message: 'Save these backup codes securely. They will not be shown again.' })
}
