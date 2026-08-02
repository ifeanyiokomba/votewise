// VoteWise — SVE Risk-Limiting Audit (RLA) (Chapter 10)
//
// A risk-limiting audit is a post-election audit that examines a random sample
// of ballots to confirm that the reported election outcome is correct. If the
// sample provides strong statistical evidence that the outcome is correct, the
// audit stops (the risk limit is met). If discrepancies are found, the audit
// escalates to a full recount.
//
// Approach:
//   1. Compute the certified tally (tallyElection).
//   2. For each position, compute the winner's margin.
//   3. Compute the required sample size using the simplified BRAVO-style
//      formula:
//          n = ceil( ln(riskLimit) / ln(1 - margin) )
//      Lower risk limit OR smaller margin → more ballots sampled → higher
//      confidence.
//   4. Select a deterministic random sample of vote IDs. The sample is seeded
//      for reproducibility — anyone with the seed can re-run the audit and
//      verify that the same ballots were sampled.
//   5. For each sampled vote, decrypt the choice (AES-256-GCM) and compare to
//      the stored candidateId (which is what the reported tally used). If they
//      match, the vote was correctly captured in the tally. Otherwise it is a
//      mismatch (discrepancy).
//   6. If no discrepancies are found in any position's sample, the risk limit
//      is met → audit passes. If discrepancies are found, the audit escalates
//      → full recount recommended.

import { createHash, randomBytes } from 'crypto'
import { db } from '@/lib/db'
import { decryptChoice } from './crypto'
import { tallyElection, type TallyResult } from './tally'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RLAOptions {
  /** Maximum risk of certifying an incorrect outcome. 0 < r < 1. Default 0.10. */
  riskLimit?: number
  /** Reproducibility seed. Auto-generated (cryptographically random) if absent. */
  seed?: string
  /** Audit simulation votes only (default false — real votes only). */
  simulation?: boolean
}

export interface AuditSampleMismatch {
  voteId: string
  receiptCode: string | null
  /** candidateId stored on the VoteRecord (what the tally used). */
  expected: string | null
  /** candidateId recovered by decrypting the ballot. */
  actual: string | null
  isNota: boolean
  reason: string
}

export interface AuditSampleResult {
  sampled: number
  matching: number
  mismatches: AuditSampleMismatch[]
  discrepancyFound: boolean
}

export interface RLAPositionResult {
  positionId: string
  title: string
  /** Winner display name(s) (comma-joined for shared/tied winners). */
  winner: string | null
  winnerIds: string[]
  /** Winner's margin as a fraction (0..1). 0 = tie, 1 = unanimous. */
  margin: number
  totalVotes: number
  sampleSize: number
  sampled: number
  matching: number
  mismatches: AuditSampleMismatch[]
  riskLimitMet: boolean
}

export interface RLAResult {
  electionId: string
  electionName: string
  riskLimit: number
  seed: string
  generatedAt: string
  /** Audit hash from the certified tally — anchors the audit to a specific tally. */
  tallyHash: string
  positions: RLAPositionResult[]
  overallPassed: boolean
  totalBallots: number
  totalSampled: number
  totalMatching: number
  totalMismatches: number
}

// ---------------------------------------------------------------------------
// Sample size
// ---------------------------------------------------------------------------

/**
 * Compute the required sample size using the simplified BRAVO-style formula:
 *
 *     n = ceil( ln(riskLimit) / ln(1 - margin) )
 *
 * - `riskLimit` is the maximum risk of certifying an incorrect outcome
 *   (e.g. 0.10 for a 10% risk limit). Lower → more ballots sampled → higher
 *   confidence.
 * - `margin` is the reported winner's margin as a fraction (e.g. 0.05 for 5%).
 * - `contestBallots` is the total number of ballots cast in the contest.
 *
 * Edge cases:
 *   - contestBallots <= 0 → 0 (nothing to audit)
 *   - margin <= 0 (tie / unresolved) → contestBallots (full recount)
 *   - margin >= 1 (unanimous) → 1 (one ballot is statistically sufficient)
 *
 * The result is always clamped to [1, contestBallots] when contestBallots > 0.
 */
export function computeSampleSize(
  riskLimit: number,
  margin: number,
  contestBallots: number,
): number {
  if (contestBallots <= 0) return 0
  if (margin <= 0) return contestBallots // tie → full recount
  if (margin >= 1) return 1 // unanimous → minimum sample

  // Clamp to a safe numerical range to avoid divide-by-zero / NaN.
  const safeRiskLimit = Math.min(Math.max(riskLimit, 1e-9), 0.999999)
  const safeMargin = Math.min(Math.max(margin, 1e-9), 0.999999)

  // Both ln(riskLimit) and ln(1 - margin) are negative — their ratio is
  // positive.
  const n = Math.ceil(Math.log(safeRiskLimit) / Math.log(1 - safeMargin))
  return Math.max(1, Math.min(n, contestBallots))
}

