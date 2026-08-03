import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { runReadinessCheck } from '@/lib/pihed'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/pihed/readiness — Election Readiness Checker (pre-flight checklist)
// Checks: DB, Redis, Queue, Email, SMS, WhatsApp, Storage, SSL, Backups,
// Monitoring, Incidents, Secrets. Blocks Go Live if critical checks fail.
export async function GET(req: NextRequest) {
  // Auth check — closes the endpoint authentication gap (audit finding)
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth) return errorJson('Unauthorized', 401)
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error

  const result = await runReadinessCheck()
  return json(result)
}
