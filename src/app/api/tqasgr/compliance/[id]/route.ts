import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import { updateComplianceFramework } from '@/lib/tqasgr'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth || (auth.role !== 'SUPER_ADMIN' && auth.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const fw = await updateComplianceFramework(id, body)
  return json({ framework: fw, message: 'Compliance framework updated' })
}
