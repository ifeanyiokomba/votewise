// VoteWise — SVE Simulation Module (Chapter 10)
//
// Ballot Preview & Simulation. Before an election goes live, administrators
// can simulate the entire voting process:
//
//   Preview Ballot → Cast Test Vote → Review Results → Reset Simulation
//
// All simulation records are marked isSimulation=true and do NOT affect real
// results. This lets organizations verify:
// - Ballot layout + candidate order
// - Voting rules + eligibility
// - Result calculations
// - Notification flows
// - Observer dashboards
//
// resetSimulation() deletes all simulation vote records + ballots for an
// election, allowing a clean re-run.

import { db } from '@/lib/db'
import { buildBallot } from './ballot-builder'
import { castVote } from './vote-recorder'
import { tallyElection } from './tally'
import type { SimulationResult } from './types'

/**
 * Run a full simulation: generate a simulation ballot, cast a test vote with
 * the provided selections, and return the simulated results.
 */
export async function runSimulation(
  electionId: string,
  selections: Record<string, string | string[]>,
): Promise<SimulationResult> {
  // Generate a simulation ballot (no voter, no session).
  const { ballot } = await buildBallot({
    electionId,
    isSimulation: true,
    shuffleCandidates: false, // show natural order in preview
  })

  // Cast a simulation vote.
  const result = await castVote({
    ballotId: ballot.ballotId,
    selections,
    isSimulation: true,
  })

  // Tally simulation results (decrypt + count).
  const tally = await tallyElection(electionId, { simulation: true })

  return {
    ballotId: ballot.ballotId,
    receipts: result.receipts,
    results: tally.resultsByPosition.map((p) => ({
      positionId: p.positionId,
      title: p.title,
      candidates: p.results
        .filter((r) => r.candidateId !== null)
        .map((r) => ({ name: r.candidateName, votes: r.votes, percentage: r.percentage })),
    })),
    resetSupported: true,
  }
}

/**
 * Reset all simulation data for an election. Marks simulation ballots +
 * vote records as ARCHIVED (immutable — never deletes). Real data is
 * never touched.
 *
 * Per Part 5 spec: "No update operation should exist for a recorded ballot."
 * However, simulation data is NOT a real recorded ballot — it's test data
 * flagged with isSimulation=true. We mark it as ARCHIVED rather than
 * deleting, preserving immutability for audit purposes while still
 * clearing it from active results.
 */
export async function resetSimulation(electionId: string): Promise<{ archivedBallots: number; archivedVotes: number }> {
  // Archive simulation vote records (never delete — immutability principle)
  const archivedVotes = await db.voteRecord.updateMany({
    where: { electionId, isSimulation: true, isArchived: false },
    data: { isArchived: true },
  }).catch(() => ({ count: 0 }))
  const archivedBallots = await db.ballot.updateMany({
    where: { electionId, isSimulation: true },
    data: { status: 'ARCHIVED' },
  }).catch(() => ({ count: 0 }))
  return { archivedBallots: archivedBallots.count, archivedVotes: archivedVotes.count }
}

/**
 * Get a preview ballot for an election without casting a vote. Used by the
 * admin "Preview Ballot" button to show what voters will see.
 */
export async function previewBallot(electionId: string) {
  const { ballot } = await buildBallot({
    electionId,
    isSimulation: true,
    shuffleCandidates: false,
  })
  return ballot
}

/**
 * List all simulation runs for an election (for audit / review).
 */
export async function listSimulations(electionId: string) {
  const ballots = await db.ballot.findMany({
    where: { electionId, isSimulation: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true,
      createdAt: true,
      expiresAt: true,
      status: true,
      _count: { select: { /* no relation defined; count via VoteRecord separately */ } },
    },
  })
  // Enrich with vote counts.
  const enriched = await Promise.all(
    ballots.map(async (b) => ({
      ...b,
      voteCount: await db.voteRecord.count({ where: { ballotId: b.id, isSimulation: true } }),
    })),
  )
  return enriched
}
