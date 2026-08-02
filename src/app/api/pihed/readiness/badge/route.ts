import { NextRequest } from 'next/server'
import { json } from '@/lib/election'
import { runReadinessCheck } from '@/lib/pihed'

export const dynamic = 'force-dynamic'

// GET /api/pihed/readiness/badge — Public readiness badge data
// Query: ?voters=50000  →  run capacity check for 50k expected voters
//
// Returns a lightweight JSON summary suitable for embedding on an org's
// election page as a "Platform Readiness: ✓ Ready" badge. No auth — this
// is public confidence-building data.
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const expectedVoters = Math.max(0, Number(url.searchParams.get('voters')) || 0)

  // Run a lightweight readiness check (no persistence — this is a public poll)
  const result = await runReadinessCheck(expectedVoters)

  return json({
    ready: result.ready,
    criticalFailures: result.criticalFailures,
    warnings: result.warnings,
    checks: result.checks.map((c) => ({
      name: c.name,
      status: c.status,
      critical: c.critical,
    })),
    capacity: {
      sufficient: result.capacity.sufficient,
      safeConcurrency: result.capacity.safeConcurrency,
      replicas: result.capacity.replicas,
    },
    timestamp: result.timestamp,
  })
}
