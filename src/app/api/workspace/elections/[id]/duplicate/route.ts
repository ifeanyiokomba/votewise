import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson, writeAudit, getClientIp } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { getCurrentOfficial } from '@/lib/guards'

export const dynamic = 'force-dynamic'

// POST /api/workspace/elections/[id]/duplicate — duplicate an election.
// Copies everything except votes, results, and audit logs.
//
// Body (all optional):
//   - name?:        override the new election's name
//   - startTime?:   ISO string — use as the new voting start time (custom mode)
//   - endTime?:     ISO string — use as the new voting end time (custom mode)
//   - shiftDays?:   number — shift ALL original timestamps by this many days
//
// Date resolution:
//   1. Custom mode (startTime + endTime both provided): use them directly.
//      Other lifecycle timestamps (accreditation, candidateReg, results) are
//      shifted by the same delta (newStart − originalStart) so their relative
//      offsets to voting-open are preserved.
//   2. Shift-by-days mode (shiftDays provided): shift every original timestamp
//      by `shiftDays` days. Ideal for "duplicate this election for next year".
//   3. Default fallback (1 week from now): preserves the original behavior —
//      new start = now + 7d, new end = now + 7d + 6h, other timestamps nulled.
//
// Returns: { ok, election } where `election` includes the computed dates so
// the UI can show a confirmation summary.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult
  const { id } = await params

  const official = await getCurrentOfficial(req)
  if (!official) return errorJson('Unauthorized', 401)

  const body = await req.json().catch(() => ({}))
  const { name, startTime, endTime, shiftDays } = body as {
    name?: string
    startTime?: string
    endTime?: string
    shiftDays?: number
  }

  const original = await db.electionSession.findUnique({
    where: { id },
    include: {
      positions: { include: { candidates: true } },
    },
  })

  if (!original || original.organizationId !== org.id)
    return errorJson('Election not found', 404)

  // ---- Resolve the new election's lifecycle timestamps ----------------------
  type DateMode = 'custom' | 'shift' | 'default'
  const mode: DateMode =
    startTime && endTime ? 'custom' : typeof shiftDays === 'number' ? 'shift' : 'default'

  const DAY_MS = 24 * 60 * 60 * 1000
  let newStart: Date
  let newEnd: Date
  let shift: number | null = null // ms delta to apply to the other timestamps

  if (mode === 'custom') {
    newStart = new Date(startTime as string)
    newEnd = new Date(endTime as string)
    if (isNaN(newStart.getTime())) return errorJson('Invalid startTime', 400)
    if (isNaN(newEnd.getTime())) return errorJson('Invalid endTime', 400)
    if (newEnd <= newStart) return errorJson('endTime must be after startTime', 400)
    shift = newStart.getTime() - original.startTime.getTime()
  } else if (mode === 'shift') {
    const days = Number(shiftDays)
    if (!Number.isFinite(days) || days === 0) return errorJson('shiftDays must be a non-zero number', 400)
    shift = days * DAY_MS
    newStart = new Date(original.startTime.getTime() + shift)
    newEnd = new Date(original.endTime.getTime() + shift)
  } else {
    // Default: 1 week from now, 6-hour voting window.
    newStart = new Date(Date.now() + 7 * DAY_MS)
    newEnd = new Date(Date.now() + 7 * DAY_MS + 6 * 60 * 60 * 1000)
    shift = null // don't touch the other timestamps — preserve original behavior
  }

  // Apply the shift to the other lifecycle timestamps (only when we have one).
  function shiftDate(d: Date | null | undefined): Date | null {
    if (!d) return null
    if (shift === null) return null // default mode → null out, matching old behavior
    return new Date(d.getTime() + shift)
  }

  const newAccStart = shiftDate(original.accreditationStart)
  const newAccEnd = shiftDate(original.accreditationEnd)
  const newCandRegStart = shiftDate(original.candidateRegStart)
  const newCandRegEnd = shiftDate(original.candidateRegEnd)
  const newResultsReleaseAt = shiftDate(original.resultsReleaseAt)

  // ---- Create the duplicate ------------------------------------------------
  const newName = (name && String(name).trim()) || `${original.name} (Copy)`
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
      startTime: newStart,
      endTime: newEnd,
      accreditationStart: newAccStart,
      accreditationEnd: newAccEnd,
      candidateRegStart: newCandRegStart,
      candidateRegEnd: newCandRegEnd,
      resultsReleaseAt: newResultsReleaseAt,
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
    details: {
      organizationId: org.id, originalId: id, duplicateId: duplicate.id,
      dateMode: mode, shiftDays: typeof shiftDays === 'number' ? shiftDays : undefined,
    },
    ip: getClientIp(req),
  }).catch(() => {})

  return json({
    ok: true,
    election: duplicate,
    dates: {
      mode,
      startTime: duplicate.startTime,
      endTime: duplicate.endTime,
      accreditationStart: duplicate.accreditationStart,
      accreditationEnd: duplicate.accreditationEnd,
      candidateRegStart: duplicate.candidateRegStart,
      candidateRegEnd: duplicate.candidateRegEnd,
      resultsReleaseAt: duplicate.resultsReleaseAt,
    },
  })
}
