import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken } from '@/lib/auth'
import { getCommandCenterData } from '@/lib/paoem'

export const dynamic = 'force-dynamic'

// GET /api/paoem/command-center — Digital Command Center (War Room) data
export async function GET(req: NextRequest) {
  const auth = verifyAccessToken(req)
  if (!auth || (auth.role !== 'SUPER_ADMIN' && auth.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }

  const data = await getCommandCenterData()
  return json(data)
}
