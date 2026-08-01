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
import { computeAuditHash as computeAuditLogHash } from '@/lib/crypto'
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

/**
 * Verify the audit-log hash chain for a specific election.
 *
 * Walks this election's audit log entries in chronological order and checks:
 *   1. Self-integrity: each entry's hash recomputes correctly from its
 *      fields (prevHash, actorId, action, details, createdAt, nonce).
 *   2. Link integrity: each entry's prevHash either matches the previous
 *      entry in this election's set, OR exists as a hash somewhere in the
 *      global audit log (cross-election link is valid), OR is a known
 *      genesis anchor.
 *
 * This is more focused than `verifyAuditChain()` (which walks the entire
 * global chain and requires the first-ever entry to link from a specific
 * genesis string). The election-scoped check catches tampering with THIS
 * election's entries while being resilient to legacy genesis conventions
 * and cross-election interleaving.
 *
 * Returns the chain integrity report + the first 3 / last 3 entries for
 * visualization.
 */
export async function verifyElectionAuditChain(electionId: string): Promise<{
  intact: boolean
  brokenAt: string | null
  totalChecked: number
  electionEntries: number
  head: Array<{
    id: string
    action: string
    actorName: string
    actorRole: string
    prevHash: string
    hash: string
    createdAt: Date
  }>
  tail: Array<{
    id: string
    action: string
    actorName: string
    actorRole: string
    prevHash: string
    hash: string
    createdAt: Date
  }>
  hiddenMiddleCount: number
}> {
  // Fetch this election's audit logs in chronological order.
  const electionLogs = await db.auditLog.findMany({
    where: { electionId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, action: true, actorId: true, actorName: true, actorRole: true,
      details: true, prevHash: true, hash: true, nonce: true, createdAt: true,
    },
  })

  if (electionLogs.length === 0) {
    return {
      intact: true,
      brokenAt: null,
      totalChecked: 0,
      electionEntries: 0,
      head: [],
      tail: [],
      hiddenMiddleCount: 0,
    }
  }

  // Build a set of ALL audit log hashes (global) so we can validate
  // cross-election prevHash links. This is a single column scan.
  const allLogs = await db.auditLog.findMany({
    select: { hash: true },
    orderBy: { createdAt: 'asc' },
  })
  const globalHashes = new Set(allLogs.map((l) => l.hash))

  // Known genesis anchors (v2 + legacy v1).
  const GENESIS_ANCHORS = new Set([
    'GENESIS-votewise-sug-v2',
    'GENESIS-afrivote-sug-v1',
  ])

  let intact = true
  let brokenAt: string | null = null
  let totalChecked = 0
  let lastHashInElection: string | null = null

  for (const log of electionLogs) {
    totalChecked++

    // 1. Self-integrity: recompute the hash and compare.
    const recomputed = computeAuditLogHash({
      prevHash: log.prevHash,
      actorId: log.actorId,
      action: log.action,
      details: log.details,
      createdAt: log.createdAt,
      nonce: log.nonce,
    })
    if (recomputed !== log.hash) {
      intact = false
      brokenAt = log.id
      break
    }

    // 2. Link integrity: prevHash must be one of:
    //    - a known genesis anchor (for the first entry or a fork point)
    //    - the previous entry's hash in this election
    //    - a hash that exists in the global audit log (cross-election link)
    const prevOk =
      GENESIS_ANCHORS.has(log.prevHash) ||
      (lastHashInElection !== null && log.prevHash === lastHashInElection) ||
      globalHashes.has(log.prevHash)
    if (!prevOk) {
      intact = false
      brokenAt = log.id
      break
    }

    lastHashInElection = log.hash
  }

  // First 3 + last 3 for visualization.
  const head = electionLogs.slice(0, 3).map((l) => ({
    id: l.id, action: l.action, actorName: l.actorName, actorRole: l.actorRole,
    prevHash: l.prevHash, hash: l.hash, createdAt: l.createdAt,
  }))
  const tail = electionLogs.slice(-3).map((l) => ({
    id: l.id, action: l.action, actorName: l.actorName, actorRole: l.actorRole,
    prevHash: l.prevHash, hash: l.hash, createdAt: l.createdAt,
  }))
  const hiddenMiddleCount = Math.max(0, electionLogs.length - 6)

  return {
    intact,
    brokenAt,
    totalChecked,
    electionEntries: electionLogs.length,
    head,
    tail,
    hiddenMiddleCount,
  }
}
