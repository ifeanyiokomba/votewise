import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson, writeAudit, getClientIp } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { requirePermission, type IAMContext } from '@/lib/iam'
import { getCurrentOfficial } from '@/lib/guards'

export const dynamic = 'force-dynamic'

// Special organisation ID for built-in templates (shared across all orgs).
const BUILT_IN_ORG_ID = 'built-in'

// Helper: run requirePermission and unwrap to IAMContext or NextResponse.
async function auth(
  req: NextRequest,
  perm: Parameters<typeof requirePermission>[1],
): Promise<IAMContext | NextResponse> {
  return requirePermission(req, perm)
}

// Parse the JSON `templateData` field safely.
function safeParse(data: string | null | undefined): any | null {
  if (!data) return null
  try { return JSON.parse(data) } catch { return null }
}

// GET /api/workspace/election-templates/[templateId] — get a single template
// with the full templateData payload (so the UI can preview positions/candidates).
// Read access requires org context (any org member).
export async function GET(req: NextRequest, { params }: { params: Promise<{ templateId: string }> }) {
  // Auth check — closes the endpoint authentication gap (audit finding)
  const official = await getCurrentOfficial(req)
  if (!official) return errorJson('Unauthorized', 401)
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult
  const { templateId } = await params

  const template = await db.electionTemplate.findUnique({
    where: { id: templateId },
  })

  if (!template) return errorJson('Template not found', 404)

  // Tenant isolation: built-in templates are shared; org-created templates are
  // only visible to the org that created them.
  if (template.organizationId !== BUILT_IN_ORG_ID && template.organizationId !== org.id) {
    return errorJson('Template not found', 404)
  }

  const parsed = safeParse(template.templateData)
  const positions = Array.isArray(parsed?.positions) ? parsed.positions : []
  const candidateCount = positions.reduce(
    (sum: number, p: any) => sum + (Array.isArray(p?.candidates) ? p.candidates.length : 0),
    0,
  )

  return json({
    template: {
      id: template.id,
      name: template.name,
      description: template.description,
      category: template.category,
      electionType: template.electionType,
      votingMethod: template.votingMethod,
      visibility: template.visibility,
      isBuiltIn: template.isBuiltIn,
      createdBy: template.createdBy,
      organizationId: template.organizationId,
      settings: safeParse(template.settings),
      templateData: parsed || { positions: [] },
      positionCount: positions.length,
      candidateCount,
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
    },
  })
}

// DELETE /api/workspace/election-templates/[templateId] — delete a template.
// Only org-created templates can be deleted (built-in templates are protected).
// Requires election.manage permission. Audit-logs the deletion.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ templateId: string }> }) {
  const ctx = await auth(req, 'election.manage')
  if (ctx instanceof NextResponse) return ctx

  const orgId = ctx.org?.id
  if (!orgId) return errorJson('Organization context required.', 400)

  const { templateId } = await params

  const template = await db.electionTemplate.findUnique({
    where: { id: templateId },
    select: { id: true, name: true, organizationId: true, isBuiltIn: true },
  })

  if (!template) return errorJson('Template not found', 404)

  // Built-in templates are immutable — never deletable through this endpoint.
  if (template.isBuiltIn) {
    return errorJson('Built-in templates cannot be deleted.', 400)
  }

  // Org-owned only: org-created templates can only be deleted by their org.
  if (template.organizationId !== orgId) {
    return errorJson('Template not found', 404)
  }

  await db.electionTemplate.delete({ where: { id: templateId } })

  await writeAudit({
    actorId: ctx.user.id,
    actorRole: ctx.user.role,
    actorName: ctx.user.name,
    action: 'TEMPLATE_DELETED',
    details: {
      organizationId: orgId,
      templateId,
      templateName: template.name,
    },
    ip: getClientIp(req),
  }).catch(() => {})

  return json({ ok: true })
}
