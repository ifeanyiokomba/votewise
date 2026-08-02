import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson, writeAudit, getClientIp } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { getCurrentOfficial } from '@/lib/guards'

export const dynamic = 'force-dynamic'

// GET /api/workspace/elections — Election Center: list elections grouped by status.
export async function GET(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  const elections = await db.electionSession.findMany({
    where: { organizationId: org.id },
    orderBy: { createdAt: 'desc' },
    include: {
      workspace: { select: { id: true, name: true, code: true } },
      _count: { select: { voters: true, candidates: true, positions: true, timeline: true } },
    },
  })

  const now = new Date()
  const grouped = {
    running: elections.filter((e) => e.status === 'LIVE' || (now >= e.startTime && now < e.endTime && e.status !== 'CERTIFIED' && e.status !== 'ARCHIVED')),
    upcoming: elections.filter((e) => now < e.startTime && e.status !== 'ARCHIVED' && e.status !== 'CERTIFIED' && e.status !== 'CANCELLED'),
    completed: elections.filter((e) => e.status === 'CERTIFIED' || e.status === 'COMPLETED' || (now >= e.endTime && e.status !== 'ARCHIVED' && e.status !== 'CANCELLED')),
    draft: elections.filter((e) => e.status === 'DRAFT' || e.status === 'PENDING_REVIEW' || e.status === 'READY'),
    archived: elections.filter((e) => e.status === 'ARCHIVED' || e.status === 'CANCELLED'),
  }

  return json({
    stats: {
      total: elections.length,
      running: grouped.running.length,
      upcoming: grouped.upcoming.length,
      completed: grouped.completed.length,
      draft: grouped.draft.length,
      archived: grouped.archived.length,
    },
    ...grouped,
  })
}

// POST /api/workspace/elections — create a new election (Chapter 7 wizard).
export async function POST(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  const official = await getCurrentOfficial(req)
  if (!official) return errorJson('Unauthorized', 401)

  const body = await req.json().catch(() => ({}))
  const { name, description, category, electionType, votingMethod, visibility,
    workspaceId, startTime, endTime, accreditationStart, accreditationEnd,
    candidateRegStart, candidateRegEnd, resultsReleaseAt, settings } = body

  if (!name) return errorJson('Election name is required', 400)
  if (!startTime || !endTime) return errorJson('Start and end times are required', 400)

  const election = await db.electionSession.create({
    data: {
      organizationId: org.id,
      workspaceId: workspaceId || null,
      name: String(name).trim(),
      description: description || null,
      category: category || null,
      electionType: electionType || 'General',
      votingMethod: votingMethod || 'Single Choice',
      visibility: visibility || 'PRIVATE',
      academicSession: new Date().getFullYear().toString(),
      university: org.name,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      accreditationStart: accreditationStart ? new Date(accreditationStart) : null,
      accreditationEnd: accreditationEnd ? new Date(accreditationEnd) : null,
      candidateRegStart: candidateRegStart ? new Date(candidateRegStart) : null,
      candidateRegEnd: candidateRegEnd ? new Date(candidateRegEnd) : null,
      resultsReleaseAt: resultsReleaseAt ? new Date(resultsReleaseAt) : null,
      settings: settings ? JSON.stringify(settings) : null,
      createdById: official.id,
      status: 'DRAFT',
    },
  })

  // Record timeline event
  await db.electionEvent.create({
    data: {
      electionId: election.id,
      organizationId: org.id,
      eventType: 'CREATED',
      description: `Election "${election.name}" created`,
      actorId: official.id,
      actorName: official.name,
    },
  }).catch(() => {})

  await writeAudit({
    actorId: official.id, actorRole: official.role, actorName: official.name,
    action: 'ELECTION_CREATED',
    details: { organizationId: org.id, electionId: election.id, name, type: electionType },
    ip: getClientIp(req),
  }).catch(() => {})

  return json({ ok: true, election })
}