// ---------------------------------------------------------------------------
// Deterministic SHA-256 PRNG
// ---------------------------------------------------------------------------

/**
 * Build a deterministic PRNG from a seed using SHA-256. Each call returns a
 * pseudo-random 32-bit unsigned integer. The same seed always produces the
 * same stream — which is what makes the audit sample reproducible for
 * independent verification.
 *
 * Implementation: we hash `seed + ":" + counter` to produce 256 bits (32
 * bytes) of randomness per round, then carve those bytes into eight 32-bit
 * draws. When we exhaust the buffer, we bump the counter and hash again.
 */
function makeSha256Prng(seed: string): () => number {
  let counter = 0
  let buffer = createHash('sha256').update(`${seed}:${counter}`).digest()
  let bufferPos = 0

  const refill = () => {
    counter += 1
    buffer = createHash('sha256').update(`${seed}:${counter}`).digest()
    bufferPos = 0
  }

  return () => {
    if (bufferPos + 4 > buffer.length) refill()
    const val = buffer.readUInt32BE(bufferPos)
    bufferPos += 4
    return val
  }
}

/**
 * Cryptographically random selection of `sampleSize` vote IDs from the full
 * list, seeded for reproducibility. Uses a SHA-256 PRNG to drive a Fisher–
 * Yates partial shuffle, so that:
 *   - The selection is deterministic given (voteIds, sampleSize, seed).
 *   - Re-running with the same seed returns the exact same sample.
 *   - The seed is published with the audit report so anyone can verify the
 *     same ballots were sampled.
 *
 * If `sampleSize >= voteIds.length`, returns all vote IDs (in shuffled order).
 */
export function selectRandomSample(
  voteIds: string[],
  sampleSize: number,
  seed: string,
): string[] {
  if (voteIds.length === 0 || sampleSize <= 0) return []
  const n = Math.min(sampleSize, voteIds.length)
  const rand = makeSha256Prng(seed)

  // Fisher–Yates shuffle, stopping after we've selected n items.
  const arr = [...voteIds]
  const selected: string[] = []
  for (let i = 0; i < n; i++) {
    const j = i + (rand() % (arr.length - i))
    const tmp = arr[i]
    arr[i] = arr[j]
    arr[j] = tmp
    selected.push(arr[i])
  }
  return selected
}

// ---------------------------------------------------------------------------
// Per-sample audit
// ---------------------------------------------------------------------------

/**
 * Audit a sample of votes for a position. For each sampled vote:
 *   - Decrypt the choice (AES-256-GCM).
 *   - Compare the decrypted candidateId to the stored candidateId on the
 *     VoteRecord (which is what the reported tally used).
 *   - If they match, the vote was correctly captured in the tally.
 *   - If they don't match (or decryption fails), record a mismatch.
 *
 * Decryption failures (corrupt or tampered ciphertext) count as mismatches.
 */
