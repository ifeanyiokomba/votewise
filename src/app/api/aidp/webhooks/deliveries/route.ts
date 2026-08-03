import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { getWebhookDeliveries } from '@/lib/aidp'
import { getCurrentOfficial } from '@/lib/guards'

export const dynamic = 'force-dynamic'

// GET /api/aidp/webhooks/deliveries?webhookId=...&limit=...
export async function GET(req: NextRequest) {
  // Auth check — closes the endpoint authentication gap (audit finding)
  const official = await getCurrentOfficial(req)
  if (!official) return errorJson('Unauthorized', 401)
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error

  const { searchParams } = new URL(req.url)
  const webhookId = searchParams.get('webhookId') || undefined
  const limit = parseInt(searchParams.get('limit') || '50')

  const deliveries = await getWebhookDeliveries(orgResult.id, webhookId, limit)
  return json({ deliveries })
}
