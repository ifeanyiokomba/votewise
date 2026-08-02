import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken } from '@/lib/auth'
import { setFeatureFlag } from '@/lib/paoem'

export const dynamic = 'force-dynamic'

// PATCH /api/paoem/feature-flags/[key] — Toggle a feature flag
// Body: { enabled: boolean }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const auth = verifyAccessToken(req)
  if (!auth || (auth.role !== 'SUPER_ADMIN' && auth.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }

  const { key } = await params
  const body = await req.json().catch(() => ({}))
  if (typeof body.enabled !== 'boolean') return errorJson('enabled (boolean) is required', 400)

  const flag = await setFeatureFlag(key, body.enabled, auth.sub, auth.email)
  return json({ ok: true, flag })
}
