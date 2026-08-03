import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/workspace/analytics
// Organization-wide Election Analytics Dashboard. Aggregates cross-election
// metrics: overview stats, election comparison, turnout trend, participation
// by status, top elections by turnout, 30-day vote timeline, incident summary,
// and voter engagement. Used by the /workspace/analytics page.
//
// Org is resolved via `requireOrganization` (subdomain / custom domain /
// `?x-vw-org=` query). Returns 404 if no org context is found.
export async function GET(req: NextRequest) {
  // Auth check — closes the endpoint authentication gap (audit finding)
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth) return errorJson('Unauthorized', 401)
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  const now = new Date()

  // ---- Fetch all elections for this org (with related counts) ----
  const elections = await db.electionSession.findMany({
    where: { organizationId: org.id },
    orderBy: { startTime: 'asc' },
    include: {
      _count: {
        select: {
          voters: true,
          candidates: true,
          positions: true,
        },
      },
    },
  })

  // ---- Fetch all incidents for this org ----
  const incidents = await db.electionIncident.findMany({
    where: { organizationId: org.id },
    select: {
      id: true,
      status: true,
      severity: true,
      electionId: true,
      createdAt: true,
    },
  })

  // ---- Fetch all org-scoped voters (engagement metrics) ----
  const voters = await db.voter.findMany({
    where: { organizationId: org.id },
    select: {
      id: true,
      status: true,
      verificationStatus: true,
      hasVoted: true,
    },
  })

  // ---- Fetch vote records (VoteRecord table — org-scoped) for the timeline ----
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const recentVotes = await db.voteRecord.findMany({
    where: {
      organizationId: org.id,
      createdAt: { gte: thirtyDaysAgo },
    },
    select: {
      id: true,
      electionId: true,
      createdAt: true,
      isSimulation: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  // ---- Helpers ----
  function classifyStatus(e: { status: string; startTime: Date; endTime: Date }) {
    if (e.status === 'ARCHIVED' || e.status === 'CANCELLED') return 'archived'
    if (e.status === 'CERTIFIED' || e.status === 'COMPLETED') return 'completed'
    if (e.status === 'LIVE' || (now >= e.startTime && now < e.endTime)) return 'live'
    if (now >= e.endTime) return 'completed'
    if (now < e.startTime) return 'upcoming'
    if (e.status === 'DRAFT' || e.status === 'PENDING_REVIEW' || e.status === 'READY') return 'draft'
    return 'draft'
  }

  function formatDuration(start: Date, end: Date): string {
    const ms = end.getTime() - start.getTime()
    if (ms < 0) return '0h'
    const totalMinutes = Math.floor(ms / 60000)
    const days = Math.floor(totalMinutes / (60 * 24))
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
    const minutes = totalMinutes % 60
    if (days > 0) return `${days}d ${hours}h`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  // ---- Vote counts per election (from VoteRecord, excluding simulations) ----
  const electionIds = elections.map((e) => e.id)
  const voteCountsRaw = await db.voteRecord.groupBy({
    by: ['electionId'],
    where: {
      organizationId: org.id,
      electionId: { in: electionIds },
      isSimulation: false,
    },
    _count: { _all: true },
  })
  const voteCountByElection = new Map<string, number>(
    voteCountsRaw.map((r) => [r.electionId, r._count._all]),
  )

  // ---- Build election comparison array ----
  const electionComparison = elections.map((e) => {
    const eligibleVoters = e._count.voters
    const votesCast = voteCountByElection.get(e.id) || 0
    const turnoutPct = eligibleVoters > 0 ? Math.round((votesCast / eligibleVoters) * 1000) / 10 : 0
    const incidentsCount = incidents.filter((i) => i.electionId === e.id).length
    const status = classifyStatus(e)
    return {
      id: e.id,
      name: e.name,
      status,
      rawStatus: e.status,
      startTime: e.startTime,
      endTime: e.endTime,
      eligibleVoters,
      votesCast,
      turnoutPct,
      positionsCount: e._count.positions,
      candidatesCount: e._count.candidates,
      incidentsCount,
      duration: formatDuration(e.startTime, e.endTime),
    }
  })

  // ---- Overview stats ----
  const totalElections = elections.length
  const totalVoters = voters.length
  const totalVotesCast = electionComparison.reduce((a, e) => a + e.votesCast, 0)

  const completedOrLive = electionComparison.filter((e) => e.status === 'completed' || e.status === 'live')
  const eligibleSum = completedOrLive.reduce((a, e) => a + e.eligibleVoters, 0)
  const votedSum = completedOrLive.reduce((a, e) => a + e.votesCast, 0)
  const avgTurnout = eligibleSum > 0 ? Math.round((votedSum / eligibleSum) * 1000) / 10 : 0

  const mostActive = electionComparison
    .slice()
    .sort((a, b) => b.votesCast - a.votesCast)[0] || null

  // ---- Turnout trend (completed + live, sorted by date) ----
  const turnoutTrend = completedOrLive
    .map((e) => ({
      electionId: e.id,
      name: e.name,
      turnoutPct: e.turnoutPct,
      votesCast: e.votesCast,
      eligibleVoters: e.eligibleVoters,
      date: e.startTime,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  // ---- Participation by status ----
  const participationByStatus = {
    live: electionComparison.filter((e) => e.status === 'live').length,
    upcoming: electionComparison.filter((e) => e.status === 'upcoming').length,
    completed: electionComparison.filter((e) => e.status === 'completed').length,
    draft: electionComparison.filter((e) => e.status === 'draft').length,
    archived: electionComparison.filter((e) => e.status === 'archived').length,
  }

  // ---- Top elections by turnout (top 5 completed) ----
  const topElectionsByTurnout = electionComparison
    .filter((e) => e.status === 'completed' && e.eligibleVoters > 0)
    .sort((a, b) => b.turnoutPct - a.turnoutPct)
    .slice(0, 5)
    .map((e) => ({
      id: e.id,
      name: e.name,
      turnoutPct: e.turnoutPct,
      votesCast: e.votesCast,
      eligibleVoters: e.eligibleVoters,
      startTime: e.startTime,
    }))

  // ---- Vote timeline (votes per day, last 30 days) ----
  const timelineMap = new Map<string, number>()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
    const key = d.toISOString().slice(0, 10) // YYYY-MM-DD
    timelineMap.set(key, 0)
  }
  for (const v of recentVotes) {
    const key = new Date(v.createdAt).toISOString().slice(0, 10)
    if (timelineMap.has(key)) {
      timelineMap.set(key, (timelineMap.get(key) || 0) + 1)
    }
  }
  const voteTimeline = Array.from(timelineMap.entries()).map(([date, count]) => ({
    date,
    count,
  }))

  // ---- Incident summary ----
  const totalIncidents = incidents.length
  const openIncidents = incidents.filter(
    (i) => i.status === 'OPEN' || i.status === 'INVESTIGATING' || i.status === 'ESCALATED',
  ).length
  const criticalIncidents = incidents.filter((i) => i.severity === 'CRITICAL').length
  const resolvedIncidents = incidents.filter(
    (i) => i.status === 'RESOLVED' || i.status === 'DISMISSED',
  ).length
  const resolvedRate = totalIncidents > 0 ? Math.round((resolvedIncidents / totalIncidents) * 100) : 0

  // ---- Voter engagement ----
  const verifiedVoters = voters.filter((v) => v.verificationStatus === 'VERIFIED').length
  const suspendedVoters = voters.filter((v) => v.status === 'SUSPENDED').length
  const activeVoters = voters.filter((v) => v.hasVoted).length

  return json({
    organization: {
      id: org.id,
      name: org.name,
      subdomain: org.subdomain,
      logoUrl: org.logoUrl,
      primaryColour: org.primaryColour,
    },
    overview: {
      totalElections,
      totalVoters,
      totalVotesCast,
      avgTurnout,
      mostActiveElection: mostActive
        ? { id: mostActive.id, name: mostActive.name, votesCast: mostActive.votesCast, turnoutPct: mostActive.turnoutPct }
        : null,
      openIncidents,
      verifiedVoters,
    },
    electionComparison,
    turnoutTrend,
    participationByStatus,
    topElectionsByTurnout,
    voteTimeline,
    incidentSummary: {
      total: totalIncidents,
      open: openIncidents,
      critical: criticalIncidents,
      resolved: resolvedIncidents,
      resolvedRate,
    },
    voterEngagement: {
      totalVoters,
      verifiedVoters,
      suspendedVoters,
      activeVoters,
      pendingVoters: voters.filter((v) => v.verificationStatus === 'PENDING').length,
    },
    generatedAt: now,
  })
}
