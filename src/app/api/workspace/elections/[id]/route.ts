import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson, writeAudit, getClientIp } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { getCurrentOfficial } from '@/lib/guards'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/workspace/elections/[id] — get a single election with full details.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Auth check — closes the endpoint authentication gap (audit finding)
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth) return errorJson('Unauthorized', 401)
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult
  const { id } = await params

  const election = await db.electionSession.findUnique({
    where: { id },
    include: {
      workspace: { select: { id: true, name: true, code: true, unitType: true } },
      positions: {
        orderBy: { displayOrder: 'asc' },
        include: { _count: { select: { candidates: true } } },
      },
      _count: { select: { voters: true, candidates: true, positions: true, timeline: true, accreditations: true } },
    },
  })

  if (!election || election.organizationId !== org.id)
    return errorJson('Election not found', 404)

  return json({ election })
}

// PATCH /api/workspace/elections/[id] — update election (only in DRAFT/READY status).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult
  const { id } = await params

  const official = await getCurrentOfficial(req)
  if (!official) return errorJson('Unauthorized', 401)

  const election = await db.electionSession.findUnique({ where: { id } })
  if (!election || election.organizationId !== org.id)
    return errorJson('Election not found', 404)

  // Immutable after certification
  if (election.status === 'CERTIFIED' || election.status === 'ARCHIVED')
    return errorJson('Election is immutable after certification', 403)

  const body = await req.json().catch(() => ({}))
  const allowed: Record<string, any> = {}
  const fields = ['name', 'description', 'category', 'electionType', 'votingMethod', 'visibility',
    'startTime', 'endTime', 'accreditationStart', 'accreditationEnd',
    'candidateRegStart', 'candidateRegEnd', 'resultsReleaseAt', 'status', 'settings']
  for (const f of fields) {
    if (body[f] !== undefined) {
      if (f === 'startTime' || f === 'endTime' || f === 'accreditationStart' || f === 'accreditationEnd' ||
          f === 'candidateRegStart' || f === 'candidateRegEnd' || f === 'resultsReleaseAt') {
        allowed[f] = body[f] ? new Date(body[f]) : null
      } else if (f === 'settings') {
        allowed[f] = body[f] ? JSON.stringify(body[f]) : null
      } else {
        allowed[f] = body[f]
      }
    }
  }

  // ── READINESS GATE (Chapter 17 — Election Readiness Checker) ──────────
  // Spec: "Before any election is allowed to go live, run an automated
  // infrastructure readiness assessment. If any critical check fails, the
  // platform warns administrators or blocks the launch until the issue is
  // resolved."
  //
  // When an admin attempts to transition the election to LIVE, run the
  // 13-point pre-flight checklist. Block the transition if any critical
  // check fails.
  if (body.status === 'LIVE' && election.status !== 'LIVE') {
    const { runReadinessCheck, recordReadinessRun } = await import('@/lib/pihed')
    const voterCount = await db.voter.count({ where: { electionId: id } }).catch(() => 0)
    const result = await runReadinessCheck(voterCount)

    // Persist the run to the audit trail
    await recordReadinessRun(result, {
      organizationId: org.id,
      electionId: id,
      expectedVoters: voterCount,
      triggeredBy: official.id,
      triggeredByName: official.name,
      notes: 'Go-live readiness gate',
    }).catch(() => {})

    if (!result.ready) {
      const failedChecks = result.checks
        .filter((c) => c.critical && c.status === 'UNHEALTHY')
        .map((c) => `${c.name}: ${c.message}`)
      return json({
        ok: false,
        error: 'Election Readiness Check FAILED — launch blocked',
        ready: false,
        criticalFailures: result.criticalFailures,
        failedChecks,
        capacity: result.capacity,
        allChecks: result.checks,
        timestamp: result.timestamp,
      }, 403)
    }
  }

  const updated = await db.electionSession.update({ where: { id }, data: allowed })

  // Record timeline event for status changes
  if (body.status && body.status !== election.status) {
    await db.electionEvent.create({
      data: {
        electionId: id, organizationId: org.id,
        eventType: body.status.toUpperCase(),
        description: `Status changed from ${election.status} to ${body.status}`,
        actorId: official.id, actorName: official.name,
      },
    }).catch(() => {})
  }

  await writeAudit({
    actorId: official.id, actorRole: official.role, actorName: official.name,
    action: 'ELECTION_UPDATED',
    details: { organizationId: org.id, electionId: id, fields: Object.keys(allowed) },
    ip: getClientIp(req),
  }).catch(() => {})

  return json({ ok: true, election: updated })
}
