import { NextRequest } from 'next/server'
import { clearAuthCookies, readAccessToken, verifyAccessToken } from '@/lib/auth'
import { json, errorJson } from '@/lib/election'

export const dynamic = 'force-dynamic'

// Alias for /api/auth/refresh GET/DELETE on a friendlier path.
export async function GET(req: NextRequest) {
  const token = readAccessToken(req)
  const payload = await verifyAccessToken(token)
  if (!payload) return json({ valid: false }, 401)
  return json({ valid: true, official: payload })
}

export async function POST(req: NextRequest) {
  // Proxy to refresh rotation logic.
  return errorJson('Use /api/auth/refresh', 404)
}

export async function DELETE() {
  await clearAuthCookies()
  return json({ ok: true })
}
