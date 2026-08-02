// VoteWise — Cost Tracker (Chapter 17 — Cost Monitoring)
//
// Spec: "Track: Infrastructure costs, Storage costs, SMS costs, Email costs,
// Compute costs, Database costs. Prevent unexpected spending."
//
// Records cost line items to the CostRecord table and aggregates them for
// the cost monitoring dashboard.

import { db } from '@/lib/db'

const USD_TO_NGN = 1500  // approximate exchange rate

export type CostCategory =
  | 'infrastructure'
  | 'compute'
  | 'database'
  | 'storage'
  | 'sms'
  | 'email'
  | 'whatsapp'
  | 'cdn'
  | 'other'

export interface CostRecordInput {
  category: CostCategory
  service?: string
  amountUsd: number
  units?: number
  unitLabel?: string
  periodStart?: Date
  periodEnd?: Date
  organizationId?: string
}

/** Record a cost line item. */
export async function recordCost(input: CostRecordInput) {
  const now = new Date()
  return db.costRecord.create({
    data: {
      category: input.category,
      service: input.service || null,
      amountUsd: input.amountUsd,
      amountNgn: input.amountUsd * USD_TO_NGN,
      units: input.units || null,
      unitLabel: input.unitLabel || null,
      periodStart: input.periodStart || now,
      periodEnd: input.periodEnd || now,
      organizationId: input.organizationId || null,
    },
  })
}

/** Record SMS cost (called by the notification service). */
export async function recordSmsCost(organizationId: string, units: number) {
  const costPerSms = 0.02  // $0.02 per SMS (Nigerian rate)
  return recordCost({
    category: 'sms',
    service: 'termii',
    amountUsd: units * costPerSms,
    units,
    unitLabel: 'SMS',
    organizationId,
  })
}

/** Record email cost. */
export async function recordEmailCost(organizationId: string, units: number) {
  const costPerEmail = 0.0005  // $0.0005 per email (Resend)
  return recordCost({
    category: 'email',
    service: 'resend',
    amountUsd: units * costPerEmail,
    units,
    unitLabel: 'email',
    organizationId,
  })
}

/** Record WhatsApp cost. */
export async function recordWhatsappCost(organizationId: string, units: number) {
  const costPerMsg = 0.05  // $0.05 per WhatsApp message
  return recordCost({
    category: 'whatsapp',
    service: 'termii',
    amountUsd: units * costPerMsg,
    units,
    unitLabel: 'WhatsApp',
    organizationId,
  })
}

// --- Query helpers (for the Costs dashboard) ------------------------------

export interface CostQuery {
  since?: Date
  until?: Date
  organizationId?: string
  category?: CostCategory
}

export async function getCostSummary(q: CostQuery = {}) {
  const where: any = {}
  if (q.since) where.periodStart = { gte: q.since }
  if (q.until) where.periodStart = { ...where.periodStart, lte: q.until }
  if (q.organizationId) where.organizationId = q.organizationId
  if (q.category) where.category = q.category

  const [byCategory, total, byService] = await Promise.all([
    db.costRecord.groupBy({
      by: ['category'],
      where,
      _sum: { amountUsd: true },
    }),
    db.costRecord.aggregate({ where, _sum: { amountUsd: true } }),
    db.costRecord.groupBy({
      by: ['service'],
      where,
      _sum: { amountUsd: true },
    }),
  ])

  return {
    totalUsd: total._sum.amountUsd || 0,
    totalNgn: (total._sum.amountUsd || 0) * USD_TO_NGN,
    byCategory: Object.fromEntries(
      byCategory.map((c) => [c.category, c._sum.amountUsd || 0]),
    ),
    byService: Object.fromEntries(
      byService.map((s) => [s.service || 'unknown', s._sum.amountUsd || 0]),
    ),
  }
}

export async function getCostTrend(days: number = 30, organizationId?: string) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const where: any = { periodStart: { gte: since } }
  if (organizationId) where.organizationId = organizationId

  const records = await db.costRecord.findMany({
    where,
    orderBy: { periodStart: 'asc' },
    select: { category: true, amountUsd: true, periodStart: true },
  })

  // Group by day + category
  const byDay = new Map<string, Record<string, number>>()
  for (const r of records) {
    const day = r.periodStart.toISOString().slice(0, 10)
    if (!byDay.has(day)) byDay.set(day, {})
    const dayMap = byDay.get(day)!
    dayMap[r.category] = (dayMap[r.category] || 0) + r.amountUsd
  }

  return Array.from(byDay.entries()).map(([day, costs]) => ({
    date: day,
    costs,
    total: Object.values(costs).reduce((a, b) => a + b, 0),
  }))
}

/**
 * Seed sample cost data on first load so the dashboard has something to
 * show. In production, real cost records come from provider billing.
 */
export async function ensureCostsSeeded() {
  const count = await db.costRecord.count()
  if (count > 0) return

  const now = Date.now()
  const samples: CostRecordInput[] = []
  const categories: Array<{ cat: CostCategory; service: string; baseCost: number; unitLabel: string }> = [
    { cat: 'compute', service: 'aws-ecs', baseCost: 45, unitLabel: 'hours' },
    { cat: 'database', service: 'aws-rds', baseCost: 32, unitLabel: 'hours' },
    { cat: 'storage', service: 'aws-s3', baseCost: 5, unitLabel: 'GB-month' },
    { cat: 'sms', service: 'termii', baseCost: 18, unitLabel: 'SMS' },
    { cat: 'email', service: 'resend', baseCost: 2, unitLabel: 'email' },
    { cat: 'cdn', service: 'cloudflare', baseCost: 8, unitLabel: 'GB' },
    { cat: 'infrastructure', service: 'aws-alb', baseCost: 12, unitLabel: 'hours' },
  ]

  // 30 days of sample data
  for (let d = 29; d >= 0; d--) {
    const day = new Date(now - d * 24 * 60 * 60 * 1000)
    for (const c of categories) {
      // Add some daily variance
      const variance = 0.7 + Math.random() * 0.6
      samples.push({
        category: c.cat,
        service: c.service,
        amountUsd: Number((c.baseCost * variance).toFixed(2)),
        units: Math.floor(c.baseCost * variance * 100),
        unitLabel: c.unitLabel,
        periodStart: day,
        periodEnd: new Date(day.getTime() + 24 * 60 * 60 * 1000),
      })
    }
  }

  await db.costRecord.createMany({
    data: samples.map((s) => ({
      category: s.category,
      service: s.service || null,
      amountUsd: s.amountUsd,
      amountNgn: s.amountUsd * USD_TO_NGN,
      units: s.units || null,
      unitLabel: s.unitLabel || null,
      periodStart: s.periodStart!,
      periodEnd: s.periodEnd!,
      organizationId: s.organizationId || null,
    })),
  })
}
