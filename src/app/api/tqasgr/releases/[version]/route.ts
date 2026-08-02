import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import { updateReleaseTrack } from '@/lib/tqasgr/release-mgmt'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ version: string }> }) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth || (auth.role !== 'SUPER_ADMIN' && auth.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }
  const { version } = await params
  const body = await req.json().catch(() => ({}))
  if (body.approved) {
    body.approvedBy = auth.email
    body.approvedAt = new Date()
  }
  const release = await updateReleaseTrack(version, body)
  return json({ release, message: 'Release track updated' })
}
