import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import { listComplianceFrameworks, getComplianceStats, ensureComplianceSeeded } from '@/lib/tqasgr'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth || (auth.role !== 'SUPER_ADMIN' && auth.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }
  await ensureComplianceSeeded().catch(() => {})
  const [frameworks, stats] = await Promise.all([listComplianceFrameworks(), getComplianceStats()])
  return json({ frameworks, stats })
}
