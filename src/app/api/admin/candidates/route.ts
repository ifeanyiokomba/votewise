import { NextRequest } from 'next/server'
import { json, errorJson, getClientIp, writeAudit } from '@/lib/election'
import { requireAdmin } from '@/lib/guards'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/admin/candidates — list ALL candidates (any status) for admin.
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof Response) return auth
  const candidates = await db.candidate.findMany({
    orderBy: [{ position: { order: 'asc' } }, { displayOrder: 'asc' }],
    include: {
      position: { select: { id: true, title: true, slug: true, scope: true } },
      faculty: { select: { id: true, name: true, code: true } },
      department: { select: { id: true, name: true, code: true } },
    },
  })
  return json({ candidates })
}

// POST /api/admin/candidates — create a candidate.
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof Response) return auth
  const body = await req.json().catch(() => ({}))
  const { fullName, positionId, facultyId, departmentId, level, slogan, manifesto, photoUrl, status, displayOrder } = body
  if (!fullName || !positionId) return errorJson('fullName and positionId are required', 400)
  const slug = String(fullName).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Math.random().toString(36).slice(2, 6)
  const candidate = await db.candidate.create({
    data: {
      fullName,
      slug,
      positionId,
      facultyId: facultyId || null,
      departmentId: departmentId || null,
      level: level || null,
      slogan: slogan || null,
      manifesto: manifesto || null,
      photoUrl: photoUrl || null,
      status: status || 'APPROVED',
      displayOrder: typeof displayOrder === 'number' ? displayOrder : 0,
    },
  })
  await writeAudit({ actorId: auth.admin!.id, actorRole: auth.admin!.role, actorName: auth.admin!.name, action: 'CANDIDATE_CREATE', details: { candidateId: candidate.id, fullName }, ip: getClientIp(req) })
  return json({ ok: true, candidate })
}
