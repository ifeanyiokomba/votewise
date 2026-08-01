import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson, writeAudit, getClientIp } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { getCurrentOfficial } from '@/lib/guards'

export const dynamic = 'force-dynamic'

// GET /api/workspace/units/[id]/observers — list observers assigned to a unit.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult
  const { id } = await params

  // Verify the unit belongs to this org.
  const unit = await db.workspace.findUnique({ where: { id } })
  if (!unit || unit.organizationId !== org.id) return errorJson('Unit not found', 404)

  const observers = await db.unitObserverAssignment.findMany({
    where: { workspaceId: id, status: 'ACTIVE' },
    orderBy: { assignedAt: 'desc' },
  })
  return json({ observers })
}

// POST /api/workspace/units/[id]/observers — assign an observer to a unit.
// Body: { memberEmail, memberName }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult
  const { id } = await params

  const official = await getCurrentOfficial(req)
  if (!official) return errorJson('Unauthorized', 401)

  const unit = await db.workspace.findUnique({ where: { id } })
  if (!unit || unit.organizationId !== org.id) return errorJson('Unit not found', 404)

  const body = await req.json().catch(() => ({}))
  const { memberEmail, memberName } = body
  if (!memberEmail || !memberName) return errorJson('memberEmail and memberName are required', 400)

  const emailLower = String(memberEmail).toLowerCase().trim()

  const assignment = await db.unitObserverAssignment.upsert({
    where: { workspaceId_memberEmail: { workspaceId: id, memberEmail: emailLower } },
    create: {
      organizationId: org.id,
      workspaceId: id,
      memberEmail: emailLower,
      memberName: String(memberName).trim(),
      status: 'ACTIVE',
      revokedAt: null,
    },
    update: {
      status: 'ACTIVE',
      revokedAt: null,
      memberName: String(memberName).trim(),
    },
  })

  await writeAudit({
    actorId: official.id, actorRole: official.role, actorName: official.name,
    action: 'OBSERVER_ASSIGNED_TO_UNIT',
    details: { organizationId: org.id, unitId: id, unitName: unit.name, observerEmail: emailLower },
    ip: getClientIp(req),
  }).catch(() => {})

  return json({ ok: true, assignment })
}

// DELETE /api/workspace/units/[id]/observers — revoke an observer assignment.
// Body: { memberEmail }
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult
  const { id } = await params

  const official = await getCurrentOfficial(req)
  if (!official) return errorJson('Unauthorized', 401)

  const body = await req.json().catch(() => ({}))
  const { memberEmail } = body
  if (!memberEmail) return errorJson('memberEmail is required', 400)

  const emailLower = String(memberEmail).toLowerCase().trim()

  await db.unitObserverAssignment.updateMany({
    where: { workspaceId: id, memberEmail: emailLower, organizationId: org.id },
    data: { status: 'REVOKED', revokedAt: new Date() },
  })

  await writeAudit({
    actorId: official.id, actorRole: official.role, actorName: official.name,
    action: 'OBSERVER_REVOKED_FROM_UNIT',
    details: { organizationId: org.id, unitId: id, observerEmail: emailLower },
    ip: getClientIp(req),
  }).catch(() => {})

  return json({ ok: true })
}
