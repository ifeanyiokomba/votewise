// VoteWise SUG v2 — In-process job queue (BullMQ interface in production).
// Used for: sending OTP notifications, writing audit logs asynchronously,
// result recomputation. Keeps request handlers fast.

export interface Job<T = unknown> {
  id: string
  name: string
  payload: T
  attempts: number
  createdAt: Date
}

type Handler<T = unknown> = (payload: T) => Promise<void>

const handlers = new Map<string, Handler>()
const queue: Job[] = []
let processing = false

export function registerHandler<T>(name: string, handler: Handler<T>) {
  handlers.set(name, handler as Handler)
}

export function enqueue<T>(name: string, payload: T): string {
  const job: Job<T> = {
    id: Math.random().toString(36).slice(2) + Date.now().toString(36),
    name,
    payload,
    attempts: 0,
    createdAt: new Date(),
  }
  queue.push(job as unknown as Job)
  void processQueue()
  return job.id
}

async function processQueue() {
  if (processing) return
  processing = true
  try {
    while (queue.length > 0) {
      const job = queue.shift()!
      const handler = handlers.get(job.name)
      if (!handler) { console.warn(`[jobs] no handler for ${job.name}`); continue }
      try {
        await handler(job.payload)
      } catch (e) {
        job.attempts++
        if (job.attempts < 3) {
          queue.push(job) // retry
          await new Promise((r) => setTimeout(r, 500 * job.attempts))
        } else {
          console.error(`[jobs] giving up on ${job.name}`, e)
        }
      }
    }
  } finally {
    processing = false
  }
}

// ---------------------------------------------------------------------------
// Chapter 17 — scheduled background jobs (alert evaluation, backup, metrics)
// ---------------------------------------------------------------------------

let periodicTimer: NodeJS.Timeout | null = null

/**
 * Start the periodic job scheduler. Runs every 30s and enqueues:
 *   • alert.evaluate  — evaluate all alert rules against live metrics
 *   • metrics.capture — snapshot system metrics for sparklines
 *   • backup.check    — check if a scheduled backup is due
 *
 * In production, this runs in the scheduler microservice. In the sandbox
 * (single process), it runs in-process so the dashboard has fresh data.
 */
export function startPeriodicJobs() {
  if (periodicTimer) return
  let tick = 0
  periodicTimer = setInterval(() => {
    tick++
    // Every 30s: alert evaluation + metrics capture
    enqueue('alert.evaluate', {})
    enqueue('metrics.capture', {})
    // Every 5 minutes (10th tick): SLO sampling
    if (tick % 10 === 0) {
      enqueue('slo.sample', {})
    }
  }, 30_000)
  console.log('[jobs] periodic scheduler started (30s interval, SLO sampling every 5min)')
}

export function stopPeriodicJobs() {
  if (periodicTimer) {
    clearInterval(periodicTimer)
    periodicTimer = null
  }
}
