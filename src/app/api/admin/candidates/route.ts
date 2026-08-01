import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson, getClientIp, writeAudit } from '@/lib/election'
import { requireOfficial } from '@/lib/guards'
import { getOrgScope } from '@/lib/org-scope'

export const dynamic = 'force-dynamic'

// GET /api/admin/candidates — tenant-scoped by organizationId.
export async function GET(req: NextRequest) {
  const auth = await requireOfficial(req, 'candidate.screen')
  if (auth instanceof Response) return auth
  const { org } = await getOrgScope(req)
  const candidates = await db.candidate.findMany({
    where: org ? { electionSession: { organizationId: org.id } } : {},
    orderBy: [{ position: { order: 'asc' } }, { displayOrder: 'asc' }],
    include: {
      position: { select: { id: true, title: true, slug: true, scope: true } },
      faculty: { select: { id: true, name: true, code: true } },
      department: { select: { id: true, name: true, code: true } },
      politicalParty: { select: { id: true, name: true, acronym: true } },
    },
  })
  return json({ candidates })
}

// POST /api/admin/candidates — create.
export async function POST(req: NextRequest) {
  const auth = await requireOfficial(req, 'candidate.screen')
  if (auth instanceof Response) return auth
  const body = await req.json().catch(() => ({}))
  const { fullName, positionId, facultyId, departmentId, level, slogan, manifesto, campaignVideoUrl, photoUrl, status, displayOrder, politicalPartyId, screeningStatus, screeningNotes, cgpa } = body
  if (!fullName || !positionId) return errorJson('fullName and positionId are required', 400)
  const slug = String(fullName).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Math.random().toString(36).slice(2, 6)
  const candidate = await db.candidate.create({
    data: {
      fullName, slug, positionId,
      facultyId: facultyId || null, departmentId: departmentId || null,
      level: level || null, slogan: slogan || null, manifesto: manifesto || null,
      campaignVideoUrl: campaignVideoUrl || null, photoUrl: photoUrl || null,
      status: status || 'APPROVED', displayOrder: typeof displayOrder === 'number' ? displayOrder : 0,
      politicalPartyId: politicalPartyId || null,
      screeningStatus: screeningStatus || 'PENDING', screeningNotes: screeningNotes || null,
      cgpa: cgpa || null, screenedById: (auth as any).official.id, screenedAt: new Date(),
    },
  })
  await writeAudit({ actorId: (auth as any).official.id, actorRole: (auth as any).official.role, actorName: (auth as any).official.name, action: 'CANDIDATE_CREATE', details: { candidateId: candidate.id, fullName }, ip: getClientIp(req) })
  return json({ ok: true, candidate })
}
