// VoteWise — In-memory TTL cache (Redis interface in production).
// Used for: aggregated results (2.5s TTL), election meta (10s), rate-limit
// buckets (handled in ratelimit.ts), org resolution (30s). All methods sync-safe.
//
// NOTE: `get` returns `undefined` for missing keys (not null), so callers can
// distinguish "not cached" from "cached as null" (negative caching). Use
// `Cache.has(key)` or check `=== undefined` to detect cache misses.

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
  get<T>(key: string): T | undefined {
    maybeCleanup()
    const e = store.get(key) as Entry<T> | undefined
    if (!e) return undefined
    if (e.expiresAt < now()) { store.delete(key); return undefined }
    return e.value as T
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
  // Chapter 2: org resolution cache (subdomain / custom domain → ResolvedOrganization)
  organizationSubdomain: (sub: string) => `org:sub:${sub}`,
  organizationDomain: (domain: string) => `org:dom:${domain}`,
} as const
