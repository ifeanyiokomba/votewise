import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import { getLiveMetrics, getMetricSeries, captureSystemMetrics } from '@/lib/pihed'

export const dynamic = 'force-dynamic'

// GET /api/pihed/metrics — Live system metrics + historical sparkline series
// Query: ?series=memory&limit=30  →  returns { live, series: { memory: [...] } }
// Platform admin only.
export async function GET(req: NextRequest) {
  const auth = await verifyAccessToken(readAccessToken(req))
  if (!auth || (auth.role !== 'SUPER_ADMIN' && auth.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }

  const url = new URL(req.url)
  const seriesKey = url.searchParams.get('series') // comma-separated
  const limit = Math.min(120, Number(url.searchParams.get('limit')) || 30)

  // Capture a fresh snapshot on every read so the dashboard always shows
  // current data (in production this would be a no-op scrape).
  await captureSystemMetrics().catch(() => {})

  const live = await getLiveMetrics()

  let series: Record<string, Array<{ value: number; createdAt: string }>> = {}
  if (seriesKey) {
    const keys = seriesKey.split(',').map((s) => s.trim()).filter(Boolean)
    const entries = await Promise.all(
      keys.map(async (k) => {
        const rows = await getMetricSeries(k, limit)
        return [k, rows.map((r) => ({ value: r.value, createdAt: r.createdAt.toISOString() }))] as const
      }),
    )
    series = Object.fromEntries(entries)
  }

  return json({ live, series, capturedAt: new Date().toISOString() })
}
