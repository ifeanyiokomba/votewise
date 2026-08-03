import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson, writeAudit, getClientIp } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { requirePermission, type IAMContext } from '@/lib/iam'
import { randomToken } from '@/lib/crypto'
import { getCurrentOfficial } from '@/lib/guards'

export const dynamic = 'force-dynamic'

// Allowed scope values. Kept as a string list (Prisma SQLite can't model an
// enum here without migrating the column). New scopes are additive only.
const ALLOWED_SCOPES = [
  'ORGANIZATION',
  'WORKSPACE',
  'VOTER_GROUP',
  'UNIVERSITY',
  'FACULTY',
  'DEPARTMENT',
] as const
type Scope = (typeof ALLOWED_SCOPES)[number]

function isScope(v: unknown): v is Scope {
  return typeof v === 'string' && (ALLOWED_SCOPES as readonly string[]).includes(v)
}

// Helper: run requirePermission and unwrap to IAMContext or NextResponse.
async function auth(
  req: NextRequest,
  perm: Parameters<typeof requirePermission>[1],
): Promise<IAMContext | NextResponse> {
  return requirePermission(req, perm)
}

// GET /api/workspace/elections/[id]/positions — list all positions for an
// election, ordered by displayOrder. Includes `_count.candidates` for each.
// Read access requires org context (any org member).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Auth check — closes the endpoint authentication gap (audit finding)
  const official = await getCurrentOfficial(req)
  if (!official) return errorJson('Unauthorized', 401)
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult
  const { id } = await params

  // Verify the election belongs to this org.
  const election = await db.electionSession.findUnique({
    where: { id },
    select: { id: true, organizationId: true, name: true, status: true },
  })
  if (!election || election.organizationId !== org.id) {
    return errorJson('Election not found', 404)
  }

  // Fetch positions ordered by displayOrder, with candidate counts.
  const positions = await db.position.findMany({
    where: { electionSessionId: id },
    orderBy: [{ displayOrder: 'asc' }, { order: 'asc' }, { createdAt: 'asc' }],
    include: {
      _count: { select: { candidates: true } },
    },
  })

  // Compute aggregate stats.
  const totalCandidates = positions.reduce((sum, p) => sum + p._count.candidates, 0)
  const stats = {
    total: positions.length,
    candidates: totalCandidates,
    singleChoice: positions.filter((p) => p.maximumVotes <= 1).length,
    multipleChoice: positions.filter((p) => p.maximumVotes > 1).length,
  }

  return json({
    electionId: id,
    electionName: election.name,
    electionStatus: election.status,
    positions: positions.map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      description: p.description,
      scope: p.scope,
      maximumVotes: p.maximumVotes,
      displayOrder: p.displayOrder,
      order: p.order,
      facultyId: p.facultyId,
      departmentId: p.departmentId,
      _count: { candidates: p._count.candidates },
      createdAt: p.createdAt.toISOString(),
    })),
    stats,
  })
}

// POST /api/workspace/elections/[id]/positions — add a new position.
// Body: { title, description?, scope, maximumVotes?, displayOrder? }.
// Auto-generates a unique slug from title + random suffix.
// Requires election.manage permission. Creates an ElectionEvent + audit log.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await auth(req, 'election.manage')
  if (ctx instanceof NextResponse) return ctx

  const { id: electionId } = await params
  const orgId = ctx.org?.id
  if (!orgId) return errorJson('Organization context required.', 400)

  // Verify the election belongs to this org.
  const election = await db.electionSession.findUnique({
    where: { id: electionId },
    select: { id: true, organizationId: true, name: true, status: true },
  })
  if (!election || election.organizationId !== orgId) {
    return errorJson('Election not found', 404)
  }

  const body = await req.json().catch(() => ({}))
  const { title, description, scope, maximumVotes, displayOrder } = body || {}

  // Validate required fields.
  if (!title || typeof title !== 'string' || !title.trim()) {
    return errorJson('title is required', 400)
  }
  if (!isScope(scope)) {
    return errorJson(`scope is required and must be one of: ${ALLOWED_SCOPES.join(', ')}`, 400)
  }

  // Validate maximumVotes (default 1, min 1).
  let mv = 1
  if (maximumVotes !== undefined && maximumVotes !== null && maximumVotes !== '') {
    const n = Number(maximumVotes)
    if (!Number.isFinite(n) || n < 1 || !Number.isInteger(n)) {
      return errorJson('maximumVotes must be a positive integer (>= 1)', 400)
    }
    mv = n
  }

  // Generate a unique slug from title + random suffix.
  const baseSlug = String(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'position'
  const suffix = randomToken(3).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 6)
  let slug = `${baseSlug}-${suffix}`
  // Defend against the rare collision — re-roll once if needed.
  const existing = await db.position.findUnique({ where: { slug }, select: { id: true } })
  if (existing) {
    slug = `${baseSlug}-${randomToken(4).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)}`
  }

  // Calculate displayOrder: append to end unless caller specified one.
  let order = typeof displayOrder === 'number' ? displayOrder : 0
  if (typeof displayOrder !== 'number') {
    const last = await db.position.findFirst({
      where: { electionSessionId: electionId },
      orderBy: { displayOrder: 'desc' },
      select: { displayOrder: true },
    })
    order = (last?.displayOrder ?? -1) + 1
  }

  const position = await db.position.create({
    data: {
      title: title.trim(),
      slug,
      description: description ? String(description).trim() || null : null,
      scope,
      maximumVotes: mv,
      displayOrder: order,
      order,
      organizationId: orgId,
      electionSessionId: electionId,
    },
    include: {
      _count: { select: { candidates: true } },
    },
  })

  // Timeline event.
  await db.electionEvent
    .create({
      data: {
        electionId,
        organizationId: orgId,
        eventType: 'POSITION_CREATED',
        description: `Position "${title.trim()}" created${mv > 1 ? ` (multiple choice, ${mv} votes)` : ' (single choice)'} — scope ${scope}`,
        actorId: ctx.user.id,
        actorName: ctx.user.name,
        metadata: JSON.stringify({ positionId: position.id, slug, scope, maximumVotes: mv }),
      },
    })
    .catch(() => {})

  await writeAudit({
    actorId: ctx.user.id,
    actorRole: ctx.user.role,
    actorName: ctx.user.name,
    action: 'POSITION_CREATE',
    details: {
      organizationId: orgId,
      electionId,
      positionId: position.id,
      title: title.trim(),
      scope,
      maximumVotes: mv,
    },
    ip: getClientIp(req),
    electionId,
  }).catch(() => {})

  return json(
    {
      ok: true,
      position: {
        id: position.id,
        title: position.title,
        slug: position.slug,
        description: position.description,
        scope: position.scope,
        maximumVotes: position.maximumVotes,
        displayOrder: position.displayOrder,
        order: position.order,
        _count: { candidates: position._count.candidates },
        createdAt: position.createdAt.toISOString(),
      },
    },
    201,
  )
}
