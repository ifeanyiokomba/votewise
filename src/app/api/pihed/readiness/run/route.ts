import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import { runReadinessCheck, recordReadinessRun } from '@/lib/pihed'

export const dynamic = 'force-dynamic'

// POST /api/pihed/readiness/run
// Run the full pre-flight readiness check and persist the result to the
// audit trail. Platform admin only (the readiness checker is an operational
// tool, not something voters or org admins invoke).
//
// Body: { expectedVoters?: number, organizationId?: string, electionId?: string, notes?: string }
export async function POST(req: NextRequest) {
  const auth = await verifyAccessToken(readAccessToken(req))
  if (!auth || (auth.role !== 'SUPER_ADMIN' && auth.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }

  let body: any = {}
  try {
    body = await req.json()
  } catch {
    /* empty body is fine */
  }

  const expectedVoters = Math.max(0, Number(body.expectedVoters) || 0)
  const result = await runReadinessCheck(expectedVoters)

  const record = await recordReadinessRun(result, {
    organizationId: body.organizationId,
    electionId: body.electionId,
    expectedVoters,
    triggeredBy: auth.sub,
    triggeredByName: auth.email,
    notes: body.notes,
  })

  return json({ ...result, runId: record.id })
}
