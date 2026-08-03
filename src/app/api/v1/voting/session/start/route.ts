import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import { errorResponse } from '@/lib/errors'
import { schemas, validate } from '@/lib/validation'
import { emitEvent } from '@/lib/event-bus'

export const dynamic = 'force-dynamic'

// POST /api/v1/voting/session/start — start a voter voting session
// Body: { electionId, matricNumber }
// Validates: election is LIVE, voter is eligible, creates a VotingSession
export async function POST(req: NextRequest) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth) return errorResponse('UNAUTHORIZED')

  const raw = await req.json().catch(() => ({}))
  if (!raw.electionId || !raw.matricNumber) {
    return errorResponse('VALIDATION_ERROR', 'electionId and matricNumber are required')
  }

  const { electionId, matricNumber } = raw

  // Check election exists and is LIVE
  const election = await db.electionSession.findUnique({ where: { id: electionId } })
  if (!election) return errorResponse('ELECTION_NOT_FOUND')
  if (election.status !== 'LIVE' && election.status !== 'VOTING') {
    return errorResponse('VOTE_ELECTION_NOT_LIVE')
  }

  // Check voter exists + is eligible
  const voter = await db.voter.findFirst({
    where: { matricNumber, electionId },
    select: { id: true, verified: true, hasVoted: true },
  }).catch(() => null)

  if (!voter) return errorResponse('VOTE_NOT_ELIGIBLE', 'Voter not found in the register')
  if (voter.hasVoted) return errorResponse('VOTE_ALREADY_CAST')

  // Create voting session
  const session = await db.votingSession.create({
    data: {
      organizationId: election.organizationId || '',
      electionId,
      voterId: voter.id,
      sessionToken: Math.random().toString(36).slice(2) + Date.now().toString(36),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min
    },
  }).catch(() => null)

  await emitEvent('VOTER_VOTING_STARTED', { electionId, voterId: voter.id, organizationId: election.organizationId || undefined })

  return Response.json({
    success: true,
    data: {
      sessionId: session?.id,
      sessionToken: session?.sessionToken,
      expiresAt: session?.expiresAt,
      message: 'Voting session started. Complete the OTVP verification to access the ballot.',
    },
  })
}
