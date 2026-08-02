import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson, writeAudit, getClientIp } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { requirePermission } from '@/lib/iam'

export const dynamic = 'force-dynamic'

const VALID_TYPES = ['INFO', 'SUCCESS', 'WARNING', 'SECURITY']

// Verify the election belongs to the resolved org. Returns the election row
// (id, name, organizationId, status, startTime, endTime) or null.
async function getOrgElection(orgId: string, electionId: string) {
  const election = await db.electionSession.findUnique({
    where: { id: electionId },
    select: {
      id: true, name: true, organizationId: true, status: true,
      startTime: true, endTime: true,
    },
  })
  if (!election || election.organizationId !== orgId) return null
  return election
}

// ---------------------------------------------------------------------------
// GET /api/workspace/elections/[id]/notifications
// Returns all notifications sent for this election. Notifications are stored
// one-row-per-voter (a broadcast to N voters creates N rows that share the
// same createdAt + title + message + type + officialId). We group those rows
// into "campaigns" so the UI can render a single entry per broadcast with a
// read progress bar (e.g. "12/15 read").
//
// Query params:
//   ?type=INFO|SUCCESS|WARNING|SECURITY   — filter by notification type
//   ?unreadOnly=true                       — only show campaigns with unread rows
//
// Org-scoped via requireOrganization — anyone authenticated inside the org
// can view the list.
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult
  const { id: electionId } = await params

  const election = await getOrgElection(org.id, electionId)
  if (!election) return errorJson('Election not found', 404)

  const { searchParams } = new URL(req.url)
  const typeFilter = searchParams.get('type')?.toUpperCase().trim()
  const unreadOnly = searchParams.get('unreadOnly') === 'true'

  // Build the where clause — only valid filter values are accepted.
  const where: any = { electionSessionId: electionId }
  if (typeFilter && VALID_TYPES.includes(typeFilter)) where.type = typeFilter

  // Fetch all notifications for this election (with voter info for names).
  const rows = await db.notification.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 1000,
    include: {
      voter: {
        select: { id: true, fullName: true, matric: true, email: true, institutionEmail: true },
      },
    },
  })

  // Group rows into "campaigns". A campaign is identified by the tuple
  // (createdAt-bucket, title, message, type, officialId). Broadcasts share
  // the exact same createdAt (set explicitly during POST), so this groups
  // them reliably.
  interface Group {
    key: string
    title: string
    message: string
    type: string
    createdAt: Date
    officialId: string | null
    total: number
    read: number
    voterId: string | null
    voterName: string | null
    voterMatric: string | null
    isBroadcast: boolean
  }

  const groups = new Map<string, Group>()
  for (const r of rows) {
    // Truncate createdAt to the second so timestamps that differ by a few
    // milliseconds (SQLite default) still group together.
    const ts = new Date(r.createdAt)
    ts.setMilliseconds(0)
    const key = `${ts.getTime()}|${r.title}|${r.message}|${r.type}|${r.officialId || ''}`
    const existing = groups.get(key)
    if (existing) {
      existing.total += 1
      if (r.readAt) existing.read += 1
      // If the campaign has multiple distinct voters, it's a broadcast.
      if (existing.voterId && r.voterId && existing.voterId !== r.voterId) {
        existing.isBroadcast = true
      }
    } else {
      groups.set(key, {
        key,
        title: r.title,
        message: r.message,
        type: r.type,
        createdAt: r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt),
        officialId: r.officialId ?? null,
        total: 1,
        read: r.readAt ? 1 : 0,
        voterId: r.voterId ?? null,
        voterName: r.voter?.fullName ?? null,
        voterMatric: r.voter?.matric ?? null,
        isBroadcast: false, // refined below
      })
    }
  }

  // Final pass: a "campaign" of 1 row with a null voterId is a broadcast stub
  // (rare in practice — broadcasts always set voterId per row). Otherwise,
  // a single-row group with a voterId is a direct send to that voter.
  const campaigns = Array.from(groups.values()).map((g) => {
    if (g.total > 1) g.isBroadcast = true
    return g
  })

  // Apply unreadOnly filter at the campaign level.
  const filtered = unreadOnly ? campaigns.filter((g) => g.read < g.total) : campaigns

  // Stats — computed over ALL notifications for this election (ignoring filters).
  const totalRows = rows.length
  const readRows = rows.filter((r) => r.readAt).length
  const unreadRows = totalRows - readRows
  const deliveryRate = totalRows > 0 ? Math.round((readRows / totalRows) * 1000) / 10 : 0

  const serialized = filtered.map((g) => ({
    id: g.key,
    title: g.title,
    message: g.message,
    type: g.type,
    createdAt: g.createdAt.toISOString(),
    officialId: g.officialId,
    target: g.isBroadcast
      ? { kind: 'ALL_VOTERS' as const, label: 'All Eligible Voters' }
      : { kind: 'VOTER' as const, label: g.voterName || 'Specific Voter', voterId: g.voterId, voterMatric: g.voterMatric },
    recipients: g.total,
    readCount: g.read,
    unreadCount: g.total - g.read,
    readPct: g.total > 0 ? Math.round((g.read / g.total) * 1000) / 10 : 0,
  }))

  return json({
    notifications: serialized,
    stats: {
      totalSent: totalRows,
      campaigns: campaigns.length,
      read: readRows,
      unread: unreadRows,
      deliveryRate,
    },
    election: { id: election.id, name: election.name, status: election.status },
  })
}

