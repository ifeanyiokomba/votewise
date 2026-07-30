import { NextRequest } from 'next/server'
import { json, errorJson, getClientIp, writeAudit } from '@/lib/election'
import { requireAdmin } from '@/lib/guards'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// POST /api/admin/voters/import
// Body: { voters: [{ matric, fullName, email, phone, facultyCode, departmentCode, level }] }
// Bulk upsert by matric. Uses faculty/department codes to resolve IDs.
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof Response) return auth
  const body = await req.json().catch(() => ({}))
  const list: any[] = Array.isArray(body.voters) ? body.voters : []
  if (list.length === 0) return errorJson('No voters provided', 400)

  const faculties = await db.faculty.findMany()
  const departments = await db.department.findMany()
  const facByCode = new Map(faculties.map((f) => [f.code.toUpperCase(), f]))
  const depByCode = new Map(departments.map((d) => [d.code.toUpperCase(), d]))

  let created = 0, updated = 0, skipped = 0
  const errors: string[] = []
  for (const v of list) {
    const matric = String(v.matric || '').trim().toUpperCase()
    if (!matric) { skipped++; continue }
    const fac = facByCode.get(String(v.facultyCode || '').trim().toUpperCase())
    const dep = depByCode.get(String(v.departmentCode || '').trim().toUpperCase())
    if (!fac || !dep) { errors.push(`${matric}: invalid faculty/department code`); skipped++; continue }
    const existing = await db.voter.findUnique({ where: { matric } })
    await db.voter.upsert({
      where: { matric },
      create: { matric, fullName: v.fullName || matric, email: v.email || null, phone: v.phone || null, facultyId: fac.id, departmentId: dep.id, level: v.level || '100' },
      update: { fullName: v.fullName || undefined, email: v.email || undefined, phone: v.phone || undefined, facultyId: fac.id, departmentId: dep.id, level: v.level || undefined },
    })
    if (existing) updated++; else created++
  }
  await writeAudit({ actorId: auth.admin!.id, actorRole: auth.admin!.role, actorName: auth.admin!.name, action: 'VOTER_BULK_IMPORT', details: { total: list.length, created, updated, skipped }, ip: getClientIp(req) })
  return json({ ok: true, created, updated, skipped, errors })
}
