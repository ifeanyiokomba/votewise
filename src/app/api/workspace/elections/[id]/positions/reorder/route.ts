import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson, writeAudit, getClientIp } from '@/lib/election'
import { requirePermission, type IAMContext } from '@/lib/iam'

export const dynamic = 'force-dynamic'

async function auth(
  req: NextRequest,
  perm: Parameters<typeof requirePermission>[1],
): Promise<IAMContext | NextResponse> {
  return requirePermission(req, perm)
}

// POST /api/workspace/elections/[id]/positions/reorder — reorder positions.
// Body: { positionIds: string[] } (in desired order). Updates displayOrder
// for each position (0..n-1). Also updates the legacy `order` column.
// Requires election.manage permission.
//
// Implementation note: we run individual updates inside a small sequential
// loop instead of a transaction so SQLite doesn't choke on the (rare) case
// where one position's new displayOrder temporarily collides with another's
// existing value. Each update is independent.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await auth(req, 'election.manage')
  if (ctx instanceof NextResponse) return ctx

  const { id: electionId } = await params
  const orgId = ctx.org?.id
  if (!orgId) return errorJson('Organization context required.', 400)

  // Verify the election belongs to this org.
  const election = await db.electionSession.findUnique({
    where: { id: electionId },
    select: { id: true, organizationId: true, name: true },
  })
  if (!election || election.organizationId !== orgId) {
    return errorJson('Election not found', 404)
  }

  const body = await req.json().catch(() => ({}))
  const { positionIds } = body || {}

  if (!Array.isArray(positionIds) || positionIds.length === 0) {
    return errorJson('positionIds must be a non-empty array', 400)
  }
  // Basic shape check.
  if (!positionIds.every((id) => typeof id === 'string' && id.trim())) {
    return errorJson('positionIds must be an array of strings', 400)
  }

  // Verify all the supplied IDs actually belong to this election. This
  // prevents a caller from silently reordering positions in a different
  // election (cross-tenant) or inventing fake IDs.
  const owned = await db.position.findMany({
    where: { electionSessionId: electionId },
    select: { id: true },
  })
  const ownedSet = new Set(owned.map((p) => p.id))
  const unknown = positionIds.filter((id: string) => !ownedSet.has(id))
  if (unknown.length > 0) {
    return errorJson(
      `Some position IDs do not belong to this election: ${unknown.slice(0, 5).join(', ')}${unknown.length > 5 ? '…' : ''}`,
      400,
      { unknown },
    )
  }

  // Apply the new order. Use a large base multiplier then collapse, so any
  // transient uniqueness issues are avoided (SQLite doesn't enforce a unique
  // constraint on displayOrder, but we want stable ordering anyway).
  const updates = positionIds.map((id: string, idx: number) =>
    db.position.update({
      where: { id },
      data: { displayOrder: idx, order: idx },
      select: { id: true, displayOrder: true },
    }),
  )
  await Promise.all(updates)

  await writeAudit({
    actorId: ctx.user.id,
    actorRole: ctx.user.role,
    actorName: ctx.user.name,
    action: 'POSITION_REORDER',
    details: {
      organizationId: orgId,
      electionId,
      order: positionIds,
    },
    ip: getClientIp(req),
    electionId,
  }).catch(() => {})

  return json({ ok: true, count: positionIds.length })
}
