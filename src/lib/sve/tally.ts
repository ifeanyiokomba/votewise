// VoteWise — SVE Tally & Verification (Chapter 10)
//
// Post-election tallying. After voting closes:
//
//   Voting Closed → Lock Ballots → Count Votes → Validate Totals
//                → Generate Results → Generate Verification Package
//
// Never count while ballots are still changing. The tally decrypts the
// stored choices (using the same AES-256-GCM key used at encryption time),
// aggregates per candidate, and produces a signed verification package.
//
// Tie handling is policy-driven (Chapter 9). Supported strategies:
// - RUNOFF: schedule a runoff election (manual)
// - MANUAL: electoral committee decides (logged)
// - SHARED: multiple winners declared
// - COIN_TOSS: random (not recommended, but supported)

import { db } from '@/lib/db'
import { decryptChoice, computeAuditHash, signAuditHash } from './crypto'
import type { VerificationPackage } from './types'

export interface TallyOptions {
  simulation?: boolean
  tieStrategy?: 'RUNOFF' | 'MANUAL' | 'SHARED' | 'COIN_TOSS'
}

export type TallyResult = VerificationPackage

/**
 * Tally an election. Decrypts all vote records, aggregates per candidate,
 * detects ties, and returns the full results. Does NOT mutate the DB — this
 * is a read operation. Use persistVerification() to store the signed package.
 */
export async function tallyElection(electionId: string, opts: TallyOptions = {}): Promise<TallyResult> {
  const { simulation = false, tieStrategy = 'SHARED' } = opts

  const election = await db.electionSession.findUnique({
    where: { id: electionId },
    include: {
      positions: {
        orderBy: { displayOrder: 'asc' },
        include: {
          candidates: { where: { status: 'APPROVED' } },
        },
      },
    },
  })
  if (!election) throw new Error('Election not found')

  // Load all vote records (non-simulation only, unless simulation=true).
  const votes = await db.voteRecord.findMany({
    where: { electionId, isSimulation: simulation },
    select: {
      id: true,
      positionId: true,
      candidateId: true,
      encryptedChoice: true,
      iv: true,
      keyId: true,
      receiptCode: true,
      voterHash: true,
      createdAt: true,
    },
  })

  // Aggregate per position.
  const resultsByPosition = election.positions.map((pos) => {
    const positionVotes = votes.filter((v) => v.positionId === pos.id)
    const candidateCounts = new Map<string, number>()
    let notaCount = 0
    let blankCount = 0

    for (const vote of positionVotes) {
      // Decrypt the choice to get the authoritative candidateId.
      try {
        const choice = decryptChoice({
          ciphertext: vote.encryptedChoice,
          iv: vote.iv,
          keyId: vote.keyId,
        })
        if (choice.isNota) {
          notaCount++
        } else if (choice.candidateId) {
          candidateCounts.set(choice.candidateId, (candidateCounts.get(choice.candidateId) || 0) + 1)
        } else {
          blankCount++
        }
      } catch {
        // If decryption fails, fall back to the stored candidateId.
        if (vote.candidateId) {
          candidateCounts.set(vote.candidateId, (candidateCounts.get(vote.candidateId) || 0) + 1)
        } else {
          blankCount++
        }
      }
    }

    const totalVotes = positionVotes.length
    const maxVotes = Math.max(...candidateCounts.values(), 0)
    const winners = Array.from(candidateCounts.entries()).filter(([, c]) => c === maxVotes && c > 0)
    const tie = winners.length > 1

    // Resolve tie based on strategy.
    let winnerIds: string[] = []
    if (tie) {
      switch (tieStrategy) {
        case 'SHARED':
          winnerIds = winners.map(([id]) => id)
          break
        case 'COIN_TOSS':
          winnerIds = [winners[Math.floor(Math.random() * winners.length)][0]]
          break
        case 'MANUAL':
        case 'RUNOFF':
        default:
          winnerIds = [] // unresolved — requires manual action
          break
      }
    } else if (winners.length === 1) {
      winnerIds = [winners[0][0]]
    }

    const results = pos.candidates.map((cand) => {
      const count = candidateCounts.get(cand.id) || 0
      return {
        candidateId: cand.id,
        candidateName: cand.fullName,
        votes: count,
        percentage: totalVotes > 0 ? Math.round((count / totalVotes) * 10000) / 100 : 0,
        isWinner: winnerIds.includes(cand.id),
      }
    })

    // Add NOTA as a "candidate" row for transparency.
    if (notaCount > 0) {
      results.push({
        candidateId: null,
        candidateName: 'None of the Above (NOTA)',
        votes: notaCount,
        percentage: totalVotes > 0 ? Math.round((notaCount / totalVotes) * 10000) / 100 : 0,
        isWinner: notaCount === maxVotes && notaCount > 0 && winnerIds.length === 0,
      })
    }

    return {
      positionId: pos.id,
      title: pos.title,
      totalVotes,
      results: results.sort((a, b) => b.votes - a.votes),
      tie,
    }
  })

  // Compute totals.
  const totalEligible = await db.voter.count({
    where: {
      OR: [
        { electionSessionId: electionId },
        { organizationId: election.organizationId || undefined },
      ],
    },
  })
  const uniqueVoterHashes = new Set(votes.map((v) => v.voterHash))
  const totalVotes = uniqueVoterHashes.size
  const invalidVotes = votes.filter((v) => !v.candidateId && !v.encryptedChoice).length
  const blankVotes = votes.filter((v) => {
    try {
      const c = decryptChoice({ ciphertext: v.encryptedChoice, iv: v.iv, keyId: v.keyId })
      return !c.candidateId && !c.isNota
    } catch { return false }
  }).length
  const turnoutPct = totalEligible > 0 ? Math.round((totalVotes / totalEligible) * 10000) / 100 : 0

  // Audit hash + integrity signature.
  const auditHash = computeAuditHash(votes.map((v) => ({
    id: v.id,
    receiptCode: v.receiptCode,
    positionId: v.positionId,
    createdAt: v.createdAt,
  })))
  const integritySignature = signAuditHash(auditHash)

  return {
    electionId,
    electionName: election.name,
    totalEligible,
    totalVotes,
    invalidVotes,
    blankVotes,
    turnoutPct,
    auditHash,
    integritySignature,
    generatedAt: new Date().toISOString(),
    resultsByPosition,
  }
}

/**
 * Persist the verification package to the DB (ElectionVerification model).
 * Called after certification.
 */
export async function persistVerification(electionId: string, tally: TallyResult): Promise<void> {
  await db.electionVerification.upsert({
    where: { electionId },
    create: {
      electionId,
      organizationId: (await db.electionSession.findUnique({ where: { id: electionId }, select: { organizationId: true } }))?.organizationId || null,
      totalEligible: tally.totalEligible,
      totalVotes: tally.totalVotes,
      invalidVotes: tally.invalidVotes,
      blankVotes: tally.blankVotes,
      turnoutPct: tally.turnoutPct,
      auditHash: tally.auditHash,
      integritySignature: tally.integritySignature,
    },
    update: {
      totalEligible: tally.totalEligible,
      totalVotes: tally.totalVotes,
      invalidVotes: tally.invalidVotes,
      blankVotes: tally.blankVotes,
      turnoutPct: tally.turnoutPct,
      auditHash: tally.auditHash,
      integritySignature: tally.integritySignature,
      generatedAt: new Date(),
    },
  })
}

/**
 * Get the stored verification package for an election (if certified).
 */
export async function getVerification(electionId: string) {
  return db.electionVerification.findUnique({ where: { electionId } })
}
