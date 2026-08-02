import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken } from '@/lib/auth'
import { getOrgHealthScore } from '@/lib/paoem'

export const dynamic = 'force-dynamic'

// GET /api/paoem/organizations/[orgId]/health — Org health score
export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const auth = verifyAccessToken(req)
  if (!auth || (auth.role !== 'SUPER_ADMIN' && auth.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }

  const { orgId } = await params
  const health = await getOrgHealthScore(orgId)
  if (!health) return errorJson('Organization not found', 404)
  return json(health)
}
