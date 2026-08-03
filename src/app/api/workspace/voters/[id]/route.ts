import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/workspace/voters/[id] — full voter profile with timeline.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Auth check — closes the endpoint authentication gap (audit finding)
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth) return errorJson('Unauthorized', 401)
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult
  const { id } = await params

  const voter = await db.voter.findUnique({
    where: { id },
    select: {
      id: true, organizationId: true, firstName: true, lastName: true, email: true,
      phone: true, status: true, verificationStatus: true, metadata: true,
      hasVoted: true, votedAt: true, flagged: true, flaggedReason: true,
      createdAt: true, updatedAt: true, matric: true, fullName: true,
    },
  })

  if (!voter || voter.organizationId !== org.id)
    return errorJson('Voter not found', 404)

  // Fetch voter timeline events
  const timeline = await db.voterTimelineEvent.findMany({
    where: { voterId: id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  // Fetch voter groups this voter belongs to
  const groups = await db.voterGroup.findMany({
    where: { organizationId: org.id },
    select: { id: true, name: true, slug: true, code: true, isDynamic: true },
  })

  return json({ voter, timeline, groups })
}
