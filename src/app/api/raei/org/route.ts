import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { getOrgDashboard, getAIInsights } from '@/lib/raei'

export const dynamic = 'force-dynamic'

// GET /api/raei/org — Organization-level intelligence dashboard
export async function GET(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error

  const [dashboard, insights] = await Promise.all([
    getOrgDashboard(orgResult.id),
    getAIInsights(orgResult.id),
  ])

  return json({ ...dashboard, insights })
}
