// VoteWise — SVE Live Counter (Chapter 10)
//
// In-memory cache for real-time vote counts + turnout. Avoids hitting the
// database on every "how many votes so far?" query. The cache is invalidated
// on every vote cast and refreshed from the DB on demand (TTL 5s).
//
// This is the read path. The write path (vote-recorder.ts) calls
// incrementLiveCount() after each successful vote, which bumps the in-memory
// counter and notifies the WebSocket service to broadcast to observers.

import { db } from '@/lib/db'

interface LiveStats {
  electionId: string
  eligibleVoters: number
  votesCast: number // unique voters who voted
  ballotRecords: number // total vote records (positions × voters)
  turnoutPct: number
  lastVoteAt?: string
  lastUpdated: number
}

const cache = new Map<string, LiveStats>()
const TTL_MS = 5_000 // 5 seconds

/**
 * Get live stats for an election. Uses cache if fresh; otherwise recomputes
 * from the database. This is the read path used by observer dashboards +
 * the public live turnout view.
 */
export async function getLiveStats(electionId: string, force = false): Promise<LiveStats> {
  const cached = cache.get(electionId)
  const now = Date.now()
  if (!force && cached && now - cached.lastUpdated < TTL_MS) {
    return cached
  }

  // Recompute from DB.
  const election = await db.electionSession.findUnique({
    where: { id: electionId },
    select: { id: true, name: true },
  })
  if (!election) {
    return {
      electionId,
      eligibleVoters: 0,
      votesCast: 0,
      ballotRecords: 0,
      turnoutPct: 0,
      lastUpdated: now,
    }
  }

  // Eligible voters = all voters in the org's master registry (non-simulation).
  // In a production system this would be the AccreditationRule-evaluated set;
  // for the cache we use the total voter count as an upper bound.
  const eligibleVoters = await db.voter.count({
    where: {
      OR: [
        { electionSessionId: electionId },
        { organizationId: await getElectionOrgId(electionId) },
      ],
      status: { not: 'SUSPENDED' },
      flagged: { not: true },
    },
  })

  const ballotRecords = await db.voteRecord.count({
    where: { electionId, isSimulation: false },
  })

  // Unique voters who voted = distinct voterHash values.
  const votedHashes = await db.voteRecord.findMany({
    where: { electionId, isSimulation: false },
    select: { voterHash: true, createdAt: true },
    distinct: ['voterHash'],
    orderBy: { createdAt: 'desc' },
  })
  const votesCast = votedHashes.length
  const lastVoteAt = votedHashes[0]?.createdAt?.toISOString()

  const turnoutPct = eligibleVoters > 0 ? (votesCast / eligibleVoters) * 100 : 0

  const stats: LiveStats = {
    electionId,
    eligibleVoters,
    votesCast,
    ballotRecords,
    turnoutPct: Math.round(turnoutPct * 100) / 100,
    lastVoteAt,
    lastUpdated: now,
  }
  cache.set(electionId, stats)
  return stats
}

async function getElectionOrgId(electionId: string): Promise<string | undefined> {
  const e = await db.electionSession.findUnique({
    where: { id: electionId },
    select: { organizationId: true },
  })
  return e?.organizationId || undefined
}

/**
 * Increment the in-memory count after a vote is cast. Best-effort — if it
 * fails, the next getLiveStats() call will recompute from DB.
 */
export async function incrementLiveCount(electionId: string, recordsAdded: number, isSimulation: boolean): Promise<void> {
  if (isSimulation) return // simulations don't affect real counts
  const cached = cache.get(electionId)
  if (cached) {
    cached.ballotRecords += recordsAdded
    cached.votesCast += 1 // one voter voted (regardless of how many positions)
    cached.lastVoteAt = new Date().toISOString()
    cached.lastUpdated = Date.now()
    if (cached.eligibleVoters > 0) {
      cached.turnoutPct = Math.round((cached.votesCast / cached.eligibleVoters) * 10000) / 100
    }
    cache.set(electionId, cached)
  }
  // Notify the WebSocket service (best-effort, non-blocking).
  notifyWebSocket(electionId, cached).catch(() => {})
}

/**
 * Get live stats for ALL elections (used by the observer global view).
 */
export async function getAllLiveStats(): Promise<LiveStats[]> {
  const elections = await db.electionSession.findMany({
    where: { status: { in: ['LIVE', 'PAUSED', 'COMPLETED'] } },
    select: { id: true },
  })
  return Promise.all(elections.map((e) => getLiveStats(e.id)))
}

/**
 * Clear the cache for an election (used after tally / certification).
 */
export function clearLiveCache(electionId: string): void {
  cache.delete(electionId)
}

// ---------------------------------------------------------------------------
// WebSocket notification (best-effort HTTP push to the results service).
// The results service on port 3030 then broadcasts to all subscribers.
// ---------------------------------------------------------------------------
async function notifyWebSocket(electionId: string, stats?: LiveStats): Promise<void> {
  // The mini-service has an internal HTTP endpoint on port 3031 that triggers
  // an immediate broadcast to the election's WebSocket room (no 2s wait).
  try {
    await fetch(`http://localhost:3031/internal/bump?electionId=${electionId}`, {
      method: 'POST',
      signal: AbortSignal.timeout(2000),
    }).catch(() => {})
  } catch {
    // Best-effort — the service will re-read on its next poll interval.
  }
}
