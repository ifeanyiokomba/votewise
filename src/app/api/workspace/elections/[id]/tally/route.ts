import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson, getClientIp } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { tallyElection, persistVerification } from '@/lib/sve'
import { requirePermission } from '@/lib/iam'

export const dynamic = 'force-dynamic'

// POST /api/workspace/elections/[id]/tally — Tally + lock ballots + generate verification.
//
// After voting closes, the electoral committee tallies the results:
//   Voting Closed → Lock Ballots → Count Votes → Validate Totals
//                → Generate Results → Generate Verification Package
//
// This decrypts all stored choices (AES-256-GCM), aggregates per candidate,
// detects ties, and produces a signed verification package (auditHash +
// integritySignature). Never counts while ballots are still changing.
//
// Requires: election.certify permission (org owner / admin).
// Body: { tieStrategy?: 'RUNOFF' | 'MANUAL' | 'SHARED' | 'COIN_TOSS' }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePermission(req, 'election.certify')
  if ('error' in ctx) return ctx.error

  const { id: electionId } = await params
  const election = await db.electionSession.findUnique({
    where: { id: electionId },
    select: { id: true, organizationId: true, status: true, name: true, endTime: true },
  })
  if (!election) return errorJson('Election not found', 404)
  if (election.organizationId !== ctx.org?.id) return errorJson('Election not found', 404)

  // Election must be closed (or force tally for testing).
  const now = new Date()
  const body = await req.json().catch(() => ({}))
  const force = body.force === true
  if (!force && now < election.endTime && election.status === 'LIVE') {
    return errorJson('Voting is still open. Close the election before tallying.', 403)
  }

  const tieStrategy = body.tieStrategy || 'SHARED'
  const tally = await tallyElection(electionId, { tieStrategy })
  await persistVerification(electionId, tally)

  // Transition election to COMPLETED (if not already).
  if (election.status === 'LIVE' || election.status === 'PAUSED') {
    await db.electionSession.update({
      where: { id: electionId },
      data: { status: 'COMPLETED' },
    })
    await db.electionEvent.create({
      data: {
        electionId,
        organizationId: election.organizationId,
        eventType: 'RESULTS_GENERATED',
        description: `Results tallied: ${tally.totalVotes} votes, ${tally.turnoutPct}% turnout`,
        actorId: ctx.user.id,
        actorName: ctx.user.name,
        metadata: JSON.stringify({ auditHash: tally.auditHash, tieStrategy }),
      },
    })
  }

  return json({
    ok: true,
    tally,
    message: `Results tallied. ${tally.totalVotes} votes counted, ${tally.turnoutPct}% turnout. Verification package generated.`,
  })
}

// GET /api/workspace/elections/[id]/tally — Get current tally (read-only).
// Returns the live tally without locking. Safe to call during voting.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  const { id: electionId } = await params
  const election = await db.electionSession.findUnique({
    where: { id: electionId },
    select: { id: true, organizationId: true, status: true, settings: true },
  })
  if (!election || election.organizationId !== org.id) {
    return errorJson('Election not found', 404)
  }

  // Only show candidate-level results if live results enabled or election completed.
  const settings = election.settings ? JSON.parse(election.settings) : {}
  const showResults = settings.showLiveResults || election.status === 'COMPLETED' || election.status === 'CERTIFIED'

  if (!showResults) {
    const stats = await import('@/lib/sve').then((m) => m.getLiveStats(electionId))
    return json({
      electionId,
      status: election.status,
      eligibleVoters: (await stats).eligibleVoters,
      votesCast: (await stats).votesCast,
      turnoutPct: (await stats).turnoutPct,
      message: 'Results are hidden until voting closes. Showing aggregate turnout only.',
    })
  }

  const tally = await tallyElection(electionId, { tieStrategy: 'SHARED' })
  return json(tally)
}
