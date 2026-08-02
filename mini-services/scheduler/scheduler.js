// VoteWise — Scheduler entrypoint.
//
// Runs periodic jobs on a cron-like schedule. Single replica (K8s
// leader-election or a DB-backed lock prevents duplicate triggers).
// Enqueues work into the job queue (consumed by the worker service).
//
// Schedule (per spec):
//   • Hourly snapshots  — every hour at :05
//   • Daily backups     — 02:00 daily
//   • Weekly backups    — Sunday 03:00
//   • Monthly archives  — 1st of month 04:00
//   • Uptime sampling   — every 5 minutes
//   • Cost aggregation  — every hour at :30
//   • SSL renewal check — daily 05:00
//   • Replica lag check — every 2 minutes

import { enqueue } from '../../src/lib/jobs'

const SCHEDULE: Array<{ name: string; cron: string; job: string; payload?: any }> = [
  { name: 'hourly-backup',  cron: '5 * * * *',     job: 'backup.scheduled', payload: { type: 'hourly' } },
  { name: 'daily-backup',   cron: '0 2 * * *',     job: 'backup.scheduled', payload: { type: 'daily' } },
  { name: 'weekly-backup',  cron: '0 3 * * 0',     job: 'backup.scheduled', payload: { type: 'weekly' } },
  { name: 'monthly-archive',cron: '0 4 1 * *',     job: 'backup.scheduled', payload: { type: 'monthly' } },
  { name: 'uptime-sample',  cron: '*/5 * * * *',   job: 'uptime.sample' },
  { name: 'cost-aggregate', cron: '30 * * * *',    job: 'cost.aggregate' },
  { name: 'ssl-renewal',    cron: '0 5 * * *',     job: 'ssl.check-renewal' },
  { name: 'replica-lag',    cron: '*/2 * * * *',   job: 'health.replication-lag' },
]

// --- Minimal cron matcher --------------------------------------------------
// Returns true if the current time matches the 5-field cron expression.
function cronMatch(expr: string, now: Date): boolean {
  const [min, hour, dom, mon, dow] = expr.split(' ')
  const match = (field: string, val: number, max: number) => {
    if (field === '*') return true
    if (field.startsWith('*/')) {
      const step = Number(field.slice(2))
      return val % step === 0
    }
    return field.split(',').some((p) => Number(p) === val)
  }
  return (
    match(min, now.getMinutes(), 59) &&
    match(hour, now.getHours(), 23) &&
    match(dom, now.getDate(), 31) &&
    match(mon, now.getMonth() + 1, 12) &&
    match(dow, now.getDay(), 6)
  )
}

console.log('[scheduler] started. Schedules:')
SCHEDULE.forEach((s) => console.log(`  ${s.cron}  ${s.name} → ${s.job}`))

let lastTick = ''
setInterval(() => {
  const now = new Date()
  const tickKey = `${now.getHours()}:${now.getMinutes()}`
  if (tickKey === lastTick) return
  lastTick = tickKey

  for (const s of SCHEDULE) {
    if (cronMatch(s.cron, now)) {
      console.log(`[scheduler] firing ${s.name} → enqueue ${s.job}`)
      enqueue(s.job, s.payload || {})
    }
  }
}, 30_000) // check every 30s

console.log('[scheduler] waiting for next tick...')
