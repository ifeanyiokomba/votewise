import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken } from '@/lib/auth'
import { getOrganizations } from '@/lib/paoem'

export const dynamic = 'force-dynamic'

// GET /api/paoem/organizations?search=...&status=...&plan=...&limit=...&offset=...
export async function GET(req: NextRequest) {
  const auth = verifyAccessToken(req)
  if (!auth || (auth.role !== 'SUPER_ADMIN' && auth.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }

  const { searchParams } = new URL(req.url)
  const result = await getOrganizations({
    search: searchParams.get('search') || undefined,
    status: searchParams.get('status') || undefined,
    plan: searchParams.get('plan') || undefined,
    limit: parseInt(searchParams.get('limit') || '50'),
    offset: parseInt(searchParams.get('offset') || '0'),
  })
  return json(result)
}
