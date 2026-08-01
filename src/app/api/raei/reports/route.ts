import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { generateReport } from '@/lib/raei'

export const dynamic = 'force-dynamic'

// POST /api/raei/reports — Generate a report
// Body: { type, format, electionId?, organizationId?, dateRange? }
export async function POST(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error

  const body = await req.json().catch(() => ({}))
  if (!body.type) return errorJson('Report type is required', 400)

  try {
    const report = await generateReport({
      type: body.type,
      format: body.format || 'JSON',
      electionId: body.electionId,
      organizationId: orgResult.id,
      dateRange: body.dateRange,
    })
    return json(report)
  } catch (e: any) {
    return errorJson(e.message || 'Failed to generate report', 500)
  }
}
