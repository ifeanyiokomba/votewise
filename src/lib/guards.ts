// VoteWise SUG v2 — Route guards: RBAC + 2FA + rate limit + device binding.
// Every privileged endpoint goes through `requireOfficial(capability)`.

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAccessToken, readAccessToken, AccessPayload } from '@/lib/auth'
import { can, scopeCovers, Capability, PermissionContext } from '@/lib/rbac'
import { RATE_LIMITS } from '@/lib/ratelimit'
import { deviceFromRequest } from '@/lib/device'

export interface OfficialContext {
  payload: AccessPayload
  official: {
    id: string
    email: string
    name: string
    role: string
    scopeFacultyId: string | null
    scopeDepartmentId: string | null
    totpEnabled: boolean
  }
  ctx: PermissionContext
  device: ReturnType<typeof deviceFromRequest>
}

function unauthorized(message = 'Unauthorized', status = 401) {
  return NextResponse.json({ error: message }, { status, headers: { 'content-type': 'application/json' } })
}

function tooMany(retryAfterMs: number) {
  return NextResponse.json(
    { error: 'Too many requests. Please slow down.' },
    { status: 429, headers: { 'content-type': 'application/json', 'retry-after': String(Math.ceil(retryAfterMs / 1000)) } }
  )
}

export async function requireOfficial(
  req: NextRequest,
  capability: Capability,
  opts: { rateLimit?: 'auth' | 'none' } = {}
): Promise<OfficialContext | NextResponse> {
  // 1. IP rate limit (global + auth-specific).
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
  const ipRl = RATE_LIMITS.ip(ip)
  if (!ipRl.allowed) return tooMany(ipRl.retryAfterMs)
  if (opts.rateLimit === 'auth') {
    const authRl = RATE_LIMITS.authIp(ip)
    if (!authRl.allowed) return tooMany(authRl.retryAfterMs)
  }

  // 2. Verify access token.
  const token = readAccessToken(req)
  const payload = await verifyAccessToken(token)
  if (!payload) return unauthorized('Session expired. Please sign in again.')

  // 3. Load the official (and verify they still exist + aren't locked).
  const official = await db.electionOfficial.findUnique({
    where: { id: payload.sub },
    select: {
      id: true, email: true, name: true, role: true,
      scopeFacultyId: true, scopeDepartmentId: true, totpEnabled: true,
      lockedUntil: true,
    },
  })
  if (!official) return unauthorized('Account not found.')
  if (official.lockedUntil && official.lockedUntil > new Date()) {
    return unauthorized('Account is temporarily locked due to suspicious activity.', 423)
  }

  // 4. RBAC check.
  const ctx: PermissionContext = {
    role: official.role as any,
    scopeFacultyId: official.scopeFacultyId,
    scopeDepartmentId: official.scopeDepartmentId,
  }
  if (!can(ctx, capability)) return unauthorized('You do not have permission to perform this action.', 403)

  return {
    payload,
    official: {
      id: official.id, email: official.email, name: official.name, role: official.role,
      scopeFacultyId: official.scopeFacultyId, scopeDepartmentId: official.scopeDepartmentId,
      totpEnabled: official.totpEnabled,
    },
    ctx,
    device: deviceFromRequest(req),
  }
}

// Scope-aware variant: ensures the official's scope covers the target resource.
export async function requireScopedOfficial(
  req: NextRequest,
  capability: Capability,
  target: { facultyId?: string | null; departmentId?: string | null }
): Promise<OfficialContext | NextResponse> {
  const res = await requireOfficial(req, capability)
  if (res instanceof NextResponse) return res
  if (!scopeCovers(res.ctx, target)) {
    return unauthorized('Your role scope does not cover this resource.', 403)
  }
  return res
}

// Lightweight helper: returns the current official from the access token in
// the request, WITHOUT requiring a specific capability. Use this when you need
// to do custom role checks (e.g. platform super admin only). Returns null if
// not authenticated.
export async function getCurrentOfficial(req: NextRequest) {
  const token = readAccessToken(req)
  if (!token) return null
  const payload = await verifyAccessToken(token)
  if (!payload) return null
  const official = await db.electionOfficial.findUnique({
    where: { id: payload.sub },
    select: {
      id: true, email: true, name: true, role: true,
      scopeFacultyId: true, scopeDepartmentId: true, totpEnabled: true,
      lockedUntil: true,
    },
  })
  if (!official) return null
  if (official.lockedUntil && official.lockedUntil > new Date()) return null
  return official
}

// Voter session guard (DB-backed session token on Voter row, device-bound).
export async function requireVoter(req: NextRequest) {
  const token =
    req.headers.get('x-voter-token') ||
    req.headers.get('x-session-token') ||
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) {
    return { error: NextResponse.json({ error: 'No voter session' }, { status: 401, headers: { 'content-type': 'application/json' } }) }
  }
  const voter = await db.voter.findUnique({
    where: { sessionToken: token },
    include: { faculty: { select: { name: true, code: true } }, department: { select: { name: true, code: true } } },
  })
  if (!voter || !voter.sessionExpiresAt || voter.sessionExpiresAt < new Date()) {
    return { error: NextResponse.json({ error: 'Voter session expired' }, { status: 401, headers: { 'content-type': 'application/json' } }) }
  }
  if (voter.lockedUntil && voter.lockedUntil > new Date()) {
    return { error: NextResponse.json({ error: 'Your account is temporarily locked.' }, { status: 423, headers: { 'content-type': 'application/json' } }) }
  }
  if (voter.hasVoted) {
    return { error: NextResponse.json({ error: 'You have already voted' }, { status: 403, headers: { 'content-type': 'application/json' } }) }
  }
  // Device binding (if singleDeviceEnforcement is on, session device must match).
  const fp = req.headers.get('x-device-fp')
  if (fp && voter.sessionDeviceId) {
    const device = await db.device.findUnique({ where: { id: voter.sessionDeviceId } })
    if (device && device.fingerprint !== fp) {
      return { error: NextResponse.json({ error: 'Session bound to a different device. Please re-verify.' }, { status: 401, headers: { 'content-type': 'application/json' } }) }
    }
  }
  return { voter }
}

// Voter token from header OR cookie (for non-browser clients).
export function readVoterToken(req: NextRequest): string | null {
  return (
    req.headers.get('x-voter-token') ||
    req.headers.get('x-session-token') ||
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    req.cookies.get('votewise_voter')?.value ||
    null
  )
}
