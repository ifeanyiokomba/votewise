import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import { verifyGoLiveItem } from '@/lib/tqasgr'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth) return errorJson('Unauthorized', 401)
  const { itemId } = await params
  const body = await req.json().catch(() => ({}))
  if (!body.verified) return errorJson('verified field required', 400)
  const item = await verifyGoLiveItem(itemId, auth.email, body.notes)
  return json({ item, message: 'Go-live item verified' })
}
