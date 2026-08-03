import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson, writeAudit, getClientIp } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { requirePermission, type IAMContext } from '@/lib/iam'
import { randomToken } from '@/lib/crypto'
import { getCurrentOfficial } from '@/lib/guards'

export const dynamic = 'force-dynamic'

// Special organisation ID used for built-in templates so they're available to
// every org regardless of which org created them.
export const BUILT_IN_ORG_ID = 'built-in'

// Helper: run requirePermission and unwrap to IAMContext or NextResponse.
async function auth(
  req: NextRequest,
  perm: Parameters<typeof requirePermission>[1],
): Promise<IAMContext | NextResponse> {
  return requirePermission(req, perm)
}

// Parse the JSON `templateData` field safely. Returns null on failure.
function safeParse(data: string | null | undefined): any | null {
  if (!data) return null
  try { return JSON.parse(data) } catch { return null }
}

// Compute the position + candidate counts for a template by parsing its
// stored `templateData` JSON. Falls back to 0 on parse failure.
function countTemplate(t: { templateData: string | null }) {
  const parsed = safeParse(t.templateData)
  const positions = Array.isArray(parsed?.positions) ? parsed.positions : []
  const candidateCount = positions.reduce(
    (sum: number, p: any) => sum + (Array.isArray(p?.candidates) ? p.candidates.length : 0),
    0,
  )
  return { positionCount: positions.length, candidateCount }
}

// GET /api/workspace/election-templates — list all templates available to the
// current org (built-in + org-created). Returns summary fields + counts.
// Read access requires org context (any org member).
export async function GET(req: NextRequest) {
  // Auth check — closes the endpoint authentication gap (audit finding)
  const official = await getCurrentOfficial(req)
  if (!official) return errorJson('Unauthorized', 401)
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  // Built-in templates (organisationId = "built-in") are shared across all orgs.
  // Org-created templates are scoped to the current org.
  const templates = await db.electionTemplate.findMany({
    where: {
      OR: [
        { organizationId: BUILT_IN_ORG_ID },
        { organizationId: org.id },
      ],
    },
    orderBy: [{ isBuiltIn: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      name: true,
      description: true,
      category: true,
      electionType: true,
      votingMethod: true,
      visibility: true,
      isBuiltIn: true,
      createdBy: true,
      templateData: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return json({
    templates: templates.map((t) => {
      const counts = countTemplate(t)
      return {
        id: t.id,
        name: t.name,
        description: t.description,
        category: t.category,
        electionType: t.electionType,
        votingMethod: t.votingMethod,
        visibility: t.visibility,
        isBuiltIn: t.isBuiltIn,
        createdBy: t.createdBy,
        positionCount: counts.positionCount,
        candidateCount: counts.candidateCount,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      }
    }),
  })
}

// POST /api/workspace/election-templates — save a new template from an
// existing election. Body: { electionId, templateName, templateDescription? }.
// Loads the election + positions + candidates, serializes them into
// `templateData` JSON (stripping IDs and election-specific data), creates the
// template. Requires election.manage permission.
export async function POST(req: NextRequest) {
  const ctx = await auth(req, 'election.manage')
  if (ctx instanceof NextResponse) return ctx

  const orgId = ctx.org?.id
  if (!orgId) return errorJson('Organization context required.', 400)

  const body = await req.json().catch(() => ({}))
  const { electionId, templateName, templateDescription } = body || {}

  if (!electionId || typeof electionId !== 'string') {
    return errorJson('electionId is required', 400)
  }
  if (!templateName || typeof templateName !== 'string' || !templateName.trim()) {
    return errorJson('templateName is required', 400)
  }

  // Load the election + positions + candidates, verifying org ownership.
  const election = await db.electionSession.findUnique({
    where: { id: electionId },
    include: {
      positions: {
        orderBy: [{ displayOrder: 'asc' }, { order: 'asc' }, { createdAt: 'asc' }],
        include: {
          candidates: {
            orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
          },
        },
      },
    },
  })

  if (!election || election.organizationId !== orgId) {
    return errorJson('Election not found', 404)
  }

  // Build the templateData snapshot — strip all IDs and election-specific data
  // so the template can be applied cleanly to a new election later.
  const templateData = {
    positions: election.positions.map((p) => ({
      title: p.title,
      description: p.description,
      scope: p.scope,
      maximumVotes: p.maximumVotes,
      candidates: p.candidates.map((c) => ({
        fullName: c.fullName,
        slogan: c.slogan,
        manifesto: c.manifesto,
        biography: c.biography,
        photoUrl: c.photoUrl,
      })),
    })),
  }

  // Carry over the election-level config (no dates — those are set when applying).
  const settings = election.settings

  const template = await db.electionTemplate.create({
    data: {
      organizationId: orgId,
      name: String(templateName).trim(),
      description: templateDescription ? String(templateDescription).trim() : null,
      category: election.category,
      electionType: election.electionType,
      votingMethod: election.votingMethod,
      visibility: election.visibility,
      settings,
      templateData: JSON.stringify(templateData),
      isBuiltIn: false,
      createdBy: ctx.user.id,
    },
  })

  await writeAudit({
    actorId: ctx.user.id,
    actorRole: ctx.user.role,
    actorName: ctx.user.name,
    action: 'TEMPLATE_SAVED',
    details: {
      organizationId: orgId,
      electionId,
      templateId: template.id,
      templateName: template.name,
      positionCount: templateData.positions.length,
    },
    ip: getClientIp(req),
    electionId,
  }).catch(() => {})

  return json(
    {
      ok: true,
      template: {
        id: template.id,
        name: template.name,
        description: template.description,
        category: template.category,
        electionType: template.electionType,
        votingMethod: template.votingMethod,
        visibility: template.visibility,
        isBuiltIn: template.isBuiltIn,
        createdAt: template.createdAt.toISOString(),
      },
    },
    201,
  )
}

// Internal helper exported for the apply route to use when generating unique
// slugs for new positions/candidates. Not part of the HTTP API.
export function makeSlug(prefix: string): string {
  const base = String(prefix || 'item')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'item'
  const suffix = randomToken(4).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)
  return `${base}-${suffix}`
}
