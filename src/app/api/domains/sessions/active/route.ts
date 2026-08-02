import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import { listActiveLoginSessions, getSessionStats } from '@/lib/domains/session-manager'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth) return errorJson('Unauthorized', 401)
  const url = new URL(req.url)
  const org = url.searchParams.get('org') || undefined
  const [sessions, stats] = await Promise.all([listActiveLoginSessions(org), getSessionStats(org)])
  return json({ sessions, stats })
}
