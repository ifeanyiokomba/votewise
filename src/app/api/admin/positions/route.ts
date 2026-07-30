import { NextRequest } from 'next/server'
import { json, errorJson, getClientIp, writeAudit } from '@/lib/election'
import { requireAdmin } from '@/lib/guards'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/admin/positions
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof Response) return auth
  const positions = await db.position.findMany({
    orderBy: { order: 'asc' },
    include: { faculty: { select: { name: true, code: true } }, department: { select: { name: true, code: true } }, _count: { select: { candidates: true } } },
  })
  return json({ positions })
}

// POST /api/admin/positions
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof Response) return auth
  const body = await req.json().catch(() => ({}))
  const { title, scope, description, facultyId, departmentId, order } = body
  if (!title || !scope) return errorJson('title and scope are required', 400)
  const slug = String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.random().toString(36).slice(2, 5)
  const position = await db.position.create({
    data: { title, slug, scope, description: description || null, facultyId: scope === 'FACULTY' ? facultyId : null, departmentId: scope === 'DEPARTMENT' ? departmentId : null, order: typeof order === 'number' ? order : 0 },
  })
  await writeAudit({ actorId: auth.admin!.id, actorRole: auth.admin!.role, actorName: auth.admin!.name, action: 'POSITION_CREATE', details: { positionId: position.id, title }, ip: getClientIp(req) })
  return json({ ok: true, position })
}
