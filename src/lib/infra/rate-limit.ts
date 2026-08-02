// VoteWise — Rate Limiting Middleware (Chapter 17 — Security Hardening)
//
// Spec: "Rate limiting" under Security Hardening.
//
// Uses the Redis cache (with in-memory fallback) to enforce per-IP and
// per-endpoint limits. Returns a 429 with Retry-After when exceeded.
//
// Usage in an API route:
//   import { enforceRateLimit } from '@/lib/infra/rate-limit'
//   const limited = await enforceRateLimit(req, 'vote-cast', 10, 60)
//   if (limited) return limited.response

import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/infra/redis'

export interface RateLimitConfig {
  /** Unique bucket name (e.g. 'vote-cast', 'otp-request', 'login'). */
  bucket: string
  /** Max requests in the window. */
  limit: number
  /** Window size in seconds. */
  windowSeconds: number
}

/**
 * Enforce a rate limit on the current request. Returns null if allowed,
 * or a NextResponse (429) if the limit is exceeded.
 */
export async function enforceRateLimit(
  req: NextRequest,
  config: RateLimitConfig,
): Promise<NextResponse | null> {
  const ip = getClientIp(req)
  const key = `rl:${config.bucket}:${ip}`
  const { allowed, remaining, resetAt } = await rateLimit(
    key,
    config.limit,
    config.windowSeconds,
  )

  if (allowed) return null

  const retryAfter = Math.ceil((resetAt - Date.now()) / 1000)
  return NextResponse.json(
    {
      error: 'Rate limit exceeded',
      bucket: config.bucket,
      limit: config.limit,
      windowSeconds: config.windowSeconds,
      retryAfter,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
        'X-RateLimit-Limit': String(config.limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.floor(resetAt / 1000)),
      },
    },
  )
}

/**
 * Apply rate-limit headers to a successful response (for client visibility).
 */
export function rateLimitHeaders(remaining: number, limit: number, resetAt: number) {
  return {
    'X-RateLimit-Limit': String(limit),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(Math.floor(resetAt / 1000)),
  }
}

// --- Standard rate limit presets (per spec: "DDoS protection", "Rate limiting") ---
export const RATE_LIMITS = {
  /** Vote casting — 10 votes per minute per IP (1 voter = 1 vote, so this is generous) */
  voteCast: { bucket: 'vote-cast', limit: 10, windowSeconds: 60 },
  /** OTP request — 5 per 5 minutes (prevent OTP flooding) */
  otpRequest: { bucket: 'otp-request', limit: 5, windowSeconds: 300 },
  /** Login — 10 per minute (brute-force protection) */
  login: { bucket: 'login', limit: 10, windowSeconds: 60 },
  /** Password reset — 3 per hour */
  passwordReset: { bucket: 'password-reset', limit: 3, windowSeconds: 3600 },
  /** API key auth — 60 per minute (general API) */
  api: { bucket: 'api', limit: 60, windowSeconds: 60 },
  /** Receipt verification — 30 per minute (public) */
  receiptVerify: { bucket: 'receipt-verify', limit: 30, windowSeconds: 60 },
  /** General read — 200 per minute */
  read: { bucket: 'read', limit: 200, windowSeconds: 60 },
  /** General write — 30 per minute */
  write: { bucket: 'write', limit: 30, windowSeconds: 60 },
} as const

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}
