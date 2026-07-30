// AfriVote SUG v2 — In-process job queue (BullMQ interface in production).
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
