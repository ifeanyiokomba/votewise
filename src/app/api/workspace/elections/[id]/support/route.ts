import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson, writeAudit, getClientIp } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { requireOfficial } from '@/lib/guards'

export const dynamic = 'force-dynamic'

const VALID_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'ESCALATED', 'CLOSED']
const VALID_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']

// Row shape returned by the raw SQL query below.
interface TicketRow {
  id: string
  electionId: string | null
  voterId: string | null
  voterName: string | null
  voterMatric: string | null
  issueType: string
  description: string
  status: string
  priority: string
  assignedTo: string | null
  assignedToName: string | null
  openedBy: string | null
  category: string | null
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
  resolution: string | null
}

function normalizeTicket(t: any): TicketRow {
  return {
    ...t,
    priority: t.priority === 'NORMAL' ? 'MEDIUM' : (VALID_PRIORITIES.includes(t.priority) ? t.priority : 'MEDIUM'),
    status: VALID_STATUSES.includes(t.status) ? t.status : 'OPEN',
    createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : String(t.createdAt),
    updatedAt: t.updatedAt instanceof Date ? t.updatedAt.toISOString() : String(t.updatedAt),
    resolvedAt: t.resolvedAt instanceof Date ? t.resolvedAt.toISOString() : (t.resolvedAt ? String(t.resolvedAt) : null),
  }
}

// GET /api/workspace/elections/[id]/support
// Returns all SupportTickets linked to this election. Org-scoped via
// requireOrganization — anyone authenticated inside the org can view the
// list (the per-ticket PATCH still requires `ticket.triage`).
//
// NOTE: uses raw SQL because the dev server may hold a stale Prisma client
// class after `prisma db push` regenerates the client (the new
// SupportTicket.electionId field may not be recognized until a full
// process restart). Raw SQL bypasses the model-layer validation.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Auth check — closes the endpoint authentication gap (audit finding)
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth) return errorJson('Unauthorized', 401)
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult
  const { id } = await params

  const election = await db.electionSession.findUnique({
    where: { id },
    select: { id: true, name: true, organizationId: true },
  })
  if (!election || election.organizationId !== org.id) {
    return errorJson('Election not found', 404)
  }

  const rows: any[] = await db.$queryRawUnsafe(
    `SELECT id, electionId, voterId, voterName, voterMatric, issueType,
            description, status, priority, assignedTo, assignedToName,
            openedBy, category, createdAt, updatedAt, resolvedAt, resolution
     FROM SupportTicket
     WHERE electionId = ?
     ORDER BY datetime(createdAt) DESC`,
    id,
  )

  const tickets = rows.map(normalizeTicket)

  return json({
    tickets,
    electionId: id,
    electionName: election.name,
    counts: {
      total: tickets.length,
      open: tickets.filter((t) => t.status === 'OPEN').length,
      inProgress: tickets.filter((t) => t.status === 'IN_PROGRESS').length,
      resolved: tickets.filter((t) => t.status === 'RESOLVED' || t.status === 'CLOSED').length,
      escalated: tickets.filter((t) => t.status === 'ESCALATED').length,
    },
  })
}

// POST /api/workspace/elections/[id]/support
// Creates a new support ticket linked to this election. Requires `ticket.triage`.
// Body: { voterName?, issueType, description, priority? }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult
  const { id } = await params

  const officialRes = await requireOfficial(req, 'ticket.triage')
  if (officialRes instanceof Response) return officialRes
  const official = officialRes.official

  const election = await db.electionSession.findUnique({
    where: { id },
    select: { id: true, name: true, organizationId: true },
  })
  if (!election || election.organizationId !== org.id) {
    return errorJson('Election not found', 404)
  }

  const body = await req.json().catch(() => ({}))
  const issueType = typeof body.issueType === 'string' ? body.issueType.trim() : ''
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  if (!issueType) return errorJson('issueType is required', 400)
  if (!description) return errorJson('description is required', 400)
  if (description.length > 5000) return errorJson('description is too long (max 5000 chars)', 400)

  const voterName = (typeof body.voterName === 'string' ? body.voterName.trim() : '') || 'Anonymous'
  const priority = VALID_PRIORITIES.includes(body.priority) ? body.priority : 'MEDIUM'

  // Use raw INSERT to avoid any stale-Prisma-class issues. Generate a CUID
  // via Prisma's lower-level helper or fall back to a simple crypto-based id.
  const ticketId = generateId()
  const now = new Date().toISOString()
  await db.$executeRawUnsafe(
    `INSERT INTO SupportTicket
       (id, organizationId, electionId, voterName, voterMatric,
        issueType, description, status, priority, openedBy, category,
        createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ticketId,
    org.id,
    id,
    voterName,
    body.voterMatric || 'N/A',
    issueType,
    description,
    'OPEN',
    priority,
    official.id,
    body.category || 'OTHER',
    now,
    now,
  )

  // Audit log entry.
  await writeAudit({
    actorId: official.id,
    actorRole: official.role,
    actorName: official.name,
    action: 'SUPPORT_TICKET_CREATED',
    details: {
      organizationId: org.id,
      electionId: id,
      ticketId,
      issueType,
      priority,
    },
    ip: getClientIp(req),
    electionId: id,
  }).catch(() => {})

  return json({
    ok: true,
    ticket: {
      id: ticketId,
      electionId: id,
      voterId: null,
      voterName,
      voterMatric: body.voterMatric || 'N/A',
      issueType,
      description,
      status: 'OPEN',
      priority,
      assignedTo: null,
      assignedToName: null,
      openedBy: official.id,
      category: body.category || 'OTHER',
      createdAt: now,
      updatedAt: now,
      resolvedAt: null,
      resolution: null,
    },
  }, 201)
}

// 8-byte random hex id (cuid-shaped) — sufficient for dev/sample tickets.
// Production uses Prisma's cuid() generation.
import { randomBytes } from 'crypto'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
function generateId(): string {
  const ts = Date.now().toString(36)
  const rand = randomBytes(8).toString('hex')
  return `ck${ts}${rand}`.slice(0, 24)
}
