import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json } from '@/lib/election'
import { requireOfficial } from '@/lib/guards'
import { scopeCovers } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

// GET /api/observer/voters?q=...
export async function GET(req: NextRequest) {
  const auth = await requireOfficial(req, 'voter.search')
  if (auth instanceof Response) return auth
  const ctx = (auth as any).ctx
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim()
  if (!q) return json({ voters: [] })
  const where = {
    OR: [{ matric: { contains: q } }, { fullName: { contains: q } }, { institutionEmail: { contains: q } }, { personalEmail: { contains: q } }, { phone: { contains: q } }],
    ...(ctx.role === 'FACULTY_OFFICER' ? { facultyId: ctx.scopeFacultyId } : {}),
    ...(ctx.role === 'DEPARTMENT_OFFICER' ? { departmentId: ctx.scopeDepartmentId } : {}),
  }
  const voters = await db.voter.findMany({
    where, take: 50,
    include: { faculty: { select: { name: true, code: true } }, department: { select: { name: true, code: true } } },
  })
  return json({ voters })
}
