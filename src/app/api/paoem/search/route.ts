import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken } from '@/lib/auth'
import { globalSearch } from '@/lib/paoem'

export const dynamic = 'force-dynamic'

// GET /api/paoem/search?q=... — Global search across everything
export async function GET(req: NextRequest) {
  const auth = verifyAccessToken(req)
  if (!auth || (auth.role !== 'SUPER_ADMIN' && auth.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }

  const q = new URL(req.url).searchParams.get('q') || ''
  const result = await globalSearch(q)
  return json(result)
}
