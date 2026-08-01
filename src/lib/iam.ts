import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import { resolveOrganization, type ResolvedOrganization } from '@/lib/org-context'
import { writeAudit, getClientIp } from '@/lib/election'

// VoteWise — Enterprise IAM Middleware (Chapter 4)
//
// The permission pipeline. Every privileged API route should use requirePermission()
// instead of implementing its own auth logic:
//
//   Request → Authenticate → Resolve Org → Load Membership → Load Permissions
//           → Validate Permission → Execute → Audit Log → Response
//
// This replaces the legacy requireOfficial() + hardcoded rbac.ts matrix with
// a DB-driven permission system (Role → RolePermission → Permission).

export interface IAMContext {
  user: {
    id: string
    email: string
    name: string
    role: string
    accountStatus: string
    totpEnabled: boolean
  }
  org: ResolvedOrganization | null
  permissions: Set<string>
  isPlatformAdmin: boolean
  ip: string
  device: string
}

// Permission keys (mirrors the seeded permissions in scripts/seed-rbac.ts).
// These are checked against the user's loaded permissions set.
export type PermissionKey =
  | 'election.create' | 'election.manage' | 'election.delete' | 'election.publish'
  | 'election.suspend' | 'election.certify'
  | 'voter.import' | 'voter.manage' | 'voter.search' | 'voter.flag'
  | 'candidate.manage' | 'candidate.screen'
  | 'billing.manage' | 'billing.view'
  | 'security.view' | 'security.manage'
  | 'audit.view' | 'audit.export'
  | 'support.handle' | 'support.escalate'
  | 'org.branding' | 'org.domain' | 'org.roles' | 'org.members'
  | 'results.view' | 'results.export'
  | 'otp.resend' | 'voterfield.manage'

function unauthorized(message = 'Unauthorized', status = 401) {
  return NextResponse.json({ error: message }, { status, headers: { 'content-type': 'application/json' } })
}

function forbidden(message = 'You do not have permission to perform this action.') {
  return NextResponse.json({ error: message }, { status: 403, headers: { 'content-type': 'application/json' } })
}

