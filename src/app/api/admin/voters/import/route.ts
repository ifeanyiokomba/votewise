import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson, getClientIp, writeAudit } from '@/lib/election'
import { requireOfficial } from '@/lib/guards'
import { scopeCovers } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

// POST /api/admin/voters/import
// Body: { voters: [{ matric, fullName, institutionEmail, phone, facultyCode, departmentCode, level }] }
export async function POST(req: NextRequest) {
  const auth = await requireOfficial(req, 'voter.manage')
  if (auth instanceof Response) return auth
  const ctx = (auth as any).ctx
  const body = await req.json().catch(() => ({}))
  const list: any[] = Array.isArray(body.voters) ? body.voters : []
  if (list.length === 0) return errorJson('No voters provided', 400)

  const faculties = await db.faculty.findMany()
  const departments = await db.department.findMany()
  const facByCode = new Map(faculties.map((f) => [f.code.toUpperCase(), f]))
  const depByCode = new Map(departments.map((d) => [d.code.toUpperCase(), d]))
  const election = await db.electionSession.findFirst({ orderBy: { createdAt: 'desc' } })

  let created = 0, updated = 0, skipped = 0
  const errors: string[] = []
  for (const v of list) {
    const matric = String(v.matric || '').trim().toUpperCase()
    if (!matric) { skipped++; continue }
    const fac = facByCode.get(String(v.facultyCode || '').trim().toUpperCase())
    const dep = depByCode.get(String(v.departmentCode || '').trim().toUpperCase())
    if (!fac || !dep) { errors.push(`${matric}: invalid faculty/department code`); skipped++; continue }
    // Scope enforcement for faculty/department officers.
    if (!scopeCovers(ctx, { facultyId: fac.id, departmentId: dep.id })) { errors.push(`${matric}: out of your scope`); skipped++; continue }
    const existing = await db.voter.findUnique({ where: { matric } })
    await db.voter.upsert({
      where: { matric },
      create: {
        matric, fullName: v.fullName || matric,
        institutionEmail: v.institutionEmail || v.email || null, phone: v.phone || null,
        facultyId: fac.id, departmentId: dep.id, level: v.level || '100',
        electionSessionId: election?.id || null,
      },
      update: { fullName: v.fullName || undefined, institutionEmail: v.institutionEmail || v.email || undefined, phone: v.phone || undefined, facultyId: fac.id, departmentId: dep.id, level: v.level || undefined },
    })
    if (existing) updated++; else created++
  }
  await writeAudit({ actorId: (auth as any).official.id, actorRole: (auth as any).official.role, actorName: (auth as any).official.name, action: 'VOTER_BULK_IMPORT', details: { total: list.length, created, updated, skipped }, ip: getClientIp(req) })
  return json({ ok: true, created, updated, skipped, errors })
}
