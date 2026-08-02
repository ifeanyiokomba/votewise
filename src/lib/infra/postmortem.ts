// VoteWise — Postmortem Manager (Chapter 17 — Incident Lifecycle)
//
// Completes the incident lifecycle: detect → alert → respond → POSTMORTEM → improve.
// A postmortem is a blameless document written after an incident is resolved,
// capturing the timeline, root cause, impact, what went well/wrong, action
// items, and lessons learned.
//
// Spec (Ch.17 Philosophy): "Infrastructure is not an afterthought—it is part
// of election integrity." Postmortems ensure we learn from every failure.

import { db } from '@/lib/db'
import { logger } from './logger'

export interface PostmortemInput {
  incidentId?: string
  title: string
  severity: string
  summary: string
  timeline?: Array<{ time: string; event: string }>
  rootCause: string
  impact: string
  whatWentWell?: string[]
  whatWentWrong?: string[]
  actionItems?: Array<{ item: string; owner?: string; due?: string; status: string }>
  lessonsLearned?: string[]
}

export interface PostmortemUpdate {
  title?: string
  severity?: string
  status?: string
  summary?: string
  timeline?: Array<{ time: string; event: string }>
  rootCause?: string
  impact?: string
  whatWentWell?: string[]
  whatWentWrong?: string[]
  actionItems?: Array<{ item: string; owner?: string; due?: string; status: string }>
  lessonsLearned?: string[]
  reviewedBy?: string
}

export async function createPostmortem(
  input: PostmortemInput,
  author: { id: string; name: string },
) {
  const pm = await db.postmortem.create({
    data: {
      incidentId: input.incidentId || null,
      title: input.title,
      severity: input.severity,
      status: 'draft',
      summary: input.summary,
      timeline: JSON.stringify(input.timeline || []),
      rootCause: input.rootCause,
      impact: input.impact,
      whatWentWell: JSON.stringify(input.whatWentWell || []),
      whatWentWrong: JSON.stringify(input.whatWentWrong || []),
      actionItems: JSON.stringify(input.actionItems || []),
      lessonsLearned: JSON.stringify(input.lessonsLearned || []),
      authoredBy: author.id,
      authoredByName: author.name,
    },
  })

  logger.audit(`Postmortem created: ${input.title}`, {
    metadata: { postmortemId: pm.id, incidentId: input.incidentId },
  })

  return pm
}

export async function listPostmortems(limit: number = 30, status?: string) {
  const where = status ? { status } : {}
  return db.postmortem.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}

export async function getPostmortem(id: string) {
  const pm = await db.postmortem.findUnique({ where: { id } })
  if (!pm) return null
  return {
    ...pm,
    timeline: JSON.parse(pm.timeline || '[]'),
    whatWentWell: JSON.parse(pm.whatWentWell || '[]'),
    whatWentWrong: JSON.parse(pm.whatWentWrong || '[]'),
    actionItems: JSON.parse(pm.actionItems || '[]'),
    lessonsLearned: JSON.parse(pm.lessonsLearned || '[]'),
  }
}

export async function updatePostmortem(id: string, update: PostmortemUpdate) {
  const data: any = {}
  if (update.title !== undefined) data.title = update.title
  if (update.severity !== undefined) data.severity = update.severity
  if (update.status !== undefined) data.status = update.status
  if (update.summary !== undefined) data.summary = update.summary
  if (update.rootCause !== undefined) data.rootCause = update.rootCause
  if (update.impact !== undefined) data.impact = update.impact
  if (update.timeline !== undefined) data.timeline = JSON.stringify(update.timeline)
  if (update.whatWentWell !== undefined) data.whatWentWell = JSON.stringify(update.whatWentWell)
  if (update.whatWentWrong !== undefined) data.whatWentWrong = JSON.stringify(update.whatWentWrong)
  if (update.actionItems !== undefined) data.actionItems = JSON.stringify(update.actionItems)
  if (update.lessonsLearned !== undefined) data.lessonsLearned = JSON.stringify(update.lessonsLearned)
  if (update.reviewedBy !== undefined) {
    data.reviewedBy = update.reviewedBy
    data.reviewedAt = new Date()
  }
  if (update.status === 'published') {
    data.publishedAt = new Date()
  }

  return db.postmortem.update({ where: { id }, data })
}

