import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import { listReadinessRuns } from '@/lib/pihed'

export const dynamic = 'force-dynamic'

// GET /api/pihed/readiness/runs — Recent pre-flight readiness runs (audit trail)
// Query: ?limit=20  (max 50)
// Platform admin only.
export async function GET(req: NextRequest) {
  const auth = await verifyAccessToken(readAccessToken(req))
  if (!auth || (auth.role !== 'SUPER_ADMIN' && auth.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }

  const url = new URL(req.url)
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit')) || 20))

  const runs = await listReadinessRuns(limit)
  return json({
    runs: runs.map((r) => ({
      id: r.id,
      organizationId: r.organizationId,
      electionId: r.electionId,
      expectedVoters: r.expectedVoters,
      ready: r.ready,
      criticalFailures: r.criticalFailures,
      warnings: r.warnings,
      triggeredByName: r.triggeredByName,
      notes: r.notes,
      createdAt: r.createdAt.toISOString(),
    })),
  })
}
