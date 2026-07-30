import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson, getClientIp, writeAudit } from '@/lib/election'
import { requireOfficial } from '@/lib/guards'
import { scopeCovers } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

// GET /api/admin/voters — scoped list + search.
export async function GET(req: NextRequest) {
  const auth = await requireOfficial(req, 'voter.manage')
  if (auth instanceof Response) return auth
  const ctx = (auth as any).ctx
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim()
  const status = searchParams.get('status')
  const facultyId = searchParams.get('facultyId')
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') || '50', 10))

  const where: Record<string, unknown> = {}
  if (q) where.OR = [{ matric: { contains: q } }, { fullName: { contains: q } }, { institutionEmail: { contains: q } }, { personalEmail: { contains: q } }, { phone: { contains: q } }]
  if (status === 'voted') where.hasVoted = true
  if (status === 'pending') where.hasVoted = false
  // Scope filtering for faculty/department officers.
  if (ctx.role === 'FACULTY_OFFICER') where.facultyId = ctx.scopeFacultyId
  if (ctx.role === 'DEPARTMENT_OFFICER') where.departmentId = ctx.scopeDepartmentId
  if (facultyId && (ctx.role === 'SUPER_ADMIN' || ctx.role === 'ELECTORAL_COMMITTEE')) where.facultyId = facultyId

  const [total, voters] = await Promise.all([
    db.voter.count({ where }),
    db.voter.findMany({
      where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize,
      include: { faculty: { select: { name: true, code: true } }, department: { select: { name: true, code: true } } },
    }),
  ])
  return json({ voters, total, page, pageSize, totalPages: Math.ceil(total / pageSize) })
}

// POST /api/admin/voters — create single voter (scope-checked).
export async function POST(req: NextRequest) {
  const auth = await requireOfficial(req, 'voter.manage')
  if (auth instanceof Response) return auth
  const body = await req.json().catch(() => ({}))
  const { matric, fullName, institutionEmail, personalEmail, phone, facultyId, departmentId, programmeId, level } = body
  if (!matric || !fullName || !facultyId || !departmentId || !level) return errorJson('matric, fullName, facultyId, departmentId, level are required', 400)
  if (!scopeCovers((auth as any).ctx, { facultyId, departmentId })) return errorJson('Your scope does not cover this faculty/department', 403)
  const election = await db.electionSession.findFirst({ orderBy: { createdAt: 'desc' } })
  const voter = await db.voter.upsert({
    where: { matric: String(matric).toUpperCase() },
    create: {
      matric: String(matric).toUpperCase(), fullName,
      institutionEmail: institutionEmail || null, personalEmail: personalEmail || null, phone: phone || null,
      facultyId, departmentId, programmeId: programmeId || null, level,
      electionSessionId: election?.id || null,
    },
    update: { fullName, institutionEmail: institutionEmail || null, personalEmail: personalEmail || null, phone: phone || null, facultyId, departmentId, programmeId: programmeId || null, level },
  })
  await writeAudit({ actorId: (auth as any).official.id, actorRole: (auth as any).official.role, actorName: (auth as any).official.name, action: 'VOTER_CREATE', details: { matric }, ip: getClientIp(req) })
  return json({ ok: true, voter })
}