export async function auditSample(
  electionId: string,
  positionId: string,
  voteIds: string[],
): Promise<AuditSampleResult> {
  if (voteIds.length === 0) {
    return { sampled: 0, matching: 0, mismatches: [], discrepancyFound: false }
  }

  const votes = await db.voteRecord.findMany({
    where: { id: { in: voteIds }, electionId, positionId },
    select: {
      id: true,
      candidateId: true,
      encryptedChoice: true,
      iv: true,
      keyId: true,
      receiptCode: true,
    },
  })

  const mismatches: AuditSampleMismatch[] = []
  let matching = 0

  for (const vote of votes) {
    try {
      const choice = decryptChoice({
        ciphertext: vote.encryptedChoice,
        iv: vote.iv,
        keyId: vote.keyId,
      })
      const decryptedId = choice.candidateId ?? null
      if (decryptedId === vote.candidateId) {
        matching++
      } else {
        mismatches.push({
          voteId: vote.id,
          receiptCode: vote.receiptCode,
          expected: vote.candidateId,
          actual: decryptedId,
          isNota: choice.isNota,
          reason: `Decrypted choice (${decryptedId ?? 'null'}) does not match stored candidateId (${vote.candidateId ?? 'null'})`,
        })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      mismatches.push({
        voteId: vote.id,
        receiptCode: vote.receiptCode,
        expected: vote.candidateId,
        actual: null,
        isNota: false,
        reason: `Decryption failed: ${msg}`,
      })
    }
  }

  return {
    sampled: votes.length,
    matching,
    mismatches,
    discrepancyFound: mismatches.length > 0,
  }
}

// ---------------------------------------------------------------------------
// Full audit
// ---------------------------------------------------------------------------

/**
 * Run a full risk-limiting audit for an election.
 *
 * Steps:
 *   1. Compute the certified tally (tallyElection).
 *   2. For each position:
 *      a. Identify the winner(s) and compute the winner's margin.
 *      b. Compute the required sample size (BRAVO-style).
 *      c. Select a deterministic random sample of votes.
 *      d. Audit the sample.
 *      e. riskLimitMet = true iff no discrepancies were found in the sample.
 *   3. overallPassed = true iff every position met its risk limit.
 *
 * If `seed` is not provided, a cryptographically random one is generated. The
 * seed is included in the result so the audit can be re-run for verification.
 */
export async function runRiskLimitingAudit(
  electionId: string,
  options: RLAOptions = {},
): Promise<RLAResult> {
  const riskLimit = options.riskLimit ?? 0.10
  const seed = options.seed || generateAuditSeed()
  const simulation = options.simulation ?? false

  // 1. Compute the certified tally.
  const tally: TallyResult = await tallyElection(electionId, { simulation })

  const positionResults: RLAPositionResult[] = []
  let totalBallots = 0
  let totalSampled = 0
  let totalMatching = 0
  let totalMismatches = 0

  for (const pos of tally.resultsByPosition) {
    const totalVotes = pos.totalVotes
    totalBallots += totalVotes

    // Skip positions with no votes — nothing to audit.
    if (totalVotes === 0) {
      positionResults.push({
        positionId: pos.positionId,
        title: pos.title,
        winner: null,
        winnerIds: [],
        margin: 0,
        totalVotes: 0,
        sampleSize: 0,
        sampled: 0,
        matching: 0,
        mismatches: [],
        riskLimitMet: true,
      })
      continue
    }

    // Identify winners and compute margin (winner_votes - runner_up_votes) / total.
    const sortedResults = [...pos.results].sort((a, b) => b.votes - a.votes)
    const winners = sortedResults.filter((r) => r.isWinner)
    const winnerIds = winners
      .map((w) => w.candidateId)
      .filter((id): id is string => id !== null)
    const winnerName = winners.map((w) => w.candidateName).join(', ') || null

    const winnerVotes = sortedResults[0]?.votes ?? 0
    const runnerUpVotes = sortedResults[1]?.votes ?? 0
    const margin = totalVotes > 0 ? (winnerVotes - runnerUpVotes) / totalVotes : 0

    // 2. Compute sample size.
    const sampleSize = computeSampleSize(riskLimit, margin, totalVotes)

    // 3. Get all vote IDs for this position and select a random sample.
    //    The seed is mixed with the positionId so each position's sample is
    //    independent and reproducible.
    const allVotes = await db.voteRecord.findMany({
      where: { electionId, positionId: pos.positionId, isSimulation: simulation },
      select: { id: true },
    })
    const allVoteIds = allVotes.map((v) => v.id)
    const positionSeed = `${seed}:${pos.positionId}`
    const sampledVoteIds = selectRandomSample(allVoteIds, sampleSize, positionSeed)

    // 4. Audit the sample.
    const audit = await auditSample(electionId, pos.positionId, sampledVoteIds)

    totalSampled += audit.sampled
    totalMatching += audit.matching
    totalMismatches += audit.mismatches.length

    positionResults.push({
      positionId: pos.positionId,
      title: pos.title,
      winner: winnerName,
      winnerIds,
      margin,
      totalVotes,
      sampleSize,
      sampled: audit.sampled,
      matching: audit.matching,
      mismatches: audit.mismatches,
      riskLimitMet: !audit.discrepancyFound,
    })
  }

  const overallPassed = positionResults.every((p) => p.riskLimitMet)

  return {
    electionId,
    electionName: tally.electionName,
    riskLimit,
    seed,
    generatedAt: new Date().toISOString(),
    tallyHash: tally.auditHash,
    positions: positionResults,
    overallPassed,
    totalBallots,
    totalSampled,
    totalMatching,
    totalMismatches,
  }
}

/**
 * Generate a fresh, cryptographically random audit seed. The seed is what
 * makes an audit reproducible — anyone with the seed can re-run the audit and
 * verify the same ballots were sampled. Generating it from crypto.randomBytes
 * ensures no one can predict the sample in advance.
 */
export function generateAuditSeed(): string {
  return randomBytes(16).toString('hex')
}

// Re-export createHash so callers (and tests) can build a matching PRNG if
// they want to re-derive a sample from a known seed.
export { createHash }