// The main IAM middleware. Call this at the top of any privileged API route:
//
//   export async function POST(req: NextRequest) {
//     const ctx = await requirePermission(req, 'voter.import')
//     if (ctx instanceof NextResponse) return ctx
//     // ... business logic ...
//   }
//
// Returns either an IAMContext (success) or a NextResponse (error: 401/403/404).
export async function requirePermission(
  req: NextRequest,
  permission: PermissionKey,
): Promise<IAMContext | NextResponse> {
  // 1. Authenticate — verify the access token.
  const token = readAccessToken(req)
  const payload = await verifyAccessToken(token)
  if (!payload) return unauthorized('Session expired. Please sign in again.')

  // 2. Load the user (from OrganizationMember — the unified User model).
  //    Falls back to legacy ElectionOfficial for backward compat.
  let user: { id: string; email: string; name: string; role: string; accountStatus: string; totpEnabled: boolean; organizationId: string | null } | null = null

  const member = await db.organizationMember.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, name: true, role: true, accountStatus: true, totpEnabled: true, organizationId: true },
  }).catch(() => null)

  if (member) {
    user = member
  } else {
    // Fallback: legacy ElectionOfficial (bridging during Chapter 4 migration).
    const official = await db.electionOfficial.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, role: true, totpEnabled: true },
    }).catch(() => null)
    if (official) {
      user = { ...official, accountStatus: 'ACTIVE', organizationId: null }
    }
  }

  if (!user) return unauthorized('Account not found.')

  // 3. Account status check.
  if (user.accountStatus === 'SUSPENDED') return unauthorized('Account is suspended.', 403)
  if (user.accountStatus === 'LOCKED') return unauthorized('Account is locked.', 423)
  if (user.accountStatus === 'DISABLED') return unauthorized('Account is disabled.', 403)
  if (user.accountStatus === 'ARCHIVED') return unauthorized('Account is archived.', 403)

  // 4. Resolve the organization from the request (subdomain / custom domain).
  const org = await resolveOrganization(req)

  // 5. Platform admins bypass org-specific permission checks.
  const isPlatformAdmin = user.role === 'SUPER_ADMIN' || user.role === 'PLATFORM_SUPER_ADMIN'
  if (isPlatformAdmin) {
    // Platform admins have all permissions.
    const ip = getClientIp(req) || 'unknown'
    const device = req.headers.get('user-agent') || 'unknown'
    return {
      user: { id: user.id, email: user.email, name: user.name, role: user.role, accountStatus: user.accountStatus, totpEnabled: user.totpEnabled },
      org,
      permissions: new Set<string>(['__all__']), // wildcard
      isPlatformAdmin: true,
      ip,
      device,
    }
  }

  // 6. Load the user's permissions via roles → RolePermission → Permission.
  //    First, find the member's roles in this org (or platform-wide).
  const memberRoles = await db.organizationMemberRole.findMany({
    where: { memberId: user.id },
    include: {
      role: {
        include: {
          permissions: { include: { permission: true } },
        },
      },
    },
  }).catch(() => [])

  // Collect all permission keys from all roles.
  const permissions = new Set<string>()
  for (const mr of memberRoles) {
    // Only count roles that belong to this org (or are platform-wide).
    if (mr.role.organizationId === null || (org && mr.role.organizationId === org.id)) {
      for (const rp of mr.role.permissions) {
        permissions.add(rp.permission.key)
      }
    }
  }

  // Also add permissions from the legacy role string (backward compat).
  // This ensures the existing demo still works during the migration.
  const legacyRole = user.role
  if (legacyRole === 'SUPER_ADMIN' || legacyRole === 'ELECTORAL_COMMITTEE') {
    // Legacy admins get all permissions.
    permissions.add('__all__')
  } else if (legacyRole === 'OBSERVER') {
    for (const p of ['voter.search', 'candidate.screen', 'audit.view', 'support.handle', 'results.view', 'results.export', 'otp.resend']) {
      permissions.add(p)
    }
  }

  // 7. Validate the required permission.
  if (!permissions.has('__all__') && !permissions.has(permission)) {
    return forbidden()
  }

  const ip = getClientIp(req) || 'unknown'
  const device = req.headers.get('user-agent') || 'unknown'

  return {
    user: { id: user.id, email: user.email, name: user.name, role: user.role, accountStatus: user.accountStatus, totpEnabled: user.totpEnabled },
    org,
    permissions,
    isPlatformAdmin: false,
    ip,
    device,
  }
}

// Helper: check if a user has a specific permission (without the full middleware).
// Useful for conditional UI rendering.
export async function userHasPermission(userId: string, permission: PermissionKey, orgId?: string): Promise<boolean> {
  const memberRoles = await db.organizationMemberRole.findMany({
    where: { memberId: userId },
    include: {
      role: {
        include: {
          permissions: { include: { permission: true } },
        },
      },
    },
  }).catch(() => [])

  for (const mr of memberRoles) {
    if (mr.role.organizationId === null || (orgId && mr.role.organizationId === orgId)) {
      if (mr.role.permissions.some((rp) => rp.permission.key === permission)) return true
    }
  }
  return false
}

// Helper: audit an IAM event. Every identity event should be logged.
export async function auditIAMEvent(params: {
  userId: string
  userRole: string
  userName: string
  action: string
  resource?: string
  resourceId?: string
  ip?: string | null
  device?: string | null
  details?: Record<string, unknown>
  organizationId?: string | null
}): Promise<void> {
  await writeAudit({
    actorId: params.userId,
    actorRole: params.userRole,
    actorName: params.userName,
    action: params.action,
    details: params.details,
    ip: params.ip,
  }).catch(() => {})
}
