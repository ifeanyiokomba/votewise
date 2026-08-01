import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { getDeliveryStats } from '@/lib/cnse'

export const dynamic = 'force-dynamic'

// GET /api/cnse/analytics?electionId=...&since=...
export async function GET(req: NextRequest) {
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
