// AfriVote SUG v2 — Client-side API helpers.
// Officials authenticate via HttpOnly cookies (set by /api/auth/login) → no
// token management needed; `credentials: 'include'` carries the cookies.
// Voters still use a header token (x-voter-token) for their session.

const VOTER_TOKEN_KEY = 'afrivote_voter_token'

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
  getPositions: () => req('/api/positions'),
  getResults: () => req('/api/results'),
  getCandidates: () => req('/api/candidates'),
  getFaculties: () => req('/api/faculties'),

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

  // Support + chat
  submitTicket: (payload: any) => req('/api/support/ticket', { method: 'POST', body: JSON.stringify(payload) }),
  chat: (message: string, history: any[]) => req('/api/chat', { method: 'POST', body: JSON.stringify({ message, history }) }),

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
  adminImportVoters: (voters: any[]) => req('/api/admin/voters/import', { method: 'POST', body: JSON.stringify({ voters }) }),
  adminGetSettings: () => req('/api/admin/settings'),
  adminUpdateSettings: (data: any) => req('/api/admin/settings', { method: 'PUT', body: JSON.stringify(data) }),
  adminGetAuditLogs: (page = 1) => req(`/api/admin/audit-logs?page=${page}`),
  adminVerifyAudit: () => req('/api/admin/audit-verify'),
  adminGetSecurityEvents: (params = '') => req(`/api/admin/security-events${params ? '?' + params : ''}`),
  adminResolveSecurityEvent: (id: string, resolved: boolean) => req('/api/admin/security-events', { method: 'PATCH', body: JSON.stringify({ id, resolved }) }),
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
}
