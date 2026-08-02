import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import { listUatSessions, createUatSession, getUatStats } from '@/lib/tqasgr/release-mgmt'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth || (auth.role !== 'SUPER_ADMIN' && auth.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }
  const url = new URL(req.url)
  const version = url.searchParams.get('version') || undefined
  const status = url.searchParams.get('status') || undefined
  const [sessions, stats] = await Promise.all([listUatSessions(version, status), getUatStats(version)])
  return json({ sessions, stats })
}

export async function POST(req: NextRequest) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth || (auth.role !== 'SUPER_ADMIN' && auth.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }
  const body = await req.json().catch(() => ({}))
  if (!body.releaseVersion || !body.participantName || !body.scenario) {
    return errorJson('releaseVersion, participantName, scenario required', 400)
  }
  const session = await createUatSession(body)
  return json({ session, message: 'UAT session created' })
}
