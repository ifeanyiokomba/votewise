import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson, writeAudit, getClientIp } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { getCurrentOfficial } from '@/lib/guards'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/workspace/voter-fields — list the org's dynamic voter field definitions.
export async function GET(req: NextRequest) {
  // Auth check — closes the endpoint authentication gap (audit finding)
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth) return errorJson('Unauthorized', 401)
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  const fields = await db.voterField.findMany({
    where: { organizationId: org.id },
    orderBy: { displayOrder: 'asc' },
  })
  return json({ fields })
}

// POST /api/workspace/voter-fields — create a new dynamic voter field.
// Body: { label, key, fieldType, required?, displayOrder?, options? }
export async function POST(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  const official = await getCurrentOfficial(req)
  if (!official) return errorJson('Unauthorized', 401)

  const body = await req.json().catch(() => ({}))
  const { label, key, fieldType, required, displayOrder, options } = body
  if (!label || !key || !fieldType)
    return errorJson('label, key, and fieldType are required', 400)
  if (!['TEXT', 'NUMBER', 'EMAIL', 'PHONE', 'SELECT', 'DATE'].includes(fieldType))
    return errorJson('Invalid fieldType', 400)

  // Sanitize key
  const sanitizedKey = String(key).replace(/[^a-zA-Z0-9_]/g, '')

  try {
    const field = await db.voterField.create({
      data: {
        organizationId: org.id,
        label: String(label),
        key: sanitizedKey,
        fieldType: String(fieldType),
        required: !!required,
        displayOrder: displayOrder || 0,
        options: options ? JSON.stringify(options) : null,
      },
    })
    await writeAudit({
      actorId: official.id, actorRole: official.role, actorName: official.name,
      action: 'VOTER_FIELD_CREATED',
      details: { organizationId: org.id, fieldId: field.id, key: sanitizedKey, label },
      ip: getClientIp(req),
    }).catch(() => {})
    return json({ ok: true, field })
  } catch (e: any) {
    if (e?.code === 'P2002') return errorJson('A field with this key already exists', 409)
    return errorJson('Failed to create field', 500)
  }
}

// PATCH /api/workspace/voter-fields — update a field.
// Body: { id, label?, fieldType?, required?, displayOrder?, options? }
export async function PATCH(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  const official = await getCurrentOfficial(req)
  if (!official) return errorJson('Unauthorized', 401)

  const body = await req.json().catch(() => ({}))
  const { id, ...updates } = body
  if (!id) return errorJson('Field id is required', 400)

  // Verify ownership
  const existing = await db.voterField.findUnique({ where: { id } })
  if (!existing || existing.organizationId !== org.id)
    return errorJson('Field not found', 404)

  const field = await db.voterField.update({
    where: { id },
    data: {
      ...(updates.label && { label: String(updates.label) }),
      ...(updates.fieldType && { fieldType: String(updates.fieldType) }),
      ...(updates.required !== undefined && { required: !!updates.required }),
      ...(updates.displayOrder !== undefined && { displayOrder: parseInt(updates.displayOrder) || 0 }),
      ...(updates.options !== undefined && { options: updates.options ? JSON.stringify(updates.options) : null }),
    },
  })
  return json({ ok: true, field })
}

// DELETE /api/workspace/voter-fields — delete a field.
// Body: { id }
export async function DELETE(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  const official = await getCurrentOfficial(req)
  if (!official) return errorJson('Unauthorized', 401)

  const body = await req.json().catch(() => ({}))
  const { id } = body
  if (!id) return errorJson('Field id is required', 400)

  const existing = await db.voterField.findUnique({ where: { id } })
  if (!existing || existing.organizationId !== org.id)
    return errorJson('Field not found', 404)

  await db.voterField.delete({ where: { id } })
  return json({ ok: true })
}
