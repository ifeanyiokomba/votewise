// VoteWise — Scheduled Notification Processor
//
// SQLite has no native job scheduler, so scheduled notifications are polled.
// This module exposes `processDueNotifications()` which:
//   1. Finds all ScheduledNotifications with status=PENDING and triggerAt<=now.
//   2. Resolves the target voter list (ALL_VOTERS, VERIFIED_ONLY, or CUSTOM).
//   3. Creates one Notification row per voter (same createdAt => grouped as a
//      campaign by the GET /notifications endpoint).
//   4. Enqueues a 'notification.send' delivery job per batch.
//   5. Updates the ScheduledNotification: status=SENT, sentAt, recipientCount.
//   6. Records an ElectionEvent so the send shows up in the audit timeline.
//
// This function is idempotent: a SENT/CANCELLED/FAILED scheduled notification
// is skipped. It can be called manually (via the /schedule/process endpoint)
// or by a future cron job / background poller.

import { db } from '@/lib/db'
import { enqueue } from '@/lib/jobs'

export type ScheduledTrigger =
  | 'VOTING_OPENED'
  | 'VOTING_CLOSED'
  | 'RESULTS_PUBLISHED'
  | 'CUSTOM_DATETIME'

export type ScheduledTarget =
  | 'ALL_VOTERS'
  | 'VERIFIED_ONLY'
  | 'CUSTOM'

export type ScheduledStatus = 'PENDING' | 'SENT' | 'CANCELLED' | 'FAILED'

export interface ProcessResult {
  processed: number
  sent: number
  failed: number
  details: Array<{
    id: string
    title: string
    trigger: string
    recipients: number
    status: 'SENT' | 'FAILED'
    error?: string
  }>
}

interface Recipient {
  id: string
  fullName: string
  email: string | null
  institutionEmail: string | null
  phone: string | null
  otpChannel: string | null
}

// ---------------------------------------------------------------------------
// Resolve the recipient list for a scheduled notification.
// Returns null if no recipients are eligible (the notification will be marked
// FAILED with a descriptive error rather than silently dropped).
// ---------------------------------------------------------------------------
async function resolveRecipients(
  scheduled: {
    id: string
    electionId: string | null
    organizationId: string
    target: string
    targetVoterIds: string | null
  },
): Promise<{ recipients: Recipient[]; error?: string }> {
  if (!scheduled.electionId) {
    return { recipients: [], error: 'Scheduled notification is not tied to an election.' }
  }

  // CUSTOM target: parse the JSON array of voter IDs and fetch them.
  if (scheduled.target === 'CUSTOM') {
    let ids: string[] = []
    try {
      ids = scheduled.targetVoterIds ? JSON.parse(scheduled.targetVoterIds) : []
    } catch {
      return { recipients: [], error: 'Invalid custom target voter list (malformed JSON).' }
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      return { recipients: [], error: 'Custom target list is empty.' }
    }
    const voters = await db.voter.findMany({
      where: {
        id: { in: ids },
        organizationId: scheduled.organizationId,
        OR: [
          { electionSessionId: scheduled.electionId },
          { electionSessionId: null },
        ],
        status: { not: 'REMOVED' },
      },
      select: {
        id: true, fullName: true, email: true,
        institutionEmail: true, phone: true, otpChannel: true,
      },
      take: 5000,
    })
    if (voters.length === 0) return { recipients: [], error: 'No eligible voters matched the custom target list.' }
    return { recipients: voters }
  }

  // ALL_VOTERS or VERIFIED_ONLY — broadcast to the org's voter registry.
  const where: any = {
    organizationId: scheduled.organizationId,
    OR: [
      { electionSessionId: scheduled.electionId },
      { electionSessionId: null },
    ],
    status: { not: 'REMOVED' },
  }
  if (scheduled.target === 'VERIFIED_ONLY') {
    where.verificationStatus = 'VERIFIED'
  }

  const voters = await db.voter.findMany({
    where,
    select: {
      id: true, fullName: true, email: true,
      institutionEmail: true, phone: true, otpChannel: true,
    },
    take: 5000,
  })

  if (voters.length === 0) {
    return {
      recipients: [],
      error: scheduled.target === 'VERIFIED_ONLY'
        ? 'No verified voters found for this election.'
        : 'No eligible voters found for this election.',
    }
  }
  return { recipients: voters }
}

