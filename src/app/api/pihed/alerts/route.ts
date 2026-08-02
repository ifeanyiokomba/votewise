import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import { listAlerts, listAlertRules, getAlertStats } from '@/lib/infra/alerting'

export const dynamic = 'force-dynamic'

// GET /api/pihed/alerts — List recent alert events + rules + stats
// Query: ?unacknowledged=true&limit=50
// Platform admin only.
export async function GET(req: NextRequest) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth || (auth.role !== 'SUPER_ADMIN' && auth.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }

  const url = new URL(req.url)
  const unack = url.searchParams.get('unacknowledged') === 'true'
  const limit = Math.min(200, Number(url.searchParams.get('limit')) || 50)

  const [events, rules, stats] = await Promise.all([
    listAlerts(limit, unack),
    listAlertRules(),
    getAlertStats(),
  ])

  return json({ events, rules, stats })
}
