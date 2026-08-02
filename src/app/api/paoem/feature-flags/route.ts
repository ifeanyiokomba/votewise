import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken } from '@/lib/auth'
import { getFeatureFlags, createFeatureFlag } from '@/lib/paoem'

export const dynamic = 'force-dynamic'

// GET /api/paoem/feature-flags — List all feature flags
export async function GET(req: NextRequest) {
  const auth = verifyAccessToken(req)
  if (!auth || (auth.role !== 'SUPER_ADMIN' && auth.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }
  const flags = await getFeatureFlags()
  return json({ flags })
}

// POST /api/paoem/feature-flags — Create a feature flag
export async function POST(req: NextRequest) {
  const auth = verifyAccessToken(req)
  if (!auth || (auth.role !== 'SUPER_ADMIN' && auth.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }

  const body = await req.json().catch(() => ({}))
  if (!body.key || !body.name) return errorJson('key and name are required', 400)

  const flag = await createFeatureFlag(body, auth.sub, auth.email)
  return json({ ok: true, flag })
}
