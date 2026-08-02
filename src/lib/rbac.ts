// VoteWise — Role-Based Access Control (RBAC) Permission Engine
//
// Enterprise audit (Part 1) recommendation: "These roles should be
// centralized in a permission engine rather than scattered through
// conditional checks."
//
// This module IS that centralized permission engine. Every privileged
// endpoint goes through `requireOfficial(capability)` which calls `can()`
// below. No role check should be scattered through business logic — all
// permission decisions flow through this matrix.
//
// Roles (9 total — covers the full enterprise audit spec):
//   1. PLATFORM_SUPER_ADMIN — owns VoteWise, manages all organizations
//   2. ORG_OWNER — registered the organization, full control
//   3. ORG_ADMIN — manages elections, cannot transfer ownership
//   4. OBSERVER — monitors elections, cannot modify
//   5. VOTER — votes, nothing more
//   6. READONLY_AUDITOR — read-only access to audit logs + analytics (new)
//   7. SUPPORT_AGENT — handles support tickets + chat (new)
//   8. CANDIDATE — views own profile + election info (new)
//   9. GUEST — not logged in, browses only

export type Role =
  | 'PLATFORM_SUPER_ADMIN'  // Owns VoteWise. Manages all organizations.
  | 'ORG_OWNER'             // Registered the organization. Full control.
  | 'ORG_ADMIN'             // Manages elections. Cannot transfer ownership.
  | 'OBSERVER'              // Monitors elections. Cannot modify.
  | 'VOTER'                 // Votes. Nothing more.
  | 'READONLY_AUDITOR'      // Read-only access to audit logs + analytics (enterprise audit)
  | 'SUPPORT_AGENT'         // Handles support tickets + live chat (enterprise audit)
  | 'CANDIDATE'             // Views own profile + election info (enterprise audit)
  | 'GUEST'                 // Not logged in. Browses only.

// Legacy role mapping for backwards compatibility:
// SUPER_ADMIN → PLATFORM_SUPER_ADMIN
// ELECTORAL_COMMITTEE → ORG_OWNER (or ORG_ADMIN)
// FACULTY_OFFICER → ORG_ADMIN
// DEPARTMENT_OFFICER → ORG_ADMIN
// OBSERVER → OBSERVER

export interface PermissionContext {
  role: Role
  organizationId?: string | null  // tenant scope (enforced at query level)
  scopeFacultyId?: string | null  // Kept for backwards compat, will be removed
  scopeDepartmentId?: string | null
}

// Capabilities — checked server-side on every privileged endpoint.
// Each capability is a granular permission. Roles are granted a set of
// capabilities via the MATRIX below.
export type Capability =
  // Election management
  | 'election.manage'      // Create, configure, open, close, certify elections
  | 'election.view'        // View election details (read-only)
  | 'results.certify'      // Certify election results
  | 'results.export'       // Export results (CSV, JSON, PDF)
  | 'results.view'         // View results (live + final)
  // People management
  | 'official.manage'      // Invite/manage admins and observers
  | 'candidate.screen'     // Approve/reject candidates
  | 'candidate.view'       // View candidate profiles
  | 'voter.manage'         // Import, add, flag, manage voters
  | 'voter.search'         // Search the voter register
  // Analytics + audit
  | 'analytics.view'       // View turnout, results, activity
  | 'audit.view'           // View audit logs
  | 'security.view'        // View security events + fraud incidents
  // Support
  | 'ticket.triage'        // Handle support tickets
  | 'support.chat'         // Participate in live support chat
  | 'support.assign'       // Take/release/escalate support conversations
  // Communication
  | 'notification.broadcast' // Send notifications to voters
  | 'otvp.resend'          // Resend OTVP on behalf of a voter
  // Billing + org config
  | 'billing.manage'       // Manage payments and subscriptions
  | 'domain.manage'        // Connect/disconnect custom domains
  | 'theme.manage'         // Change organization branding/theme
  // Platform-level
  | 'platform.manage'      // Platform-level: manage ALL organizations (super admin only)
  | 'infrastructure.manage' // Manage infrastructure (deployments, backups, etc.)

