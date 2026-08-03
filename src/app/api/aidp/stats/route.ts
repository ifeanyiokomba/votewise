import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { getApiStats } from '@/lib/aidp'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/aidp/stats — API usage stats
export async function GET(req: NextRequest) {
  // Auth check — closes the endpoint authentication gap (audit finding)
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth) return errorJson('Unauthorized', 401)
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error

  const stats = await getApiStats(orgResult.id)
  return json(stats)
}
