import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { getAIInsights } from '@/lib/raei'

export const dynamic = 'force-dynamic'

// GET /api/raei/insights — AI-generated insights (rule-based for now)
export async function GET(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error

  const insights = await getAIInsights(orgResult.id)
  return json({ insights })
}
