import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { generateTotpSecret, totpUri } from '@/lib/crypto'
import { readAccessToken, verifyAccessToken } from '@/lib/auth'
import { json, errorJson, writeAudit, getClientIp } from '@/lib/election'
import QRCode from 'qrcode'

export const dynamic = 'force-dynamic'

// POST /api/auth/2fa/setup — generate a TOTP secret + QR code for the caller.
export async function POST(req: NextRequest) {
  const payload = await verifyAccessToken(readAccessToken(req))
  if (!payload) return errorJson('Unauthorized', 401)
  const official = await db.electionOfficial.findUnique({ where: { id: payload.sub } })
  if (!official) return errorJson('Unauthorized', 401)

  const secret = generateTotpSecret()
  const uri = totpUri(secret, official.email)
  const qr = await QRCode.toDataURL(uri, { margin: 1, width: 220 })

  // Store the secret temporarily (not yet enabled) so /verify can confirm.
  await db.electionOfficial.update({ where: { id: official.id }, data: { totpSecret: secret } })
  await writeAudit({ actorId: official.id, actorRole: official.role, actorName: official.name, action: '2FA_SETUP_INITIATED', ip: getClientIp(req) })
  return json({ secret, uri, qr })
}
