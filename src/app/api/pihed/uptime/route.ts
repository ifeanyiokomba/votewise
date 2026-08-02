import { NextRequest } from 'next/server'
import { json } from '@/lib/election'
import { getUptimeHistory, getUptimeSummary } from '@/lib/pihed'

export const dynamic = 'force-dynamic'

// GET /api/pihed/uptime — Public uptime history (90-day bar chart data)
// Query: ?days=90  |  ?summary=true
// No auth — this drives the public /status page uptime bars.
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const days = Math.min(365, Math.max(7, Number(url.searchParams.get('days')) || 90))
  const summaryOnly = url.searchParams.get('summary') === 'true'

  if (summaryOnly) {
    const summary = await getUptimeSummary()
    return json({ summary })
  }

  const history = await getUptimeHistory(days)
  const summary = await getUptimeSummary()
  return json({ history, summary, days })
}
