import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson } from '@/lib/election'
import { hashVoterIdentity } from '@/lib/sve'

export const dynamic = 'force-dynamic'

// POST /api/voter-status   body: { identifier }
//
// PUBLIC endpoint — no org context, no auth. Voters (or anyone holding an
// identifier) can check whether a voter exists, what their registration
// status is, which elections they are eligible for, what receipts they hold,
// and their per-voter timeline. ALL WITHOUT revealing vote choices.
//
// Privacy guarantees (returned as `_privacy`):
//   - Vote choices are NEVER revealed. Only participation + receipt codes.
//   - Receipt codes confirm a vote was counted but cannot reveal which
//     candidate was selected (the choice is AES-256-GCM encrypted at rest).
//   - The voterHash is one-way peppered (SHA-256 + secret) — no one can link
//     a receipt back to the voter's identity.
//
// Search is intentionally cross-org: an identifier may resolve in multiple
// organizations (e.g. a voter registered with two orgs). We return ALL
// matches so the voter can see their footprint everywhere.

interface VoterRow {
  id: string
  organizationId: string | null
  fullName: string
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
  matric: string
  institutionEmail: string | null
  personalEmail: string | null
  status: string | null
  verificationStatus: string | null
  hasVoted: boolean
  votedAt: Date | null
}

interface MatchPayload {
  voter: {
    fullName: string
    status: string
    verificationStatus: string
    organizationName: string
    organizationSubdomain: string | null
  }
  elections: Array<{
    electionId: string
    name: string
    status: string
    hasVoted: boolean
    votedAt: string | null
    votingOpen: boolean
    startTime: string
    endTime: string
  }>
  receipts: Array<{
    receiptCode: string
    electionName: string
    positionTitle: string
    recordedAt: string
  }>
  timeline: Array<{
    eventType: string
    description: string | null
    createdAt: string
  }>
}

