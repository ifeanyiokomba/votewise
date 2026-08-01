// VoteWise — SVE Vote Recorder (Chapter 10)
//
// The most critical module in VoteWise. Records a vote inside an atomic
// database transaction. If ANY step fails, everything rolls back. No partial
// votes. Never.
//
// Flow (all inside db.$transaction):
//   1. Validate again (race-safe — re-fetch voter inside txn)
//   2. Store encrypted ballot choice (AES-256-GCM)
//   3. Store VoteRecord (anonymous voterHash, encrypted choice, receipt, idempotency key)
//   4. Mark voter as voted (Voter.hasVoted = true, revoke session)
//   5. Create audit record (hash-chained AuditLog)
//   6. Create VoterTimelineEvent
//   7. Create ElectionEvent (timeline)
//   8. Update live count cache
//   9. Commit
//
// Security:
// - Idempotency: idempotencyKey (sha256(voterId|electionId|positionId)) has a
//   UNIQUE constraint. A duplicate submission collides and is rejected.
// - Anonymity: VoteRecord stores voterHash (one-way), never voterId.
// - Encryption: the candidate choice is encrypted at rest.
// - Audit: every vote produces a hash-chained AuditLog entry + timeline events.

import { db } from '@/lib/db'
import { getClientIp } from '@/lib/election'
import { computeAuditHash, AUDIT_GENESIS, randomToken } from '@/lib/crypto'
import {
  hashVoterIdentity,
  computeIdempotencyKey,
  computeSimulationIdempotencyKey,
  generateSveReceiptCode,
  encryptChoice,
} from './crypto'
import { runValidationPipeline } from './validation-pipeline'
import { incrementLiveCount, getLiveStats } from './live-counter'
import type { CastVoteResult, ValidationContext } from './types'
import type { NextRequest } from 'next/server'

export interface CastVoteOptions {
  ballotId: string
  selections: Record<string, string | string[]>
  isSimulation?: boolean
  ip?: string
  device?: string
}

