import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { createWebhook, listWebhooks, getWebhookDeliveries } from '@/lib/aidp'

export const dynamic = 'force-dynamic'

// GET /api/aidp/webhooks — List webhooks (+ optional deliveries)
export async function GET(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error

  const webhookId = new URL(req.url).searchParams.get('webhookId') || undefined
  const withDeliveries = new URL(req.url).searchParams.get('deliveries') === 'true'

  const [webhooks, deliveries] = await Promise.all([
    listWebhooks(orgResult.id),
    withDeliveries ? getWebhookDeliveries(orgResult.id, webhookId || undefined) : Promise.resolve([]),
  ])

  return json({ webhooks, deliveries })
}

// POST /api/aidp/webhooks — Create webhook
export async function POST(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error

  const body = await req.json().catch(() => ({}))
  if (!body.url || !body.name || !body.events) {
    return errorJson('url, name, and events are required', 400)
  }

  const webhook = await createWebhook(orgResult.id, {
    url: body.url,
    name: body.name,
    events: body.events,
  })

  return json({ ok: true, webhook })
}
