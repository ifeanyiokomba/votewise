import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { getAIInsights } from '@/lib/raei'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/raei/insights — AI-generated insights (rule-based for now)
export async function GET(req: NextRequest) {
  // Auth check — closes the endpoint authentication gap (audit finding)
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth) return errorJson('Unauthorized', 401)
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error

  const insights = await getAIInsights(orgResult.id)
  return json({ insights })
}
