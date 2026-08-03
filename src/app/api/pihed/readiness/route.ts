import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { runReadinessCheck } from '@/lib/pihed'
import { getCurrentOfficial } from '@/lib/guards'

export const dynamic = 'force-dynamic'

// GET /api/pihed/readiness — Election Readiness Checker (pre-flight checklist)
// Checks: DB, Redis, Queue, Email, SMS, WhatsApp, Storage, SSL, Backups,
// Monitoring, Incidents, Secrets. Blocks Go Live if critical checks fail.
export async function GET(req: NextRequest) {
  // Auth check — closes the endpoint authentication gap (audit finding)
  const official = await getCurrentOfficial(req)
  if (!official) return errorJson('Unauthorized', 401)
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error

  const result = await runReadinessCheck()
  return json(result)
}
