import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import { errorResponse } from '@/lib/errors'
import { ElectionStateMachine } from '@/lib/election-state-machine'
import { emitEvent } from '@/lib/event-bus'

export const dynamic = 'force-dynamic'

// GET /api/v1/elections/:id
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth) return errorResponse('UNAUTHORIZED')

  const { id } = await params
  const election = await db.electionSession.findUnique({
    where: { id },
    select: {
      id: true, name: true, status: true, startTime: true, endTime: true,
      organizationId: true, description: true, category: true,
      electionType: true, visibility: true, settings: true,
    },
  })
  if (!election) return errorResponse('ELECTION_NOT_FOUND')

  return Response.json({
    success: true,
    data: {
      ...election,
      stateInfo: {
        current: election.status,
        label: ElectionStateMachine.getLabel(election.status as any),
        color: ElectionStateMachine.getColor(election.status as any),
        nextStates: ElectionStateMachine.getNextStates(election.status as any),
        canAcceptVotes: ElectionStateMachine.canAcceptVotes(election.status as any),
        isMutable: ElectionStateMachine.isMutable(election.status as any),
      },
    },
  })
}

// PATCH /api/v1/elections/:id — update (with state machine validation)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth) return errorResponse('UNAUTHORIZED')

  const { id } = await params
  const body = await req.json().catch(() => ({}))

  const election = await db.electionSession.findUnique({ where: { id } })
  if (!election) return errorResponse('ELECTION_NOT_FOUND')

  // If status is changing, validate the state transition
  if (body.status && body.status !== election.status) {
    try {
      ElectionStateMachine.validateTransition(election.status as any, body.status as any)
    } catch (e: any) {
      return errorResponse('INVALID_STATE_TRANSITION', e.message, e.details)
    }

    // Emit state change event
    await emitEvent('ELECTION_STATE_CHANGED', {
      electionId: id,
      organizationId: election.organizationId || undefined,
      actorId: auth.sub,
      actorName: auth.email,
      data: { from: election.status, to: body.status },
    })
  }

  const updated = await db.electionSession.update({
    where: { id },
    data: {
      ...(body.name && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.status && { status: body.status }),
      ...(body.startTime && { startTime: new Date(body.startTime) }),
      ...(body.endTime && { endTime: new Date(body.endTime) }),
      ...(body.settings && { settings: JSON.stringify(body.settings) }),
    },
  })

  return Response.json({ success: true, data: updated })
}
