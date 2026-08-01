import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson, writeAudit, getClientIp } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { sha256, hmacSign, randomToken, encryptVote } from '@/lib/crypto'
import { createHash } from 'crypto'

export const dynamic = 'force-dynamic'

// POST /api/workspace/ballot/submit — Cast a vote (atomic transaction).
// Body: { ballotId, selections: { positionId: candidateId } }
// This is the most critical endpoint in VoteWise. Every step is inside a
// database transaction. If ANY step fails, everything rolls back.
export async function POST(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  const body = await req.json().catch(() => ({}))
  const { ballotId, selections } = body
  if (!ballotId || !selections) return errorJson('ballotId and selections are required', 400)

  // Load ballot
  const ballot = await db.ballot.findUnique({ where: { id: ballotId } })
  if (!ballot || ballot.organizationId !== org.id)
    return errorJson('Ballot not found', 404)
  if (ballot.status === 'SUBMITTED')
    return errorJson('This ballot has already been submitted', 409)
  if (ballot.expiresAt < new Date())
    return errorJson('Ballot has expired', 410)

  const electionId = ballot.electionId!
  const voterId = ballot.voterId
  const isSimulation = ballot.isSimulation

  // Idempotency: check if any votes already exist for this ballot
  const existing = await db.voteRecord.findFirst({ where: { ballotId } })
  if (existing) return errorJson('Vote already recorded for this ballot', 409)

  // ATOMIC TRANSACTION — everything below is all-or-nothing
  try {
    const result = await db.$transaction(async (tx) => {
      // 1. Validate election is still live (skip for simulation)
      if (!isSimulation) {
        const election = await tx.electionSession.findUnique({ where: { id: electionId } })
        if (!election) throw new Error('Election not found')
        const now = new Date()
        if (now < election.startTime) throw new Error('Voting has not opened yet')
        if (now >= election.endTime) throw new Error('Voting has closed')
      }

      // 2. Validate voter hasn't already voted (skip for simulation)
      if (voterId && !isSimulation) {
        const voter = await tx.voter.findUnique({ where: { id: voterId } })
        if (!voter) throw new Error('Voter not found')
        if (voter.hasVoted) throw new Error('Voter has already voted')
        if (voter.flagged) throw new Error('Voter is flagged — cannot vote')
      }

      // 3. Generate voter hash (anonymous)
      const voterHash = voterId
        ? sha256(`${voterId}:votewise-pepper-v2`)
        : sha256(`sim-${Date.now()}`)

      // 4. Process each selection
      const receipts: string[] = []
      for (const [positionId, candidateId] of Object.entries(selections)) {
        // Validate position + candidate exist
        const position = await tx.position.findUnique({ where: { id: positionId } })
        if (!position) throw new Error(`Position ${positionId} not found`)

        if (candidateId && candidateId !== 'NOTA') {
          const candidate = await tx.candidate.findUnique({ where: { id: String(candidateId) } })
          if (!candidate) throw new Error(`Candidate ${candidateId} not found`)
        }

        // Encrypt the choice
        const choiceData = JSON.stringify({ candidateId, isNota: candidateId === 'NOTA', timestamp: Date.now() })
        const encrypted = encryptVote({ candidateId: String(candidateId), isNota: candidateId === 'NOTA' })

        // Generate receipt code
        const receiptCode = `VW-${new Date().getFullYear()}-${randomToken(8).toUpperCase()}`
        // Idempotency key
        const idempotencyKey = createHash('sha256').update(`${voterId || 'sim'}|${electionId}|${positionId}`).digest('hex')

        // Store vote record
        await tx.voteRecord.create({
          data: {
            organizationId: org.id,
            electionId,
            positionId,
            candidateId: candidateId === 'NOTA' ? null : String(candidateId),
            voterHash,
            encryptedChoice: encrypted.ciphertext,
            iv: encrypted.iv,
            keyId: encrypted.keyId,
            receiptCode,
            idempotencyKey,
            ballotId,
            ipAddress: getClientIp(req),
            isSimulation,
          },
        })
        receipts.push(receiptCode)
      }

      // 5. Mark voter as voted (skip for simulation)
      if (voterId && !isSimulation) {
        await tx.voter.update({
          where: { id: voterId },
          data: { hasVoted: true, votedAt: new Date() },
        })
      }

      // 6. Mark ballot as submitted
      await tx.ballot.update({
        where: { id: ballotId },
        data: { status: 'SUBMITTED' },
      })

      // 7. Create audit entry
      await tx.auditLog.create({
        data: {
          electionId,
          organizationId: org.id,
          actorId: voterId || 'sim-voter',
          actorRole: 'VOTER',
          actorName: 'Voter',
          action: isSimulation ? 'SIMULATION_VOTE_CAST' : 'VOTE_CAST',
          details: JSON.stringify({ ballotId, positions: Object.keys(selections).length, receipts }),
          ip: getClientIp(req),
        },
      })

      // 8. Create election event
      await tx.electionEvent.create({
        data: {
          electionId,
          organizationId: org.id,
          eventType: isSimulation ? 'SIMULATION_VOTE_CAST' : 'VOTE_CAST',
          description: `${Object.keys(selections).length} votes cast`,
        },
      })

      return { receipts }
    })

    return json({
      ok: true,
      message: isSimulation ? 'Simulation vote recorded successfully!' : 'Vote successfully recorded!',
      receipts: result.receipts,
      isSimulation,
    })
  } catch (e: any) {
    // Transaction failed — everything rolled back
    return errorJson(e.message || 'Vote recording failed — transaction rolled back', 500)
  }
}
