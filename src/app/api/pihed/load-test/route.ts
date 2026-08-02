import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import { getLoadTestPresets, getLoadTestHistory } from '@/lib/infra/load-test'

export const dynamic = 'force-dynamic'

// GET /api/pihed/load-test — List load test presets + history
// Platform admin only.
export async function GET(req: NextRequest) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth || (auth.role !== 'SUPER_ADMIN' && auth.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }

  const [presets, history] = await Promise.all([
    Promise.resolve(getLoadTestPresets()),
    getLoadTestHistory(10),
  ])

  return json({ presets, history })
}
