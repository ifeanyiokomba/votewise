import { NextRequest } from 'next/server'
import { json } from '@/lib/election'
import { getPlatformStatus } from '@/lib/pihed'

export const dynamic = 'force-dynamic'

// GET /api/pihed/status — Public platform status page data
// No auth required — anyone can see platform health.
export async function GET() {
  try {
    const status = await getPlatformStatus()
    return json(status)
  } catch (e: any) {
    return json({ status: 'UNKNOWN', error: e.message, lastUpdated: new Date().toISOString() }, 503)
  }
}
