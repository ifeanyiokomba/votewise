import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/workspace/ballot/demo-voters?electionId=...
// Lists voters eligible for an election (for the demo voter picker).
// In production, voters authenticate via their own credentials — this endpoint
// is for demo/testing convenience.
export async function GET(req: NextRequest) {
  // Auth check — closes the endpoint authentication gap (audit finding)
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth) return errorJson('Unauthorized', 401)
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  const electionId = new URL(req.url).searchParams.get('electionId')
  if (!electionId) return errorJson('electionId is required', 400)

  const voters = await db.voter.findMany({
    where: {
      OR: [{ electionSessionId: electionId }, { organizationId: org.id }],
      status: { not: 'SUSPENDED' },
      flagged: { not: true },
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      matric: true,
      hasVoted: true,
      status: true,
    },
    orderBy: { fullName: 'asc' },
    take: 100,
  })

  return json({
    voters: voters.map((v) => ({
      id: v.id,
      name: v.fullName,
      email: v.email,
      matric: v.matric,
      hasVoted: v.hasVoted,
      status: v.status,
    })),
  })
}