// ---------------------------------------------------------------------------
// Send a single scheduled notification — creates Notification rows + enqueues
// delivery + records an ElectionEvent. Returns the recipient count on success
// or throws with a descriptive message on failure.
// ---------------------------------------------------------------------------
async function sendScheduled(scheduled: any): Promise<number> {
  const { recipients, error } = await resolveRecipients(scheduled)
  if (error || recipients.length === 0) {
    throw new Error(error || 'No eligible recipients.')
  }

  // Load the election for the event description + delivery payload.
  const election = scheduled.electionId
    ? await db.electionSession.findUnique({
        where: { id: scheduled.electionId },
        select: { id: true, name: true },
      })
    : null

  // Create one Notification row per recipient. All rows share the SAME
  // createdAt so the GET /notifications endpoint groups them into a campaign.
  const createdAt = new Date()
  const rows = recipients.map((v) => ({
    electionSessionId: scheduled.electionId,
    voterId: v.id,
    officialId: null,
    title: scheduled.title,
    message: scheduled.message,
    type: scheduled.type || 'INFO',
    createdAt,
  }))
  await db.notification.createMany({ data: rows })

  // Enqueue a single delivery job carrying the full recipient batch.
  enqueue('notification.send', {
    electionId: scheduled.electionId,
    electionName: election?.name || 'Election',
    title: scheduled.title,
    message: scheduled.message,
    type: scheduled.type || 'INFO',
    recipients: recipients.map((v) => ({
      id: v.id,
      name: v.fullName,
      email: v.email || v.institutionEmail,
      phone: v.phone,
      channel: v.otpChannel || 'EMAIL',
    })),
    sentBy: scheduled.createdByName || 'Scheduled Notification',
    sentAt: createdAt.toISOString(),
    scheduledNotificationId: scheduled.id,
    trigger: scheduled.trigger,
  })

  // Record an ElectionEvent so this shows up in the audit timeline.
  await db.electionEvent.create({
    data: {
      electionId: scheduled.electionId,
      organizationId: scheduled.organizationId,
      eventType: 'NOTIFICATION_SENT',
      description: `Scheduled ${scheduled.type || 'INFO'} notification sent (${scheduled.trigger}): "${scheduled.title}" → ${recipients.length} voters`,
      actorId: scheduled.createdBy || null,
      actorName: scheduled.createdByName || 'Scheduled Notification',
      metadata: JSON.stringify({
        title: scheduled.title,
        messagePreview: (scheduled.message || '').slice(0, 120),
        type: scheduled.type || 'INFO',
        recipientCount: recipients.length,
        target: scheduled.target,
        trigger: scheduled.trigger,
        scheduledNotificationId: scheduled.id,
        scheduled: true,
      }),
    },
  }).catch(() => {})

  return recipients.length
}

// ---------------------------------------------------------------------------
// Process all due scheduled notifications.
//
// Options:
//   - electionId: if provided, only process notifications for that election.
//   - organizationId: if provided, only process notifications for that org.
//   - limit: max notifications to process in one call (default 50).
//
// Returns a summary { processed, sent, failed, details }.
// ---------------------------------------------------------------------------
export async function processDueNotifications(opts: {
  electionId?: string
  organizationId?: string
  limit?: number
} = {}): Promise<ProcessResult> {
  const now = new Date()
  const limit = Math.max(1, Math.min(opts.limit ?? 50, 200))

  const where: any = {
    status: 'PENDING',
    triggerAt: { lte: now },
  }
  if (opts.electionId) where.electionId = opts.electionId
  if (opts.organizationId) where.organizationId = opts.organizationId

  const due = await db.scheduledNotification.findMany({
    where,
    orderBy: { triggerAt: 'asc' },
    take: limit,
  })

  const result: ProcessResult = { processed: 0, sent: 0, failed: 0, details: [] }

  for (const sn of due) {
    result.processed++
    try {
      const recipientCount = await sendScheduled(sn)
      await db.scheduledNotification.update({
        where: { id: sn.id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          recipientCount,
        },
      })
      result.sent++
      result.details.push({
        id: sn.id,
        title: sn.title,
        trigger: sn.trigger,
        recipients: recipientCount,
        status: 'SENT',
      })
    } catch (e: any) {
      await db.scheduledNotification.update({
        where: { id: sn.id },
        data: {
          status: 'FAILED',
          sentAt: new Date(),
        },
      }).catch(() => {})
      result.failed++
      result.details.push({
        id: sn.id,
        title: sn.title,
        trigger: sn.trigger,
        recipients: 0,
        status: 'FAILED',
        error: e?.message || 'Unknown error',
      })
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Helper: compute the triggerAt time for a given trigger based on the election.
// Returns null if the trigger cannot be resolved (e.g. RESULTS_PUBLISHED but
// the election has no resultsReleaseAt or endTime).
// ---------------------------------------------------------------------------
export function resolveTriggerAt(
  trigger: ScheduledTrigger,
  election: { startTime: Date; endTime: Date; resultsReleaseAt: Date | null },
  customTriggerAt?: Date | string | null,
): Date | null {
  switch (trigger) {
    case 'VOTING_OPENED':
      return election.startTime
    case 'VOTING_CLOSED':
      return election.endTime
    case 'RESULTS_PUBLISHED':
      return election.resultsReleaseAt || election.endTime
    case 'CUSTOM_DATETIME':
      if (!customTriggerAt) return null
      const d = typeof customTriggerAt === 'string' ? new Date(customTriggerAt) : customTriggerAt
      if (isNaN(d.getTime())) return null
      return d
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Helper: validate a trigger string.
// ---------------------------------------------------------------------------
export function isValidTrigger(t: string): t is ScheduledTrigger {
  return ['VOTING_OPENED', 'VOTING_CLOSED', 'RESULTS_PUBLISHED', 'CUSTOM_DATETIME'].includes(t)
}

// ---------------------------------------------------------------------------
// Helper: validate a target string.
// ---------------------------------------------------------------------------
export function isValidTarget(t: string): t is ScheduledTarget {
  return ['ALL_VOTERS', 'VERIFIED_ONLY', 'CUSTOM'].includes(t)
}
