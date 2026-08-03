import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson, writeAudit, getClientIp } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { requirePermission } from '@/lib/iam'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import {
  resolveTriggerAt,
  isValidTrigger,
  isValidTarget,
} from '@/lib/notification-processor'

export const dynamic = 'force-dynamic'

const VALID_TYPES = ['INFO', 'SUCCESS', 'WARNING', 'SECURITY']

// Verify the election belongs to the resolved org. Returns the election row
// (with the lifecycle timestamps needed to resolve triggerAt) or null.
async function getOrgElection(orgId: string, electionId: string) {
  const election = await db.electionSession.findUnique({
    where: { id: electionId },
    select: {
      id: true, name: true, organizationId: true, status: true,
      startTime: true, endTime: true, resultsReleaseAt: true,
    },
  })
  if (!election || election.organizationId !== orgId) return null
  return election
}

// ---------------------------------------------------------------------------
// GET /api/workspace/elections/[id]/notifications/schedule
// Returns all scheduled notifications for this election, newest first.
//
// Org-scoped via requireOrganization — anyone authenticated inside the org
// can view the list.
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Auth check — closes the endpoint authentication gap (audit finding)
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth) return errorJson('Unauthorized', 401)
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult
  const { id: electionId } = await params

  const election = await getOrgElection(org.id, electionId)
  if (!election) return errorJson('Election not found', 404)

  const rows = await db.scheduledNotification.findMany({
    where: { electionId },
    orderBy: [{ status: 'asc' }, { triggerAt: 'asc' }],
    take: 500,
  })

  const serialized = rows.map((sn) => ({
    id: sn.id,
    electionId: sn.electionId,
    trigger: sn.trigger,
    triggerAt: sn.triggerAt.toISOString(),
    title: sn.title,
    message: sn.message,
    type: sn.type,
    target: sn.target,
    targetVoterIds: sn.targetVoterIds ? safeParseIds(sn.targetVoterIds) : null,
    status: sn.status,
    sentAt: sn.sentAt ? sn.sentAt.toISOString() : null,
    recipientCount: sn.recipientCount,
    createdBy: sn.createdBy,
    createdByName: sn.createdByName,
    createdAt: sn.createdAt.toISOString(),
    updatedAt: sn.updatedAt.toISOString(),
  }))

  // Summary counts grouped by status.
  const now = new Date()
  const summary = {
    pending: rows.filter((r) => r.status === 'PENDING').length,
    sent: rows.filter((r) => r.status === 'SENT').length,
    cancelled: rows.filter((r) => r.status === 'CANCELLED').length,
    failed: rows.filter((r) => r.status === 'FAILED').length,
    due: rows.filter((r) => r.status === 'PENDING' && r.triggerAt <= now).length,
  }

  // Send back the election lifecycle timestamps so the UI can show the
  // "preview" of when each trigger will fire.
  return json({
    scheduled: serialized,
    summary,
    election: {
      id: election.id,
      name: election.name,
      status: election.status,
      startTime: election.startTime.toISOString(),
      endTime: election.endTime.toISOString(),
      resultsReleaseAt: election.resultsReleaseAt
        ? election.resultsReleaseAt.toISOString()
        : null,
    },
  })
}

