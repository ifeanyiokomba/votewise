import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { listIncidents, getIncidentStats } from '@/lib/eifdirs'
import { getCurrentOfficial } from '@/lib/guards'

export const dynamic = 'force-dynamic'

// GET /api/eifdirs/incidents?electionId=...&status=...&severity=...&category=...
export async function GET(req: NextRequest) {
  // Auth check — closes the endpoint authentication gap (audit finding)
  const official = await getCurrentOfficial(req)
  if (!official) return errorJson('Unauthorized', 401)
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  const { searchParams } = new URL(req.url)
  const electionId = searchParams.get('electionId') || undefined
  const status = searchParams.get('status') || undefined
  const severity = searchParams.get('severity') || undefined
  const category = searchParams.get('category') || undefined
  const limit = parseInt(searchParams.get('limit') || '50')
  const offset = parseInt(searchParams.get('offset') || '0')

  const [result, stats] = await Promise.all([
    listIncidents({ organizationId: org.id, electionId, status, severity, category, limit, offset }),
    getIncidentStats({ organizationId: org.id }),
  ])

  return json({ ...result, stats })
}
