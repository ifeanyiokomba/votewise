import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { verifyAccessToken, readAccessToken, readRefreshCookie, hashRefreshToken, signAccessToken, setAuthCookies, clearAuthCookies } from '@/lib/auth'
import { json, errorJson, writeAudit, getClientIp } from '@/lib/election'

export const dynamic = 'force-dynamic'

// POST /api/auth/refresh — rotate the refresh token, issue a new access token.
// Detects token reuse (rotated token used again → revoke whole family).
export async function POST(req: NextRequest) {
  const refreshToken = readRefreshCookie(req)
  if (!refreshToken) return errorJson('No refresh token', 401)
  const tokenHash = hashRefreshToken(refreshToken)

  const stored = await db.refreshToken.findUnique({
    where: { tokenHash },
    include: { official: { select: { id: true, email: true, name: true, role: true, scopeFacultyId: true, scopeDepartmentId: true, lockedUntil: true } } },
  })
  if (!stored) return errorJson('Invalid refresh token', 401)
  if (stored.expiresAt < new Date()) return errorJson('Refresh token expired', 401)
  if (stored.official.lockedUntil && stored.official.lockedUntil > new Date()) return errorJson('Account locked', 423)

  // Token reuse detection: if this token was already used/revoked, the whole
  // family is compromised → revoke everything.
  if (stored.usedAt || stored.revokedAt) {
    await db.refreshToken.updateMany({
      where: { family: stored.family, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    await writeAudit({
      actorId: stored.official.id, actorRole: stored.official.role, actorName: stored.official.name,
      action: 'REFRESH_TOKEN_REUSE', details: { family: stored.family }, ip: getClientIp(req),
    })
    await clearAuthCookies()
    return errorJson('Token reuse detected. All sessions revoked.', 401)
  }

  // Rotate: mark old token used+revoked, issue a new one in the same family.
  await db.refreshToken.update({ where: { id: stored.id }, data: { usedAt: new Date(), revokedAt: new Date() } })
  const { newRefreshToken } = await import('@/lib/crypto')
  const newRefresh = newRefreshToken()
  await db.refreshToken.create({
    data: {
      officialId: stored.official.id,
      tokenHash: newRefresh.tokenHash,
      family: stored.family, // same family
      ipAddress: getClientIp(req),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  })
  const access = await signAccessToken({
    sub: stored.official.id, role: stored.official.role, name: stored.official.name, email: stored.official.email,
    scopeFacultyId: stored.official.scopeFacultyId, scopeDepartmentId: stored.official.scopeDepartmentId,
  })
  await setAuthCookies(access, newRefresh.token)
  return json({ ok: true })
}

// GET /api/auth/me — current official from the access token.
export async function GET(req: NextRequest) {
  const token = readAccessToken(req)
  const payload = await verifyAccessToken(token)
  if (!payload) return json({ valid: false }, 401)
  const official = await db.electionOfficial.findUnique({
    where: { id: payload.sub },
    select: { id: true, name: true, email: true, role: true, scopeFacultyId: true, scopeDepartmentId: true, totpEnabled: true, emailVerified: true },
  })
  if (!official) return json({ valid: false }, 401)
  return json({ valid: true, official })
}

// POST /api/auth/logout — revoke the refresh token family + clear cookies.
export async function DELETE(req: NextRequest) {
  const refreshToken = readRefreshCookie(req)
  if (refreshToken) {
    const tokenHash = hashRefreshToken(refreshToken)
    const stored = await db.refreshToken.findUnique({ where: { tokenHash } })
    if (stored) {
      await db.refreshToken.updateMany({
        where: { family: stored.family, revokedAt: null },
        data: { revokedAt: new Date() },
      })
    }
  }
  await clearAuthCookies()
  return json({ ok: true })
}
