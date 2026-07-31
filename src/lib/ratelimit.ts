// VoteWise SUG v2 — In-memory token-bucket rate limiter.
// Production: swap for Redis (same interface). Bucketed per key (IP or userId).

interface Bucket { tokens: number; lastRefill: number }

const buckets = new Map<string, Bucket>()
const CLEANUP_INTERVAL = 5 * 60 * 1000 // prune idle buckets every 5 min
let lastCleanup = Date.now()

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterMs: number
}

export function rateLimit(
  key: string,
  opts: { capacity: number; refillPerSec: number }
): RateLimitResult {
  const now = Date.now()
  // Prune occasionally.
  if (now - lastCleanup > CLEANUP_INTERVAL) {
    for (const [k, b] of buckets) {
      if (now - b.lastRefill > CLEANUP_INTERVAL) buckets.delete(k)
    }
    lastCleanup = now
  }
  let b = buckets.get(key)
  if (!b) {
    b = { tokens: opts.capacity, lastRefill: now }
    buckets.set(key, b)
  }
  // Refill.
  const elapsedSec = (now - b.lastRefill) / 1000
  b.tokens = Math.min(opts.capacity, b.tokens + elapsedSec * opts.refillPerSec)
  b.lastRefill = now
  if (b.tokens >= 1) {
    b.tokens -= 1
    return { allowed: true, remaining: Math.floor(b.tokens), retryAfterMs: 0 }
  }
  const retryAfterMs = Math.ceil((1 - b.tokens) / opts.refillPerSec * 1000)
  return { allowed: false, remaining: 0, retryAfterMs }
}

// Pre-configured policies.
export const RATE_LIMITS = {
  // Global per-IP: 120 req/min
  ip: (ip: string) => rateLimit(`ip:${ip}`, { capacity: 120, refillPerSec: 2 }),
  // Auth endpoints (login, OTP): 10/min per IP
  authIp: (ip: string) => rateLimit(`auth-ip:${ip}`, { capacity: 10, refillPerSec: 0.16 }),
  // OTP send per matric: 1/min (60s cooldown also enforced in DB)
  otpSend: (matric: string) => rateLimit(`otp-send:${matric}`, { capacity: 1, refillPerSec: 1 / 60 }),
  // Vote cast per voter: 3/min (replays blocked by idempotency anyway)
  voteCast: (voterId: string) => rateLimit(`vote-cast:${voterId}`, { capacity: 3, refillPerSec: 0.05 }),
} as const
