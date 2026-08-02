import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { initiatePayment, getPaymentHistory, getAvailableGateways } from '@/lib/bspcm'

export const dynamic = 'force-dynamic'

// GET /api/bspcm/payments — Payment history + available gateways
export async function GET(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error

  const [history, gateways] = await Promise.all([
    getPaymentHistory(orgResult.id),
    getAvailableGateways(),
  ])

  return json({ payments: history, gateways })
}
