import { NextRequest } from 'next/server'
import { json, errorJson, getClientIp, writeAudit } from '@/lib/election'
import { requireAdmin } from '@/lib/guards'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/admin/voters — paginated list + search.
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof Response) return auth
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim()
  const status = searchParams.get('status') // voted | pending
  const facultyId = searchParams.get('facultyId')
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') || '50', 10))

  const where: Record<string, unknown> = {}
  if (q) where.OR = [{ matric: { contains: q } }, { fullName: { contains: q } }, { email: { contains: q } }, { phone: { contains: q } }]
  if (status === 'voted') where.hasVoted = true
  if (status === 'pending') where.hasVoted = false
  if (facultyId) where.facultyId = facultyId

  const [total, voters] = await Promise.all([
    db.voter.count({ where }),
    db.voter.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { faculty: { select: { name: true, code: true } }, department: { select: { name: true, code: true } } },
    }),
  ])
  return json({ voters, total, page, pageSize, totalPages: Math.ceil(total / pageSize) })
}

// POST /api/admin/voters — create a single voter.
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof Response) return auth
  const body = await req.json().catch(() => ({}))
  const { matric, fullName, email, phone, facultyId, departmentId, level } = body
  if (!matric || !fullName || !facultyId || !departmentId || !level) return errorJson('matric, fullName, facultyId, departmentId, level are required', 400)
  const voter = await db.voter.upsert({
    where: { matric: String(matric).toUpperCase() },
    create: { matric: String(matric).toUpperCase(), fullName, email: email || null, phone: phone || null, facultyId, departmentId, level },
    update: { fullName, email: email || null, phone: phone || null, facultyId, departmentId, level },
  })
  await writeAudit({ actorId: auth.admin!.id, actorRole: auth.admin!.role, actorName: auth.admin!.name, action: 'VOTER_CREATE', details: { matric }, ip: getClientIp(req) })
  return json({ ok: true, voter })
}
