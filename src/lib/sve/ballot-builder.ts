// VoteWise — SVE Ballot Builder (Chapter 10)
//
// Generates ballots dynamically from election configuration. Never hardcoded.
//
// Flow:
//   Election → Positions → Candidates (eligible + approved) → Voting Rules → Ballot
//
// The frontend simply renders whatever the backend sends. This means a
// university election (President/VP/Secretary) and a company election
// (Chairman/PRO/Financial Secretary) use the exact same UI.
//
// Security properties:
// - Scope filtering: a voter only sees positions they're eligible for
//   (university-wide, their faculty, their department, or their voter group).
// - Candidate shuffling: candidate order is shuffled per ballot (seeded by
//   voter hash) to remove positional bias. The same voter always sees the
//   same order; different voters see different orders.
// - Rules hash: the positions + candidates + settings are hashed at generation
//   time. If anything changes before submission, the ballot is invalidated.

import { db } from '@/lib/db'
import {
  computeIntegrityToken,
  signBallot,
  hashVoterIdentity,
  computeRulesHash,
} from './crypto'
import type { BallotContent, BallotPosition, GeneratedBallot } from './types'

// Fisher-Yates shuffle seeded by a string (deterministic per voter).
function seededShuffle<T>(arr: T[], seed: string): T[] {
  const result = [...arr]
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  // Simple seeded PRNG (xorshift32 seeded from fnv hash).
  let state = h >>> 0 || 1
  const rand = () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return ((state >>> 0) / 0xffffffff)
  }
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export interface BuildBallotOptions {
  electionId: string
  voterId?: string
  sessionId?: string
  isSimulation?: boolean
  shuffleCandidates?: boolean // default true; can be disabled for simulation preview
}

export interface BuildBallotResult {
  ballot: GeneratedBallot
  ballotRecord: {
    id: string
    content: string
    integrityToken: string
    digitalSignature: string
    expiresAt: Date
  }
}

/**
 * Build a secure ballot for a voter. This is the ONLY way to create a ballot.
 *
 * Steps:
 * 1. Load election + positions + approved candidates.
 * 2. Filter positions by voter eligibility (scope + voter groups).
 * 3. Shuffle candidates per-voter (seeded).
 * 4. Hash the rules for tamper detection.
 * 5. Compute integrity token + digital signature.
 * 6. Persist the ballot with a 30-minute expiry.
 */
export async function buildBallot(opts: BuildBallotOptions): Promise<BuildBallotResult> {
  const { electionId, voterId, sessionId, isSimulation = false, shuffleCandidates = true } = opts

  const election = await db.electionSession.findUnique({
    where: { id: electionId },
    include: {
      positions: {
        orderBy: { displayOrder: 'asc' },
        include: {
          candidates: {
            where: { status: 'APPROVED', screeningStatus: 'APPROVED' },
            orderBy: { displayOrder: 'asc' },
          },
        },
      },
    },
  })

  if (!election) throw new Error('ELECTION_NOT_FOUND')

  // Load voter if provided (for eligibility filtering).
  let voter: any = null
  if (voterId) {
    voter = await db.voter.findUnique({
      where: { id: voterId },
    })
    if (!voter) throw new Error('VOTER_NOT_FOUND')
  }

  const voterHash = voterId ? hashVoterIdentity(voterId) : hashVoterIdentity(`sim-${electionId}-${Date.now()}`)

  // Filter positions by scope + voter eligibility.
  const eligiblePositions: BallotPosition[] = []
  for (const pos of election.positions) {
    if (pos.candidates.length === 0) continue

    // Scope filtering (skip for simulation — show all positions).
    if (!isSimulation && voter) {
      const scope = pos.scope || 'ORGANIZATION'
      const eligible = isPositionEligible(pos, voter, scope)
      if (!eligible) continue
    }

    // Shuffle candidates per-voter (deterministic).
    const seed = `${voterHash}|${pos.id}`
    const candidates = shuffleCandidates
      ? seededShuffle(pos.candidates, seed)
      : pos.candidates

    eligiblePositions.push({
      positionId: pos.id,
      title: pos.title,
      description: pos.description,
      maximumVotes: pos.maximumVotes || 1,
      scope: pos.scope || 'ORGANIZATION',
      candidates: candidates.map((c) => ({
        id: c.id,
        name: c.fullName,
        photo: c.photoUrl,
        slogan: c.slogan,
        manifesto: c.manifesto,
        politicalGroup: c.politicalPartyId || null,
        biography: c.biography,
      })),
      allowNota: true,
      allowAbstain: false,
    })
  }

  const rulesHash = computeRulesHash({
    positions: election.positions.map((p) => ({
      id: p.id,
      title: p.title,
      maximumVotes: p.maximumVotes || 1,
      candidates: p.candidates.map((c) => ({ id: c.id, fullName: c.fullName, status: c.status })),
    })),
    settings: election.settings,
  })

  const generatedAt = new Date().toISOString()
  const content: BallotContent = {
    electionId: election.id,
    electionName: election.name,
    electionDescription: election.description,
    votingMethod: election.votingMethod || 'Single Choice',
    positions: eligiblePositions,
    rulesHash,
    generatedAt,
  }

  const contentStr = JSON.stringify(content)
  const integrityToken = computeIntegrityToken(contentStr, voterHash, generatedAt)
  const digitalSignature = signBallot(integrityToken)
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000) // 30-minute ballot validity

  // Persist the ballot.
  const ballotRecord = await db.ballot.create({
    data: {
      organizationId: election.organizationId || null,
      electionId: election.id,
      voterId: voterId || null,
      sessionId: sessionId || null,
      content: contentStr,
      integrityToken,
      digitalSignature,
      version: 1,
      expiresAt,
      status: 'GENERATED',
      isSimulation,
    },
  })

  // Compute time remaining for the voter UI.
  const now = Date.now()
  const closesAt = election.endTime.getTime()
  const timeRemainingMs = Math.max(0, closesAt - now)
  const votingOpen = isSimulation || (now >= election.startTime.getTime() && now < election.endTime.getTime())

  const ballot: GeneratedBallot = {
    ballotId: ballotRecord.id,
    content,
    integrityToken,
    digitalSignature,
    version: 1,
    expiresAt: expiresAt.toISOString(),
    isSimulation,
    sessionId,
    voter: {
      fullName: voter ? (voter.fullName || `${voter.firstName || ''} ${voter.lastName || ''}`.trim() || 'Voter') : 'Simulation Voter',
      eligiblePositions: eligiblePositions.length,
    },
    election: {
      name: election.name,
      votingOpen,
      closesAt: election.endTime.toISOString(),
      timeRemainingMs,
    },
  }

  return { ballot, ballotRecord: { id: ballotRecord.id, content: contentStr, integrityToken, digitalSignature, expiresAt } }
}

/**
 * Check if a voter is eligible for a position based on its scope.
 * - UNIVERSITY / ORGANIZATION: all voters
 * - FACULTY / WORKSPACE: voter must belong to the same faculty/workspace
 * - DEPARTMENT / VOTER_GROUP: voter must belong to the same department/group
 */
function isPositionEligible(pos: any, voter: any, scope: string): boolean {
  switch (scope) {
    case 'UNIVERSITY':
    case 'ORGANIZATION':
      return true
    case 'FACULTY':
    case 'WORKSPACE':
      return pos.facultyId ? voter.facultyId === pos.facultyId : true
    case 'DEPARTMENT':
    case 'VOTER_GROUP':
      return pos.departmentId ? voter.departmentId === pos.departmentId : true
    default:
      return true
  }
}
