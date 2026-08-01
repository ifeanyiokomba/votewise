import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson, writeAudit, getClientIp } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { getCurrentOfficial } from '@/lib/guards'

export const dynamic = 'force-dynamic'

// POST /api/workspace/elections/[id]/duplicate — duplicate an election.
// Copies everything except votes, results, and audit logs.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult
  const { id } = await params

  const official = await getCurrentOfficial(req)
  if (!official) return errorJson('Unauthorized', 401)

  const original = await db.electionSession.findUnique({
    where: { id },
    include: {
      positions: { include: { candidates: true } },
    },
  })

  if (!original || original.organizationId !== org.id)
    return errorJson('Election not found', 404)

  // Create the duplicate with a new name
  const newName = `${original.name} (Copy)`
  const duplicate = await db.electionSession.create({
    data: {
      organizationId: org.id,
      workspaceId: original.workspaceId,
      name: newName,
      description: original.description,
      category: original.category,
      electionType: original.electionType,
      votingMethod: original.votingMethod,
      visibility: original.visibility,
      academicSession: original.academicSession,
      university: original.university,
      startTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // default: 1 week from now
      endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 6 * 60 * 60 * 1000), // 6h voting
      accreditationStart: null,
      accreditationEnd: null,
      candidateRegStart: null,
      candidateRegEnd: null,
      resultsReleaseAt: null,
      settings: original.settings,
      createdById: official.id,
      status: 'DRAFT',
    },
  })

  // Copy positions and candidates
  for (const pos of original.positions) {
    const newPos = await db.position.create({
      data: {
        electionSessionId: duplicate.id,
        organizationId: org.id,
        title: pos.title,
        slug: `${pos.slug}-copy-${Date.now().toString(36)}`,
        description: pos.description,
        scope: pos.scope,
        maximumVotes: pos.maximumVotes,
        displayOrder: pos.displayOrder,
      },
    })
    for (const cand of pos.candidates) {
      await db.candidate.create({
        data: {
          electionSessionId: duplicate.id,
          organizationId: org.id,
          positionId: newPos.id,
          fullName: cand.fullName,
          slug: `${cand.slug}-copy-${Date.now().toString(36)}`,
          slogan: cand.slogan,
          manifesto: cand.manifesto,
          campaignVideoUrl: cand.campaignVideoUrl,
          photoUrl: cand.photoUrl,
          biography: cand.biography,
          screeningStatus: 'PENDING',
          status: 'APPROVED',
          displayOrder: cand.displayOrder,
        },
      })
    }
  }

  // Record timeline events
  await db.electionEvent.create({
    data: {
      electionId: duplicate.id, organizationId: org.id,
      eventType: 'CREATED',
      description: `Election duplicated from "${original.name}"`,
      actorId: official.id, actorName: official.name,
    },
  }).catch(() => {})
  await db.electionEvent.create({
    data: {
      electionId: original.id, organizationId: org.id,
      eventType: 'DUPLICATED',
      description: `Duplicated to "${newName}"`,
      actorId: official.id, actorName: official.name,
    },
  }).catch(() => {})

  await writeAudit({
    actorId: official.id, actorRole: official.role, actorName: official.name,
    action: 'ELECTION_DUPLICATED',
    details: { organizationId: org.id, originalId: id, duplicateId: duplicate.id },
    ip: getClientIp(req),
  }).catch(() => {})

  return json({ ok: true, election: duplicate })
}
