import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { initiatePayment } from '@/lib/bspcm'
import { verifyAccessToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// POST /api/bspcm/payments/initiate — Initiate a payment
// Body: { invoiceId, gateway }
export async function POST(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error

  const body = await req.json().catch(() => ({}))
  if (!body.invoiceId || !body.gateway) {
    return errorJson('invoiceId and gateway are required', 400)
  }

  const auth = verifyAccessToken(req)
  const email = auth?.email || 'billing@votewise.com.ng'
  const name = auth?.email || orgResult.name

  try {
    const result = await initiatePayment({
      invoiceId: body.invoiceId,
      organizationId: orgResult.id,
      gateway: body.gateway,
      email,
      name,
    })
    return json(result)
  } catch (e: any) {
    return errorJson(e.message || 'Failed to initiate payment', 500)
  }
}
