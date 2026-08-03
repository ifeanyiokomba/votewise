import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { getCurrentOfficial } from '@/lib/guards'

export const dynamic = 'force-dynamic'

// GET /api/workspace/elections/[id]/timeline — election event timeline.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Auth check — closes the endpoint authentication gap (audit finding)
  const official = await getCurrentOfficial(req)
  if (!official) return errorJson('Unauthorized', 401)
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult
  const { id } = await params

  // Verify election belongs to this org
  const election = await db.electionSession.findUnique({ where: { id }, select: { organizationId: true } })
  if (!election || election.organizationId !== org.id)
    return errorJson('Election not found', 404)

  const events = await db.electionEvent.findMany({
    where: { electionId: id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  return json({ events })
}
