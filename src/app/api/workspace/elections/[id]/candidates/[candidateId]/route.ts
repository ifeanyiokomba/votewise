import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson, writeAudit, getClientIp } from '@/lib/election'
import { requirePermission, type IAMContext } from '@/lib/iam'

export const dynamic = 'force-dynamic'

async function auth(req: NextRequest, perm: Parameters<typeof requirePermission>[1]): Promise<IAMContext | NextResponse> {
  return requirePermission(req, perm)
}

// Resolve a candidate scoped to (electionId, orgId) — returns the candidate
// with its position or null. Used by both PATCH and DELETE.
async function resolveCandidate(electionId: string, candidateId: string, orgId: string) {
  const candidate = await db.candidate.findUnique({
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
      position: { select: { id: true, title: true, electionSessionId: true } },
    },
  })
  if (!candidate) return null
  // Must belong to the same election + org.
  if (candidate.electionSessionId !== electionId) return null
  if (candidate.organizationId && candidate.organizationId !== orgId) return null
  return candidate
}

// PATCH /api/workspace/elections/[id]/candidates/[candidateId] — update
// candidate (fullName, slogan, manifesto, photoUrl, biography, displayOrder,
// campaignVideoUrl). Requires candidate.manage permission.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; candidateId: string }> },
) {
  const ctx = await auth(req, 'candidate.manage')
  if (ctx instanceof NextResponse) return ctx

  const { id: electionId, candidateId } = await params
  const orgId = ctx.org?.id
  if (!orgId) return errorJson('Organization context required.', 400)

  const existing = await resolveCandidate(electionId, candidateId, orgId)
  if (!existing) return errorJson('Candidate not found', 404)

  const body = await req.json().catch(() => ({}))
  const allowed: Record<string, unknown> = {}
  const fields = ['fullName', 'slogan', 'manifesto', 'photoUrl', 'biography', 'campaignVideoUrl', 'displayOrder']
  for (const f of fields) {
    if (body[f] !== undefined) {
      if (f === 'displayOrder') {
        allowed[f] = typeof body[f] === 'number' ? body[f] : 0
      } else if (f === 'fullName') {
        const v = String(body[f]).trim()
        if (!v) return errorJson('fullName cannot be empty', 400)
        allowed[f] = v
      } else {
        // Treat empty string as null to keep the column consistent.
        allowed[f] = body[f] === '' ? null : body[f]
      }
    }
  }

  if (Object.keys(allowed).length === 0) {
    return errorJson('No valid fields to update', 400)
  }

  const updated = await db.candidate.update({
    where: { id: candidateId },
    data: allowed,
    include: {
      position: { select: { id: true, title: true, slug: true } },
    },
  })

  await writeAudit({
    actorId: ctx.user.id,
    actorRole: ctx.user.role,
    actorName: ctx.user.name,
    action: 'CANDIDATE_UPDATE',
    details: { organizationId: orgId, electionId, candidateId, fields: Object.keys(allowed) },
    ip: getClientIp(req),
    electionId,
  }).catch(() => {})

  return json({ ok: true, candidate: updated })
}

// DELETE /api/workspace/elections/[id]/candidates/[candidateId] — remove
// candidate. Requires candidate.manage permission.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; candidateId: string }> },
) {
  const ctx = await auth(req, 'candidate.manage')
  if (ctx instanceof NextResponse) return ctx

  const { id: electionId, candidateId } = await params
  const orgId = ctx.org?.id
  if (!orgId) return errorJson('Organization context required.', 400)

  const existing = await resolveCandidate(electionId, candidateId, orgId)
  if (!existing) return errorJson('Candidate not found', 404)

  await db.candidate.delete({ where: { id: candidateId } }).catch(() => {})

  // Timeline event.
  await db.electionEvent.create({
    data: {
      electionId,
      organizationId: orgId,
      eventType: 'CANDIDATE_REMOVED',
      description: `Candidate "${existing.fullName}" removed from position "${existing.position?.title ?? 'Unknown'}"`,
      actorId: ctx.user.id,
      actorName: ctx.user.name,
      metadata: JSON.stringify({ candidateId, positionId: existing.positionId, fullName: existing.fullName }),
    },
  }).catch(() => {})

  await writeAudit({
    actorId: ctx.user.id,
    actorRole: ctx.user.role,
    actorName: ctx.user.name,
    action: 'CANDIDATE_DELETE',
    details: { organizationId: orgId, electionId, candidateId, fullName: existing.fullName },
    ip: getClientIp(req),
    electionId,
  }).catch(() => {})

  return json({ ok: true })
}
