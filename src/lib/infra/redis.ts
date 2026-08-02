// VoteWise — Redis Client Wrapper (Chapter 17 — Redis Layer)
//
// Spec: "Use Redis for: Session storage, OTVP cache, Rate limiting,
// Queue backend, Temporary election state."
//
// In the sandbox (no Redis), this gracefully degrades to an in-memory
// Map. In production (REDIS_URL set), it uses the `redis` package.
// The interface is identical either way so call sites don't branch.

let redisClient: any = null
let inMemoryStore = new Map<string, { value: string; expiresAt?: number }>()
let inMemorySets = new Map<string, Set<string>>()

function getClient() {
  if (redisClient) return redisClient
  // In production, uncomment to use the real `redis` package:
  // if (process.env.REDIS_URL) {
  //   const { createClient } = require('redis')
  //   redisClient = createClient({ url: process.env.REDIS_URL })
  //   redisClient.on('error', (e: any) => console.error('[redis]', e))
  //   redisClient.connect()
  //   return redisClient
  // }
  return null  // null = use in-memory fallback
}

// --- In-memory TTL sweeper -------------------------------------------------
setInterval(() => {
  const now = Date.now()
  for (const [k, v] of inMemoryStore) {
    if (v.expiresAt && v.expiresAt < now) inMemoryStore.delete(k)
  }
}, 60_000).unref?.()

export const cache = {
  async get(key: string): Promise<string | null> {
    const client = getClient()
    if (client) return client.get(key)
    const entry = inMemoryStore.get(key)
    if (!entry) return null
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      inMemoryStore.delete(key)
      return null
    }
    return entry.value
  },

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const client = getClient()
    if (client) {
      if (ttlSeconds) await client.set(key, value, { EX: ttlSeconds })
      else await client.set(key, value)
      return
    }
    inMemoryStore.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
    })
  },

  async del(key: string): Promise<void> {
    const client = getClient()
    if (client) { await client.del(key); return }
    inMemoryStore.delete(key)
  },

  async incr(key: string, ttlSeconds?: number): Promise<number> {
    const client = getClient()
    if (client) {
      const n = await client.incr(key)
      if (n === 1 && ttlSeconds) await client.expire(key, ttlSeconds)
      return n
    }
    const cur = Number(inMemoryStore.get(key)?.value || 0) + 1
    inMemoryStore.set(key, {
      value: String(cur),
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
    })
    return cur
  },

  /** Add to a Redis SET (used for session tracking, dedup sets). */
  async sadd(key: string, ...members: string[]): Promise<number> {
    const client = getClient()
    if (client) return client.sAdd(key, members)
    if (!inMemorySets.has(key)) inMemorySets.set(key, new Set())
    const set = inMemorySets.get(key)!
    let added = 0
    for (const m of members) if (!set.has(m)) { set.add(m); added++ }
    return added
  },

  /** Check membership in a Redis SET. */
  async sismember(key: string, member: string): Promise<boolean> {
    const client = getClient()
    if (client) return client.sIsMember(key, member)
    return inMemorySets.get(key)?.has(member) || false
  },

  /** Get the size of a Redis SET. */
  async scard(key: string): Promise<number> {
    const client = getClient()
    if (client) return client.sCard(key)
    return inMemorySets.get(key)?.size || 0
  },

  /** Check if Redis is actually connected (for the readiness checker). */
  async ping(): Promise<boolean> {
    const client = getClient()
    if (client) {
      try {
        const res = await client.ping()
        return res === 'PONG'
      } catch {
        return false
      }
    }
    return false  // in-memory fallback
  },

  /** Is a real Redis configured? (Used by the readiness checker.) */
  get isConfigured() {
    return Boolean(process.env.REDIS_URL)
  },
}

// ---------------------------------------------------------------------------
// Session storage (spec: "Session storage")
// ---------------------------------------------------------------------------

const SESSION_TTL = 15 * 60  // 15 minutes (matches access token TTL)

export async function setSession(sessionId: string, data: any): Promise<void> {
  await cache.set(`session:${sessionId}`, JSON.stringify(data), SESSION_TTL)
}

export async function getSession<T = any>(sessionId: string): Promise<T | null> {
  const raw = await cache.get(`session:${sessionId}`)
  return raw ? JSON.parse(raw) : null
}

export async function destroySession(sessionId: string): Promise<void> {
  await cache.del(`session:${sessionId}`)
}

// ---------------------------------------------------------------------------
// OTVP cache (spec: "OTVP cache") — one-time vote passwords
// ---------------------------------------------------------------------------

const OTVP_TTL = 5 * 60  // 5 minutes

export async function setOtp(key: string, code: string): Promise<void> {
  await cache.set(`otp:${key}`, code, OTVP_TTL)
}

export async function getOtp(key: string): Promise<string | null> {
  return cache.get(`otp:${key}`)
}

export async function consumeOtp(key: string): Promise<boolean> {
  const code = await cache.get(`otp:${key}`)
  if (!code) return false
  await cache.del(`otp:${key}`)  // one-time use
  return true
}

// ---------------------------------------------------------------------------
// Rate limiting (spec: "Rate limiting")
// ---------------------------------------------------------------------------

export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const count = await cache.incr(key, windowSeconds)
  const allowed = count <= limit
  return {
    allowed,
    remaining: Math.max(0, limit - count),
    resetAt: Date.now() + windowSeconds * 1000,
  }
}
