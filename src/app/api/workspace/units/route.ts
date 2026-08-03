import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson, writeAudit, getClientIp } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { getCurrentOfficial } from '@/lib/guards'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/workspace/units — list all Organization Units for the org.
export async function GET(req: NextRequest) {
  // Auth check — closes the endpoint authentication gap (audit finding)
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth) return errorJson('Unauthorized', 401)
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  const units = await db.workspace.findMany({
    where: { organizationId: org.id },
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { elections: true, observerAssignments: true, voterGroups: true } },
    },
  })
  return json({ units })
}

// POST /api/workspace/units — create a new Organization Unit.
// Body: { name, code?, description?, parentWorkspaceId? }
export async function POST(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  const official = await getCurrentOfficial(req)
  if (!official) return errorJson('Unauthorized', 401)

  const body = await req.json().catch(() => ({}))
  const { name, code, description, parentWorkspaceId, unitType } = body
  if (!name) return errorJson('Unit name is required', 400)

  const slug = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  const unit = await db.workspace.create({
    data: {
      organizationId: org.id,
      name: String(name).trim(),
      slug,
      unitType: unitType || null,
      code: code || null,
      description: description || null,
      parentWorkspaceId: parentWorkspaceId || null,
      createdBy: official.id,
    },
  }).catch(() => null)

  if (!unit) return errorJson('Failed to create unit (slug may already exist)', 500)

  await writeAudit({
    actorId: official.id, actorRole: official.role, actorName: official.name,
    action: 'ORG_UNIT_CREATED',
    details: { organizationId: org.id, unitId: unit.id, name, code },
    ip: getClientIp(req),
  }).catch(() => {})

  return json({ ok: true, unit })
}
