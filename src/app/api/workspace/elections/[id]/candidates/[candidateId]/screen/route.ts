import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson, writeAudit, getClientIp } from '@/lib/election'
import { requirePermission, type IAMContext } from '@/lib/iam'

export const dynamic = 'force-dynamic'

async function auth(req: NextRequest, perm: Parameters<typeof requirePermission>[1]): Promise<IAMContext | NextResponse> {
  return requirePermission(req, perm)
}

const VALID_STATUSES = new Set(['APPROVED', 'DISQUALIFIED', 'WITHDRAWN'])

// POST /api/workspace/elections/[id]/candidates/[candidateId]/screen —
// screen a candidate. Body: { screeningStatus: APPROVED|DISQUALIFIED|
// WITHDRAWN, screeningNotes?: string }. Also updates the runtime `status`
// field to mirror screeningStatus. Sets screenedAt + screenedById.
// Creates an ElectionEvent for the screening. Requires candidate.screen.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; candidateId: string }> },
) {
  const ctx = await auth(req, 'candidate.screen')
  if (ctx instanceof NextResponse) return ctx

  const { id: electionId, candidateId } = await params
  const orgId = ctx.org?.id
  if (!orgId) return errorJson('Organization context required.', 400)

  const body = await req.json().catch(() => ({}))
  const screeningStatus = String(body?.screeningStatus || '').toUpperCase()
  const screeningNotes = body?.screeningNotes != null ? String(body.screeningNotes) : null

  if (!VALID_STATUSES.has(screeningStatus)) {
    return errorJson('screeningStatus must be APPROVED, DISQUALIFIED, or WITHDRAWN', 400)
  }

  // Resolve candidate scoped to (electionId, orgId).
  const existing = await db.candidate.findUnique({
    where: { id: candidateId },
    select: {
      id: true,
      fullName: true,
      slug: true,
      positionId: true,
      electionSessionId: true,
      organizationId: true,
      screeningStatus: true,
      status: true,
      position: { select: { id: true, title: true } },
    },
  })
  if (!existing || existing.electionSessionId !== electionId) {
    return errorJson('Candidate not found', 404)
  }
  if (existing.organizationId && existing.organizationId !== orgId) {
    return errorJson('Candidate not found', 404)
  }

  const updated = await db.candidate.update({
    where: { id: candidateId },
    data: {
      screeningStatus,
      screeningNotes: screeningNotes || null,
      // Mirror runtime status: APPROVED→APPROVED, DISQUALIFIED→DISQUALIFIED, WITHDRAWN→WITHDRAWN.
      status: screeningStatus,
      screenedAt: new Date(),
      screenedById: ctx.user.id,
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
      eventType: 'CANDIDATE_SCREENED',
      description: `Candidate "${existing.fullName}" screened: ${screeningStatus}`,
      actorId: ctx.user.id,
      actorName: ctx.user.name,
      metadata: JSON.stringify({
        candidateId,
        positionId: existing.positionId,
        fullName: existing.fullName,
        previousStatus: existing.screeningStatus,
        newStatus: screeningStatus,
        notes: screeningNotes,
      }),
    },
  }).catch(() => {})

  await writeAudit({
    actorId: ctx.user.id,
    actorRole: ctx.user.role,
    actorName: ctx.user.name,
    action: 'CANDIDATE_SCREENED',
    details: {
      organizationId: orgId,
      electionId,
      candidateId,
      fullName: existing.fullName,
      previousStatus: existing.screeningStatus,
      newStatus: screeningStatus,
      notes: screeningNotes,
    },
    ip: getClientIp(req),
    electionId,
  }).catch(() => {})

  return json({ ok: true, candidate: updated })
}
