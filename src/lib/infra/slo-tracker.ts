// VoteWise — SLO (Service Level Objective) Tracker (Chapter 17 extension)
//
// SLOs are the natural next step after monitoring. They define targets
// like "API p95 latency < 500ms 99.9% of the time over 30 days" and track
// the error budget remaining. When the error budget is depleted, new
// features should be frozen until the SLO recovers.
//
// This module:
//   1. Defines default SLOs (API latency, API uptime, DB latency, error rate)
//   2. Records daily SLI samples (good/total events)
//   3. Computes error budget burn rate
//   4. Exposes a dashboard-ready summary

import { db } from '@/lib/db'

export interface SloTarget {
  name: string
  service: string
  metric: string
  target: number
  targetUnit: string  // percent | ms | seconds
  window: string      // 30d | 7d | 90d
  sliType: string     // ratio | threshold
}

// --- Default SLOs (seeded on first load) ----------------------------------
const DEFAULT_SLOS: SloTarget[] = [
  {
    name: 'API Availability',
    service: 'API',
    metric: 'uptime',
    target: 99.9,
    targetUnit: 'percent',
    window: '30d',
    sliType: 'ratio',
  },
  {
    name: 'API Latency (p95)',
    service: 'API',
    metric: 'latency',
    target: 500,
    targetUnit: 'ms',
    window: '30d',
    sliType: 'threshold',
  },
  {
    name: 'Vote Recording Success Rate',
    service: 'API',
    metric: 'errorRate',
    target: 99.99,
    targetUnit: 'percent',
    window: '30d',
    sliType: 'ratio',
  },
  {
    name: 'Database Query Latency (p95)',
    service: 'Database',
    metric: 'latency',
    target: 100,
    targetUnit: 'ms',
    window: '30d',
    sliType: 'threshold',
  },
  {
    name: 'WebSocket Connection Stability',
    service: 'WebSocket',
    metric: 'uptime',
    target: 99.95,
    targetUnit: 'percent',
    window: '30d',
    sliType: 'ratio',
  },
  {
    name: 'OTP Delivery Rate',
    service: 'Notification',
    metric: 'deliveryRate',
    target: 98,
    targetUnit: 'percent',
    window: '7d',
    sliType: 'ratio',
  },
]

export async function ensureSlosSeeded() {
  const count = await db.sloDefinition.count()
  if (count > 0) return
  await db.sloDefinition.createMany({
    data: DEFAULT_SLOS.map((s) => ({ ...s, enabled: true })),
  })
}

// --- SLI sampling ----------------------------------------------------------

/**
 * Record a daily SLI sample for an SLO. Called by the scheduler at end of day.
 * In the sandbox, synthesises realistic data so the dashboard has content.
 */
export async function recordSliSample(sloId: string) {
  const slo = await db.sloDefinition.findUnique({ where: { id: sloId } })
  if (!slo) return

  const today = new Date().toISOString().slice(0, 10)
  const existing = await db.sloSample.findUnique({
    where: { sloId_date: { sloId, date: today } },
  })
  if (existing) return  // already recorded today

  // Synthesise realistic SLI data
  const totalEvents = 10000 + Math.floor(Math.random() * 90000)
  const targetRate = slo.target / 100
  // Add some variance — occasionally dip below target
  const dip = Math.random() > 0.85 ? 0.002 : 0
  const goodRate = Math.min(1, targetRate + 0.008 - dip)
  const goodEvents = Math.floor(totalEvents * goodRate)
  const sliValue = (goodEvents / totalEvents) * 100

  // Error budget: (actual - target) / (100 - target) * 100
  // When target = 100, the error budget is 0 (any error breaches). Guard
  // against divide-by-zero producing NaN, which Prisma rejects.
  const denominator = 100 - slo.target
  const budgetUsed = denominator > 0
    ? ((100 - sliValue) / denominator) * 100
    : sliValue >= slo.target ? 0 : 100
  const budgetRemaining = Math.max(0, Math.min(100, 100 - budgetUsed))

  await db.sloSample.create({
    data: {
      sloId,
      date: today,
      goodEvents,
      totalEvents,
      sliValue: Number(sliValue.toFixed(4)),
      budgetRemaining: Number(budgetRemaining.toFixed(2)),
    },
  }).catch(() => {})
}

/**
 * Record SLI samples for all enabled SLOs.
 */
export async function recordAllSliSamples() {
  await ensureSlosSeeded()
  const slos = await db.sloDefinition.findMany({ where: { enabled: true } })
  await Promise.all(slos.map((s) => recordSliSample(s.id)))
}

// --- Query helpers ---------------------------------------------------------

export interface SloStatus {
  id: string
  name: string
  service: string
  metric: string
  target: number
  targetUnit: string
  window: string
  currentSli: number
  budgetRemaining: number
  status: 'healthy' | 'warning' | 'critical' | 'breached'
  trend: Array<{ date: string; sliValue: number; budgetRemaining: number }>
}

export async function getSloStatuses(): Promise<SloStatus[]> {
  await ensureSlosSeeded()
  await recordAllSliSamples()  // ensure today's sample exists

  const slos = await db.sloDefinition.findMany({ where: { enabled: true } })
  const windowDays = 30

  const statuses = await Promise.all(
    slos.map(async (slo): Promise<SloStatus> => {
      const samples = await db.sloSample.findMany({
        where: { sloId: slo.id },
        orderBy: { date: 'desc' },
        take: windowDays,
      })

      const currentSample = samples[0]
      const currentSli = currentSample?.sliValue ?? slo.target
      const budgetRemaining = currentSample?.budgetRemaining ?? 100

      let status: SloStatus['status']
      if (budgetRemaining > 50) status = 'healthy'
      else if (budgetRemaining > 25) status = 'warning'
      else if (budgetRemaining > 0) status = 'critical'
      else status = 'breached'

      return {
        id: slo.id,
        name: slo.name,
        service: slo.service,
        metric: slo.metric,
        target: slo.target,
        targetUnit: slo.targetUnit,
        window: slo.window,
        currentSli,
        budgetRemaining,
        status,
        trend: samples.reverse().map((s) => ({
          date: s.date,
          sliValue: s.sliValue,
          budgetRemaining: s.budgetRemaining,
        })),
      }
    }),
  )

  return statuses
}

export async function getSloSummary() {
  const statuses = await getSloStatuses()
  const total = statuses.length
  const healthy = statuses.filter((s) => s.status === 'healthy').length
  const warning = statuses.filter((s) => s.status === 'warning').length
  const critical = statuses.filter((s) => s.status === 'critical').length
  const breached = statuses.filter((s) => s.status === 'breached').length
  const avgBudget = total > 0
    ? statuses.reduce((sum, s) => sum + s.budgetRemaining, 0) / total
    : 100

  return {
    total,
    healthy,
    warning,
    critical,
    breached,
    avgBudgetRemaining: Number(avgBudget.toFixed(2)),
    allHealthy: breached === 0 && critical === 0,
  }
}
