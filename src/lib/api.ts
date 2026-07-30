// Client-side API helpers. All requests use relative paths (gateway-friendly).
// Auth tokens are stored in localStorage and attached via headers.

const VOTER_TOKEN_KEY = 'afrivote_voter_token'
const ADMIN_TOKEN_KEY = 'afrivote_admin_token'
const OBSERVER_TOKEN_KEY = 'afrivote_observer_token'

export function getVoterToken() { return typeof window === 'undefined' ? null : localStorage.getItem(VOTER_TOKEN_KEY) }
export function setVoterToken(t: string | null) {
  if (typeof window === 'undefined') return
  if (t) localStorage.setItem(VOTER_TOKEN_KEY, t); else localStorage.removeItem(VOTER_TOKEN_KEY)
}
export function getAdminToken() { return typeof window === 'undefined' ? null : localStorage.getItem(ADMIN_TOKEN_KEY) }
export function setAdminToken(t: string | null) {
  if (typeof window === 'undefined') return
  if (t) localStorage.setItem(ADMIN_TOKEN_KEY, t); else localStorage.removeItem(ADMIN_TOKEN_KEY)
}
export function getObserverToken() { return typeof window === 'undefined' ? null : localStorage.getItem(OBSERVER_TOKEN_KEY) }
export function setObserverToken(t: string | null) {
  if (typeof window === 'undefined') return
  if (t) localStorage.setItem(OBSERVER_TOKEN_KEY, t); else localStorage.removeItem(OBSERVER_TOKEN_KEY)
}

async function req<T = any>(path: string, opts: RequestInit = {}, token?: string | null): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json', ...(opts.headers as Record<string, string> || {}) }
  if (token) headers['x-session-token'] = token
  const res = await fetch(path, { ...opts, headers })
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
  getBallot: () => req('/api/voter/ballot', {}, getVoterToken()),
  castVote: (selections: Record<string, string>) =>
    req('/api/vote/cast', { method: 'POST', body: JSON.stringify({ selections }) }, getVoterToken()),
  verifyReceipt: (receiptCode: string) => req('/api/vote/verify-receipt', { method: 'POST', body: JSON.stringify({ receiptCode }) }),

  // Support
  submitTicket: (payload: any) => req('/api/support/ticket', { method: 'POST', body: JSON.stringify(payload) }),
  chat: (message: string, history: any[]) => req('/api/chat', { method: 'POST', body: JSON.stringify({ message, history }) }),

  // Admin
  adminLogin: (email: string, password: string) => req('/api/admin/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  adminSession: () => req('/api/admin/session', {}, getAdminToken()),
  adminGetCandidates: () => req('/api/admin/candidates', {}, getAdminToken()),
  adminCreateCandidate: (data: any) => req('/api/admin/candidates', { method: 'POST', body: JSON.stringify(data) }, getAdminToken()),
  adminUpdateCandidate: (id: string, data: any) => req(`/api/admin/candidates/${id}`, { method: 'PATCH', body: JSON.stringify(data) }, getAdminToken()),
  adminDeleteCandidate: (id: string) => req(`/api/admin/candidates/${id}`, { method: 'DELETE' }, getAdminToken()),
  adminGetPositions: () => req('/api/admin/positions', {}, getAdminToken()),
  adminCreatePosition: (data: any) => req('/api/admin/positions', { method: 'POST', body: JSON.stringify(data) }, getAdminToken()),
  adminGetVoters: (params: string) => req(`/api/admin/voters?${params}`, {}, getAdminToken()),
  adminCreateVoter: (data: any) => req('/api/admin/voters', { method: 'POST', body: JSON.stringify(data) }, getAdminToken()),
  adminImportVoters: (voters: any[]) => req('/api/admin/voters/import', { method: 'POST', body: JSON.stringify({ voters }) }, getAdminToken()),
  adminGetSettings: () => req('/api/admin/settings', {}, getAdminToken()),
  adminUpdateSettings: (data: any) => req('/api/admin/settings', { method: 'PUT', body: JSON.stringify(data) }, getAdminToken()),
  adminGetAuditLogs: (page = 1) => req(`/api/admin/audit-logs?page=${page}`, {}, getAdminToken()),
  adminElectionAction: (action: string) => req(`/api/admin/election/${action}`, { method: 'POST' }, getAdminToken()),
  adminUpdateElection: (data: any) => req('/api/election', { method: 'PUT', body: JSON.stringify(data) }, getAdminToken()),
  adminGetObservers: () => req('/api/admin/observers', {}, getAdminToken()),
  adminCreateObserver: (data: any) => req('/api/admin/observers', { method: 'POST', body: JSON.stringify(data) }, getAdminToken()),

  // Observer
  observerLogin: (email: string, password: string) => req('/api/observer/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  observerSession: () => req('/api/observer/session', {}, getObserverToken()),
  observerAnalytics: () => req('/api/observer/analytics', {}, getObserverToken()),
  observerSearchVoters: (q: string) => req(`/api/observer/voters?q=${encodeURIComponent(q)}`, {}, getObserverToken()),
  observerGetTickets: (status?: string) => req(`/api/observer/tickets${status ? `?status=${status}` : ''}`, {}, getObserverToken()),
  observerUpdateTicket: (id: string, data: any) => req(`/api/observer/tickets/${id}`, { method: 'PATCH', body: JSON.stringify(data) }, getObserverToken()),
}
