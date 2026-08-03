import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { hashVoterIdentity } from '@/lib/sve'
import { getCurrentOfficial } from '@/lib/guards'

export const dynamic = 'force-dynamic'

// GET /api/workspace/voter-portal — Self-service voter portal data.
//
// Returns the authenticated voter's SVE dashboard data:
//   - elections: list of elections in this org with the voter's voting status
//     (eligible | voted | pending) and votedAt timestamp if applicable.
//   - receipts: every VoteRecord matching the voter's hash — but ONLY the
//     receiptCode, electionName, positionTitle, and recordedAt. NEVER the
//     candidateId or encryptedChoice (receipt-anchored anonymity).
//   - timeline: VoterTimelineEvent entries (imported, verified, voted, etc.).
//
// Voter resolution order:
//   1. x-voter-token header (VotingSession.sessionToken) — the real path.
//   2. ?voterId= query param — for demo / admin preview convenience.
export async function GET(req: NextRequest) {
  // Auth check — closes the endpoint authentication gap (audit finding)
  const official = await getCurrentOfficial(req)
  if (!official) return errorJson('Unauthorized', 401)
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  const url = new URL(req.url)
  const voterIdQuery = url.searchParams.get('voterId')
  const voterToken = req.headers.get('x-voter-token')

  let voterId: string | undefined

  // Path 1: resolve from a voting session token.
  if (voterToken) {
    const session = await db.votingSession.findUnique({
      where: { sessionToken: voterToken },
      select: { id: true, voterId: true, organizationId: true, expiresAt: true },
    })
    if (session && session.organizationId === org.id && session.expiresAt > new Date()) {
      voterId = session.voterId
    }
  }

  // Path 2: demo / admin preview — accept ?voterId= directly.
  if (!voterId && voterIdQuery) {
    voterId = voterIdQuery
  }

  if (!voterId) {
    return errorJson('Voter not identified. Provide x-voter-token or voterId.', 401)
  }

  // Load the voter (must belong to this org).
  const voter = await db.voter.findFirst({
    where: { id: voterId, organizationId: org.id },
    select: {
      id: true,
      fullName: true,
      email: true,
      matric: true,
      hasVoted: true,
      votedAt: true,
      status: true,
      verificationStatus: true,
    },
  })
  if (!voter) return errorJson('Voter not found', 404)

  // Fetch every election in this org so we can compute the voter's status.
  const elections = await db.electionSession.findMany({
    where: { organizationId: org.id },
    select: {
      id: true,
      name: true,
      status: true,
      startTime: true,
      endTime: true,
      visibility: true,
    },
    orderBy: { startTime: 'desc' },
  })

  // Look up this voter's vote records across the whole org.
  // voterHash is one-way peppered — used for receipt lookup without exposing
  // the voter ↔ vote link directly.
  const voterHash = hashVoterIdentity(voter.id)

  const voteRecords = await db.voteRecord.findMany({
    where: { voterHash, isSimulation: false },
    select: {
      id: true,
      electionId: true,
      positionId: true,
      receiptCode: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  // Index voted elections + votedAt timestamps by electionId.
  const votedByElection = new Map<string, Date>()
  for (const v of voteRecords) {
    if (!v.electionId) continue
    const existing = votedByElection.get(v.electionId)
    if (!existing || v.createdAt > existing) {
      votedByElection.set(v.electionId, v.createdAt)
    }
  }

  const electionsWithStatus = elections.map((e) => {
    const votedAt = votedByElection.get(e.id)
    const now = new Date()
    const isLive = e.status === 'LIVE' && now >= e.startTime && now < e.endTime
    const isClosed = now >= e.endTime || e.status === 'COMPLETED' || e.status === 'CERTIFIED'
    let status: 'voted' | 'eligible' | 'pending'
    if (votedAt) status = 'voted'
    else if (isLive) status = 'eligible'
    else if (isClosed) status = 'pending' // results pending / closed without vote
    else status = 'eligible' // upcoming — eligible to vote when window opens
    return {
      electionId: e.id,
      name: e.name,
      status: e.status,
      hasVoted: !!votedAt,
      votedAt: votedAt ? votedAt.toISOString() : null,
      eligible: voter.status === 'ACTIVE' && voter.verificationStatus !== 'REJECTED',
      votingOpen: isLive,
      startTime: e.startTime.toISOString(),
      endTime: e.endTime.toISOString(),
      votingStatus: status,
    }
  })

  // Build receipt list — without revealing candidateId.
  // We need election names + position titles; fetch them in one go.
  const electionIds = [...new Set(voteRecords.map((v) => v.electionId).filter(Boolean) as string[])]
  const positionIds = [...new Set(voteRecords.map((v) => v.positionId).filter(Boolean) as string[])]

  const [electionsById, positionsById] = await Promise.all([
    db.electionSession.findMany({
      where: { id: { in: electionIds } },
      select: { id: true, name: true },
    }),
    db.position.findMany({
      where: { id: { in: positionIds } },
      select: { id: true, title: true },
    }),
  ])

  const electionNameMap = new Map(electionsById.map((e) => [e.id, e.name]))
  const positionTitleMap = new Map(positionsById.map((p) => [p.id, p.title]))

  const receipts = voteRecords.map((v) => ({
    receiptCode: v.receiptCode,
    electionName: v.electionId ? (electionNameMap.get(v.electionId) ?? 'Unknown Election') : 'Unknown Election',
    positionTitle: v.positionId ? (positionTitleMap.get(v.positionId) ?? 'Unknown Position') : 'Unknown Position',
    recordedAt: v.createdAt.toISOString(),
  }))

  // Voter timeline events (imported, verified, voted, etc.).
  const timelineRows = await db.voterTimelineEvent.findMany({
    where: { voterId: voter.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      eventType: true,
      description: true,
      actorName: true,
      electionId: true,
      createdAt: true,
    },
  })
  const timeline = timelineRows.map((t) => ({
    id: t.id,
    eventType: t.eventType,
    description: t.description,
    actorName: t.actorName,
    electionId: t.electionId,
    createdAt: t.createdAt.toISOString(),
  }))

  return json({
    voter: {
      id: voter.id,
      fullName: voter.fullName,
      email: voter.email,
      matric: voter.matric,
      hasVoted: voter.hasVoted,
      votedAt: voter.votedAt ? voter.votedAt.toISOString() : null,
      status: voter.status,
      verificationStatus: voter.verificationStatus,
    },
    elections: electionsWithStatus,
    receipts,
    timeline,
  })
}
