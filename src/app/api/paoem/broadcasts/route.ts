import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken } from '@/lib/auth'
import { createBroadcast, getBroadcasts } from '@/lib/paoem'

export const dynamic = 'force-dynamic'

// GET /api/paoem/broadcasts — List broadcasts
export async function GET(req: NextRequest) {
  const auth = verifyAccessToken(req)
  if (!auth || (auth.role !== 'SUPER_ADMIN' && auth.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }
  const broadcasts = await getBroadcasts(true)
  return json({ broadcasts })
}

// POST /api/paoem/broadcasts — Create a broadcast
// Body: { title, message, type?, target?, expiresAt? }
export async function POST(req: NextRequest) {
  const auth = verifyAccessToken(req)
  if (!auth || (auth.role !== 'SUPER_ADMIN' && auth.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }

  const body = await req.json().catch(() => ({}))
  if (!body.title || !body.message) return errorJson('title and message are required', 400)

  const broadcast = await createBroadcast(body, auth.sub, auth.email)
  return json({ ok: true, broadcast })
}
