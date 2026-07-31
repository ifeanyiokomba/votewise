import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson, getClientIp, writeAudit, logVoterActivity } from '@/lib/election'
import { requireOfficial } from '@/lib/guards'

export const dynamic = 'force-dynamic'

// GET /api/admin/collation — list all collation submissions
export async function GET(req: NextRequest) {
  const auth = await requireOfficial(req, 'voter.manage')
  if (auth instanceof Response) return auth
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const where: Record<string, unknown> = {}
  if (status) where.status = status
  const collations = await db.studentCollation.findMany({
    where, orderBy: { createdAt: 'desc' }, take: 100,
    include: {
      faculty: { select: { name: true } },
      department: { select: { name: true } },
    },
  })
  return json({ collations })
}

// POST /api/admin/collation — submit voter data for collation
// Body: { facultyId?, departmentId?, students: [{ matric, fullName, email, phone, level }] }
export async function POST(req: NextRequest) {
  const auth = await requireOfficial(req, 'voter.manage')
  if (auth instanceof Response) return auth
  const official = (auth as any).official
  const body = await req.json().catch(() => ({}))
  const { facultyId, departmentId, students } = body

  if (!Array.isArray(students) || students.length === 0)
    return errorJson('Student data is required', 400)

  const collation = await db.studentCollation.create({
    data: {
      tenantId: official.tenantId || null,
      facultyId: facultyId || null,
      departmentId: departmentId || null,
      submittedById: official.id,
      submittedByName: official.name,
      submittedByRole: official.role,
      studentCount: students.length,
      rawData: JSON.stringify(students),
      status: 'PENDING',
    },
  })

  await writeAudit({
    actorId: official.id, actorRole: official.role, actorName: official.name,
    action: 'COLLATION_SUBMITTED', details: { collationId: collation.id, count: students.length }, ip: getClientIp(req),
  })

  return json({ ok: true, collation })
}

// PATCH /api/admin/collation — approve/reject/upload a collation
// Body: { id, action: 'APPROVE_FACULTY' | 'APPROVE_COMMITTEE' | 'REJECT' | 'UPLOAD', notes? }
export async function PATCH(req: NextRequest) {
  const auth = await requireOfficial(req, 'voter.manage')
  if (auth instanceof Response) return auth
  const official = (auth as any).official
  const body = await req.json().catch(() => ({}))
  const { id, action, notes } = body

  const collation = await db.studentCollation.findUnique({ where: { id } })
  if (!collation) return errorJson('Collation not found', 404)

  if (action === 'APPROVE_FACULTY') {
    await db.studentCollation.update({ where: { id }, data: { status: 'FACULTY_APPROVED', reviewedById: official.id, reviewedAt: new Date(), reviewNotes: notes } })
    return json({ ok: true, status: 'FACULTY_APPROVED' })
  }

  if (action === 'APPROVE_COMMITTEE') {
    await db.studentCollation.update({ where: { id }, data: { status: 'COMMITTEE_APPROVED', reviewedById: official.id, reviewedAt: new Date(), reviewNotes: notes } })
    return json({ ok: true, status: 'COMMITTEE_APPROVED' })
  }

  if (action === 'REJECT') {
    await db.studentCollation.update({ where: { id }, data: { status: 'REJECTED', reviewedById: official.id, reviewedAt: new Date(), reviewNotes: notes } })
    return json({ ok: true, status: 'REJECTED' })
  }

  if (action === 'UPLOAD') {
    // Import the students as voters
    const students = JSON.parse(collation.rawData || '[]')
    const { getElectionContext } = await import('@/lib/election')
    const { election } = await getElectionContext()
    let imported = 0
    for (const s of students) {
      // Resolve faculty/department by name if IDs not provided
      let facId = collation.facultyId
      let depId = collation.departmentId
      if (!facId && s.facultyCode) {
        const fac = await db.faculty.findUnique({ where: { code: s.facultyCode } })
        if (fac) facId = fac.id
      }
      if (!depId && s.departmentCode) {
        const dep = await db.department.findUnique({ where: { code: s.departmentCode } })
        if (dep) depId = dep.id
      }
      if (!facId || !depId) continue
      try {
        await db.voter.upsert({
          where: { matric: String(s.matric).toUpperCase() },
          create: {
            matric: String(s.matric).toUpperCase(), fullName: s.fullName,
            institutionEmail: s.email || null, phone: s.phone || null,
            facultyId: facId, departmentId: depId, level: s.level || '100',
            tenantId: collation.tenantId, electionSessionId: election?.id || null,
          },
          update: {},
        })
        imported++
      } catch { /* skip duplicates */ }
    }
    await db.studentCollation.update({ where: { id }, data: { status: 'UPLOADED', importedAt: new Date(), importedCount: imported } })
    await writeAudit({
      actorId: official.id, actorRole: official.role, actorName: official.name,
      action: 'COLLATION_UPLOADED', details: { collationId: id, imported }, ip: getClientIp(req),
    })
    return json({ ok: true, status: 'UPLOADED', imported })
  }

  return errorJson('Unknown action', 400)
}
