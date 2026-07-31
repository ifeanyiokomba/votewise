// VoteWise — Role-Based Access Control matrix.
// Six user roles as defined in the product vision.

export type Role =
  | 'PLATFORM_SUPER_ADMIN'  // Owns VoteWise. Manages all organizations.
  | 'ORG_OWNER'             // Registered the organization. Full control.
  | 'ORG_ADMIN'             // Manages elections. Cannot transfer ownership.
  | 'OBSERVER'              // Monitors elections. Cannot modify.
  | 'VOTER'                 // Votes. Nothing more.
  | 'GUEST'                 // Not logged in. Browses only.

// Legacy role mapping for backwards compatibility:
// SUPER_ADMIN → PLATFORM_SUPER_ADMIN
// ELECTORAL_COMMITTEE → ORG_OWNER (or ORG_ADMIN)
// FACULTY_OFFICER → ORG_ADMIN
// DEPARTMENT_OFFICER → ORG_ADMIN
// OBSERVER → OBSERVER

export interface PermissionContext {
  role: Role
  scopeFacultyId?: string | null  // Kept for backwards compat, will be removed
  scopeDepartmentId?: string | null
}

// Capabilities — checked server-side on every privileged endpoint.
export type Capability =
  | 'election.manage'      // Create, configure, open, close, certify elections
  | 'official.manage'      // Invite/manage admins and observers
  | 'candidate.screen'     // Approve/reject candidates
  | 'voter.manage'         // Import, add, flag, manage voters
  | 'analytics.view'       // View turnout, results, activity
  | 'voter.search'         // Search the voter register
  | 'ticket.triage'        // Handle support tickets
  | 'audit.view'           // View audit logs
  | 'security.view'        // View security events
  | 'results.certify'      // Certify election results
  | 'results.export'       // Export results (CSV, JSON, PDF)
  | 'notification.broadcast' // Send notifications to voters
  | 'billing.manage'       // Manage payments and subscriptions
  | 'domain.manage'        // Connect/disconnect custom domains
  | 'theme.manage'         // Change organization branding/theme
  | 'platform.manage'      // Platform-level: manage ALL organizations (super admin only)

const MATRIX: Record<Role, Capability[]> = {
  PLATFORM_SUPER_ADMIN: [
    'platform.manage', 'election.manage', 'official.manage', 'candidate.screen',
    'voter.manage', 'analytics.view', 'voter.search', 'ticket.triage',
    'audit.view', 'security.view', 'results.certify', 'results.export',
    'notification.broadcast', 'billing.manage',
  ],
  ORG_OWNER: [
    'election.manage', 'official.manage', 'candidate.screen', 'voter.manage',
    'analytics.view', 'voter.search', 'ticket.triage', 'audit.view',
    'security.view', 'results.certify', 'results.export', 'notification.broadcast',
    'billing.manage', 'domain.manage', 'theme.manage',
  ],
  ORG_ADMIN: [
    'election.manage', 'candidate.screen', 'voter.manage', 'analytics.view',
    'voter.search', 'ticket.triage', 'results.export', 'notification.broadcast',
    'domain.manage', 'theme.manage',
  ],
  OBSERVER: [
    'analytics.view', 'voter.search', 'ticket.triage', 'results.export',
  ],
  VOTER: [],
  GUEST: [],
}

export function can(ctx: PermissionContext, cap: Capability): boolean {
  return MATRIX[ctx.role]?.includes(cap) ?? false
}

export function requires2FA(role: Role): boolean {
  // Platform super admins and org owners must use 2FA
  return role === 'PLATFORM_SUPER_ADMIN' || role === 'ORG_OWNER'
}

// Scope check: org admins can only act within their organization.
// In the new architecture, all data is tenant-scoped, so this is enforced
// at the database query level (WHERE tenantId = ?).
export function scopeCovers(ctx: PermissionContext, target?: { facultyId?: string | null; departmentId?: string | null }): boolean {
  // Platform super admin can access everything
  if (ctx.role === 'PLATFORM_SUPER_ADMIN') return true
  // Org owners and admins are scoped to their tenant (enforced at query level)
  if (ctx.role === 'ORG_OWNER' || ctx.role === 'ORG_ADMIN') return true
  // Observers can view public analytics
  if (ctx.role === 'OBSERVER') return true
  return false
}

// Legacy compatibility: map old role names to new ones
export function normalizeRole(oldRole: string): Role {
  const map: Record<string, Role> = {
    'SUPER_ADMIN': 'PLATFORM_SUPER_ADMIN',
    'ELECTORAL_COMMITTEE': 'ORG_OWNER',
    'FACULTY_OFFICER': 'ORG_ADMIN',
    'DEPARTMENT_OFFICER': 'ORG_ADMIN',
    'OBSERVER': 'OBSERVER',
  }
  return map[oldRole] || (oldRole as Role)
}
