import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson, writeAudit, getClientIp } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { requirePermission } from '@/lib/iam'
import {
  resolveTriggerAt,
  isValidTarget,
} from '@/lib/notification-processor'

export const dynamic = 'force-dynamic'

const VALID_TYPES = ['INFO', 'SUCCESS', 'WARNING', 'SECURITY']

// Verify the election belongs to the resolved org. Returns the election row
// (with lifecycle timestamps needed to resolve triggerAt for RESULTS_PUBLISHED
// re-resolution) or null.
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
// PATCH /api/workspace/elections/[id]/notifications/schedule/[scheduleId]
// Update a PENDING scheduled notification. Cannot update SENT / CANCELLED /
// FAILED notifications.
//
// Body (all optional): { title, message, type, target, targetVoterIds, triggerAt }
//   - For triggerAt to be respected, the trigger must be CUSTOM_DATETIME (other
//     triggers always use the election lifecycle time).
// ---------------------------------------------------------------------------
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; scheduleId: string }> },
) {
  const ctx = await requirePermission(req, 'election.manage')
  if (ctx instanceof Response) return ctx
  if (!ctx.org) return errorJson('Organization not found', 404)
  const { id: electionId, scheduleId } = await params

  const election = await getOrgElection(ctx.org.id, electionId)
  if (!election) return errorJson('Election not found', 404)

  const existing = await db.scheduledNotification.findFirst({
    where: { id: scheduleId, electionId, organizationId: ctx.org.id },
  })
  if (!existing) return errorJson('Scheduled notification not found', 404)
  if (existing.status !== 'PENDING') {
    return errorJson(
      `Cannot edit a scheduled notification that is already ${existing.status}.`,
      409,
    )
  }

  const body = await req.json().catch(() => ({}))

  // Build the patch object — only fields present in the body are updated.
  const patch: any = {}

  if (typeof body.title === 'string') {
    const t = body.title.trim()
    if (!t) return errorJson('Title cannot be empty', 400)
    if (t.length > 200) return errorJson('Title is too long (max 200 chars)', 400)
    patch.title = t
  }

  if (typeof body.message === 'string') {
    const m = body.message.trim()
    if (!m) return errorJson('Message cannot be empty', 400)
    if (m.length > 2000) return errorJson('Message is too long (max 2000 chars)', 400)
    patch.message = m
  }

  if (typeof body.type === 'string') {
    const ty = body.type.trim().toUpperCase()
    if (!VALID_TYPES.includes(ty)) return errorJson('Invalid notification type', 400)
    patch.type = ty
  }

  if (typeof body.target === 'string') {
    const tg = body.target.trim().toUpperCase()
    if (!isValidTarget(tg)) {
      return errorJson('Invalid target. Must be ALL_VOTERS, VERIFIED_ONLY, or CUSTOM', 400)
    }
    patch.target = tg
  }

  // Handle targetVoterIds — accept array, or null/empty to clear.
  if (body.targetVoterIds !== undefined) {
    if (Array.isArray(body.targetVoterIds)) {
      const ids = body.targetVoterIds
        .filter((x: any) => typeof x === 'string' && x.trim())
        .map((x: string) => x.trim())
      if (ids.length === 0) {
        // If target is CUSTOM, this is an error; otherwise just clear.
        const targetAfterPatch = patch.target || existing.target
        if (targetAfterPatch === 'CUSTOM') {
          return errorJson('A custom target requires at least one voter ID', 400)
        }
        patch.targetVoterIds = null
      } else {
        if (ids.length > 5000) return errorJson('Custom target list too large (max 5000)', 400)
        patch.targetVoterIds = JSON.stringify(ids)
      }
    } else if (body.targetVoterIds === null) {
      patch.targetVoterIds = null
    }
  }

  // If target is being set to CUSTOM, validate that targetVoterIds is non-empty.
  if (patch.target === 'CUSTOM') {
    const idsAfterPatch = patch.targetVoterIds ?? existing.targetVoterIds
    const parsed = idsAfterPatch ? safeParseIds(idsAfterPatch) : null
    if (!parsed || parsed.length === 0) {
      return errorJson('A custom target requires at least one voter ID', 400)
    }
  }

  // Handle triggerAt — only meaningful for CUSTOM_DATETIME triggers. Other
  // triggers always re-resolve from the election lifecycle.
  if (body.triggerAt !== undefined) {
    if (existing.trigger !== 'CUSTOM_DATETIME') {
      return errorJson(
        `triggerAt can only be changed for CUSTOM_DATETIME triggers (this trigger is ${existing.trigger})`,
        400,
      )
    }
    const newAt = resolveTriggerAt(
      'CUSTOM_DATETIME',
      {
        startTime: election.startTime,
        endTime: election.endTime,
        resultsReleaseAt: election.resultsReleaseAt,
      },
      typeof body.triggerAt === 'string' ? body.triggerAt : null,
    )
    if (!newAt) return errorJson('Invalid triggerAt datetime', 400)
    patch.triggerAt = newAt
  }

  // If trigger is non-CUSTOM, re-resolve triggerAt from the (possibly updated)
  // election lifecycle so the schedule always tracks the latest election times.
  if (existing.trigger !== 'CUSTOM_DATETIME') {
    const resolved = resolveTriggerAt(
      existing.trigger as any,
      {
        startTime: election.startTime,
        endTime: election.endTime,
        resultsReleaseAt: election.resultsReleaseAt,
      },
      null,
    )
    if (resolved) patch.triggerAt = resolved
  }

  const updated = await db.scheduledNotification.update({
    where: { id: scheduleId },
    data: patch,
  })

  await writeAudit({
    actorId: ctx.user.id,
    actorRole: ctx.user.role,
    actorName: ctx.user.name,
    action: 'NOTIFICATION_SCHEDULE_UPDATED',
    details: {
      organizationId: ctx.org.id,
      electionId,
      scheduledNotificationId: scheduleId,
      patch,
    },
    ip: getClientIp(req),
    electionId,
  }).catch(() => {})

  return json({
    ok: true,
    scheduledNotification: {
      id: updated.id,
      trigger: updated.trigger,
      triggerAt: updated.triggerAt.toISOString(),
      title: updated.title,
      message: updated.message,
      type: updated.type,
      target: updated.target,
      status: updated.status,
    },
    message: 'Scheduled notification updated.',
  })
}

