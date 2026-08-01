import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson } from '@/lib/election'
import { tallyElection, getLiveStats } from '@/lib/sve'

export const dynamic = 'force-dynamic'

// GET /api/elections/[id]/public-results
//
// PUBLIC endpoint — returns live results for an election if:
//   - The election has visibility "Public", OR
//   - The election status is COMPLETED or CERTIFIED, OR
//   - The election settings have showLiveResults=true
//
// No org context or auth required. Used by the public live results page
// (shareable URL) so anyone can follow an election in real time.
//
// For private elections with hidden results, only aggregate turnout is returned
// (no candidate-level breakdown).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: electionId } = await params

  const election = await db.electionSession.findUnique({
    where: { id: electionId },
    select: {
      id: true, name: true, description: true, status: true,
      organizationId: true, startTime: true, endTime: true,
      visibility: true, settings: true,
      positions: {
        orderBy: { displayOrder: 'asc' },
        select: {
          id: true, title: true, maximumVotes: true, scope: true,
          candidates: {
            where: { status: 'APPROVED', screeningStatus: 'APPROVED' },
            select: { id: true, fullName: true, photoUrl: true, slogan: true, manifesto: true },
            orderBy: { displayOrder: 'asc' },
          },
        },
      },
    },
  })

  if (!election) return errorJson('Election not found', 404)

  const settings = election.settings ? JSON.parse(election.settings) : {}
  const isPublic = election.visibility === 'Public'
  const isCompleted = election.status === 'COMPLETED' || election.status === 'CERTIFIED'
  const showCandidateResults = isPublic || isCompleted || settings.showLiveResults

  // Live stats (turnout + vote counts).
  const stats = await getLiveStats(electionId, true)

  // Only include candidate-level results if allowed.
  let results: any = null
  if (showCandidateResults) {
    results = await tallyElection(electionId, { simulation: false })
  }

  // Get organization name for context.
  let orgName: string | undefined
  if (election.organizationId) {
    const org = await db.organization.findUnique({
      where: { id: election.organizationId },
      select: { name: true, subdomain: true },
    })
    orgName = org?.name
  }

  const now = new Date()
  const isOpen = now >= election.startTime && now < election.endTime && election.status === 'LIVE'
  const timeRemainingMs = Math.max(0, election.endTime.getTime() - now.getTime())

  return json({
    electionId: election.id,
    electionName: election.name,
    description: election.description,
    organizationName: orgName,
    status: election.status,
    visibility: election.visibility,
    isLive: isOpen,
    votingWindow: {
      start: election.startTime.toISOString(),
      end: election.endTime.toISOString(),
    },
    timeRemainingMs,
    showCandidateResults,
    eligibleVoters: stats.eligibleVoters,
    votesCast: stats.votesCast,
    turnoutPct: stats.turnoutPct,
    lastVoteAt: stats.lastVoteAt,
    positions: election.positions.map((p) => ({
      positionId: p.id,
      title: p.title,
      maximumVotes: p.maximumVotes,
      candidates: p.candidates.map((c) => ({
        id: c.id,
        name: c.fullName,
        photo: c.photoUrl,
        slogan: c.slogan,
        manifesto: showCandidateResults ? c.manifesto : null, // hide manifesto if results hidden
      })),
      // Include vote counts only if results are visible.
      results: showCandidateResults && results
        ? results.resultsByPosition.find((r: any) => r.positionId === p.id)?.results || []
        : null,
    })),
    verification: showCandidateResults && results ? {
      auditHash: results.auditHash,
      integritySignature: results.integritySignature,
      totalVotes: results.totalVotes,
      turnoutPct: results.turnoutPct,
    } : null,
  })
}
