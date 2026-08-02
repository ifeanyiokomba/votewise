import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { getHistoricalComparison } from '@/lib/raei'

export const dynamic = 'force-dynamic'

// GET /api/raei/historical — Historical comparison across elections
export async function GET(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error

  const comparison = await getHistoricalComparison(orgResult.id)
  return json(comparison)
}
