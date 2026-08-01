// VoteWise — SVE Cryptographic Operations (Chapter 10)
//
// Ballot-specific crypto: integrity tokens, digital signatures, voter hashing,
// receipt codes, idempotency keys. Extends the base crypto primitives in
// src/lib/crypto.ts without duplicating them.
//
// Security properties:
// - Ballot integrity: any modification to ballot content changes the
//   integrityToken, which invalidates the digitalSignature.
// - Ballot secrecy: votes are encrypted at rest with AES-256-GCM. The
//   voterHash is a one-way peppered hash — it proves the voter voted
//   without revealing which voter.
// - Idempotency: sha256(voterId + electionId + positionId) prevents duplicate
//   votes for the same position. A unique constraint enforces this at the DB.
// - Receipts: random, unlinkable codes. Verifying a receipt confirms it exists
//   WITHOUT revealing the candidate choice.

import {
  sha256,
  hmacSign,
  hmacVerify,
  randomToken,
  encryptVote,
  decryptVote,
  type EncryptedBlob,
} from '@/lib/crypto'
import { timingSafeEqual } from 'crypto'

// Peppers (separate from the Voter.hashVoter pepper to isolate concerns).
const SVE_BALLOT_PEPPER = process.env.SVE_BALLOT_PEPPER || 'votewise-sve-ballot-pepper-v1'
const SVE_VOTER_PEPPER = process.env.SVE_VOTER_PEPPER || 'votewise-sve-voter-pepper-v1'

// ---------------------------------------------------------------------------
// Ballot integrity & signing
// ---------------------------------------------------------------------------

/**
 * Compute the integrity token for a ballot.
 * This is sha256(content + voterHash + timestamp) — any modification to the
 * ballot content, the voter, or the generation time invalidates this token.
 */
export function computeIntegrityToken(content: string, voterHash: string, generatedAt: string): string {
  return sha256(`${content}|${voterHash}|${generatedAt}|${SVE_BALLOT_PEPPER}`)
}

/**
 * Sign the integrity token with an HMAC. The signature proves the ballot was
 * issued by VoteWise (not tampered or forged by a voter). Verification uses
 * the same HMAC secret.
 */
export function signBallot(integrityToken: string): string {
  return hmacSign(`ballot:${integrityToken}`)
}

/**
 * Verify a ballot's digital signature. Returns true if the signature matches
 * the integrity token, false otherwise. Used during vote submission to ensure
 * the ballot was not modified after generation.
 */
export function verifyBallotSignature(integrityToken: string, signature: string): boolean {
  return hmacVerify(`ballot:${integrityToken}`, signature)
}

/**
 * Verify the full ballot integrity: recompute the integrity token from the
 * content + voterHash + generatedAt and compare to the stored token.
 */
