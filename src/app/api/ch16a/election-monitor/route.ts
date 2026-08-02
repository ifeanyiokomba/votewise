import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import { getElectionMonitor } from '@/lib/ch16a/voter-activity'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth) return errorJson('Unauthorized', 401)
  const url = new URL(req.url)
  const org = url.searchParams.get('org')
  const election = url.searchParams.get('election') || undefined
  if (!org) return errorJson('org query param required', 400)
  const monitor = await getElectionMonitor(org, election)
  return json(monitor)
}
