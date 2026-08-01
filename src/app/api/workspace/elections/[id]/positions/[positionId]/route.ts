import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson, writeAudit, getClientIp } from '@/lib/election'
import { requirePermission, type IAMContext } from '@/lib/iam'

export const dynamic = 'force-dynamic'

const ALLOWED_SCOPES = [
  'ORGANIZATION',
  'WORKSPACE',
  'VOTER_GROUP',
  'UNIVERSITY',
  'FACULTY',
  'DEPARTMENT',
] as const

async function auth(
  req: NextRequest,
  perm: Parameters<typeof requirePermission>[1],
): Promise<IAMContext | NextResponse> {
  return requirePermission(req, perm)
}

// Resolve a position scoped to (electionId, orgId) — returns the position or
// null. Used by both PATCH and DELETE to enforce tenant isolation.
async function resolvePosition(electionId: string, positionId: string, orgId: string) {
  const position = await db.position.findUnique({
    where: { id: positionId },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      scope: true,
      maximumVotes: true,
      displayOrder: true,
      order: true,
      electionSessionId: true,
      organizationId: true,
      _count: { select: { candidates: true } },
    },
  })
  if (!position) return null
  // Must belong to the same election + org.
  if (position.electionSessionId !== electionId) return null
  if (position.organizationId && position.organizationId !== orgId) return null
  return position
}

// PATCH /api/workspace/elections/[id]/positions/[positionId] — update a
// position (title, description, scope, maximumVotes, displayOrder).
// Requires election.manage permission.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; positionId: string }> },
) {
  const ctx = await auth(req, 'election.manage')
  if (ctx instanceof NextResponse) return ctx

  const { id: electionId, positionId } = await params
  const orgId = ctx.org?.id
  if (!orgId) return errorJson('Organization context required.', 400)

  const existing = await resolvePosition(electionId, positionId, orgId)
  if (!existing) return errorJson('Position not found', 404)

  const body = await req.json().catch(() => ({}))
  const allowed: Record<string, unknown> = {}

  // title — required non-empty if present.
  if (body.title !== undefined) {
    const v = String(body.title).trim()
    if (!v) return errorJson('title cannot be empty', 400)
    allowed.title = v
  }

  // description — null/empty allowed.
  if (body.description !== undefined) {
    const v = body.description
    allowed.description = v === null || v === '' ? null : String(v).trim()
  }

  // scope — must be one of the allowed values.
  if (body.scope !== undefined) {
    if (typeof body.scope !== 'string' || !(ALLOWED_SCOPES as readonly string[]).includes(body.scope)) {
      return errorJson(`scope must be one of: ${ALLOWED_SCOPES.join(', ')}`, 400)
    }
    allowed.scope = body.scope
  }

  // maximumVotes — positive integer >= 1.
  if (body.maximumVotes !== undefined && body.maximumVotes !== null && body.maximumVotes !== '') {
    const n = Number(body.maximumVotes)
    if (!Number.isFinite(n) || n < 1 || !Number.isInteger(n)) {
      return errorJson('maximumVotes must be a positive integer (>= 1)', 400)
    }
    allowed.maximumVotes = n
  }

  // displayOrder — integer.
  if (body.displayOrder !== undefined && body.displayOrder !== null) {
    const n = Number(body.displayOrder)
    if (!Number.isFinite(n) || !Number.isInteger(n)) {
      return errorJson('displayOrder must be an integer', 400)
    }
    allowed.displayOrder = n
    // Keep the legacy `order` column in sync to avoid drift.
    allowed.order = n
  }

  if (Object.keys(allowed).length === 0) {
    return errorJson('No valid fields to update', 400)
  }

  const updated = await db.position.update({
    where: { id: positionId },
    data: allowed,
    include: { _count: { select: { candidates: true } } },
  })

  // Timeline event — only for meaningful edits (title/scope/max votes).
  const interesting = ['title', 'scope', 'maximumVotes'].some((k) => k in allowed)
  if (interesting) {
    await db.electionEvent
      .create({
        data: {
          electionId,
          organizationId: orgId,
          eventType: 'POSITION_UPDATED',
          description: `Position "${updated.title}" updated (${Object.keys(allowed).join(', ')})`,
          actorId: ctx.user.id,
          actorName: ctx.user.name,
          metadata: JSON.stringify({ positionId, fields: Object.keys(allowed) }),
        },
      })
      .catch(() => {})
  }

  await writeAudit({
    actorId: ctx.user.id,
    actorRole: ctx.user.role,
    actorName: ctx.user.name,
    action: 'POSITION_UPDATE',
    details: { organizationId: orgId, electionId, positionId, fields: Object.keys(allowed) },
    ip: getClientIp(req),
    electionId,
  }).catch(() => {})

  return json({
    ok: true,
    position: {
      id: updated.id,
      title: updated.title,
      slug: updated.slug,
      description: updated.description,
      scope: updated.scope,
      maximumVotes: updated.maximumVotes,
      displayOrder: updated.displayOrder,
      order: updated.order,
      _count: { candidates: updated._count.candidates },
    },
  })
}

// DELETE /api/workspace/elections/[id]/positions/[positionId] — remove a
// position. Refuses to delete if the position has any candidates (return 409
// with a helpful message). Requires election.manage permission.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; positionId: string }> },
) {
  const ctx = await auth(req, 'election.manage')
  if (ctx instanceof NextResponse) return ctx

  const { id: electionId, positionId } = await params
  const orgId = ctx.org?.id
  if (!orgId) return errorJson('Organization context required.', 400)

  const existing = await resolvePosition(electionId, positionId, orgId)
  if (!existing) return errorJson('Position not found', 404)

  // Guard: refuse to delete if candidates exist (return 409).
  if (existing._count.candidates > 0) {
    return errorJson(
      `Cannot delete "${existing.title}" because it has ${existing._count.candidates} candidate${existing._count.candidates === 1 ? '' : 's'}. Remove or reassign all candidates first.`,
      409,
      { positionId, candidateCount: existing._count.candidates },
    )
  }

  await db.position.delete({ where: { id: positionId } }).catch(() => {})

  // Timeline event.
  await db.electionEvent
    .create({
      data: {
        electionId,
        organizationId: orgId,
        eventType: 'POSITION_REMOVED',
        description: `Position "${existing.title}" removed`,
        actorId: ctx.user.id,
        actorName: ctx.user.name,
        metadata: JSON.stringify({ positionId, title: existing.title, slug: existing.slug }),
      },
    })
    .catch(() => {})

  await writeAudit({
    actorId: ctx.user.id,
    actorRole: ctx.user.role,
    actorName: ctx.user.name,
    action: 'POSITION_DELETE',
    details: { organizationId: orgId, electionId, positionId, title: existing.title },
    ip: getClientIp(req),
    electionId,
  }).catch(() => {})

  return json({ ok: true })
}
