import { NextRequest } from 'next/server'
import { json } from '@/lib/election'
import { SCOPES, WEBHOOK_EVENTS } from '@/lib/aidp/types'

export const dynamic = 'force-dynamic'

// GET /api/aidp/scopes — List available scopes + webhook events (public)
export async function GET() {
  return json({
    scopes: SCOPES,
    webhookEvents: WEBHOOK_EVENTS,
  })
}
