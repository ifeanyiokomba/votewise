// AfriVote SUG v2 — JWT access + refresh token auth with HttpOnly cookies.
// Stateless access token (15 min) + rotating refresh token (7 days, family-tracked).
// Tokens NEVER touch JavaScript (HttpOnly cookies) → XSS cannot steal them.

import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import { randomToken, sha256 } from '@/lib/crypto'

const ACCESS_SECRET = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET || 'afrivote-access-secret-dev-only-32bytes!!'.slice(0, 32))
const REFRESH_SECRET = new TextEncoder().encode(process.env.JWT_REFRESH_SECRET || 'afrivote-refresh-secret-dev-only-32byte!'.slice(0, 32))

export const ACCESS_COOKIE = 'afrivote_access'
export const REFRESH_COOKIE = 'afrivote_refresh'

export interface AccessPayload {
  sub: string        // official id
  role: string       // SUPER_ADMIN|ELECTORAL_COMMITTEE|FACULTY_OFFICER|DEPARTMENT_OFFICER|OBSERVER
  name: string
  email: string
  scopeFacultyId?: string | null
  scopeDepartmentId?: string | null
  type: 'access'
  iat: number
  exp: number
}

export async function signAccessToken(payload: Omit<AccessPayload, 'type' | 'iat' | 'exp'>, ttlMinutes = 15): Promise<string> {
  return new SignJWT({ ...payload, type: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${ttlMinutes}m`)
    .setSubject(payload.sub)
    .sign(ACCESS_SECRET)
}

export async function verifyAccessToken(token: string | undefined | null): Promise<AccessPayload | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, ACCESS_SECRET)
    if (payload.type !== 'access') return null
    return payload as unknown as AccessPayload
  } catch {
    return null
  }
}

// Refresh tokens are opaque random strings; we store their HASH in the DB.
export function newRefreshToken(): { token: string; tokenHash: string; family: string } {
  const token = randomToken(40)
  const family = randomToken(16)
  return { token, tokenHash: sha256(token), family }
}

export function hashRefreshToken(token: string): string {
  return sha256(token)
}

export async function verifyRefreshToken(token: string | undefined | null): Promise<{ tokenHash: string } | null> {
  if (!token) return null
  return { tokenHash: hashRefreshToken(token) }
}

// ---------------------------------------------------------------------------
// Cookie helpers (server-side)
// ---------------------------------------------------------------------------
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
}

export async function setAuthCookies(accessToken: string, refreshToken: string, accessTtlMin = 15, refreshTtlDays = 7) {
  const c = await cookies()
  c.set(ACCESS_COOKIE, accessToken, { ...COOKIE_OPTS, maxAge: accessTtlMin * 60 })
  c.set(REFRESH_COOKIE, refreshToken, { ...COOKIE_OPTS, maxAge: refreshTtlDays * 24 * 60 * 60 })
}

export async function clearAuthCookies() {
  const c = await cookies()
  c.delete(ACCESS_COOKIE)
  c.delete(REFRESH_COOKIE)
}

export function readAccessCookie(req: NextRequest): string | null {
  return req.cookies.get(ACCESS_COOKIE)?.value || null
}
export function readRefreshCookie(req: NextRequest): string | null {
  return req.cookies.get(REFRESH_COOKIE)?.value || null
}

// For non-browser clients (e.g. tests), also accept Authorization header.
export function readAccessToken(req: NextRequest): string | null {
  return readAccessCookie(req) || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || null
}
