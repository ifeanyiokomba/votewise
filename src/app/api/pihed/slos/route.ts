import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import { getSloStatuses, getSloSummary } from '@/lib/infra/slo-tracker'

export const dynamic = 'force-dynamic'

// GET /api/pihed/slos — Service Level Objective statuses + summary
// Query: ?summary=true  →  just the summary card data
// Platform admin only.
export async function GET(req: NextRequest) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth || (auth.role !== 'SUPER_ADMIN' && auth.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }

  const url = new URL(req.url)
  const summaryOnly = url.searchParams.get('summary') === 'true'

  if (summaryOnly) {
    const summary = await getSloSummary()
    return json({ summary })
  }

  const [statuses, summary] = await Promise.all([
    getSloStatuses(),
    getSloSummary(),
  ])

  return json({ statuses, summary })
}
