import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { getElectionDashboard } from '@/lib/raei'

export const dynamic = 'force-dynamic'

// GET /api/raei/election/[electionId] — Election-level real-time dashboard
export async function GET(req: NextRequest, { params }: { params: Promise<{ electionId: string }> }) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error

  const { electionId } = await params
  const dashboard = await getElectionDashboard(electionId)
  if (!dashboard) return errorJson('Election not found', 404)

  return json(dashboard)
}
