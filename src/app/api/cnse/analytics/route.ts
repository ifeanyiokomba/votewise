import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { getDeliveryStats } from '@/lib/cnse'
import { getCurrentOfficial } from '@/lib/guards'

export const dynamic = 'force-dynamic'

// GET /api/cnse/analytics?electionId=...&since=...
export async function GET(req: NextRequest) {
  // Auth check — closes the endpoint authentication gap (audit finding)
  const official = await getCurrentOfficial(req)
  if (!official) return errorJson('Unauthorized', 401)
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  const { searchParams } = new URL(req.url)
  const electionId = searchParams.get('electionId') || undefined
  const sinceStr = searchParams.get('since')
  const since = sinceStr ? new Date(sinceStr) : undefined

  const stats = await getDeliveryStats({
    organizationId: org.id,
    electionId,
    since,
  })

  return json(stats)
}