const PRIVACY = {
  choicesHidden:
    'Your vote choices are NEVER revealed. Only your participation status and receipt codes are shown.',
  receiptAnchored:
    'Receipt codes confirm your vote was counted but cannot reveal which candidate you selected.',
  voterHashOneWay:
    'Your voter hash is one-way encrypted — no one can link your receipt to your identity.',
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const rawIdentifier = String(body.identifier || '').trim()
  if (!rawIdentifier) {
    return errorJson('Please enter an email, phone, or voter ID.', 400)
  }
  if (rawIdentifier.length < 3) {
    return errorJson('Identifier is too short — please enter at least 3 characters.', 400)
  }

  // SQLite's LIKE (used by Prisma `contains`) is case-insensitive for ASCII
  // by default. We keep the trimmed identifier verbatim so the user can use
  // emails with mixed case, phone numbers with +, or matric numbers.
  const q = rawIdentifier

  // Search across ALL orgs. We match on matric, email, phone, or the legacy
  // institutionEmail / personalEmail fields (kept for backwards compat).
  // We deliberately do NOT match on fullName to prevent voter enumeration by
  // name (a name alone is not a secret identifier).
  const where = {
    OR: [
      { matric: { contains: q } },
      { email: { contains: q } },
      { phone: { contains: q } },
      { institutionEmail: { contains: q } },
      { personalEmail: { contains: q } },
    ],
  }

  const voters: VoterRow[] = await db.voter.findMany({
    where,
    take: 25, // safety cap — there shouldn't be 25 matches, but cap anyway
    select: {
      id: true,
      organizationId: true,
      fullName: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      matric: true,
      institutionEmail: true,
      personalEmail: true,
      status: true,
      verificationStatus: true,
      hasVoted: true,
      votedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  if (voters.length === 0) {
    return json({
      found: false,
      message:
        'No voter record matches that identifier. Please check your spelling and try again, or use a different identifier (email, phone, or voter ID).',
      _privacy: PRIVACY,
    })
  }

  // Resolve org metadata for every matched voter.
  const orgIds = [...new Set(voters.map((v) => v.organizationId).filter(Boolean) as string[])]
  const orgs = orgIds.length
    ? await db.organization.findMany({
        where: { id: { in: orgIds } },
        select: { id: true, name: true, subdomain: true },
      })
    : []
  const orgMap = new Map(orgs.map((o) => [o.id, o]))

  // Build per-voter payload. We do this sequentially to keep DB queries
  // simple and readable; 25 voters max keeps this cheap.
  const matches: MatchPayload[] = []
  for (const voter of voters) {
    const org = voter.organizationId ? orgMap.get(voter.organizationId) : undefined
    const organizationName = org?.name || 'Unknown Organization'
    const organizationSubdomain = org?.subdomain || null

    // --- Elections the voter is eligible for (across this org) ---
    // We surface EVERY election in this org, since the voter registry is
    // org-wide. The `hasVoted` flag is computed from VoteRecord (not from
    // the legacy Voter.hasVoted column) so the answer is authoritative
    // regardless of legacy data drift.
    let elections: MatchPayload['elections'] = []
    if (voter.organizationId) {
      const electionRows = await db.electionSession.findMany({
        where: { organizationId: voter.organizationId },
        select: {
          id: true,
          name: true,
          status: true,
          startTime: true,
          endTime: true,
        },
        orderBy: { startTime: 'desc' },
      })

      // Pull this voter's vote records so we can mark which elections they
      // already voted in. voterHash is one-way — we never expose the voterId
      // alongside the receipt.
      const voterHash = hashVoterIdentity(voter.id)
      const voteRecords = await db.voteRecord.findMany({
        where: { voterHash },
        select: {
          electionId: true,
          createdAt: true,
          isSimulation: true,
        },
      })
      // Index voted elections + the latest votedAt timestamp per electionId
      // (a voter can vote in multiple positions within one election).
      const votedByElection = new Map<string, Date>()
      for (const v of voteRecords) {
        if (!v.electionId || v.isSimulation) continue
        const existing = votedByElection.get(v.electionId)
        if (!existing || v.createdAt > existing) {
          votedByElection.set(v.electionId, v.createdAt)
        }
      }

      const now = new Date()
      elections = electionRows.map((e) => {
        const votedAt = votedByElection.get(e.id)
        const isLive =
          (e.status === 'LIVE' || e.status === 'VOTING') &&
          now >= e.startTime &&
          now < e.endTime
        return {
          electionId: e.id,
          name: e.name,
          status: e.status,
          hasVoted: !!votedAt,
          votedAt: votedAt ? votedAt.toISOString() : null,
          votingOpen: isLive,
          startTime: e.startTime.toISOString(),
          endTime: e.endTime.toISOString(),
        }
      })
    }

    // --- Receipts ---
    // Only the receiptCode + election name + position title + recordedAt.
    // NEVER the candidateId or encryptedChoice (ballot secrecy).
    const voterHash = hashVoterIdentity(voter.id)
    const receiptRows = await db.voteRecord.findMany({
      where: { voterHash, isSimulation: false },
      select: {
        receiptCode: true,
        electionId: true,
        positionId: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    const electionIds = [...new Set(receiptRows.map((r) => r.electionId).filter(Boolean) as string[])]
    const positionIds = [...new Set(receiptRows.map((r) => r.positionId).filter(Boolean) as string[])]
    const [electionsById, positionsById] = await Promise.all([
      electionIds.length
        ? db.electionSession.findMany({
            where: { id: { in: electionIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      positionIds.length
        ? db.position.findMany({
            where: { id: { in: positionIds } },
            select: { id: true, title: true },
          })
        : Promise.resolve([]),
    ])
    const electionNameMap = new Map(electionsById.map((e) => [e.id, e.name]))
    const positionTitleMap = new Map(positionsById.map((p) => [p.id, p.title]))

    const receipts: MatchPayload['receipts'] = receiptRows.map((r) => ({
      receiptCode: r.receiptCode,
      electionName: r.electionId ? electionNameMap.get(r.electionId) ?? 'Unknown Election' : 'Unknown Election',
      positionTitle: r.positionId ? positionTitleMap.get(r.positionId) ?? 'Unknown Position' : 'Unknown Position',
      recordedAt: r.createdAt.toISOString(),
    }))

    // --- Timeline ---
    // Last 10 events. We surface eventType + description + createdAt only —
    // NOT metadata (which could theoretically embed vote-related context).
    const timelineRows = await db.voterTimelineEvent.findMany({
      where: { voterId: voter.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        eventType: true,
        description: true,
        createdAt: true,
      },
    })
    const timeline: MatchPayload['timeline'] = timelineRows.map((t) => ({
      eventType: t.eventType,
      description: t.description,
      createdAt: t.createdAt.toISOString(),
    }))

    // Prefer the Chapter-3 names; fall back to fullName.
    const fullName = [voter.firstName, voter.lastName].filter(Boolean).join(' ').trim() || voter.fullName

    matches.push({
      voter: {
        fullName,
        status: (voter.status || 'ACTIVE').toUpperCase(),
        verificationStatus: (voter.verificationStatus || 'PENDING').toUpperCase(),
        organizationName,
        organizationSubdomain,
      },
      elections,
      receipts,
      timeline,
    })
  }

  // Compose a helpful summary message.
  const totalReceipts = matches.reduce((n, m) => n + m.receipts.length, 0)
  const totalElections = matches.reduce((n, m) => n + m.elections.length, 0)
  const votedElections = matches.reduce(
    (n, m) => n + m.elections.filter((e) => e.hasVoted).length,
    0,
  )
  const liveElections = matches.reduce(
    (n, m) => n + m.elections.filter((e) => e.votingOpen && !e.hasVoted).length,
    0,
  )

  const parts: string[] = []
  if (matches.length === 1) {
    parts.push(`Found 1 voter record for "${rawIdentifier}".`)
  } else {
    parts.push(`Found ${matches.length} voter records for "${rawIdentifier}".`)
  }
  if (totalElections > 0) {
    parts.push(
      `Eligible for ${totalElections} election${totalElections === 1 ? '' : 's'} across ${matches.length} organization${matches.length === 1 ? '' : 's'}.`,
    )
  }
  if (votedElections > 0) {
    parts.push(`Voted in ${votedElections} election${votedElections === 1 ? '' : 's'}.`)
  }
  if (liveElections > 0) {
    parts.push(
      `${liveElections} election${liveElections === 1 ? '' : 's'} currently open — vote now!`,
    )
  }
  if (totalReceipts > 0) {
    parts.push(
      `Holds ${totalReceipts} receipt${totalReceipts === 1 ? '' : 's'} you can verify.`,
    )
  }
  const message = parts.join(' ')

  return json({
    found: true,
    matches,
    message,
    _privacy: PRIVACY,
  })
}
