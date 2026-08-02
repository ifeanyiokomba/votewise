import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { verifyElectionAuditChain } from '@/lib/sve'

export const dynamic = 'force-dynamic'

// POST /api/workspace/elections/compare
// Side-by-side comparison of 2–5 elections within the same organization.
//
// Body: { electionIds: string[] }  (max 5, min 2 enforced client-side but
// the server also clamps to [1..5] to be defensive).
//
// For each election, returns:
//   - Basic info: id, name, status, category, electionType, votingMethod,
//     visibility, startTime, endTime, duration (hours)
//   - Participation: eligibleVoters, votesCast, turnoutPct, uniqueVoters
//   - Structure: positionsCount, candidatesCount, avgCandidatesPerPosition
//   - Integrity: isCertified, hasVerificationPackage, auditLogCount,
//     chainIntact (boolean)
//   - Incidents: totalIncidents, openIncidents, criticalIncidents
//   - Results summary: winners per position (if results are visible) +
//     marginOfVictoryPct for the closest position
//   - Timeline: firstVoteAt, lastVoteAt, votingDurationHours
//
// Returns: { comparisons: [...], summary: {...} }

function classifyStatus(e: { status: string; startTime: Date; endTime: Date }) {
  const now = new Date()
  if (e.status === 'ARCHIVED' || e.status === 'CANCELLED') return 'archived'
  if (e.status === 'CERTIFIED' || e.status === 'COMPLETED') return 'completed'
  if (e.status === 'LIVE' || (now >= e.startTime && now < e.endTime)) return 'live'
  if (now >= e.endTime) return 'completed'
  if (now < e.startTime) return 'upcoming'
  return 'draft'
}

function hoursBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime()
  if (ms <= 0) return 0
  return Math.round((ms / 3600000) * 10) / 10
}

