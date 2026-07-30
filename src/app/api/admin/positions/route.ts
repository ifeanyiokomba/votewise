import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson, getClientIp, writeAudit } from '@/lib/election'
import { requireOfficial } from '@/lib/guards'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireOfficial(req, 'election.manage')
  if (auth instanceof Response) return auth
  const positions = await db.position.findMany({
    orderBy: { order: 'asc' },
    include: { faculty: { select: { name: true, code: true } }, department: { select: { name: true, code: true } }, _count: { select: { candidates: true } } },
  })
  return json({ positions })
}

export async function POST(req: NextRequest) {
  const auth = await requireOfficial(req, 'election.manage')
  if (auth instanceof Response) return auth
  const body = await req.json().catch(() => ({}))
  const { title, scope, description, facultyId, departmentId, order } = body
  if (!title || !scope) return errorJson('title and scope are required', 400)
  const slug = String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.random().toString(36).slice(2, 5)
  const election = await db.electionSession.findFirst({ orderBy: { createdAt: 'desc' } })
  const position = await db.position.create({
    data: {
      title, slug, scope, description: description || null,
      electionSessionId: election?.id || null,
      facultyId: scope === 'FACULTY' ? facultyId : null,
      departmentId: scope === 'DEPARTMENT' ? departmentId : null,
      order: typeof order === 'number' ? order : 0,
    },
  })
  await writeAudit({ actorId: (auth as any).official.id, actorRole: (auth as any).official.role, actorName: (auth as any).official.name, action: 'POSITION_CREATE', details: { positionId: position.id, title }, ip: getClientIp(req) })
  return json({ ok: true, position })
}
