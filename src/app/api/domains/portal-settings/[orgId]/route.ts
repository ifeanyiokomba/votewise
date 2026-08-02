import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import { getPortalSettings, updatePortalSettings } from '@/lib/domains/portal-customization'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params
  const settings = await getPortalSettings(orgId)
  return json({ settings })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth) return errorJson('Unauthorized', 401)
  const { orgId } = await params
  const body = await req.json().catch(() => ({}))
  const settings = await updatePortalSettings(orgId, body)
  return json({ settings, message: 'Portal settings updated' })
}
