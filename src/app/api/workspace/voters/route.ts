import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson, writeAudit, getClientIp } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { getCurrentOfficial } from '@/lib/guards'

export const dynamic = 'force-dynamic'

// GET /api/workspace/voters — master voter registry with search + pagination.
// Searches across firstName, lastName, email, phone, AND dynamic metadata fields.
export async function GET(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim()
  const status = searchParams.get('status')
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const pageSize = Math.min(200, parseInt(searchParams.get('pageSize') || '50', 10))

  const where: Record<string, unknown> = { organizationId: org.id }
  if (q) {
    where.OR = [
      { firstName: { contains: q } },
      { lastName: { contains: q } },
      { email: { contains: q } },
      { phone: { contains: q } },
      { matric: { contains: q } },
      { fullName: { contains: q } },
    ]
  }
  if (status === 'active') where.status = 'ACTIVE'
  if (status === 'suspended') where.status = 'SUSPENDED'
  if (status === 'pending') where.verificationStatus = 'PENDING'
  if (status === 'verified') where.verificationStatus = 'VERIFIED'

  const [total, voters] = await Promise.all([
    db.voter.count({ where }),
    db.voter.findMany({
      where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize,
      select: {
        id: true, organizationId: true, firstName: true, lastName: true, email: true,
        phone: true, status: true, verificationStatus: true, metadata: true,
        hasVoted: true, flagged: true, createdAt: true, matric: true, fullName: true,
      },
    }),
  ])

  return json({ voters, total, page, pageSize, totalPages: Math.ceil(total / pageSize) })
}

// POST /api/workspace/voters — add a single voter to the master registry.
export async function POST(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  const official = await getCurrentOfficial(req)
  if (!official) return errorJson('Unauthorized', 401)

  const body = await req.json().catch(() => ({}))
  const { firstName, lastName, email, phone, metadata } = body
  if (!firstName && !lastName) return errorJson('First name or last name is required', 400)

  // Generate a unique voter ID
  const uniqueVoterId = `VW-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase()

  const voter = await db.voter.create({
    data: {
      organizationId: org.id,
      firstName: firstName || null,
      lastName: lastName || null,
      email: email || null,
      phone: phone || null,
      metadata: metadata ? JSON.stringify(metadata) : null,
      status: 'ACTIVE',
      verificationStatus: 'PENDING',
      matric: uniqueVoterId, // use matric as unique voter ID (legacy compat)
      fullName: `${firstName || ''} ${lastName || ''}`.trim(),
      facultyId: 'legacy', // legacy required field — use placeholder
      departmentId: 'legacy',
      level: 'N/A',
    },
  }).catch(() => null)

  if (!voter) return errorJson('Failed to create voter', 500)

  // Record timeline event
  await db.voterTimelineEvent.create({
    data: {
      organizationId: org.id, voterId: voter.id,
      eventType: 'IMPORTED', description: 'Voter added to master registry',
      actorId: official.id, actorName: official.name,
    },
  }).catch(() => {})

  return json({ ok: true, voter })
}

// PATCH /api/workspace/voters — bulk operations.
// Body: { action: 'suspend'|'reactivate'|'verify'|'delete', voterIds: string[] }
export async function PATCH(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  const official = await getCurrentOfficial(req)
  if (!official) return errorJson('Unauthorized', 401)

  const body = await req.json().catch(() => ({}))
  const { action, voterIds } = body
  if (!action || !voterIds || !Array.isArray(voterIds))
    return errorJson('action and voterIds are required', 400)

  let updated = 0
  for (const id of voterIds) {
    try {
      if (action === 'suspend') {
        await db.voter.update({ where: { id }, data: { status: 'SUSPENDED' } })
        await db.voterTimelineEvent.create({ data: { organizationId: org.id, voterId: id, eventType: 'SUSPENDED', actorId: official.id, actorName: official.name } })
      } else if (action === 'reactivate') {
        await db.voter.update({ where: { id }, data: { status: 'ACTIVE' } })
        await db.voterTimelineEvent.create({ data: { organizationId: org.id, voterId: id, eventType: 'REACTIVATED', actorId: official.id, actorName: official.name } })
      } else if (action === 'verify') {
        await db.voter.update({ where: { id }, data: { verificationStatus: 'VERIFIED' } })
        await db.voterTimelineEvent.create({ data: { organizationId: org.id, voterId: id, eventType: 'EMAIL_VERIFIED', description: 'Manually verified', actorId: official.id, actorName: official.name } })
      }
      updated++
    } catch {}
  }

  await writeAudit({
    actorId: official.id, actorRole: official.role, actorName: official.name,
    action: 'BULK_VOTER_OPERATION',
    details: { organizationId: org.id, action, count: updated },
    ip: getClientIp(req),
  }).catch(() => {})

  return json({ ok: true, updated })
}
