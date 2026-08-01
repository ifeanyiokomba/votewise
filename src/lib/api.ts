// VoteWise SUG v2 — Client-side API helpers.
// Officials authenticate via HttpOnly cookies (set by /api/auth/login) → no
// token management needed; `credentials: 'include'` carries the cookies.
// Voters still use a header token (x-voter-token) for their session.

const VOTER_TOKEN_KEY = 'votewise_voter_token'

export function getVoterToken() { return typeof window === 'undefined' ? null : localStorage.getItem(VOTER_TOKEN_KEY) }
export function setVoterToken(t: string | null) {
  if (typeof window === 'undefined') return
  if (t) localStorage.setItem(VOTER_TOKEN_KEY, t); else localStorage.removeItem(VOTER_TOKEN_KEY)
}

async function req<T = any>(path: string, opts: RequestInit = {}, voterToken?: string | null): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json', ...(opts.headers as Record<string, string> || {}) }
  if (voterToken) headers['x-voter-token'] = voterToken
  // Officials: cookies are sent automatically with credentials:'include'.
  const res = await fetch(path, { ...opts, headers, credentials: 'include' })
  const text = await res.text()
  let data: any = null
  try { data = text ? JSON.parse(text) : null } catch { data = { raw: text } }
  if (!res.ok) {
    const msg = data?.error || `Request failed (${res.status})`
    const err: any = new Error(msg)
    err.status = res.status
    err.data = data
    throw err
  }
  return data as T
}

