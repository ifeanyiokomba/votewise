import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson, writeAudit, getClientIp } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { requirePermission } from '@/lib/iam'
import { getCurrentOfficial } from '@/lib/guards'

export const dynamic = 'force-dynamic'

// Verify the election belongs to the resolved org.
async function getOrgElection(orgId: string, electionId: string) {
  const election = await db.electionSession.findUnique({
    where: { id: electionId },
    select: {
      id: true, name: true, organizationId: true, status: true,
      startTime: true, endTime: true,
    },
  })
  if (!election || election.organizationId !== orgId) return null
  return election
}

// GET /api/workspace/elections/[id]/voters — voters eligible for this election
// with their voting status. Query: ?search=...&status=...&page=1
// Returns voters + stats (total, voted, pending, suspended).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Auth check — closes the endpoint authentication gap (audit finding)
  const official = await getCurrentOfficial(req)
  if (!official) return errorJson('Unauthorized', 401)
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult
  const { id: electionId } = await params

  const election = await getOrgElection(org.id, electionId)
  if (!election) return errorJson('Election not found', 404)

  const { searchParams } = new URL(req.url)
  const search = (searchParams.get('search') || '').trim()
  const status = searchParams.get('status') // all | voted | not-voted | verified | pending | suspended
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const pageSize = Math.min(200, parseInt(searchParams.get('pageSize') || '50', 10))

  // Voters belong to this organization AND are scoped to this election.
  // In the current schema, Voter.electionSessionId is the legacy link, while
  // Voter.organizationId is the new tenant scope. We include voters that match
  // either (organizationId = org.id) — election-wide eligibility comes from
  // the org's master registry; per-election tagging uses electionSessionId.
  const where: Record<string, unknown> = {
    organizationId: org.id,
    OR: [
      { electionSessionId: electionId },
      { electionSessionId: null },
    ],
  }

  if (search) {
    const q = search
    ;(where as any).AND = [
      {
        OR: [
          { firstName: { contains: q } },
          { lastName: { contains: q } },
          { fullName: { contains: q } },
          { email: { contains: q } },
          { institutionEmail: { contains: q } },
          { matric: { contains: q } },
          { phone: { contains: q } },
        ],
      },
    ]
  }

  if (status === 'voted') (where as any).hasVoted = true
  if (status === 'not-voted') (where as any).hasVoted = false
  if (status === 'verified') (where as any).verificationStatus = 'VERIFIED'
  if (status === 'pending') (where as any).verificationStatus = 'PENDING'
  if (status === 'suspended') (where as any).status = 'SUSPENDED'

  // For stats, we compute over the unfiltered election-eligible set so the
  // numbers don't jump as the user types in the search box.
  const statsWhere = { organizationId: org.id, OR: [{ electionSessionId: electionId }, { electionSessionId: null }] }

  const [total, voted, pending, suspended, voters] = await Promise.all([
    db.voter.count({ where: statsWhere }),
    db.voter.count({ where: { ...statsWhere, hasVoted: true } }),
    db.voter.count({ where: { ...statsWhere, hasVoted: false } }),
    db.voter.count({ where: { ...statsWhere, status: 'SUSPENDED' } }),
    db.voter.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, firstName: true, lastName: true, fullName: true,
        email: true, institutionEmail: true, phone: true, matric: true,
        status: true, verificationStatus: true,
        hasVoted: true, votedAt: true, flagged: true, flaggedReason: true,
        createdAt: true,
      },
    }),
  ])

  // Also resolve the verification status counts for clarity.
  const [verifiedCount, rejectedCount] = await Promise.all([
    db.voter.count({ where: { ...statsWhere, verificationStatus: 'VERIFIED' } }),
    db.voter.count({ where: { ...statsWhere, verificationStatus: 'REJECTED' } }),
  ])

  return json({
    voters,
    stats: {
      total,
      voted,
      pending,            // not-yet-voted count (alias of "Pending Votes")
      suspended,
      verified: verifiedCount,
      rejected: rejectedCount,
      turnoutPct: total > 0 ? Math.round((voted / total) * 1000) / 10 : 0,
    },
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    election: { id: election.id, name: election.name, status: election.status },
  })
}

// POST /api/workspace/elections/[id]/voters — add a voter to this election's
// eligible list. Body: { fullName, email, matric?, phone? }
// Requires: voter.import permission.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePermission(req, 'voter.import')
  if (ctx instanceof Response) return ctx
  if (!ctx.org) return errorJson('Organization not found', 404)
  const { id: electionId } = await params

  const election = await getOrgElection(ctx.org.id, electionId)
  if (!election) return errorJson('Election not found', 404)

  const body = await req.json().catch(() => ({}))
  const { fullName, email, matric, phone } = body
  if (!fullName) return errorJson('Full name is required', 400)
  if (!email && !matric) return errorJson('Email or matric is required', 400)

  // Split full name into first/last for the legacy fields.
  const parts = String(fullName).trim().split(/\s+/)
  const firstName = parts[0] || ''
  const lastName = parts.slice(1).join(' ') || ''
  const emailLower = email ? String(email).toLowerCase().trim() : null

  // Generate a unique voter ID (matric) if not provided.
  const uniqueMatric = matric || `VW-${electionId.slice(-6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`

  // De-dupe by matric (matric is globally unique). If a voter with this matric
  // already exists in this org, link them to this election instead of failing.
  const existing = await db.voter.findUnique({ where: { matric: uniqueMatric } }).catch(() => null)
  if (existing) {
    if (existing.organizationId !== ctx.org.id) {
      return errorJson('A voter with this matric already exists in another organization.', 409)
    }
    // Link the existing voter to this election (if not already linked).
    if (existing.electionSessionId !== electionId) {
      await db.voter.update({
        where: { id: existing.id },
        data: { electionSessionId: electionId },
      }).catch(() => {})
    }
    return json({ ok: true, voter: existing, linked: true, message: 'Existing voter linked to this election.' })
  }

  const voter = await db.voter.create({
    data: {
      organizationId: ctx.org.id,
      electionSessionId: electionId,
      firstName,
      lastName,
      fullName: String(fullName).trim(),
      email: emailLower,
      institutionEmail: emailLower,
      phone: phone || null,
      matric: uniqueMatric,
      status: 'ACTIVE',
      verificationStatus: 'PENDING',
      facultyId: 'legacy',
      departmentId: 'legacy',
      level: 'N/A',
    },
  }).catch(() => null)

  if (!voter) return errorJson('Failed to create voter', 500)

  // Record a timeline event for audit.
  await db.voterTimelineEvent.create({
    data: {
      organizationId: ctx.org.id,
      voterId: voter.id,
      electionId,
      eventType: 'IMPORTED',
      description: `Voter added to election "${election.name}"`,
      actorId: ctx.user.id,
      actorName: ctx.user.name,
    },
  }).catch(() => {})

  await writeAudit({
    actorId: ctx.user.id,
    actorRole: ctx.user.role,
    actorName: ctx.user.name,
    action: 'VOTER_ADDED_TO_ELECTION',
    details: {
      organizationId: ctx.org.id,
      electionId,
      electionName: election.name,
      voterId: voter.id,
      voterEmail: emailLower,
      voterMatric: uniqueMatric,
    },
    ip: getClientIp(req),
  }).catch(() => {})

  return json({ ok: true, voter, message: `${voter.fullName} added to this election.` })
}
