import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import { errorResponse } from '@/lib/errors'
import { ElectionStateMachine } from '@/lib/election-state-machine'
import { emitEvent } from '@/lib/event-bus'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth) return errorResponse('UNAUTHORIZED')

  const { id } = await params
  const election = await db.electionSession.findUnique({ where: { id } })
  if (!election) return errorResponse('ELECTION_NOT_FOUND')

  try {
    ElectionStateMachine.validateTransition(election.status as any, 'READY')
  } catch (e: any) {
    return errorResponse('INVALID_STATE_TRANSITION', e.message, e.details)
  }

  await db.electionSession.update({ where: { id }, data: { status: 'READY' } })
  await emitEvent('ELECTION_STATE_CHANGED', { electionId: id, organizationId: election.organizationId || undefined, actorId: auth.sub, data: { from: election.status, to: 'READY' } })

  return Response.json({ success: true, data: { id, status: 'READY', message: 'Election published and ready for go-live' } })
}