// ---------------------------------------------------------------------------
// Permission Matrix — the single source of truth for role → capability mapping.
// ---------------------------------------------------------------------------
const MATRIX: Record<Role, Capability[]> = {
  PLATFORM_SUPER_ADMIN: [
    // Platform super admins can do everything
    'platform.manage', 'infrastructure.manage',
    'election.manage', 'election.view', 'official.manage', 'candidate.screen',
    'candidate.view', 'voter.manage', 'analytics.view', 'voter.search',
    'ticket.triage', 'support.chat', 'support.assign',
    'audit.view', 'security.view', 'results.certify', 'results.export',
    'results.view', 'notification.broadcast', 'otvp.resend', 'billing.manage',
    'domain.manage', 'theme.manage',
  ],
  ORG_OWNER: [
    // Org owners have full control within their organization
    'election.manage', 'election.view', 'official.manage', 'candidate.screen',
    'candidate.view', 'voter.manage', 'analytics.view', 'voter.search',
    'ticket.triage', 'support.chat', 'support.assign',
    'audit.view', 'security.view', 'results.certify', 'results.export',
    'results.view', 'notification.broadcast', 'otvp.resend', 'billing.manage',
    'domain.manage', 'theme.manage',
  ],
  ORG_ADMIN: [
    // Org admins manage elections but cannot transfer ownership or manage billing
    'election.manage', 'election.view', 'candidate.screen', 'candidate.view',
    'voter.manage', 'analytics.view', 'voter.search',
    'ticket.triage', 'support.chat', 'support.assign',
    'results.export', 'results.view', 'notification.broadcast', 'otvp.resend',
    'domain.manage', 'theme.manage',
  ],
  OBSERVER: [
    // Observers monitor elections — read-only + support
    'election.view', 'analytics.view', 'voter.search',
    'ticket.triage', 'support.chat', 'support.assign',
    'results.export', 'results.view', 'candidate.view',
  ],
  READONLY_AUDITOR: [
    // Read-only auditor (enterprise audit) — audit logs + analytics only
    'election.view', 'analytics.view', 'audit.view', 'security.view',
    'results.view', 'results.export', 'candidate.view',
  ],
  SUPPORT_AGENT: [
    // Support agent — handles tickets + chat, cannot manage elections
    'ticket.triage', 'support.chat', 'support.assign',
    'voter.search', 'otvp.resend', 'election.view',
  ],
  CANDIDATE: [
    // Candidate — views own profile + election info
    'election.view', 'candidate.view', 'results.view',
  ],
  VOTER: [
    // Voters can only vote — no admin capabilities
  ],
  GUEST: [
    // Guests can only browse public pages
  ],
}

// ---------------------------------------------------------------------------
// Core permission check — every privileged call flows through this function.
// ---------------------------------------------------------------------------
export function can(ctx: PermissionContext, cap: Capability): boolean {
  // Normalize legacy role names
  const role = normalizeRole(ctx.role)
  return MATRIX[role]?.includes(cap) ?? false
}

// Check if a role requires 2FA
export function requires2FA(role: Role | string): boolean {
  const normalized = normalizeRole(role)
  // Platform super admins, org owners, and support agents must use 2FA
  return normalized === 'PLATFORM_SUPER_ADMIN' || normalized === 'ORG_OWNER' || normalized === 'SUPPORT_AGENT'
}

// Get all capabilities for a role (for UI display + debugging)
export function capabilitiesFor(role: Role | string): Capability[] {
  return MATRIX[normalizeRole(role)] || []
}

// Check if a role has ANY of the given capabilities (for menu visibility)
export function canAny(ctx: PermissionContext, caps: Capability[]): boolean {
  return caps.some((cap) => can(ctx, cap))
}