// ---------------------------------------------------------------------------
// POST /api/workspace/elections/[id]/notifications
// Sends a notification — either a broadcast to all eligible voters in this
// election's org, or a direct send to a single voter.
//
// Body: { title, message, type?, targetVoterId? }
//   - title (string, required, 1–200 chars)
//   - message (string, required, 1–2000 chars)
//   - type (INFO|SUCCESS|WARNING|SECURITY, default INFO)
//   - targetVoterId (optional) — if provided, sends to that voter only
//
// Requires: election.manage permission.
// Creates Notification rows + enqueues a 'notification.send' delivery job per
// recipient + creates an ElectionEvent + writes an audit log entry.
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePermission(req, 'election.manage')
  if (ctx instanceof Response) return ctx
  if (!ctx.org) return errorJson('Organization not found', 404)
  const { id: electionId } = await params

  const election = await getOrgElection(ctx.org.id, electionId)
  if (!election) return errorJson('Election not found', 404)

  const body = await req.json().catch(() => ({}))
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  const type = typeof body.type === 'string' ? body.type.trim().toUpperCase() : 'INFO'
  const targetVoterId = typeof body.targetVoterId === 'string' && body.targetVoterId.trim()
    ? body.targetVoterId.trim()
    : null

  if (!title) return errorJson('A title is required', 400)
  if (title.length > 200) return errorJson('Title is too long (max 200 chars)', 400)
  if (!message) return errorJson('A message is required', 400)
  if (message.length > 2000) return errorJson('Message is too long (max 2000 chars)', 400)
  if (!VALID_TYPES.includes(type)) return errorJson('Invalid notification type', 400)

  // Resolve the recipient list.
  let recipients: { id: string; fullName: string; email: string | null; institutionEmail: string | null; phone: string | null; otpChannel: string | null }[] = []

  if (targetVoterId) {
    // Direct send — verify the voter belongs to this org (and is linked to
    // this election OR in the org's master registry).
    const voter = await db.voter.findFirst({
      where: {
        id: targetVoterId,
        organizationId: ctx.org.id,
        OR: [{ electionSessionId: electionId }, { electionSessionId: null }],
      },
      select: { id: true, fullName: true, email: true, institutionEmail: true, phone: true, otpChannel: true },
    })
    if (!voter) return errorJson('Voter not found or not eligible for this election', 404)
    recipients = [voter]
  } else {
    // Broadcast — all eligible voters in this org.
    recipients = await db.voter.findMany({
      where: {
        organizationId: ctx.org.id,
        OR: [{ electionSessionId: electionId }, { electionSessionId: null }],
        status: { not: 'REMOVED' },
      },
      select: { id: true, fullName: true, email: true, institutionEmail: true, phone: true, otpChannel: true },
      take: 5000, // safety cap
    })
    if (recipients.length === 0) return errorJson('No eligible voters found for this election', 400)
  }

  // Create one Notification row per recipient. All rows in this campaign
  // share the SAME createdAt timestamp so the GET endpoint can group them
  // back into a single campaign for display.
  const createdAt = new Date()
  const rows = recipients.map((v) => ({
    electionSessionId: electionId,
    voterId: v.id,
    officialId: null,
    title,
    message,
    type,
    createdAt,
  }))

  await db.notification.createMany({ data: rows })

  // Enqueue delivery jobs — one per recipient, batched into a single job
  // payload to keep the queue small. In sandbox this is a no-op transport;
  // in production it dispatches to Resend (email) / Termii (SMS / WhatsApp).
  const { enqueue } = await import('@/lib/jobs')
  enqueue('notification.send', {
    electionId,
    electionName: election.name,
    title,
    message,
    type,
    recipients: recipients.map((v) => ({
      id: v.id,
      name: v.fullName,
      email: v.email || v.institutionEmail,
      phone: v.phone,
      channel: v.otpChannel || 'EMAIL',
    })),
    sentBy: ctx.user.name,
    sentAt: createdAt.toISOString(),
  })

  // Record an ElectionEvent so this shows up in the audit timeline.
  await db.electionEvent.create({
    data: {
      electionId,
      organizationId: ctx.org.id,
      eventType: 'NOTIFICATION_SENT',
      description: `${type} notification sent: "${title}" → ${targetVoterId ? '1 voter' : `${recipients.length} voters`}`,
      actorId: ctx.user.id,
      actorName: ctx.user.name,
      metadata: JSON.stringify({
        title,
        messagePreview: message.slice(0, 120),
        type,
        recipientCount: recipients.length,
        target: targetVoterId ? 'SINGLE_VOTER' : 'ALL_VOTERS',
        targetVoterId: targetVoterId || null,
      }),
    },
  }).catch(() => {})

  // Write an audit log entry.
  await writeAudit({
    actorId: ctx.user.id,
    actorRole: ctx.user.role,
    actorName: ctx.user.name,
    action: 'NOTIFICATION_SENT',
    details: {
      organizationId: ctx.org.id,
      electionId,
      electionName: election.name,
      title,
      type,
      recipientCount: recipients.length,
      target: targetVoterId ? 'SINGLE_VOTER' : 'ALL_VOTERS',
      targetVoterId: targetVoterId || null,
    },
    ip: getClientIp(req),
    electionId,
  }).catch(() => {})

  return json({
    ok: true,
    recipients: recipients.length,
    target: targetVoterId ? 'SINGLE_VOTER' : 'ALL_VOTERS',
    campaignId: createdAt.getTime().toString(),
    message: `Notification sent to ${recipients.length} ${recipients.length === 1 ? 'voter' : 'voters'}.`,
  }, 201)
}
