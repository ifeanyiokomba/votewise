import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import { queryLogs, getLogStats } from '@/lib/infra/logger'

export const dynamic = 'force-dynamic'

// GET /api/pihed/logs — Centralized log viewer (searchable)
// Query: ?category=&level=&service=&search=&since=&limit=
// Platform admin only.
export async function GET(req: NextRequest) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth || (auth.role !== 'SUPER_ADMIN' && auth.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }

  const url = new URL(req.url)
  const category = url.searchParams.get('category') || undefined
  const level = url.searchParams.get('level') || undefined
  const service = url.searchParams.get('service') || undefined
  const search = url.searchParams.get('search') || undefined
  const since = url.searchParams.get('since') ? new Date(url.searchParams.get('since')!) : undefined
  const limit = Math.min(500, Number(url.searchParams.get('limit')) || 100)

  const [logs, stats] = await Promise.all([
    queryLogs({ category: category as any, level: level as any, service: service as any, search, since, limit }),
    getLogStats(),
  ])

  return json({ logs, stats })
}