function formatDuration(start: Date, end: Date): string {
  const ms = end.getTime() - start.getTime()
  if (ms <= 0) return '0h'
  const totalMinutes = Math.floor(ms / 60000)
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export async function POST(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  const body = await req.json().catch(() => ({}))
  const rawIds = Array.isArray(body?.electionIds) ? body.electionIds : []
  // De-dup + clamp to 5.
  const electionIds = Array.from(new Set(rawIds.map((s: unknown) => String(s)))).slice(0, 5)

  if (electionIds.length === 0) {
    return errorJson('At least one electionId is required', 400)
  }

  // Fetch all selected elections (org-scoped).
  const elections = await db.electionSession.findMany({
    where: {
      id: { in: electionIds },
      organizationId: org.id,
    },
    include: {
      positions: {
        orderBy: { displayOrder: 'asc' },
        include: {
          candidates: {
            where: { status: 'APPROVED' },
            select: { id: true, fullName: true },
          },
        },
      },
      _count: { select: { voters: true, candidates: true, auditLogs: true } },
    },
  })

  if (elections.length === 0) {
    return errorJson('No matching elections found in this organization', 404)
  }

  // ElectionVerification has no Prisma back-relation on ElectionSession (the
  // FK is `electionId`, not `electionSessionId`), so we look it up separately.
  const verifications = await db.electionVerification.findMany({
    where: { electionId: { in: electionIds } },
    select: {
      electionId: true,
      id: true,
      auditHash: true,
      integritySignature: true,
      turnoutPct: true,
      totalVotes: true,
      totalEligible: true,
      generatedAt: true,
    },
  })
  const verificationByElection = new Map(verifications.map((v) => [v.electionId, v]))

  // Order results to match the input order (so the user sees their selection
  // in the order they picked it).
  const byId = new Map(elections.map((e) => [e.id, e]))
  const ordered = electionIds.map((id) => byId.get(id)).filter(Boolean) as typeof elections

  // Fetch vote records (non-simulation) per election in one query.
  const allVotes = await db.voteRecord.findMany({
    where: {
      electionId: { in: ordered.map((e) => e.id) },
      isSimulation: false,
    },
    select: {
      electionId: true,
      positionId: true,
      candidateId: true,
      voterHash: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  // Fetch incidents per election in one query.
  const allIncidents = await db.electionIncident.findMany({
    where: { electionId: { in: ordered.map((e) => e.id) } },
    select: { electionId: true, status: true, severity: true },
  })

  // Group votes by election.
  const votesByElection = new Map<string, typeof allVotes>()
  for (const v of allVotes) {
    const arr = votesByElection.get(v.electionId || '') || []
    arr.push(v)
    votesByElection.set(v.electionId || '', arr)
  }

  // Group incidents by election.
  const incidentsByElection = new Map<string, typeof allIncidents>()
  for (const i of allIncidents) {
    const arr = incidentsByElection.get(i.electionId || '') || []
    arr.push(i)
    incidentsByElection.set(i.electionId || '', arr)
  }

  // Pre-compute audit chain integrity per election (parallel, bounded to 5).
  const chainResults = await Promise.all(
    ordered.map(async (e) => {
      try {
        const r = await verifyElectionAuditChain(e.id)
        return { electionId: e.id, intact: r.intact, totalChecked: r.totalChecked }
      } catch {
        return { electionId: e.id, intact: false, totalChecked: 0 }
      }
    }),
  )
  const chainByElection = new Map(chainResults.map((c) => [c.electionId, c]))

  // Build per-election comparison objects.
  const comparisons = ordered.map((e) => {
    const votes = votesByElection.get(e.id) || []
    const incidents = incidentsByElection.get(e.id) || []

    const eligibleVoters = e._count.voters
    const uniqueVoterHashes = new Set(votes.map((v) => v.voterHash))
    const uniqueVoters = uniqueVoterHashes.size
    // votesCast = total vote records (one per position cast). For turnout we
    // use uniqueVoters so a voter who cast all positions isn't counted N times.
    const votesCast = votes.length
    const turnoutPct = eligibleVoters > 0
      ? Math.round((uniqueVoters / eligibleVoters) * 1000) / 10
      : 0

    const positionsCount = e.positions.length
    const candidatesCount = e._count.candidates
    const avgCandidatesPerPosition = positionsCount > 0
      ? Math.round((candidatesCount / positionsCount) * 10) / 10
      : 0

    const isCertified = e.status === 'CERTIFIED'
    const hasVerificationPackage = !!verificationByElection.get(e.id)
    const auditLogCount = e._count.auditLogs
    const chainIntact = chainByElection.get(e.id)?.intact ?? false

    const totalIncidents = incidents.length
    const openIncidents = incidents.filter(
      (i) => i.status === 'OPEN' || i.status === 'INVESTIGATING' || i.status === 'ESCALATED',
    ).length
    const criticalIncidents = incidents.filter((i) => i.severity === 'CRITICAL').length

    // Timeline (first/last vote timestamps).
    const firstVoteAt = votes.length > 0 ? votes[0].createdAt : null
    const lastVoteAt = votes.length > 0 ? votes[votes.length - 1].createdAt : null
    const votingDurationHours = firstVoteAt && lastVoteAt
      ? hoursBetween(new Date(firstVoteAt), new Date(lastVoteAt))
      : 0

    // Results visibility — winners are only returned if results are public.
    const settings = e.settings ? JSON.parse(e.settings) : {}
    const resultsVisible =
      settings.showLiveResults === true ||
      e.status === 'COMPLETED' ||
      e.status === 'CERTIFIED' ||
      e.visibility === 'Public'

    // Compute winners per position directly from VoteRecord.candidateId.
    // Post-certify the candidateId is mirrored on the vote row, so we don't
    // need to decrypt here. (Pre-certify live results rely on the mirrored
    // candidateId written at cast time too — see vote-recorder.)
    let winners: Array<{
      positionId: string
      positionTitle: string
      winnerId: string | null
      winnerName: string
      votes: number
      totalVotes: number
      pct: number
    }> = []
    let closestMarginPct: number | null = null

    if (resultsVisible && positionsCount > 0) {
      for (const pos of e.positions) {
        const posVotes = votes.filter((v) => v.positionId === pos.id)
        const counts = new Map<string, number>()
        let notaCount = 0
        for (const v of posVotes) {
          if (v.candidateId) {
            counts.set(v.candidateId, (counts.get(v.candidateId) || 0) + 1)
          } else {
            notaCount++
          }
        }
        const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])
        const top = sorted[0]
        const second = sorted[1]
        const winnerCand = top ? pos.candidates.find((c) => c.id === top[0]) : null
        const totalVotes = posVotes.length
        const pct = totalVotes > 0 && top ? Math.round((top[1] / totalVotes) * 10000) / 100 : 0
        const winnerName = winnerCand?.fullName
          || (notaCount > 0 && (!top || top[1] < notaCount) ? 'None of the Above' : 'No winner')
        winners.push({
          positionId: pos.id,
          positionTitle: pos.title,
          winnerId: top ? top[0] : null,
          winnerName,
          votes: top ? top[1] : 0,
          totalVotes,
          pct,
        })
        // Margin of victory (percentage points) for this position.
        if (top) {
          const secondVotes = second ? second[1] : 0
          const margin = totalVotes > 0 ? Math.round(((top[1] - secondVotes) / totalVotes) * 10000) / 100 : 0
          if (closestMarginPct === null || margin < closestMarginPct) {
            closestMarginPct = margin
          }
        }
      }
    }

    return {
      id: e.id,
      name: e.name,
      status: classifyStatus(e),
      rawStatus: e.status,
      category: e.category || null,
      electionType: e.electionType || null,
      votingMethod: e.votingMethod || null,
      visibility: e.visibility,
      startTime: e.startTime,
      endTime: e.endTime,
      durationHours: hoursBetween(e.startTime, e.endTime),
      durationLabel: formatDuration(e.startTime, e.endTime),
      // Participation
      eligibleVoters,
      votesCast,
      turnoutPct,
      uniqueVoters,
      // Structure
      positionsCount,
      candidatesCount,
      avgCandidatesPerPosition,
      // Integrity
      isCertified,
      hasVerificationPackage,
      auditLogCount,
      chainIntact,
      // Incidents
      totalIncidents,
      openIncidents,
      criticalIncidents,
      // Results
      resultsVisible,
      winners,
      closestMarginPct,
      // Timeline
      firstVoteAt,
      lastVoteAt,
      votingDurationHours,
    }
  })

  // ---- Summary across all selected elections ----
  const totalElections = comparisons.length
  const totalVotes = comparisons.reduce((a, c) => a + c.votesCast, 0)
  const totalEligible = comparisons.reduce((a, c) => a + c.eligibleVoters, 0)
  const avgTurnout = totalEligible > 0
    ? Math.round((comparisons.reduce((a, c) => a + c.uniqueVoters, 0) / totalEligible) * 1000) / 10
    : 0
  const turnouts = comparisons.map((c) => c.turnoutPct).filter((t) => t > 0)
  const bestTurnout = turnouts.length > 0 ? Math.max(...turnouts) : 0
  const worstTurnout = turnouts.length > 0 ? Math.min(...turnouts) : 0

  return json({
    comparisons,
    summary: {
      totalElections,
      avgTurnout,
      totalVotes,
      totalEligible,
      bestTurnout,
      worstTurnout,
    },
  })
}
