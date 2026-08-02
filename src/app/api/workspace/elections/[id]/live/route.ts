import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { getLiveStats } from '@/lib/sve'

export const dynamic = 'force-dynamic'

// GET /api/workspace/elections/[id]/live — Live monitoring stats for an election.
//
// Used by the observer live view + admin command center. Returns:
// - eligibleVoters, votesCast, turnoutPct, invalidVotes, blankVotes
// - votesByPosition (per-position counts)
// - votesByCandidate (per-candidate counts — only if results are visible)
// - recentActivity (last 20 timeline events)
// - systemHealth (uptime, active sessions, ballots generated)
//
// Observers never see ballots. They see aggregate transparency metrics.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  const { id: electionId } = await params
  const election = await db.electionSession.findUnique({
    where: { id: electionId },
    select: {
      id: true, name: true, status: true, organizationId: true,
      startTime: true, endTime: true, settings: true, visibility: true,
    },
  })
  if (!election || election.organizationId !== org.id) {
    return errorJson('Election not found', 404)
  }

  const stats = await getLiveStats(electionId, true) // force refresh

  // Per-position vote counts (aggregate — no candidate breakdown unless results visible).
  const positions = await db.position.findMany({
    where: { electionSessionId: electionId },
    select: { id: true, title: true },
    orderBy: { displayOrder: 'asc' },
  })
  const votesByPosition = await Promise.all(
    positions.map(async (p) => ({
      positionId: p.id,
      title: p.title,
      count: await db.voteRecord.count({ where: { electionId, positionId: p.id, isSimulation: false } }),
    })),
  )

  // Per-candidate counts — only if live results are enabled OR election is completed.
  const settings = election.settings ? JSON.parse(election.settings) : {}
  const showCandidateResults = settings.showLiveResults || election.status === 'COMPLETED' || election.status === 'CERTIFIED'
  let votesByCandidate: any[] = []
  if (showCandidateResults) {
    const candidates = await db.candidate.findMany({
      where: { electionSessionId: electionId, status: 'APPROVED' },
      select: { id: true, fullName: true, positionId: true, photoUrl: true },
    })
    votesByCandidate = await Promise.all(
      candidates.map(async (c) => ({
        positionId: c.positionId,
        candidateId: c.id,
        candidateName: c.fullName,
        photo: c.photoUrl,
        count: await db.voteRecord.count({ where: { electionId, candidateId: c.id, isSimulation: false } }),
      })),
    )
  }

  // Recent activity (timeline events).
  const recentActivity = await db.electionEvent.findMany({
    where: { electionId },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { eventType: true, description: true, createdAt: true, actorName: true },
  })

  // Active sessions count.
  const activeSessions = await db.votingSession.count({
    where: { electionId, hasVoted: false, expiresAt: { gt: new Date() } },
  })

  // Ballots generated (total).
  const ballotsGenerated = await db.ballot.count({
    where: { electionId, isSimulation: false },
  })

  return json({
    electionId,
    electionName: election.name,
    status: election.status,
    eligibleVoters: stats.eligibleVoters,
    votesCast: stats.votesCast,
    turnoutPct: stats.turnoutPct,
    invalidVotes: 0, // computed during tally
    blankVotes: 0,
    lastVoteAt: stats.lastVoteAt,
    votesByPosition,
    votesByCandidate,
    recentActivity: recentActivity.map((a) => ({
      type: a.eventType,
      timestamp: a.createdAt.toISOString(),
      description: a.description,
      actor: a.actorName,
    })),
    systemHealth: {
      activeSessions,
      ballotsGenerated,
      errorsToday: 0,
    },
    showCandidateResults,
    votingWindow: {
      start: election.startTime.toISOString(),
      end: election.endTime.toISOString(),
    },
  })
}