export const api = {
  // Public
  getElection: () => req('/api/election'),
  // Tenant (multi-organization) — LEGACY (Chapter 1 retention)
  registerTenant: (data: any) => req('/api/tenant/register', { method: 'POST', body: JSON.stringify(data) }),
  getCurrentTenant: () => req('/api/tenant/current'),
  listTenants: () => req('/api/tenant/list'),

  // Organizations (Chapter 1 — generic hierarchy)
  listOrganizations: () => req('/api/organizations'),
  getOrganization: (slug: string) => req(`/api/organizations/${slug}`),
  registerOrganization: (data: any) => req('/api/organizations/register', { method: 'POST', body: JSON.stringify(data) }),
  checkSubdomain: (sub: string) => req(`/api/organizations/check-subdomain?sub=${encodeURIComponent(sub)}`),

  // Workspace (Chapter 2 — org-scoped, resolved from subdomain/custom domain)
  workspaceDashboard: (subdomain?: string) => req(`/api/workspace/dashboard${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  workspaceSettings: (subdomain?: string) => req(`/api/workspace/settings${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  workspaceUpdateSettings: (data: any, subdomain?: string) => req(`/api/workspace/settings${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'PATCH', body: JSON.stringify(data) }),
  workspaceDomains: (subdomain?: string) => req(`/api/workspace/domain${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  workspaceConnectDomain: (domain: string, isPrimary = true, subdomain?: string) => req(`/api/workspace/domain${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'POST', body: JSON.stringify({ domain, isPrimary }) }),
  workspaceDisconnectDomain: (domain: string, subdomain?: string) => req(`/api/workspace/domain${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'DELETE', body: JSON.stringify({ domain }) }),

  // Chapter 3: dynamic voter fields + import jobs
  workspaceVoterFields: (subdomain?: string) => req(`/api/workspace/voter-fields${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  workspaceCreateVoterField: (data: any, subdomain?: string) => req(`/api/workspace/voter-fields${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'POST', body: JSON.stringify(data) }),
  workspaceUpdateVoterField: (id: string, data: any, subdomain?: string) => req(`/api/workspace/voter-fields${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'PATCH', body: JSON.stringify({ id, ...data }) }),
  workspaceDeleteVoterField: (id: string, subdomain?: string) => req(`/api/workspace/voter-fields${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'DELETE', body: JSON.stringify({ id }) }),
  workspaceImports: (subdomain?: string) => req(`/api/workspace/imports${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  workspaceCreateImport: (data: any, subdomain?: string) => req(`/api/workspace/imports${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'POST', body: JSON.stringify(data) }),
  workspaceImportStatus: (id: string, subdomain?: string) => req(`/api/workspace/imports/${id}${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),

  // Chapter 4: IAM — invitations
  workspaceInvitations: (subdomain?: string) => req(`/api/workspace/invitations${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  workspaceInviteUser: (data: any, subdomain?: string) => req(`/api/workspace/invitations${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'POST', body: JSON.stringify(data) }),
  workspaceRevokeInvitation: (id: string, subdomain?: string) => req(`/api/workspace/invitations${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'DELETE', body: JSON.stringify({ id }) }),
  acceptInvitation: (token: string, password: string) => req('/api/workspace/invitations/accept', { method: 'POST', body: JSON.stringify({ token, password }) }),

  // Organization Units (hierarchical election divisions)
  commandCenter: (subdomain?: string) => req(`/api/workspace/command-center${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  workspaceUnits: (subdomain?: string) => req(`/api/workspace/units${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  workspaceCreateUnit: (data: any, subdomain?: string) => req(`/api/workspace/units${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'POST', body: JSON.stringify(data) }),
  workspaceUnitObservers: (unitId: string, subdomain?: string) => req(`/api/workspace/units/${unitId}/observers${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  workspaceAssignObserver: (unitId: string, data: any, subdomain?: string) => req(`/api/workspace/units/${unitId}/observers${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'POST', body: JSON.stringify(data) }),
  workspaceRevokeObserver: (unitId: string, memberEmail: string, subdomain?: string) => req(`/api/workspace/units/${unitId}/observers${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'DELETE', body: JSON.stringify({ memberEmail }) }),

  // Chapter 7: Election Management System
  electionCenter: (subdomain?: string) => req(`/api/workspace/elections${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  createElection: (data: any, subdomain?: string) => req(`/api/workspace/elections${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'POST', body: JSON.stringify(data) }),
  getElection: (id: string, subdomain?: string) => req(`/api/workspace/elections/${id}${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  updateElection: (id: string, data: any, subdomain?: string) => req(`/api/workspace/elections/${id}${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'PATCH', body: JSON.stringify(data) }),
  duplicateElection: (id: string, subdomain?: string) => req(`/api/workspace/elections/${id}/duplicate${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'POST' }),
  validateElection: (id: string, subdomain?: string) => req(`/api/workspace/elections/${id}/validate${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  electionTimeline: (id: string, subdomain?: string) => req(`/api/workspace/elections/${id}/timeline${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),

  // Chapter 8: Voter Management
  voterRegistry: (params: string, subdomain?: string) => req(`/api/workspace/voters${params ? '?' + params : ''}${subdomain ? `${params ? '&' : '?'}x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  addVoter: (data: any, subdomain?: string) => req(`/api/workspace/voters${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'POST', body: JSON.stringify(data) }),
  bulkVoterAction: (action: string, voterIds: string[], subdomain?: string) => req(`/api/workspace/voters${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'PATCH', body: JSON.stringify({ action, voterIds }) }),
  getVoterProfile: (id: string, subdomain?: string) => req(`/api/workspace/voters/${id}${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  voterGroups: (subdomain?: string) => req(`/api/workspace/voter-groups${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  createVoterGroup: (data: any, subdomain?: string) => req(`/api/workspace/voter-groups${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'POST', body: JSON.stringify(data) }),
  accreditationDashboard: (electionId: string | null, subdomain?: string) => req(`/api/workspace/accreditation${electionId ? `?electionId=${electionId}` : ''}${subdomain ? `${electionId ? '&' : '?'}x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  createAccreditationRule: (data: any, subdomain?: string) => req(`/api/workspace/accreditation${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'POST', body: JSON.stringify(data) }),

  // Chapter 9: Rules Engine
  ruleSets: (electionId: string | null, subdomain?: string) => req(`/api/workspace/rules${electionId ? `?electionId=${electionId}` : ''}${subdomain ? `${electionId ? '&' : '?'}x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  createRuleSet: (data: any, subdomain?: string) => req(`/api/workspace/rules${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'POST', body: JSON.stringify(data) }),
  testRules: (ruleSetId: string, sampleVoter: any, subdomain?: string) => req(`/api/workspace/rules/test${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'POST', body: JSON.stringify({ ruleSetId, sampleVoter }) }),
  policies: (subdomain?: string) => req(`/api/workspace/policies${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  savePolicy: (data: any, subdomain?: string) => req(`/api/workspace/policies${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'POST', body: JSON.stringify(data) }),

  // Platform (super-admin)
  platformGetOrganizations: () => req('/api/platform/organizations'),
  platformUpdateOrganization: (id: string, status: string) => req('/api/platform/organizations', { method: 'PATCH', body: JSON.stringify({ id, status }) }),
  platformGetOrganizationDetail: (id: string) => req(`/api/platform/organizations/${id}`),
  getPositions: () => req('/api/positions'),
  getResults: () => req('/api/results'),
  getCandidates: () => req('/api/candidates'),
  getFaculties: () => req('/api/faculties'),
  getTurnout: () => req('/api/turnout'),
  getVoteFeed: () => req('/api/vote-feed'),

  // Voter
  verifyMatric: (matric: string) => req('/api/voter/verify-matric', { method: 'POST', body: JSON.stringify({ matric }) }),
  sendOtp: (matric: string, channel: string) => req('/api/voter/send-otp', { method: 'POST', body: JSON.stringify({ matric, channel }) }),
  verifyOtp: (matric: string, otp: string) => req('/api/voter/verify-otp', { method: 'POST', body: JSON.stringify({ matric, otp }) }),
  getVoterSession: () => req('/api/voter/session', {}, getVoterToken()),
  voterLogout: () => req('/api/voter/session', { method: 'POST' }, getVoterToken()),
  accredit: () => req('/api/voter/accredit', { method: 'POST' }, getVoterToken()),
  getBallot: () => req('/api/voter/ballot', {}, getVoterToken()),
  castVote: (selections: Record<string, string>) =>
    req('/api/vote/cast', { method: 'POST', body: JSON.stringify({ selections }) }, getVoterToken()),
  verifyReceipt: (receiptCode: string) => req('/api/vote/verify-receipt', { method: 'POST', body: JSON.stringify({ receiptCode }) }),
  getNotifications: () => req('/api/voter/notifications', {}, getVoterToken()),
  markNotificationsRead: () => req('/api/voter/notifications', { method: 'POST' }, getVoterToken()),

  // Support + chat
  submitTicket: (payload: any) => req('/api/support/ticket', { method: 'POST', body: JSON.stringify(payload) }),
  chat: (message: string, history: any[]) => req('/api/chat', { method: 'POST', body: JSON.stringify({ message, history }) }),
  chatSend: (payload: any) => req('/api/chat/send', { method: 'POST', body: JSON.stringify(payload) }, getVoterToken()),
  chatHistory: () => req('/api/chat/history', {}, getVoterToken()),
  chatConversations: () => req('/api/chat/conversations'),
  chatReply: (threadId: string, message: string) => req('/api/chat/conversations', { method: 'POST', body: JSON.stringify({ threadId, message }) }),

  // Auth (officials — cookie-based)
  login: (email: string, password: string, totp?: string) =>
    req('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password, totp }) }),
  me: () => req('/api/auth/me'),
  logout: () => req('/api/auth/logout', { method: 'POST' }),
  refresh: () => req('/api/auth/refresh', { method: 'POST' }),
  setup2fa: () => req('/api/auth/2fa/setup', { method: 'POST' }),
  verify2fa: (code: string) => req('/api/auth/2fa/verify', { method: 'POST', body: JSON.stringify({ code }) }),
  disable2fa: () => req('/api/auth/2fa/disable', { method: 'POST' }),
  requestPasswordReset: (email: string) => req('/api/auth/password-reset/request', { method: 'POST', body: JSON.stringify({ email }) }),
  confirmPasswordReset: (token: string, password: string) => req('/api/auth/password-reset/confirm', { method: 'POST', body: JSON.stringify({ token, password }) }),

  // Admin (officials — cookie-based, RBAC enforced server-side)
  adminGetCandidates: () => req('/api/admin/candidates'),
  adminCreateCandidate: (data: any) => req('/api/admin/candidates', { method: 'POST', body: JSON.stringify(data) }),
  adminUpdateCandidate: (id: string, data: any) => req(`/api/admin/candidates/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  adminDeleteCandidate: (id: string) => req(`/api/admin/candidates/${id}`, { method: 'DELETE' }),
  adminGetPositions: () => req('/api/admin/positions'),
  adminCreatePosition: (data: any) => req('/api/admin/positions', { method: 'POST', body: JSON.stringify(data) }),
  adminGetVoters: (params: string) => req(`/api/admin/voters?${params}`),
  adminCreateVoter: (data: any) => req('/api/admin/voters', { method: 'POST', body: JSON.stringify(data) }),
  adminGetVoter: (id: string) => req(`/api/admin/voters/${id}`),
  adminFlagVoter: (id: string, flagged: boolean, reason?: string) => req(`/api/admin/voters/${id}/flag`, { method: 'POST', body: JSON.stringify({ flagged, reason }) }),
  adminResendOtp: (id: string, channel?: string) => req(`/api/admin/voters/${id}/resend-otp`, { method: 'POST', body: JSON.stringify({ channel }) }),
  adminGetActivity: (params = '') => req(`/api/admin/activity${params ? '?' + params : ''}`),
  adminGetCollations: (status?: string) => req(`/api/admin/collation${status ? `?status=${status}` : ''}`),
  adminSubmitCollation: (data: any) => req('/api/admin/collation', { method: 'POST', body: JSON.stringify(data) }),
  adminUpdateCollation: (id: string, action: string, notes?: string) => req('/api/admin/collation', { method: 'PATCH', body: JSON.stringify({ id, action, notes }) }),
  adminImportVoters: (voters: any[]) => req('/api/admin/voters/import', { method: 'POST', body: JSON.stringify({ voters }) }),
  adminGetSettings: () => req('/api/admin/settings'),
  adminUpdateSettings: (data: any) => req('/api/admin/settings', { method: 'PUT', body: JSON.stringify(data) }),
  adminGetAuditLogs: (page = 1) => req(`/api/admin/audit-logs?page=${page}`),
  adminVerifyAudit: () => req('/api/admin/audit-verify'),
  adminGetSecurityEvents: (params = '') => req(`/api/admin/security-events${params ? '?' + params : ''}`),
  adminResolveSecurityEvent: (id: string, resolved: boolean) => req('/api/admin/security-events', { method: 'PATCH', body: JSON.stringify({ id, resolved }) }),
  adminGetHealth: () => req('/api/admin/health'),
  adminElectionAction: (action: string) => req(`/api/admin/election/${action}`, { method: 'POST' }),
  adminUpdateElection: (data: any) => req('/api/election', { method: 'PUT', body: JSON.stringify(data) }),
  adminGetOfficials: () => req('/api/admin/observers'),
  adminCreateOfficial: (data: any) => req('/api/admin/observers', { method: 'POST', body: JSON.stringify(data) }),
  adminBroadcastNotification: (data: any) => req('/api/admin/notifications', { method: 'POST', body: JSON.stringify(data) }),

  // Observer (same cookie auth; endpoints enforce OBSERVER-or-higher RBAC)
  observerAnalytics: () => req('/api/observer/analytics'),
  observerSearchVoters: (q: string) => req(`/api/observer/voters?q=${encodeURIComponent(q)}`),
  observerGetTickets: (status?: string) => req(`/api/observer/tickets${status ? `?status=${status}` : ''}`),
  observerUpdateTicket: (id: string, data: any) => req(`/api/observer/tickets/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Results export (officials)
  exportResults: (format: 'csv' | 'json') => `/api/results/export?format=${format}`,

  // Public certificate
  getCertificate: () => req('/api/results/certificate'),
}
