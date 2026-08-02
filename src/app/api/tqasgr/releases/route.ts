import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import { listReleaseTracks, createReleaseTrack, getReleaseStats, ensureReleaseTracksSeeded } from '@/lib/tqasgr/release-mgmt'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth || (auth.role !== 'SUPER_ADMIN' && auth.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }
  await ensureReleaseTracksSeeded().catch(() => {})
  const url = new URL(req.url)
  const phase = url.searchParams.get('phase') || undefined
  const [releases, stats] = await Promise.all([listReleaseTracks(phase), getReleaseStats()])
  return json({ releases, stats })
}

export async function POST(req: NextRequest) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth || (auth.role !== 'SUPER_ADMIN' && auth.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }
  const body = await req.json().catch(() => ({}))
  if (!body.version) return errorJson('version required', 400)
  const release = await createReleaseTrack({ ...body, createdBy: auth.sub, createdByName: auth.email })
  return json({ release, message: `Release track created: ${body.version}` })
}
