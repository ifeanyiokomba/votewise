import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { getOrgDashboard, getAIInsights } from '@/lib/raei'
import { getCurrentOfficial } from '@/lib/guards'

export const dynamic = 'force-dynamic'

// GET /api/raei/org — Organization-level intelligence dashboard
export async function GET(req: NextRequest) {
  // Auth check — closes the endpoint authentication gap (audit finding)
  const official = await getCurrentOfficial(req)
  if (!official) return errorJson('Unauthorized', 401)
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error

  const [dashboard, insights] = await Promise.all([
    getOrgDashboard(orgResult.id),
    getAIInsights(orgResult.id),
  ])

  return json({ ...dashboard, insights })
}
