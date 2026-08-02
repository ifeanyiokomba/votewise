import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken } from '@/lib/auth'
import { generateFinancialReport, type FinancialReportType } from '@/lib/bspcm'
import { requireOrganization } from '@/lib/org-context'

export const dynamic = 'force-dynamic'

// POST /api/bspcm/financial-reports — Generate a financial report
// Body: { type: 'REVENUE'|'INVOICE'|'TAX'|'PAYMENT'|'REFUND'|'SUBSCRIPTION', dateRange?, admin? }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  if (!body.type) return errorJson('Report type is required', 400)

  const auth = verifyAccessToken(req)
  const isAdmin = auth?.role === 'SUPER_ADMIN'

  let organizationId: string | undefined
  if (body.admin && isAdmin) {
    // Platform admin — see all orgs
  } else {
    const orgResult = await requireOrganization(req)
    if ('error' in orgResult) return orgResult.error
    organizationId = orgResult.id
  }

  const dateRange = body.dateRange ? { start: new Date(body.dateRange.start), end: new Date(body.dateRange.end) } : undefined

  try {
    const report = await generateFinancialReport(body.type as FinancialReportType, { organizationId, dateRange })
    return json(report)
  } catch (e: any) {
    return errorJson(e.message || 'Failed to generate report', 500)
  }
}
