// AfriVote SUG v2 — In-memory TTL cache (Redis interface in production).
// Used for: aggregated results (2.5s TTL), election meta (10s), rate-limit
// buckets (handled in ratelimit.ts). All methods are sync-safe.

interface Entry<T> { value: T; expiresAt: number }

const store = new Map<string, Entry<unknown>>()
let lastCleanup = Date.now()

function maybeCleanup() {
  const now = Date.now()
  if (now - lastCleanup < 60_000) return
  for (const [k, e] of store) {
    if (e.expiresAt < now) store.delete(k)
  }
  lastCleanup = now
}

export const Cache = {
  get<T>(key: string): T | null {
    maybeCleanup()
    const e = store.get(key) as Entry<T> | undefined
    if (!e) return null
    if (e.expiresAt < now()) { store.delete(key); return null }
    return e.value
  },
  set<T>(key: string, value: T, ttlMs: number): void {
    store.set(key, { value, expiresAt: now() + ttlMs })
  },
  del(key: string): void { store.delete(key) },
  clear(prefix?: string): void {
    if (!prefix) { store.clear(); return }
    for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k)
  },
}

function now() { return Date.now() }

// Convenience keys.
export const CACHE_KEYS = {
  results: (sessionId = 'default') => `results:${sessionId}`,
  electionMeta: (sessionId = 'default') => `election:meta:${sessionId}`,
  turnout: (sessionId = 'default') => `turnout:${sessionId}`,
} as const
