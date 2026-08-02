import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import { listTestSuites, getTestStats, ensureTestSuitesSeeded } from '@/lib/tqasgr/test-runner'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth || (auth.role !== 'SUPER_ADMIN' && auth.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }
  await ensureTestSuitesSeeded().catch(() => {})
  const url = new URL(req.url)
  const type = url.searchParams.get('type') || undefined
  const mod = url.searchParams.get('module') || undefined
  const [suites, stats] = await Promise.all([listTestSuites(type, mod), getTestStats()])
  return json({ suites, stats })
}
