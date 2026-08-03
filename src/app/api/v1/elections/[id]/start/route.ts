import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import { errorResponse } from '@/lib/errors'
import { ElectionStateMachine } from '@/lib/election-state-machine'
import { emitEvent } from '@/lib/event-bus'
import { runReadinessCheck } from '@/lib/pihed'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth) return errorResponse('UNAUTHORIZED')

  const { id } = await params
  const election = await db.electionSession.findUnique({ where: { id } })
  if (!election) return errorResponse('ELECTION_NOT_FOUND')

  // Validate state transition
  try {
    ElectionStateMachine.validateTransition(election.status as any, 'LIVE')
  } catch (e: any) {
    return errorResponse('INVALID_STATE_TRANSITION', e.message, e.details)
  }

  // Readiness gate — spec: "blocks Go Live if any critical check fails"
  const voterCount = await db.voter.count({ where: { electionId: id } }).catch(() => 0)
  const readiness = await runReadinessCheck(voterCount)
  if (!readiness.ready) {
    return errorResponse('READINESS_FAILED', undefined, {
      criticalFailures: readiness.criticalFailures,
      failedChecks: readiness.checks.filter((c) => c.critical && c.status === 'UNHEALTHY').map((c) => c.name),
    })
  }

  await db.electionSession.update({ where: { id }, data: { status: 'LIVE' } })
  await emitEvent('ELECTION_GO_LIVE', { electionId: id, organizationId: election.organizationId || undefined, actorId: auth.sub, data: { voterCount } })

  return Response.json({ success: true, data: { id, status: 'LIVE', message: 'Election is now LIVE. Voters can cast their ballots.' } })
}