export async function deletePostmortem(id: string) {
  return db.postmortem.delete({ where: { id } })
}

export async function getPostmortemStats() {
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  const [total, published, drafts, recent90d, actionItemsOpen] = await Promise.all([
    db.postmortem.count(),
    db.postmortem.count({ where: { status: 'published' } }),
    db.postmortem.count({ where: { status: 'draft' } }),
    db.postmortem.count({ where: { createdAt: { gte: since } } }),
    db.postmortem.findMany({
      where: { status: 'published' },
      select: { actionItems: true },
    }),
  ])

  let openActionItems = 0
  for (const pm of actionItemsOpen) {
    try {
      const items = JSON.parse(pm.actionItems || '[]')
      openActionItems += items.filter((i: any) => i.status !== 'done' && i.status !== 'completed').length
    } catch { /* ignore */ }
  }

  return {
    total,
    published,
    drafts,
    recent90d,
    openActionItems,
  }
}

/**
 * Seed a sample postmortem on first load so the dashboard has content.
 */
export async function ensurePostmortemSeeded() {
  const count = await db.postmortem.count()
  if (count > 0) return

  await createPostmortem(
    {
      title: 'API latency spike during SUG election peak',
      severity: 'warning',
      summary:
        'On election day, API p95 latency spiked to 1.2s for approximately 18 minutes during the peak voting hour. No votes were lost — the vote recording queue absorbed the backlog — but voter experience degraded noticeably. Root cause: insufficient database connection pool size for the concurrent voter load.',
      timeline: [
        { time: '10:00', event: 'Voting opened. Load at 2,000 concurrent voters.' },
        { time: '10:15', event: 'Load ramped to 15,000 concurrent voters (peak hour).' },
        { time: '10:18', event: 'p95 latency exceeded 500ms SLO threshold.' },
        { time: '10:22', event: 'Alert fired: "High API Latency" (Slack + email).' },
        { time: '10:25', event: 'On-call engineer began investigation.' },
        { time: '10:30', event: 'Identified DB connection pool exhaustion.' },
        { time: '10:35', event: 'Increased pool size from 20 → 50 via config rollout.' },
        { time: '10:40', event: 'p95 latency returned to 180ms. SLO recovered.' },
      ],
      rootCause:
        'The Prisma client connection pool was sized for the default (10) but the election peaked at 15,000 concurrent voters. Each voter request held a connection for ~80ms, exhausting the pool. Requests queued, inflating latency.',
      impact:
        '18 minutes of degraded p95 latency (500ms–1200ms). 0 votes lost (queue absorbed backlog). 3 voters reported timeouts via support. No data integrity impact.',
      whatWentWell: [
        'The vote recording queue absorbed the backlog — no votes were lost.',
        'The alerting system fired within 4 minutes of the SLO breach.',
        'The on-call engineer identified the root cause in 5 minutes.',
        'Rolling config update applied without downtime.',
      ],
      whatWentWrong: [
        'Connection pool size was never load-tested at election-day scale.',
        'The capacity planner assumed 150 vps/replica but didn\'t account for connection hold time.',
        'No pre-election load test was run at the actual expected voter count.',
      ],
      actionItems: [
        { item: 'Run pre-election load test at expected voter count', owner: 'Platform Team', due: '2025-08-15', status: 'in-progress' },
        { item: 'Increase default connection pool to 50', owner: 'Backend', due: '2025-08-10', status: 'done' },
        { item: 'Add connection pool usage metric to the dashboard', owner: 'Observability', due: '2025-08-20', status: 'in-progress' },
        { item: 'Add capacity-planning step to the Election Readiness Checker', owner: 'Platform Team', due: '2025-08-30', status: 'todo' },
      ],
      lessonsLearned: [
        'Always run a pre-election load test at the actual expected voter count, not a generic 10k.',
        'Connection pool sizing must account for query hold time, not just throughput.',
        'The queue-based vote recording architecture proved its worth — zero vote loss under load.',
      ],
    },
    { id: 'system', name: 'Platform Team' },
  ).catch(() => {})

  // Mark it as published + reviewed
  const pms = await db.postmortem.findMany({ take: 1 })
  if (pms[0]) {
    await db.postmortem.update({
      where: { id: pms[0].id },
      data: {
        status: 'published',
        publishedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        reviewedBy: 'cto@votewise.com.ng',
        reviewedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
    })
  }
}
