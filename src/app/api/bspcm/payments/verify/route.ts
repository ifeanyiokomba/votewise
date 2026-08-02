import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyPayment } from '@/lib/bspcm'

export const dynamic = 'force-dynamic'

// POST /api/bspcm/payments/verify — Verify a payment (webhook or manual)
// Body: { reference, gateway }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  if (!body.reference || !body.gateway) {
    return errorJson('reference and gateway are required', 400)
  }

  try {
    const result = await verifyPayment(body.reference, body.gateway)
    return json(result)
  } catch (e: any) {
    return errorJson(e.message || 'Failed to verify payment', 500)
  }
}