// ---------------------------------------------------------------------------
// Tenant scope check — ensures the user can only access their own org's data.
// In the new architecture, all data is tenant-scoped, so this is enforced
// at the database query level (WHERE organizationId = ?).
// ---------------------------------------------------------------------------
export function scopeCovers(
  ctx: PermissionContext,
  target?: { facultyId?: string | null; departmentId?: string | null; organizationId?: string | null },
): boolean {
  // Platform super admin can access everything
  if (normalizeRole(ctx.role) === 'PLATFORM_SUPER_ADMIN') return true
  // If target has an org, check it matches the user's org
  if (target?.organizationId && ctx.organizationId) {
    return target.organizationId === ctx.organizationId
  }
  // Org owners and admins are scoped to their tenant (enforced at query level)
  if (['ORG_OWNER', 'ORG_ADMIN', 'OBSERVER', 'READONLY_AUDITOR', 'SUPPORT_AGENT', 'CANDIDATE'].includes(normalizeRole(ctx.role))) {
    return true
  }
  return false
}

// ---------------------------------------------------------------------------
// Role metadata — for UI display, menu visibility, and onboarding flows.
// ---------------------------------------------------------------------------
export interface RoleMeta {
  role: Role
  label: string
  description: string
  color: string  // tailwind text color class
  badgeColor: string  // tailwind badge classes
  level: number  // hierarchy level (0=highest)
}

export const ROLE_METADATA: RoleMeta[] = [
  { role: 'PLATFORM_SUPER_ADMIN', label: 'Platform Super Admin', description: 'Owns VoteWise. Manages all organizations.', color: 'text-red-600 dark:text-red-400', badgeColor: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300', level: 0 },
  { role: 'ORG_OWNER', label: 'Organization Owner', description: 'Registered the organization. Full control.', color: 'text-amber-600 dark:text-amber-400', badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300', level: 1 },
  { role: 'ORG_ADMIN', label: 'Organization Admin', description: 'Manages elections. Cannot transfer ownership.', color: 'text-emerald-600 dark:text-emerald-400', badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', level: 2 },
  { role: 'OBSERVER', label: 'Observer', description: 'Monitors elections. Cannot modify.', color: 'text-zinc-600 dark:text-zinc-400', badgeColor: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300', level: 3 },
  { role: 'READONLY_AUDITOR', label: 'Read-only Auditor', description: 'Read-only access to audit logs + analytics.', color: 'text-zinc-600 dark:text-zinc-400', badgeColor: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300', level: 3 },
  { role: 'SUPPORT_AGENT', label: 'Support Agent', description: 'Handles support tickets + live chat.', color: 'text-amber-600 dark:text-amber-400', badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300', level: 3 },
  { role: 'CANDIDATE', label: 'Candidate', description: 'Views own profile + election info.', color: 'text-zinc-600 dark:text-zinc-400', badgeColor: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300', level: 4 },
  { role: 'VOTER', label: 'Voter', description: 'Votes. Nothing more.', color: 'text-zinc-600 dark:text-zinc-400', badgeColor: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300', level: 5 },
  { role: 'GUEST', label: 'Guest', description: 'Not logged in. Browses only.', color: 'text-zinc-500', badgeColor: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400', level: 9 },
]

export function getRoleMeta(role: Role | string): RoleMeta {
  const normalized = normalizeRole(role)
  return ROLE_METADATA.find((r) => r.role === normalized) || ROLE_METADATA[ROLE_METADATA.length - 1]
}

// ---------------------------------------------------------------------------
// Legacy compatibility — map old role names to new ones.
// ---------------------------------------------------------------------------
export function normalizeRole(oldRole: string): Role {
  const map: Record<string, Role> = {
    'SUPER_ADMIN': 'PLATFORM_SUPER_ADMIN',
    'ELECTORAL_COMMITTEE': 'ORG_OWNER',
    'FACULTY_OFFICER': 'ORG_ADMIN',
    'DEPARTMENT_OFFICER': 'ORG_ADMIN',
    'OBSERVER': 'OBSERVER',
    'VOTER': 'VOTER',
    'GUEST': 'GUEST',
    'PLATFORM_SUPER_ADMIN': 'PLATFORM_SUPER_ADMIN',
    'ORG_OWNER': 'ORG_OWNER',
    'ORG_ADMIN': 'ORG_ADMIN',
    'READONLY_AUDITOR': 'READONLY_AUDITOR',
    'SUPPORT_AGENT': 'SUPPORT_AGENT',
    'CANDIDATE': 'CANDIDATE',
  }
  return map[oldRole] || (oldRole as Role)
}
