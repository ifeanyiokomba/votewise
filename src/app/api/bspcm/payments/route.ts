import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { initiatePayment, getPaymentHistory, getAvailableGateways } from '@/lib/bspcm'
import { getCurrentOfficial } from '@/lib/guards'

export const dynamic = 'force-dynamic'

// GET /api/bspcm/payments — Payment history + available gateways
export async function GET(req: NextRequest) {
  // Auth check — closes the endpoint authentication gap (audit finding)
  const official = await getCurrentOfficial(req)
  if (!official) return errorJson('Unauthorized', 401)
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error

  const [history, gateways] = await Promise.all([
    getPaymentHistory(orgResult.id),
    getAvailableGateways(),
  ])

  return json({ payments: history, gateways })
}