function safeParseIds(raw: string): string[] | null {
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// POST /api/workspace/elections/[id]/notifications/schedule
// Schedules a notification to be sent automatically when a trigger event
// occurs (voting opens, voting closes, results published) or at a custom
// datetime.
//
// Body: { trigger, triggerAt?, title, message, type?, target?, targetVoterIds? }
//   - trigger: VOTING_OPENED | VOTING_CLOSED | RESULTS_PUBLISHED | CUSTOM_DATETIME
//   - triggerAt: required for CUSTOM_DATETIME (ISO string or datetime-local)
//   - title: 1–200 chars
//   - message: 1–2000 chars
//   - type: INFO | SUCCESS | WARNING | SECURITY (default INFO)
//   - target: ALL_VOTERS | VERIFIED_ONLY | CUSTOM (default ALL_VOTERS)
//   - targetVoterIds: string[] (required when target=CUSTOM)
//
// Requires: election.manage permission.
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePermission(req, 'election.manage')
  if (ctx instanceof Response) return ctx
  if (!ctx.org) return errorJson('Organization not found', 404)
  const { id: electionId } = await params

  const election = await getOrgElection(ctx.org.id, electionId)
  if (!election) return errorJson('Election not found', 404)

  const body = await req.json().catch(() => ({}))
  const trigger = typeof body.trigger === 'string' ? body.trigger.trim().toUpperCase() : ''
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  const type = typeof body.type === 'string' ? body.type.trim().toUpperCase() : 'INFO'
  const target = typeof body.target === 'string' ? body.target.trim().toUpperCase() : 'ALL_VOTERS'
  const targetVoterIdsRaw = Array.isArray(body.targetVoterIds)
    ? body.targetVoterIds.filter((x: any) => typeof x === 'string' && x.trim()).map((x: string) => x.trim())
    : []

  // Validate trigger.
  if (!trigger) return errorJson('A trigger is required', 400)
  if (!isValidTrigger(trigger)) {
    return errorJson('Invalid trigger. Must be VOTING_OPENED, VOTING_CLOSED, RESULTS_PUBLISHED, or CUSTOM_DATETIME', 400)
  }

  // Resolve triggerAt from the election lifecycle (or from the body for CUSTOM_DATETIME).
  const customTriggerAt =
    trigger === 'CUSTOM_DATETIME'
      ? (typeof body.triggerAt === 'string' ? body.triggerAt : null)
      : null
  const triggerAt = resolveTriggerAt(
    trigger,
    {
      startTime: election.startTime,
      endTime: election.endTime,
      resultsReleaseAt: election.resultsReleaseAt,
    },
    customTriggerAt,
  )
  if (!triggerAt) {
    if (trigger === 'CUSTOM_DATETIME') {
      return errorJson('A valid triggerAt datetime is required for CUSTOM_DATETIME triggers', 400)
    }
    if (trigger === 'RESULTS_PUBLISHED') {
      return errorJson('This election has no resultsReleaseAt or endTime set — cannot schedule a RESULTS_PUBLISHED notification', 400)
    }
    return errorJson('Could not resolve a trigger time for this election', 400)
  }

  // Validate title + message.
  if (!title) return errorJson('A title is required', 400)
  if (title.length > 200) return errorJson('Title is too long (max 200 chars)', 400)
  if (!message) return errorJson('A message is required', 400)
  if (message.length > 2000) return errorJson('Message is too long (max 2000 chars)', 400)
  if (!VALID_TYPES.includes(type)) return errorJson('Invalid notification type', 400)

  // Validate target + targetVoterIds.
  if (!isValidTarget(target)) {
    return errorJson('Invalid target. Must be ALL_VOTERS, VERIFIED_ONLY, or CUSTOM', 400)
  }
  let targetVoterIdsJson: string | null = null
  if (target === 'CUSTOM') {
    if (targetVoterIdsRaw.length === 0) {
      return errorJson('A custom target requires at least one voter ID', 400)
    }
    if (targetVoterIdsRaw.length > 5000) {
      return errorJson('Custom target list is too large (max 5000 voter IDs)', 400)
    }
    targetVoterIdsJson = JSON.stringify(targetVoterIdsRaw)
  }

  // Prevent duplicate scheduling of the same trigger for the same election
  // (one PENDING notification per trigger is enough — the user can edit it).
  if (trigger !== 'CUSTOM_DATETIME') {
    const existing = await db.scheduledNotification.findFirst({
      where: { electionId, trigger, status: 'PENDING' },
      select: { id: true },
    })
    if (existing) {
      return errorJson(
        `A pending ${trigger} scheduled notification already exists for this election. Edit or cancel it before creating a new one.`,
        409,
      )
    }
  }

  const created = await db.scheduledNotification.create({
    data: {
      organizationId: ctx.org.id,
      electionId,
      trigger,
      triggerAt,
      title,
      message,
      type,
      target,
      targetVoterIds: targetVoterIdsJson,
      status: 'PENDING',
      createdBy: ctx.user.id,
      createdByName: ctx.user.name,
    },
  })

  // Write an audit log entry.
  await writeAudit({
    actorId: ctx.user.id,
    actorRole: ctx.user.role,
    actorName: ctx.user.name,
    action: 'NOTIFICATION_SCHEDULED',
    details: {
      organizationId: ctx.org.id,
      electionId,
      electionName: election.name,
      scheduledNotificationId: created.id,
      trigger,
      triggerAt: triggerAt.toISOString(),
      title,
      type,
      target,
      customTargetCount: target === 'CUSTOM' ? targetVoterIdsRaw.length : null,
    },
    ip: getClientIp(req),
    electionId,
  }).catch(() => {})

  return json({
    ok: true,
    scheduledNotification: {
      id: created.id,
      trigger: created.trigger,
      triggerAt: created.triggerAt.toISOString(),
      title: created.title,
      message: created.message,
      type: created.type,
      target: created.target,
      status: created.status,
    },
    message: `Scheduled notification set for ${triggerAt.toLocaleString()}.`,
  }, 201)
}