export function verifyBallotIntegrity(
  content: string,
  voterHash: string,
  generatedAt: string,
  storedIntegrityToken: string,
): boolean {
  const computed = computeIntegrityToken(content, voterHash, generatedAt)
  // Constant-time compare.
  const a = Buffer.from(computed)
  const b = Buffer.from(storedIntegrityToken)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

// ---------------------------------------------------------------------------
// Voter hashing (anonymous identity)
// ---------------------------------------------------------------------------

/**
 * One-way voter hash. Stored on VoteRecord instead of the voterId. This lets
 * us prove "this voter voted" and prevent double-voting (via idempotency key)
 * without storing the voter↔vote link.
 *
 * The pepper is SVE-specific and separate from the legacy hashVoter() so
 * legacy systems cannot correlate.
 */
export function hashVoterIdentity(voterId: string): string {
  return sha256(`${voterId}:${SVE_VOTER_PEPPER}`)
}

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

/**
 * Idempotency key for a vote. sha256(voterId + electionId + positionId).
 * Stored with a UNIQUE constraint on VoteRecord. If a voter clicks Submit
 * twice (or the network retries), the second insert collides on this key and
 * is rejected — preventing duplicate votes.
 */
export function computeIdempotencyKey(voterId: string, electionId: string, positionId: string): string {
  return sha256(`${voterId}|${electionId}|${positionId}`)
}

/**
 * Idempotency key for a simulation vote (separate namespace so simulations
 * never collide with real votes).
 */
export function computeSimulationIdempotencyKey(electionId: string, positionId: string, ballotId: string): string {
  return sha256(`sim|${electionId}|${positionId}|${ballotId}`)
}

// ---------------------------------------------------------------------------
// Receipt codes
// ---------------------------------------------------------------------------

/**
 * Generate a VoteWise receipt code. Format: VW-YYYY-XXXXXXXX
 * where YYYY is the current year and X is a random alphanumeric.
 * The receipt is unique, unlinkable to the vote content, and verifiable.
 */
export function generateSveReceiptCode(): string {
  const year = new Date().getFullYear()
  const seg = randomToken(5).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
  return `VW-${year}-${seg.padEnd(8, '0')}`
}

// ---------------------------------------------------------------------------
// Vote encryption at rest
// ---------------------------------------------------------------------------

export interface EncryptedChoice {
  candidateId: string | null
  isNota: boolean
  timestamp: string
}

/**
 * Encrypt a vote choice with AES-256-GCM. Even database administrators
 * cannot casually inspect raw ballots — the key lives in env / KMS.
 */
export function encryptChoice(choice: EncryptedChoice): EncryptedBlob {
  return encryptVote(choice)
}

/**
 * Decrypt a vote choice. Only used during tallying (after voting closes) and
 * for audit purposes. Never exposed through the receipt verification API.
 */
export function decryptChoice(blob: EncryptedBlob): EncryptedChoice {
  return decryptVote(blob) as unknown as EncryptedChoice
}

// ---------------------------------------------------------------------------
// Rules hash (detect mid-vote rule changes)
// ---------------------------------------------------------------------------

/**
 * Hash the election rules + positions + candidates at ballot generation time.
 * Stored on the ballot. During vote submission, we recompute and compare —
 * if the rules changed (e.g. admin added a candidate), the ballot is invalid
 * and the voter must regenerate it. This prevents "stale ballot" attacks.
 *
 * Order-independent: positions and candidates are sorted by ID before hashing
 * so that different query orderings (e.g. orderBy displayOrder vs none) don't
 * produce different hashes.
 */
export function computeRulesHash(election: {
  positions: Array<{ id: string; title: string; maximumVotes: number; candidates: Array<{ id: string; fullName: string; status: string }> }>
  settings?: string | null
}): string {
  const data = {
    positions: [...election.positions]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((p) => ({
        id: p.id,
        title: p.title,
        max: p.maximumVotes,
        candidates: [...p.candidates]
          .sort((a, b) => a.id.localeCompare(b.id))
          .map((c) => ({ id: c.id, name: c.fullName, status: c.status })),
      })),
    settings: election.settings || null,
  }
  return sha256(JSON.stringify(data))
}

// ---------------------------------------------------------------------------
// Audit hash (post-election verification)
// ---------------------------------------------------------------------------

/**
 * Hash all vote records for an election. Used in the post-election
 * verification package. Any change to the votes changes this hash.
 */
export function computeAuditHash(votes: Array<{ id: string; receiptCode: string; positionId: string; createdAt: Date }>): string {
  const sorted = [...votes].sort((a, b) => a.id.localeCompare(b.id))
  const data = sorted.map((v) => `${v.id}|${v.receiptCode}|${v.positionId}|${v.createdAt.toISOString()}`).join('|')
  return sha256(`audit|${data}|${SVE_BALLOT_PEPPER}`)
}

/**
 * Sign the audit hash to produce the integrity signature. This is included
 * in the verification package and proves the tally was produced by VoteWise.
 */
export function signAuditHash(auditHash: string): string {
  return hmacSign(`verification:${auditHash}`)
}
