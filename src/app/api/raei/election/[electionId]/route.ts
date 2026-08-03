import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { getElectionDashboard } from '@/lib/raei'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/raei/election/[electionId] — Election-level real-time dashboard
export async function GET(req: NextRequest, { params }: { params: Promise<{ electionId: string }> }) {
  // Auth check — closes the endpoint authentication gap (audit finding)
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth) return errorJson('Unauthorized', 401)
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error

  const { electionId } = await params
  const dashboard = await getElectionDashboard(electionId)
  if (!dashboard) return errorJson('Election not found', 404)

  return json(dashboard)
}
