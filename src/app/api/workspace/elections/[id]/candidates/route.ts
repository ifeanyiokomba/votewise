import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson, writeAudit, getClientIp } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { requirePermission, type IAMContext } from '@/lib/iam'
import { randomToken } from '@/lib/crypto'
import { getCurrentOfficial } from '@/lib/guards'

export const dynamic = 'force-dynamic'

// GET /api/workspace/elections/[id]/candidates — list all candidates for an
// election, grouped by position. Includes position title, candidate details
// (fullName, photoUrl, slogan, manifesto, screeningStatus, status,
// displayOrder). Read access requires org context (any org member).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Auth check — closes the endpoint authentication gap (audit finding)
  const official = await getCurrentOfficial(req)
  if (!official) return errorJson('Unauthorized', 401)
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult
  const { id } = await params

  // Verify the election belongs to this org.
  const election = await db.electionSession.findUnique({
    where: { id },
    select: { id: true, organizationId: true, name: true, status: true },
  })
  if (!election || election.organizationId !== org.id) {
    return errorJson('Election not found', 404)
  }

  // Fetch positions (ordered) with their candidates (ordered by displayOrder).
  const positions = await db.position.findMany({
    where: { electionSessionId: id },
    orderBy: [{ displayOrder: 'asc' }, { order: 'asc' }, { createdAt: 'asc' }],
    include: {
      candidates: {
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          fullName: true,
          slug: true,
          photoUrl: true,
          slogan: true,
          manifesto: true,
          biography: true,
          campaignVideoUrl: true,
          screeningStatus: true,
          screeningNotes: true,
          screenedAt: true,
          status: true,
          displayOrder: true,
          createdAt: true,
          updatedAt: true,
          positionId: true,
        },
      },
      _count: { select: { candidates: true } },
    },
  })

  // Flatten for stats.
  const all = positions.flatMap((p) => p.candidates)
  const stats = {
    total: all.length,
    pending: all.filter((c) => c.screeningStatus === 'PENDING').length,
    approved: all.filter((c) => c.screeningStatus === 'APPROVED').length,
    disqualified: all.filter((c) => c.screeningStatus === 'DISQUALIFIED').length,
    withdrawn: all.filter((c) => c.screeningStatus === 'WITHDRAWN').length,
  }

  return json({
    electionId: id,
    electionName: election.name,
    electionStatus: election.status,
    positions: positions.map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      scope: p.scope,
      maximumVotes: p.maximumVotes,
      displayOrder: p.displayOrder,
      description: p.description,
      _count: { candidates: p.candidates.length },
      candidates: p.candidates.map((c) => ({
        ...c,
        positionTitle: p.title,
        screenedAt: c.screenedAt ? c.screenedAt.toISOString() : null,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
    })),
    stats,
  })
}

// Helper: run requirePermission and unwrap to IAMContext or return the
// NextResponse directly. Using `instanceof NextResponse` gives TypeScript a
// clean type narrowing (vs. the looser `'error' in ctx` pattern).
async function auth(req: NextRequest, perm: Parameters<typeof requirePermission>[1]): Promise<IAMContext | NextResponse> {
  return requirePermission(req, perm)
}

// POST /api/workspace/elections/[id]/candidates — add a new candidate to a
// position in this election. Body: { fullName, positionId, slogan?,
// manifesto?, photoUrl?, biography? }. Auto-generates a slug from
// fullName + random suffix. Requires candidate.manage permission.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await auth(req, 'candidate.manage')
  if (ctx instanceof NextResponse) return ctx

  const { id: electionId } = await params
  const orgId = ctx.org?.id
  if (!orgId) return errorJson('Organization context required.', 400)

  // Verify the election belongs to this org.
  const election = await db.electionSession.findUnique({
    where: { id: electionId },
    select: { id: true, organizationId: true, name: true, status: true },
  })
  if (!election || election.organizationId !== orgId) {
    return errorJson('Election not found', 404)
  }

  const body = await req.json().catch(() => ({}))
  const { fullName, positionId, slogan, manifesto, photoUrl, biography, campaignVideoUrl, displayOrder } = body || {}
  if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
    return errorJson('fullName is required', 400)
  }
  if (!positionId) return errorJson('positionId is required', 400)

  // Verify the position belongs to this election.
  const position = await db.position.findUnique({
    where: { id: positionId },
    select: { id: true, electionSessionId: true, organizationId: true, title: true },
  })
  if (!position || position.electionSessionId !== electionId) {
    return errorJson('Position not found in this election', 404)
  }

  // Auto-generate a slug from fullName + random suffix.
  const baseSlug = String(fullName).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'candidate'
  const slug = `${baseSlug}-${randomToken(3).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 6)}`

  // Calculate displayOrder: append to the end of this position's candidates.
  let order = typeof displayOrder === 'number' ? displayOrder : 0
  if (typeof displayOrder !== 'number') {
    const last = await db.candidate.findFirst({
      where: { positionId },
      orderBy: { displayOrder: 'desc' },
      select: { displayOrder: true },
    })
    order = (last?.displayOrder ?? -1) + 1
  }

  const candidate = await db.candidate.create({
    data: {
      fullName: fullName.trim(),
      slug,
      positionId,
      electionSessionId: electionId,
      organizationId: orgId,
      slogan: slogan || null,
      manifesto: manifesto || null,
      photoUrl: photoUrl || null,
      biography: biography || null,
      campaignVideoUrl: campaignVideoUrl || null,
      displayOrder: order,
      screeningStatus: 'PENDING',
      status: 'APPROVED',
    },
    include: {
      position: { select: { id: true, title: true, slug: true } },
    },
  })

  // Timeline event.
  await db.electionEvent.create({
    data: {
      electionId,
      organizationId: orgId,
      eventType: 'CANDIDATE_REGISTERED',
      description: `Candidate "${fullName.trim()}" added to position "${position.title}"`,
      actorId: ctx.user.id,
      actorName: ctx.user.name,
      metadata: JSON.stringify({ candidateId: candidate.id, positionId, slug }),
    },
  }).catch(() => {})

  await writeAudit({
    actorId: ctx.user.id,
    actorRole: ctx.user.role,
    actorName: ctx.user.name,
    action: 'CANDIDATE_CREATE',
    details: { organizationId: orgId, electionId, candidateId: candidate.id, fullName: fullName.trim(), positionId },
    ip: getClientIp(req),
    electionId,
  }).catch(() => {})

  return json({ ok: true, candidate }, 201)
}