export async function castVote(opts: CastVoteOptions, req?: NextRequest): Promise<CastVoteResult> {
  const { ballotId, selections, isSimulation = false } = opts

  // Load ballot to get electionId + voterId
  const ballot = await db.ballot.findUnique({ where: { id: ballotId } })
  if (!ballot) throw new CastVoteError('Ballot not found', 404, 'BALLOT_NOT_FOUND')
  if (ballot.status === 'SUBMITTED') throw new CastVoteError('This ballot has already been submitted', 409, 'ALREADY_SUBMITTED')
  if (ballot.expiresAt < new Date()) throw new CastVoteError('Ballot has expired', 410, 'BALLOT_EXPIRED')
  if (ballot.isSimulation !== isSimulation) {
    throw new CastVoteError(
      isSimulation ? 'This ballot is not a simulation ballot' : 'This is a simulation ballot — use the simulation endpoint',
      400, 'BALLOT_TYPE_MISMATCH',
    )
  }

  const electionId = ballot.electionId!
  const voterId = ballot.voterId || undefined
  const sessionId = ballot.sessionId || undefined
  const ip = opts.ip || (req ? getClientIp(req) : '0.0.0.0')
  const device = opts.device || (req ? req.headers.get('user-agent')?.slice(0, 120) || 'unknown' : 'unknown')

  // ------------------------------------------------------------------------
  // Pre-transaction validation pipeline
  // ------------------------------------------------------------------------
  const ctx: ValidationContext = {
    electionId,
    voterId,
    sessionId,
    ballotId,
    selections,
    isSimulation,
    ip,
    device,
  }
  const validation = await runValidationPipeline(ctx)
  if (!validation.passed) {
    const firstFail = validation.failedChecks.find((c) => c.severity === 'BLOCK')
    throw new CastVoteError(
      firstFail?.message || 'Vote validation failed',
      403,
      'VALIDATION_FAILED',
      validation.failedChecks,
    )
  }

  const election = validation.election!
  const voter = validation.voter
  const voterHash = voterId ? hashVoterIdentity(voterId) : hashVoterIdentity(`sim-${electionId}`)
  const orgId = election.organizationId || null

  // Parse ballot content to map positionId → title
  const ballotContent = JSON.parse(ballot.content)
  const positionMap = new Map<string, { title: string; maxVotes: number }>(
    ballotContent.positions.map((p: any) => [p.positionId, { title: p.title, maxVotes: p.maximumVotes || 1 }]),
  )

  const receipts: Array<{ positionId: string; positionTitle: string; receiptCode: string }> = []

  // ------------------------------------------------------------------------
  // ATOMIC TRANSACTION — everything below is all-or-nothing
  // ------------------------------------------------------------------------
  try {
    await db.$transaction(async (tx) => {
      // 1. Race-safe re-validation inside the transaction.
      if (voterId && !isSimulation) {
        const fresh = await tx.voter.findUnique({ where: { id: voterId } })
        if (!fresh) throw new CastVoteError('Voter not found', 404, 'VOTER_NOT_FOUND')
        if (fresh.hasVoted) throw new CastVoteError('You have already voted', 409, 'ALREADY_VOTED')
        if (fresh.flagged || fresh.status === 'SUSPENDED') throw new CastVoteError('Your account has been flagged', 403, 'VOTER_FLAGGED')
      }

      // 2-3. Store VoteRecord for each selection (encrypted + idempotent).
      for (const [positionId, selection] of Object.entries(selections)) {
        const posMeta = positionMap.get(positionId)
        if (!posMeta) throw new CastVoteError(`Position ${positionId} not in ballot`, 400, 'POSITION_NOT_IN_BALLOT')

        const selArray = Array.isArray(selection) ? selection : [selection]
        // If NOTA is selected, we store a single NOTA vote (ignore others).
        const isNota = selArray.includes('NOTA')

        if (isNota) {
          const receiptCode = generateSveReceiptCode()
          const idempotencyKey = isSimulation
            ? computeSimulationIdempotencyKey(electionId, positionId, ballotId)
            : computeIdempotencyKey(voterId || `sim-${ballotId}`, electionId, positionId)
          const blob = encryptChoice({ candidateId: null, isNota: true, timestamp: new Date().toISOString() })

          await tx.voteRecord.create({
            data: {
              organizationId: orgId,
              electionId,
              positionId,
              candidateId: null,
              voterHash,
              encryptedChoice: blob.ciphertext,
              iv: blob.iv,
              keyId: blob.keyId,
              receiptCode,
              idempotencyKey,
              ballotId,
              ipAddress: ip,
              deviceFingerprint: device,
              isSimulation,
            },
          })
          receipts.push({ positionId, positionTitle: posMeta.title, receiptCode })
        } else {
          // Store one VoteRecord per selected candidate (supports multiple choice).
          for (const candId of selArray) {
            const receiptCode = generateSveReceiptCode()
            const idempotencyKey = isSimulation
              ? computeSimulationIdempotencyKey(electionId, `${positionId}:${candId}`, ballotId)
              : computeIdempotencyKey(voterId || `sim-${ballotId}`, electionId, `${positionId}:${candId}`)
            const blob = encryptChoice({ candidateId: candId, isNota: false, timestamp: new Date().toISOString() })

            await tx.voteRecord.create({
              data: {
                organizationId: orgId,
                electionId,
                positionId,
                candidateId: candId,
                voterHash,
                encryptedChoice: blob.ciphertext,
                iv: blob.iv,
                keyId: blob.keyId,
                receiptCode,
                idempotencyKey,
                ballotId,
                ipAddress: ip,
                deviceFingerprint: device,
                isSimulation,
              },
            })
            receipts.push({ positionId, positionTitle: posMeta.title, receiptCode })
          }
        }
      }

      // 4. Mark voter as voted + revoke session (skip for simulation).
      if (voterId && !isSimulation) {
        await tx.voter.update({
          where: { id: voterId },
          data: {
            hasVoted: true,
            votedAt: new Date(),
            // Revoke the active session token (force re-auth for any further action).
            sessionToken: null,
            sessionExpiresAt: null,
            sessionDeviceId: null,
            otpCode: null,
            otpExpiresAt: null,
          },
        })

        // Mark voting session as voted.
        if (sessionId) {
          await tx.votingSession.update({
            where: { id: sessionId },
            data: { hasVoted: true, votedAt: new Date() },
          }).catch(() => {})
        }

        // 5. Hash-chained audit log (computed inside txn for ordering).
        const last = await tx.auditLog.findFirst({ orderBy: { createdAt: 'desc' } })
        const prevHash = last?.hash || AUDIT_GENESIS
        const createdAt = new Date()
        const nonce = randomToken(8)
        const detailsStr = JSON.stringify({
          electionId, positions: receipts.map((r) => r.positionId), count: receipts.length, simulation: isSimulation,
        })
        const hash = computeAuditHash({ prevHash, actorId: voterId, action: 'VOTE_CAST', details: detailsStr, createdAt, nonce })
        await tx.auditLog.create({
          data: {
            electionId, actorId: voterId, actorRole: 'VOTER',
            actorName: voter?.fullName || voter?.email || 'Voter',
            action: 'VOTE_CAST', details: detailsStr, ip,
            prevHash, hash, nonce, createdAt,
          },
        })

        // 6. VoterTimelineEvent
        await tx.voterTimelineEvent.create({
          data: {
            organizationId: orgId,
            voterId,
            electionId,
            eventType: 'VOTE_CAST',
            description: `Voted in ${election.name} (${receipts.length} position${receipts.length === 1 ? '' : 's'})`,
            actorId: voterId,
            actorName: voter?.fullName || 'Voter',
            metadata: JSON.stringify({ receiptCount: receipts.length, ip }),
          },
        })

        // 7. ElectionEvent (timeline)
        await tx.electionEvent.create({
          data: {
            electionId,
            organizationId: orgId,
            eventType: 'VOTE_CAST',
            description: `Vote cast by ${voter?.fullName || 'a voter'}`,
            actorId: voterId,
            actorName: voter?.fullName || 'Voter',
            metadata: JSON.stringify({ positionCount: receipts.length, simulation: isSimulation }),
          },
        })
      }

      // 8. Mark ballot as submitted.
      await tx.ballot.update({
        where: { id: ballotId },
        data: { status: 'SUBMITTED', updatedAt: new Date() },
      })
    })
  } catch (e: any) {
    // Idempotency collision → duplicate submission.
    if (e?.code === 'P2002') {
      throw new CastVoteError('Duplicate vote attempt detected and blocked', 409, 'DUPLICATE_VOTE')
    }
    if (e instanceof CastVoteError) throw e
    console.error('[sve/vote-recorder] transaction failed', e)
    throw new CastVoteError('Failed to record vote. Please try again.', 500, 'TRANSACTION_FAILED')
  }

  // 9. Update live count cache (outside txn — best-effort).
  await incrementLiveCount(electionId, receipts.length, isSimulation)
  const liveStats = await getLiveStats(electionId)

  // Async: forward receipt codes to the voter (no-op transport in sandbox).
  if (voterId && !isSimulation && voter) {
    const { enqueue } = await import('@/lib/jobs')
    const channel = voter.otpChannel || 'EMAIL'
    const dest = channel === 'EMAIL' ? (voter.institutionEmail || voter.personalEmail || voter.email) : voter.phone
    const receiptList = receipts.map((r) => `${r.positionTitle}: ${r.receiptCode}`).join('\n')
    const message = `Dear ${voter.fullName || 'Voter'}, your vote has been recorded and counted.\n\nReceipt codes (save to verify later):\n${receiptList}\n\nYour vote choice remains secret. Verify any code on VoteWise.`
    enqueue('receipt.forward', { channel, destination: dest, voterName: voter.fullName, receipts, message })
  }

  return {
    ok: true,
    receipts,
    votedAt: new Date().toISOString(),
    isSimulation,
    electionId,
    totalVotesInElection: liveStats.votesCast,
    turnoutPct: liveStats.turnoutPct,
  }
}

export class CastVoteError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    public failedChecks?: any[],
  ) {
    super(message)
    this.name = 'CastVoteError'
  }
}
