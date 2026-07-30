// AfriVote SUG v2 — Role-Based Access Control matrix.
// Roles map to ElectionOfficial.role values.

export type Role =
  | 'SUPER_ADMIN'
  | 'ELECTORAL_COMMITTEE'
  | 'FACULTY_OFFICER'
  | 'DEPARTMENT_OFFICER'
  | 'OBSERVER'

export interface PermissionContext {
  role: Role
  scopeFacultyId?: string | null
  scopeDepartmentId?: string | null
}

// Capabilities — checked server-side on every privileged endpoint.
export type Capability =
  | 'election.manage'
  | 'official.manage'
  | 'candidate.screen'
  | 'voter.manage'
  | 'analytics.view'
  | 'voter.search'
  | 'ticket.triage'
  | 'audit.view'
  | 'security.view'
  | 'results.certify'
  | 'results.export'
  | 'notification.broadcast'

const MATRIX: Record<Role, Capability[]> = {
  SUPER_ADMIN: [
    'election.manage', 'official.manage', 'candidate.screen', 'voter.manage',
    'analytics.view', 'voter.search', 'ticket.triage', 'audit.view',
    'security.view', 'results.certify', 'results.export', 'notification.broadcast',
  ],
  ELECTORAL_COMMITTEE: [
    'election.manage', 'candidate.screen', 'voter.manage', 'analytics.view',
    'voter.search', 'ticket.triage', 'audit.view', 'security.view',
    'results.certify', 'results.export', 'notification.broadcast',
  ],
  FACULTY_OFFICER: [
    'candidate.screen', 'voter.manage', 'analytics.view', 'voter.search',
    'ticket.triage', 'results.export',
  ],
  DEPARTMENT_OFFICER: [
    'candidate.screen', 'voter.manage', 'analytics.view', 'voter.search',
    'ticket.triage', 'results.export',
  ],
  OBSERVER: [
    'analytics.view', 'voter.search', 'ticket.triage', 'results.export',
  ],
}

export function can(ctx: PermissionContext, cap: Capability): boolean {
  return MATRIX[ctx.role]?.includes(cap) ?? false
}

export function requires2FA(role: Role): boolean {
  return role !== 'OBSERVER' // all officials except observers must use 2FA
}

// Scope check: a faculty officer can only act on their faculty; department
// officer on their department. Returns true if the actor's scope covers the
// target faculty/department.
export function scopeCovers(ctx: PermissionContext, target?: { facultyId?: string | null; departmentId?: string | null }): boolean {
  if (ctx.role === 'SUPER_ADMIN' || ctx.role === 'ELECTORAL_COMMITTEE' || ctx.role === 'OBSERVER') return true
  if (ctx.role === 'FACULTY_OFFICER') {
    if (!ctx.scopeFacultyId) return false
    return target?.facultyId === ctx.scopeFacultyId
  }
  if (ctx.role === 'DEPARTMENT_OFFICER') {
    if (!ctx.scopeDepartmentId) return false
    return target?.departmentId === ctx.scopeDepartmentId
  }
  return false
}
