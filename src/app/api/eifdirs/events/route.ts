import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { getEventStream } from '@/lib/eifdirs'

export const dynamic = 'force-dynamic'

// GET /api/eifdirs/events?electionId=...&category=...&severity=...&detected=...&limit=...&offset=...
export async function GET(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  const { searchParams } = new URL(req.url)
  const electionId = searchParams.get('electionId') || undefined
  const category = searchParams.get('category') || undefined
  const severity = searchParams.get('severity') || undefined
  const detected = searchParams.get('detected')
  const limit = parseInt(searchParams.get('limit') || '100')
  const offset = parseInt(searchParams.get('offset') || '0')

  const result = await getEventStream({
    organizationId: org.id,
    electionId,
    category,
    severity,
    detected: detected !== null ? detected === 'true' : undefined,
    limit,
    offset,
  })

  return json(result)
}
