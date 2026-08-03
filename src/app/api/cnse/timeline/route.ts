import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { getCommunicationTimeline } from '@/lib/cnse'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/cnse/timeline?electionId=...&limit=...
export async function GET(req: NextRequest) {
  // Auth check — closes the endpoint authentication gap (audit finding)
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth) return errorJson('Unauthorized', 401)
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  const { searchParams } = new URL(req.url)
  const electionId = searchParams.get('electionId') || undefined
  const limit = parseInt(searchParams.get('limit') || '100')

  const timeline = await getCommunicationTimeline({
    organizationId: org.id,
    electionId,
    limit,
  })

  return json({ timeline })
}