// ---------------------------------------------------------------------------
// DELETE /api/workspace/elections/[id]/notifications/schedule/[scheduleId]
// Cancel a PENDING scheduled notification (sets status to CANCELLED). Cannot
// cancel a notification that is already SENT.
// ---------------------------------------------------------------------------
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; scheduleId: string }> },
) {
  const ctx = await requirePermission(req, 'election.manage')
  if (ctx instanceof Response) return ctx
  if (!ctx.org) return errorJson('Organization not found', 404)
  const { id: electionId, scheduleId } = await params

  const election = await getOrgElection(ctx.org.id, electionId)
  if (!election) return errorJson('Election not found', 404)

  const existing = await db.scheduledNotification.findFirst({
    where: { id: scheduleId, electionId, organizationId: ctx.org.id },
  })
  if (!existing) return errorJson('Scheduled notification not found', 404)
  if (existing.status === 'SENT') {
    return errorJson('Cannot cancel a scheduled notification that has already been sent.', 409)
  }
  if (existing.status === 'CANCELLED') {
    return json({ ok: true, message: 'Scheduled notification is already cancelled.' })
  }

  const updated = await db.scheduledNotification.update({
    where: { id: scheduleId },
    data: { status: 'CANCELLED' },
  })

  await writeAudit({
    actorId: ctx.user.id,
    actorRole: ctx.user.role,
    actorName: ctx.user.name,
    action: 'NOTIFICATION_SCHEDULE_CANCELLED',
    details: {
      organizationId: ctx.org.id,
      electionId,
      scheduledNotificationId: scheduleId,
      title: existing.title,
      trigger: existing.trigger,
      triggerAt: existing.triggerAt.toISOString(),
    },
    ip: getClientIp(req),
    electionId,
  }).catch(() => {})

  return json({
    ok: true,
    scheduledNotification: {
      id: updated.id,
      status: updated.status,
    },
    message: 'Scheduled notification cancelled.',
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
