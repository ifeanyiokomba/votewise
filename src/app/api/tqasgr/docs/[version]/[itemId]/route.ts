import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import { verifyDocValidation } from '@/lib/tqasgr/release-mgmt'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ version: string; itemId: string }> }) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth || (auth.role !== 'SUPER_ADMIN' && auth.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }
  const { itemId } = await params
  const body = await req.json().catch(() => ({}))
  const item = await verifyDocValidation(itemId, auth.email, body.docUrl, body.notes)
  return json({ item, message: 'Doc validation verified' })
}
