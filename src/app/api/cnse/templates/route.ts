import { NextRequest } from 'next/server'
import { db } from '@/lib/cnse/safe-db'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { listTemplates, seedBuiltinTemplates } from '@/lib/cnse'

export const dynamic = 'force-dynamic'

// GET /api/cnse/templates?category=...&channel=...
export async function GET(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category') || undefined
  const channel = searchParams.get('channel') || undefined

  const templates = await listTemplates(org.id, category as any, channel as any)
  return json({ templates })
}

// POST /api/cnse/templates — Create or customize a template
export async function POST(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  const body = await req.json().catch(() => ({}))
  if (!body.name || !body.category || !body.channel || !body.body) {
    return errorJson('name, category, channel, and body are required', 400)
  }

  const template = await db.messageTemplate.create({
    data: {
      organizationId: org.id,
      name: body.name,
      category: body.category,
      channel: body.channel,
      language: body.language || 'en',
      subject: body.subject || null,
      body: body.body,
      variables: JSON.stringify(body.variables || []),
      isBuiltIn: false,
      isActive: true,
      createdByName: body.createdByName,
    },
  })

  return json({ ok: true, template })
}

// PATCH /api/cnse/templates — Update a template
export async function PATCH(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error

  const body = await req.json().catch(() => ({}))
  if (!body.id) return errorJson('Template ID is required', 400)

  const existing = await db.messageTemplate.findUnique({ where: { id: body.id } })
  if (!existing || existing.organizationId !== orgResult.id) {
    return errorJson('Template not found', 404)
  }

  const template = await db.messageTemplate.update({
    where: { id: body.id },
    data: {
      name: body.name || existing.name,
      subject: body.subject !== undefined ? body.subject : existing.subject,
      body: body.body || existing.body,
      variables: body.variables ? JSON.stringify(body.variables) : existing.variables,
      isActive: body.isActive !== undefined ? body.isActive : existing.isActive,
    },
  })

  return json({ ok: true, template })
}
