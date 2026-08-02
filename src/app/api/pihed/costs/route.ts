import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import { getCostSummary, getCostTrend, ensureCostsSeeded } from '@/lib/infra/cost-tracker'

export const dynamic = 'force-dynamic'

// GET /api/pihed/costs — Cost monitoring dashboard data
// Query: ?days=30&org=<organizationId>&category=sms
// Platform admin only.
export async function GET(req: NextRequest) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth || (auth.role !== 'SUPER_ADMIN' && auth.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }

  // Ensure sample data exists (no-op if already seeded)
  await ensureCostsSeeded().catch(() => {})

  const url = new URL(req.url)
  const days = Math.min(365, Math.max(1, Number(url.searchParams.get('days')) || 30))
  const orgId = url.searchParams.get('org') || undefined
  const category = url.searchParams.get('category') || undefined

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const [summary, trend] = await Promise.all([
    getCostSummary({ since, organizationId: orgId, category: category as any }),
    getCostTrend(days, orgId),
  ])

  return json({ summary, trend, days })
}
