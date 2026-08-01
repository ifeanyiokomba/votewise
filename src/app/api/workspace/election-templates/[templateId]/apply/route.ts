import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson, writeAudit, getClientIp } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { requirePermission, type IAMContext } from '@/lib/iam'
import { randomToken } from '@/lib/crypto'

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

function safeParse(data: string | null | undefined): any | null {
  if (!data) return null
  try { return JSON.parse(data) } catch { return null }
}

// Generate a unique slug from a prefix + random suffix.
function makeSlug(prefix: string): string {
  const base = String(prefix || 'item')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'item'
  const suffix = randomToken(4).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)
  return `${base}-${suffix}`
}

const ALLOWED_SCOPES = new Set([
  'ORGANIZATION', 'WORKSPACE', 'VOTER_GROUP',
  'UNIVERSITY', 'FACULTY', 'DEPARTMENT',
])

// POST /api/workspace/election-templates/[templateId]/apply — create a new
// election from a template. Body: { name, startTime, endTime, workspaceId? }.
// Creates a new ElectionSession with the template's config, then creates
// positions + candidates from templateData (with fresh IDs). Returns the new
// election ID. Requires election.create permission.
export async function POST(req: NextRequest, { params }: { params: Promise<{ templateId: string }> }) {
  const ctx = await auth(req, 'election.create')
  if (ctx instanceof NextResponse) return ctx

  const orgId = ctx.org?.id
  if (!orgId) return errorJson('Organization context required.', 400)

  const { templateId } = await params

  const body = await req.json().catch(() => ({}))
  const { name, startTime, endTime, workspaceId } = body || {}

  // Validate required fields.
  if (!name || typeof name !== 'string' || !name.trim()) {
    return errorJson('name is required', 400)
  }
  if (!startTime || !endTime) {
    return errorJson('startTime and endTime are required', 400)
  }
  const start = new Date(startTime)
  const end = new Date(endTime)
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return errorJson('startTime and endTime must be valid ISO dates', 400)
  }
  if (end <= start) {
    return errorJson('endTime must be after startTime', 400)
  }

  // Load the template.
  const template = await db.electionTemplate.findUnique({
    where: { id: templateId },
  })
  if (!template) return errorJson('Template not found', 404)

  // Tenant isolation: built-in templates are shared; org templates are org-scoped.
  if (template.organizationId !== BUILT_IN_ORG_ID && template.organizationId !== orgId) {
    return errorJson('Template not found', 404)
  }

  // Parse template data + settings.
  const parsed = safeParse(template.templateData)
  const positions = Array.isArray(parsed?.positions) ? parsed.positions : []
  const settings = safeParse(template.settings)

  // If a workspaceId was provided, verify it belongs to this org.
  let resolvedWorkspaceId: string | null = null
  if (workspaceId && typeof workspaceId === 'string') {
    const ws = await db.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, organizationId: true },
    })
    if (!ws || ws.organizationId !== orgId) {
      return errorJson('Workspace not found', 404)
    }
    resolvedWorkspaceId = ws.id
  }

  // Create the new election (DRAFT — caller can publish it later).
  const election = await db.electionSession.create({
    data: {
      organizationId: orgId,
      workspaceId: resolvedWorkspaceId,
      name: String(name).trim(),
      description: template.description,
      category: template.category,
      electionType: template.electionType || 'General',
      votingMethod: template.votingMethod || 'Single Choice',
      visibility: template.visibility || 'PRIVATE',
      academicSession: new Date().getFullYear().toString(),
      university: ctx.org?.name || '',
      startTime: start,
      endTime: end,
      accreditationStart: null,
      accreditationEnd: null,
      candidateRegStart: null,
      candidateRegEnd: null,
      resultsReleaseAt: null,
      settings: template.settings,
      createdById: ctx.user.id,
      status: 'DRAFT',
    },
  })

  // Timeline: created event.
  await db.electionEvent.create({
    data: {
      electionId: election.id,
      organizationId: orgId,
      eventType: 'CREATED',
      description: `Election "${election.name}" created from template "${template.name}"`,
      actorId: ctx.user.id,
      actorName: ctx.user.name,
      metadata: JSON.stringify({
        templateId: template.id,
        templateName: template.name,
        isBuiltIn: template.isBuiltIn,
        positionCount: positions.length,
      }),
    },
  }).catch(() => {})

  // Create positions + candidates from the template snapshot.
  let positionsCreated = 0
  let candidatesCreated = 0
  for (let i = 0; i < positions.length; i++) {
    const p = positions[i]
    if (!p || typeof p.title !== 'string') continue
    const scope = typeof p.scope === 'string' && ALLOWED_SCOPES.has(p.scope) ? p.scope : 'ORGANIZATION'
    const mv = Number.isFinite(Number(p.maximumVotes)) && Number(p.maximumVotes) >= 1
      ? Math.floor(Number(p.maximumVotes))
      : 1

    // Ensure unique slug (defensive — should never collide with random suffix).
    let slug = makeSlug(p.title)
    let attempt = 0
    while (await db.position.findUnique({ where: { slug }, select: { id: true } })) {
      attempt += 1
      if (attempt > 5) break
      slug = makeSlug(`${p.title}-${attempt}`)
    }

    const newPos = await db.position.create({
      data: {
        electionSessionId: election.id,
        organizationId: orgId,
        title: p.title,
        slug,
        description: typeof p.description === 'string' ? p.description : null,
        scope,
        maximumVotes: mv,
        displayOrder: i,
        order: i,
      },
    })
    positionsCreated++

    const cands = Array.isArray(p.candidates) ? p.candidates : []
    for (let j = 0; j < cands.length; j++) {
      const c = cands[j]
      if (!c || typeof c.fullName !== 'string') continue

      let candSlug = makeSlug(c.fullName)
      let candAttempt = 0
      while (await db.candidate.findUnique({ where: { slug: candSlug }, select: { id: true } })) {
        candAttempt += 1
        if (candAttempt > 5) break
        candSlug = makeSlug(`${c.fullName}-${candAttempt}`)
      }

      await db.candidate.create({
        data: {
          electionSessionId: election.id,
          organizationId: orgId,
          positionId: newPos.id,
          fullName: c.fullName,
          slug: candSlug,
          slogan: typeof c.slogan === 'string' ? c.slogan : null,
          manifesto: typeof c.manifesto === 'string' ? c.manifesto : null,
          biography: typeof c.biography === 'string' ? c.biography : null,
          photoUrl: typeof c.photoUrl === 'string' ? c.photoUrl : null,
          screeningStatus: 'PENDING',
          status: 'APPROVED',
          displayOrder: j,
        },
      })
      candidatesCreated++
    }
  }

  await writeAudit({
    actorId: ctx.user.id,
    actorRole: ctx.user.role,
    actorName: ctx.user.name,
    action: 'TEMPLATE_APPLIED',
    details: {
      organizationId: orgId,
      templateId: template.id,
      templateName: template.name,
      isBuiltIn: template.isBuiltIn,
      electionId: election.id,
      electionName: election.name,
      positionsCreated,
      candidatesCreated,
    },
    ip: getClientIp(req),
    electionId: election.id,
  }).catch(() => {})

  return json(
    {
      ok: true,
      electionId: election.id,
      election: {
        id: election.id,
        name: election.name,
        status: election.status,
        startTime: election.startTime.toISOString(),
        endTime: election.endTime.toISOString(),
      },
      stats: {
        positionsCreated,
        candidatesCreated,
      },
    },
    201,
  )
}
