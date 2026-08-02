import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import { listDeployments, getActiveDeployment, ensureInfraSeeded } from '@/lib/pihed'

export const dynamic = 'force-dynamic'

// GET /api/pihed/deployments — List deployment history + current active
// Platform admin only.
export async function GET(req: NextRequest) {
  const auth = await verifyAccessToken(readAccessToken(req))
  if (!auth || (auth.role !== 'SUPER_ADMIN' && auth.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }

  await ensureInfraSeeded()

  const url = new URL(req.url)
  const limit = Math.min(50, Number(url.searchParams.get('limit')) || 20)

  const [deployments, active] = await Promise.all([
    listDeployments(limit),
    getActiveDeployment(),
  ])

  return json({ deployments, active })
}
