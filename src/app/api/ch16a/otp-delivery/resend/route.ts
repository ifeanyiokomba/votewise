import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import { resendOtp } from '@/lib/ch16a/otp-delivery'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth) return errorJson('Unauthorized', 401)
  const body = await req.json().catch(() => ({}))
  if (!body.voterId || !body.organizationId) return errorJson('voterId and organizationId required', 400)
  try {
    const result = await resendOtp({
      ...body,
      triggeredBy: auth.sub,
      triggeredByName: auth.email,
    })
    return json({ ...result, message: 'OTVP resend initiated' })
  } catch (e: any) {
    return errorJson(e.message || 'Failed to resend OTVP', 400)
  }
}
