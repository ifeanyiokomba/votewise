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
    // Provide user-friendly messages for auth/permission errors
    const friendlyMsg = res.status === 401
      ? 'Please sign in to continue.'
      : res.status === 403
      ? 'You do not have permission to perform this action. Please sign in as an admin.'
      : msg
    const err: any = new Error(friendlyMsg)
    err.status = res.status
    err.data = data
    err.originalMessage = msg
    throw err
  }
  return data as T
}

export const api = {
  // Public
  getLegacyElection: () => req('/api/election'),
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

  // CSV template download URL — opens in the browser as an attachment.
  // Returns the URL (the caller can use <a href={url} download> or window.open).
  downloadVoterTemplate: (subdomain?: string) =>
    `${typeof window !== 'undefined' ? window.location.origin : ''}/api/workspace/voters/import-template${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`,

  // Chapter 4: IAM — invitations
  workspaceInvitations: (subdomain?: string) => req(`/api/workspace/invitations${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  workspaceInviteUser: (data: any, subdomain?: string) => req(`/api/workspace/invitations${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'POST', body: JSON.stringify(data) }),
  workspaceRevokeInvitation: (id: string, subdomain?: string) => req(`/api/workspace/invitations${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'DELETE', body: JSON.stringify({ id }) }),
  acceptInvitation: (token: string, password: string) => req('/api/workspace/invitations/accept', { method: 'POST', body: JSON.stringify({ token, password }) }),

  // Organization Units (hierarchical election divisions)
  commandCenter: (subdomain?: string) => req(`/api/workspace/command-center${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  // Organization-wide Election Analytics Dashboard (cross-election metrics).
  getAnalytics: (subdomain?: string) => req(`/api/workspace/analytics${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  // Side-by-side comparison of 2–5 elections (metrics, turnout, results, integrity).
  compareElections: (electionIds: string[], subdomain?: string) => req(`/api/workspace/elections/compare${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'POST', body: JSON.stringify({ electionIds }) }),
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
  duplicateElection: (
    id: string,
    options?: { name?: string; startTime?: string; endTime?: string; shiftDays?: number },
    subdomain?: string,
  ) => req(`/api/workspace/elections/${id}/duplicate${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, {
    method: 'POST',
    body: JSON.stringify(options || {}),
  }),
  validateElection: (id: string, subdomain?: string) => req(`/api/workspace/elections/${id}/validate${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  electionTimeline: (id: string, subdomain?: string) => req(`/api/workspace/elections/${id}/timeline${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  getElectionAudit: (electionId: string, subdomain?: string) => req(`/api/workspace/elections/${electionId}/audit${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  // Election Templates — list/save/get/delete/apply (built-in + org-created)
  getElectionTemplates: (subdomain?: string) => req(`/api/workspace/election-templates${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  saveElectionTemplate: (data: any, subdomain?: string) => req(`/api/workspace/election-templates${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'POST', body: JSON.stringify(data) }),
  getElectionTemplate: (templateId: string, subdomain?: string) => req(`/api/workspace/election-templates/${templateId}${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  deleteElectionTemplate: (templateId: string, subdomain?: string) => req(`/api/workspace/election-templates/${templateId}${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'DELETE' }),
  applyElectionTemplate: (templateId: string, data: any, subdomain?: string) => req(`/api/workspace/election-templates/${templateId}/apply${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'POST', body: JSON.stringify(data) }),
  // Positions — within an election workspace
  getElectionPositions: (electionId: string, subdomain?: string) => req(`/api/workspace/elections/${electionId}/positions${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  addElectionPosition: (electionId: string, data: any, subdomain?: string) => req(`/api/workspace/elections/${electionId}/positions${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'POST', body: JSON.stringify(data) }),
  updateElectionPosition: (electionId: string, positionId: string, data: any, subdomain?: string) => req(`/api/workspace/elections/${electionId}/positions/${positionId}${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteElectionPosition: (electionId: string, positionId: string, subdomain?: string) => req(`/api/workspace/elections/${electionId}/positions/${positionId}${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'DELETE' }),
  reorderElectionPositions: (electionId: string, positionIds: string[], subdomain?: string) => req(`/api/workspace/elections/${electionId}/positions/reorder${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'POST', body: JSON.stringify({ positionIds }) }),
  // Chapter 11: Settings + Support tabs (Election Workspace)
  getElectionSettings: (electionId: string, subdomain?: string) => req(`/api/workspace/elections/${electionId}/settings${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  updateElectionSettings: (electionId: string, data: any, subdomain?: string) => req(`/api/workspace/elections/${electionId}/settings${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'PATCH', body: JSON.stringify(data) }),
  getElectionSupport: (electionId: string, subdomain?: string) => req(`/api/workspace/elections/${electionId}/support${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  createElectionSupport: (electionId: string, data: any, subdomain?: string) => req(`/api/workspace/elections/${electionId}/support${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'POST', body: JSON.stringify(data) }),
  updateElectionSupport: (electionId: string, ticketId: string, data: any, subdomain?: string) => req(`/api/workspace/elections/${electionId}/support/${ticketId}${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Election Notifications — broadcast / direct-send + templates + stats
  getElectionNotifications: (electionId: string, params: string, subdomain?: string) => req(`/api/workspace/elections/${electionId}/notifications${params ? '?' + params : ''}${subdomain ? `${params ? '&' : '?'}x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  sendElectionNotification: (electionId: string, data: any, subdomain?: string) => req(`/api/workspace/elections/${electionId}/notifications${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'POST', body: JSON.stringify(data) }),
  getNotificationTemplates: (electionId: string, subdomain?: string) => req(`/api/workspace/elections/${electionId}/notifications/templates${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),

  // Election Scheduled Notifications — auto-send when voting opens/closes/results published
  getScheduledNotifications: (electionId: string, subdomain?: string) => req(`/api/workspace/elections/${electionId}/notifications/schedule${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  scheduleNotification: (electionId: string, data: any, subdomain?: string) => req(`/api/workspace/elections/${electionId}/notifications/schedule${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'POST', body: JSON.stringify(data) }),
  updateScheduledNotification: (electionId: string, scheduleId: string, data: any, subdomain?: string) => req(`/api/workspace/elections/${electionId}/notifications/schedule/${scheduleId}${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'PATCH', body: JSON.stringify(data) }),
  cancelScheduledNotification: (electionId: string, scheduleId: string, subdomain?: string) => req(`/api/workspace/elections/${electionId}/notifications/schedule/${scheduleId}${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'DELETE' }),
  processScheduledNotifications: (electionId: string, subdomain?: string) => req(`/api/workspace/elections/${electionId}/notifications/schedule/process${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'POST' }),

  // Notification Delivery Tracking — per-recipient delivery status
  getNotificationDeliveries: (electionId: string, notificationId: string, subdomain?: string) => req(`/api/workspace/elections/${electionId}/notifications/${notificationId}/deliveries${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  getNotificationDeliveryStats: (electionId: string, subdomain?: string) => req(`/api/workspace/elections/${electionId}/notifications/delivery-stats${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),

  // Observer Incident Dashboard — real-time incident reporting + monitoring
  getElectionIncidents: (electionId: string, params: string, subdomain?: string) => req(`/api/workspace/elections/${electionId}/incidents${params ? '?' + params : ''}${subdomain ? `${params ? '&' : '?'}x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  reportElectionIncident: (electionId: string, data: any, subdomain?: string) => req(`/api/workspace/elections/${electionId}/incidents${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'POST', body: JSON.stringify(data) }),
  updateElectionIncident: (electionId: string, incidentId: string, data: any, subdomain?: string) => req(`/api/workspace/elections/${electionId}/incidents/${incidentId}${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'PATCH', body: JSON.stringify(data) }),
  getElectionIncidentStats: (electionId: string, subdomain?: string) => req(`/api/workspace/elections/${electionId}/incidents/stats${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),

  // Candidates — within an election workspace
  getElectionCandidates: (electionId: string, subdomain?: string) => req(`/api/workspace/elections/${electionId}/candidates${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  addElectionCandidate: (electionId: string, data: any, subdomain?: string) => req(`/api/workspace/elections/${electionId}/candidates${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'POST', body: JSON.stringify(data) }),
  updateElectionCandidate: (electionId: string, candidateId: string, data: any, subdomain?: string) => req(`/api/workspace/elections/${electionId}/candidates/${candidateId}${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteElectionCandidate: (electionId: string, candidateId: string, subdomain?: string) => req(`/api/workspace/elections/${electionId}/candidates/${candidateId}${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'DELETE' }),
  screenElectionCandidate: (electionId: string, candidateId: string, data: any, subdomain?: string) => req(`/api/workspace/elections/${electionId}/candidates/${candidateId}/screen${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'POST', body: JSON.stringify(data) }),

  // Chapter 7: Election-scoped observers + voters (per-election workspace tabs)
  getElectionObservers: (electionId: string, subdomain?: string) => req(`/api/workspace/elections/${electionId}/observers${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  assignElectionObserver: (electionId: string, data: any, subdomain?: string) => req(`/api/workspace/elections/${electionId}/observers${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'POST', body: JSON.stringify(data) }),
  removeElectionObserver: (electionId: string, observerId: string, subdomain?: string) => req(`/api/workspace/elections/${electionId}/observers?observerId=${observerId}${subdomain ? `&x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'DELETE' }),
  getElectionVoters: (electionId: string, params: string, subdomain?: string) => req(`/api/workspace/elections/${electionId}/voters${params ? '?' + params : ''}${subdomain ? `${params ? '&' : '?'}x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  addElectionVoter: (electionId: string, data: any, subdomain?: string) => req(`/api/workspace/elections/${electionId}/voters${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'POST', body: JSON.stringify(data) }),

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

  // Chapter 10: Secure Voting Engine
  generateBallot: (electionId: string, voterId?: string, isSimulation?: boolean, subdomain?: string, sessionToken?: string) => req(`/api/workspace/ballot${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'POST', body: JSON.stringify({ electionId, voterId, isSimulation, sessionToken }) }),
  submitVote: (ballotId: string, selections: Record<string, string | string[]>, subdomain?: string) => req(`/api/workspace/ballot/submit${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'POST', body: JSON.stringify({ ballotId, selections }) }),
  verifyReceipt: (receiptCode: string, subdomain?: string) => req(`/api/workspace/ballot/receipt${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'POST', body: JSON.stringify({ receiptCode }) }),
  simulateBallot: (electionId: string, action: 'preview' | 'cast' | 'reset' | 'list' = 'preview', selections?: Record<string, string | string[]>, subdomain?: string) => req(`/api/workspace/ballot/simulate${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'POST', body: JSON.stringify({ electionId, action, selections }) }),
  autoSaveSelections: (ballotId: string, selections: Record<string, string | string[]>, subdomain?: string) => req(`/api/workspace/ballot/auto-save${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'POST', body: JSON.stringify({ ballotId, selections }) }),
  getAutoSavedSelections: (ballotId: string, subdomain?: string) => req(`/api/workspace/ballot/auto-save?ballotId=${ballotId}${subdomain ? `&x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  clearAutoSavedSelections: (ballotId: string, subdomain?: string) => req(`/api/workspace/ballot/auto-save?ballotId=${ballotId}${subdomain ? `&x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'DELETE' }),
  startVotingSession: (electionId: string, voterId?: string, subdomain?: string) => req(`/api/workspace/ballot/session/start${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'POST', body: JSON.stringify({ electionId, voterId }) }, getVoterToken()),
  getElectionLive: (electionId: string, subdomain?: string) => req(`/api/workspace/elections/${electionId}/live${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  tallyElection: (electionId: string, tieStrategy?: string, force?: boolean, subdomain?: string) => req(`/api/workspace/elections/${electionId}/tally${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'POST', body: JSON.stringify({ tieStrategy, force }) }),
  getElectionTally: (electionId: string, subdomain?: string) => req(`/api/workspace/elections/${electionId}/tally${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  getElectionVerification: (electionId: string, subdomain?: string) => req(`/api/workspace/elections/${electionId}/verification${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  // Risk-Limiting Audit — statistically sample ballots to verify a certified tally.
  runRiskLimitingAudit: (electionId: string, data: any, subdomain?: string) => req(`/api/workspace/elections/${electionId}/audit-rla${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'POST', body: JSON.stringify(data) }),
  getRiskLimitingAudit: (electionId: string, subdomain?: string) => req(`/api/workspace/elections/${electionId}/audit-rla${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  getDemoVoters: (electionId: string, subdomain?: string) => req(`/api/workspace/ballot/demo-voters?electionId=${electionId}${subdomain ? `&x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  // Chapter 10: Voter Portal SVE data (voting status, receipts, timeline)
  getVoterPortal: (subdomain?: string) => req(`/api/workspace/voter-portal${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, {}, getVoterToken()),
  // Public receipt verification (no org context needed)
  publicVerifyReceipt: (receiptCode: string) => req('/api/receipt/verify', { method: 'POST', body: JSON.stringify({ receiptCode }) }),
  // Chapter 17: PIHED — Production Infrastructure (health, readiness, status)
  pihedHealth: () => fetch('/api/pihed/health').then(r => r.json()),
  pihedReadiness: (subdomain?: string) => req(`/api/pihed/readiness${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  pihedRunReadiness: (data: any) => req('/api/pihed/readiness/run', { method: 'POST', body: JSON.stringify(data) }),
  pihedReadinessRuns: (limit?: number) => req(`/api/pihed/readiness/runs${limit ? `?limit=${limit}` : ''}`),
  pihedStatus: () => fetch('/api/pihed/status').then(r => r.json()),
  pihedMetrics: (series?: string, limit?: number) => req(`/api/pihed/metrics${series ? `?series=${encodeURIComponent(series)}${limit ? `&limit=${limit}` : ''}` : ''}`),
  pihedUptime: (days?: number) => fetch(`/api/pihed/uptime${days ? `?days=${days}` : ''}`).then(r => r.json()),
  pihedUptimeSummary: () => fetch('/api/pihed/uptime?summary=true').then(r => r.json()),
  pihedBackups: () => req('/api/pihed/backups'),
  pihedTriggerBackup: (type?: string) => req('/api/pihed/backups/trigger', { method: 'POST', body: JSON.stringify({ type: type || 'manual' }) }),
  pihedDeployments: () => req('/api/pihed/deployments'),
  pihedPromoteCanary: (id: string) => req(`/api/pihed/deployments/${id}/promote`, { method: 'POST' }),
  pihedRollbackDeployment: (id: string, reason?: string) => req(`/api/pihed/deployments/${id}/rollback`, { method: 'POST', body: JSON.stringify({ reason }) }),
  pihedDomains: (orgId?: string) => req(`/api/pihed/domains${orgId ? `?org=${encodeURIComponent(orgId)}` : ''}`),
  pihedAddDomain: (data: any) => req('/api/pihed/domains', { method: 'POST', body: JSON.stringify(data) }),
  pihedVerifyDomain: (id: string) => req(`/api/pihed/domains/${id}/verify`, { method: 'POST' }),
  pihedRemoveDomain: (id: string) => req(`/api/pihed/domains/${id}`, { method: 'DELETE' }),
  // Chapter 17 ext: Centralized Logging, Alerting, Cost Monitoring, Load Testing
  pihedLogs: (params?: string) => req(`/api/pihed/logs${params ? '?' + params : ''}`),
  pihedAlerts: (unack?: boolean) => req(`/api/pihed/alerts${unack ? '?unacknowledged=true' : ''}`),
  pihedAckAlert: (id: string) => req(`/api/pihed/alerts/${id}/acknowledge`, { method: 'POST' }),
  pihedToggleAlertRule: (id: string, enabled: boolean) => req(`/api/pihed/alerts/rules/${id}/toggle`, { method: 'PATCH', body: JSON.stringify({ enabled }) }),
  pihedCosts: (days?: number, org?: string) => req(`/api/pihed/costs${days ? `?days=${days}${org ? `&org=${encodeURIComponent(org)}` : ''}` : ''}`),
  pihedLoadTests: () => req('/api/pihed/load-test'),
  pihedRunLoadTest: (preset: string) => req('/api/pihed/load-test/run', { method: 'POST', body: JSON.stringify({ preset }) }),
  pihedSlos: () => req('/api/pihed/slos'),
  pihedSloSummary: () => req('/api/pihed/slos?summary=true'),
  pihedReadinessBadge: (voters?: number) => fetch(`/api/pihed/readiness/badge${voters ? `?voters=${voters}` : ''}`).then(r => r.json()),
  pihedPostmortems: (status?: string) => req(`/api/pihed/postmortems${status ? `?status=${status}` : ''}`),
  pihedPostmortem: (id: string) => req(`/api/pihed/postmortems/${id}`),
  pihedCreatePostmortem: (data: any) => req('/api/pihed/postmortems', { method: 'POST', body: JSON.stringify(data) }),
  pihedUpdatePostmortem: (id: string, data: any) => req(`/api/pihed/postmortems/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  pihedDeletePostmortem: (id: string) => req(`/api/pihed/postmortems/${id}`, { method: 'DELETE' }),
  pihedMaintenanceSchedule: (status?: string) => req(`/api/pihed/maintenance-schedule${status ? `?status=${status}` : ''}`),
  pihedScheduleMaintenance: (data: any) => req('/api/pihed/maintenance-schedule', { method: 'POST', body: JSON.stringify(data) }),
  pihedCancelMaintenance: (id: string) => req(`/api/pihed/maintenance-schedule/${id}/cancel`, { method: 'POST' }),
  // Chapter 18: TQASGR — Testing, QA, Security Certification, Go-Live Readiness
  tqasgrTests: (type?: string, mod?: string) => req(`/api/tqasgr/tests${type ? `?type=${type}${mod ? `&module=${mod}` : ''}` : ''}`),
  tqasgrRunSuite: (suiteId: string) => req(`/api/tqasgr/tests/${suiteId}/run`, { method: 'POST' }),
  tqasgrRunAllSuites: () => req('/api/tqasgr/tests/run-all', { method: 'POST' }),
  tqasgrReleaseChecklists: () => req('/api/tqasgr/checklists/release'),
  tqasgrCreateReleaseChecklist: (version: string) => req('/api/tqasgr/checklists/release', { method: 'POST', body: JSON.stringify({ version }) }),
  tqasgrReleaseChecklist: (version: string) => req(`/api/tqasgr/checklists/release/${version}`),
  tqasgrVerifyChecklistItem: (version: string, itemId: string, verified: boolean, notes?: string) => req(`/api/tqasgr/checklists/release/${version}/${itemId}`, { method: 'PATCH', body: JSON.stringify({ verified, notes }) }),
  tqasgrGoLiveChecklist: (org: string, election?: string) => req(`/api/tqasgr/checklists/golive?org=${encodeURIComponent(org)}${election ? `&election=${encodeURIComponent(election)}` : ''}`),
  tqasgrCreateGoLiveChecklist: (org: string, election?: string) => req('/api/tqasgr/checklists/golive', { method: 'POST', body: JSON.stringify({ organizationId: org, electionId: election }) }),
  tqasgrVerifyGoLiveItem: (itemId: string, notes?: string) => req(`/api/tqasgr/checklists/golive/${itemId}`, { method: 'PATCH', body: JSON.stringify({ verified: true, notes }) }),
  tqasgrPilots: (status?: string) => req(`/api/tqasgr/pilots${status ? `?status=${status}` : ''}`),
  tqasgrCreatePilot: (data: any) => req('/api/tqasgr/pilots', { method: 'POST', body: JSON.stringify(data) }),
  tqasgrUpdatePilot: (id: string, data: any) => req(`/api/tqasgr/pilots/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  tqasgrCompliance: () => req('/api/tqasgr/compliance'),
  tqasgrUpdateCompliance: (id: string, data: any) => req(`/api/tqasgr/compliance/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  tqasgrCertifications: () => req('/api/tqasgr/certify'),
  tqasgrIssueCertification: (data: any) => req('/api/tqasgr/certify', { method: 'POST', body: JSON.stringify(data) }),
  tqasgrVerifyCertification: (certId: string) => fetch(`/api/tqasgr/certify/${encodeURIComponent(certId)}`).then(r => r.json()),
  tqasgrUat: (version?: string, status?: string) => req(`/api/tqasgr/uat${version ? `?version=${encodeURIComponent(version)}${status ? `&status=${status}` : ''}` : ''}`),
  tqasgrCreateUat: (data: any) => req('/api/tqasgr/uat', { method: 'POST', body: JSON.stringify(data) }),
  tqasgrUpdateUat: (id: string, data: any) => req(`/api/tqasgr/uat/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  tqasgrReleases: (phase?: string) => req(`/api/tqasgr/releases${phase ? `?phase=${phase}` : ''}`),
  tqasgrCreateRelease: (data: any) => req('/api/tqasgr/releases', { method: 'POST', body: JSON.stringify(data) }),
  tqasgrUpdateRelease: (version: string, data: any) => req(`/api/tqasgr/releases/${encodeURIComponent(version)}`, { method: 'PATCH', body: JSON.stringify(data) }),
  tqasgrDocValidations: () => req('/api/tqasgr/docs'),
  tqasgrCreateDocValidation: (version: string) => req('/api/tqasgr/docs', { method: 'POST', body: JSON.stringify({ version }) }),
  tqasgrDocValidation: (version: string) => req(`/api/tqasgr/docs/${encodeURIComponent(version)}`),
  tqasgrVerifyDoc: (version: string, itemId: string, docUrl?: string, notes?: string) => req(`/api/tqasgr/docs/${encodeURIComponent(version)}/${itemId}`, { method: 'PATCH', body: JSON.stringify({ docUrl, notes }) }),
  // Chapter 16A: OTVP Delivery, Live Monitoring, Support Chat
  ch16aOtpStats: (org: string, election?: string) => req(`/api/ch16a/otp-delivery/stats?org=${encodeURIComponent(org)}${election ? `&election=${encodeURIComponent(election)}` : ''}`),
  ch16aResendOtp: (data: any) => req('/api/ch16a/otp-delivery/resend', { method: 'POST', body: JSON.stringify(data) }),
  ch16aVoterTimeline: (voterId: string) => req(`/api/ch16a/activity-timeline/${voterId}`),
  ch16aElectionMonitor: (org: string, election?: string) => req(`/api/ch16a/election-monitor?org=${encodeURIComponent(org)}${election ? `&election=${encodeURIComponent(election)}` : ''}`),
  ch16aSupportChat: (org: string, status?: string) => req(`/api/ch16a/support-chat?org=${encodeURIComponent(org)}${status ? `&status=${status}` : ''}`),
  ch16aCreateSupportChat: (data: any) => req('/api/ch16a/support-chat', { method: 'POST', body: JSON.stringify(data) }),
  ch16aSupportChatMessages: (id: string) => req(`/api/ch16a/support-chat/${id}`),
  ch16aSendSupportMessage: (id: string, data: any) => req(`/api/ch16a/support-chat/${id}`, { method: 'POST', body: JSON.stringify(data) }),
  ch16aTakeConversation: (id: string) => req(`/api/ch16a/support-chat/${id}/take`, { method: 'POST' }),
  ch16aReleaseConversation: (id: string) => req(`/api/ch16a/support-chat/${id}/release`, { method: 'POST' }),
  ch16aEscalateConversation: (id: string) => req(`/api/ch16a/support-chat/${id}/escalate`, { method: 'POST' }),
  ch16aResolveConversation: (id: string) => req(`/api/ch16a/support-chat/${id}/resolve`, { method: 'POST' }),
  // Enterprise Audit Part 2 — domain services
  domainFraudRules: (org?: string) => req(`/api/domains/fraud-rules${org ? `?org=${encodeURIComponent(org)}` : ''}`),
  domainCreateFraudRule: (data: any) => req('/api/domains/fraud-rules', { method: 'POST', body: JSON.stringify(data) }),
  domainUpdateFraudRule: (id: string, data: any) => req(`/api/domains/fraud-rules/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  domainDeleteFraudRule: (id: string) => req(`/api/domains/fraud-rules/${id}`, { method: 'DELETE' }),
  domainSessions: (org?: string) => req(`/api/domains/sessions/active${org ? `?org=${encodeURIComponent(org)}` : ''}`),
  domainProviders: (org?: string, channel?: string) => req(`/api/domains/providers${org ? `?org=${encodeURIComponent(org)}` : ''}${channel ? `${org ? '&' : '?'}channel=${channel}` : ''}`),
  domainCreateProvider: (data: any) => req('/api/domains/providers', { method: 'POST', body: JSON.stringify(data) }),
  domainUpdateProvider: (id: string, data: any) => req(`/api/domains/providers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  domainDeleteProvider: (id: string) => req(`/api/domains/providers/${id}`, { method: 'DELETE' }),
  domainPortalSettings: (orgId: string) => req(`/api/domains/portal-settings/${orgId}`),
  domainUpdatePortalSettings: (orgId: string, data: any) => req(`/api/domains/portal-settings/${orgId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  domainHomepageBlocks: (org: string) => req(`/api/domains/homepage-blocks?org=${encodeURIComponent(org)}`),
  domainCreateHomepageBlock: (data: any) => req('/api/domains/homepage-blocks', { method: 'POST', body: JSON.stringify(data) }),
  domainHomepageBanners: (org: string, active?: boolean) => req(`/api/domains/homepage-banners?org=${encodeURIComponent(org)}${active ? '&active=true' : ''}`),
  domainCreateHomepageBanner: (data: any) => req('/api/domains/homepage-banners', { method: 'POST', body: JSON.stringify(data) }),
  domainReportDefinitions: (org?: string) => req(`/api/domains/report-definitions${org ? `?org=${encodeURIComponent(org)}` : ''}`),
  domainCreateReportDefinition: (data: any) => req('/api/domains/report-definitions', { method: 'POST', body: JSON.stringify(data) }),
  domainBotKnowledge: (org?: string) => req(`/api/domains/bot-knowledge${org ? `?org=${encodeURIComponent(org)}` : ''}`),
  domainCreateBotKnowledge: (data: any) => req('/api/domains/bot-knowledge', { method: 'POST', body: JSON.stringify(data) }),
  domainQueryBotKnowledge: (query: string, org?: string) => req(`/api/domains/bot-knowledge/query${org ? `?org=${encodeURIComponent(org)}` : ''}`, { method: 'POST', body: JSON.stringify({ query }) }),

  // Chapter 16: AIDP — API, Integrations & Developer Platform
  aidpGetApiKeys: (subdomain?: string) => req(`/api/aidp/api-keys${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  aidpCreateApiKey: (data: any, subdomain?: string) => req(`/api/aidp/api-keys${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'POST', body: JSON.stringify(data) }),
  aidpRevokeApiKey: (keyId: string, subdomain?: string) => req(`/api/aidp/api-keys/${keyId}${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'DELETE' }),
  aidpGetWebhooks: (subdomain?: string) => req(`/api/aidp/webhooks${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  aidpCreateWebhook: (data: any, subdomain?: string) => req(`/api/aidp/webhooks${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'POST', body: JSON.stringify(data) }),
  aidpDeleteWebhook: (webhookId: string, subdomain?: string) => req(`/api/aidp/webhooks/${webhookId}${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'DELETE' }),
  aidpTestWebhook: (webhookId: string, subdomain?: string) => req(`/api/aidp/webhooks/${webhookId}/test${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'POST' }),
  aidpGetWebhookDeliveries: (params: string, subdomain?: string) => req(`/api/aidp/webhooks/deliveries${params ? '?' + params : ''}${subdomain ? `${params ? '&' : '?'}x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  aidpGetIntegrations: (subdomain?: string) => req(`/api/aidp/integrations${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  aidpCreateIntegration: (data: any, subdomain?: string) => req(`/api/aidp/integrations${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'POST', body: JSON.stringify(data) }),
  aidpUpdateIntegration: (integrationId: string, data: any, subdomain?: string) => req(`/api/aidp/integrations/${integrationId}${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'PATCH', body: JSON.stringify(data) }),
  aidpGetStats: (subdomain?: string) => req(`/api/aidp/stats${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  aidpGetScopes: () => req('/api/aidp/scopes'),
  aidpGetDocs: () => req('/api/aidp/docs'),
  aidpGetPostman: () => req('/api/aidp/postman'),
  aidpGetChangelog: () => req('/api/aidp/changelog'),
  aidpOAuthRegister: (data: any, subdomain?: string) => req(`/api/aidp/oauth/register${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'POST', body: JSON.stringify(data) }),
  aidpOAuthToken: (data: any) => req('/api/aidp/oauth/token', { method: 'POST', body: JSON.stringify(data) }),

  // Chapter 15: PAOEM — Platform Administration, Operations & Ecosystem Management
  paoemGetDashboard: () => req('/api/paoem/dashboard'),
  paoemGetOrganizations: (params: string) => req(`/api/paoem/organizations${params ? '?' + params : ''}`),
  paoemUpdateOrganization: (orgId: string, data: any) => req(`/api/paoem/organizations/${orgId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  paoemGetOrgHealth: (orgId: string) => req(`/api/paoem/organizations/${orgId}/health`),
  paoemGetFeatureFlags: () => req('/api/paoem/feature-flags'),
  paoemCreateFeatureFlag: (data: any) => req('/api/paoem/feature-flags', { method: 'POST', body: JSON.stringify(data) }),
  paoemSetFeatureFlag: (key: string, enabled: boolean) => req(`/api/paoem/feature-flags/${key}`, { method: 'PATCH', body: JSON.stringify({ enabled }) }),
  paoemGetMaintenance: () => req('/api/paoem/maintenance'),
  paoemStartMaintenance: (data: any) => req('/api/paoem/maintenance', { method: 'POST', body: JSON.stringify(data) }),
  paoemEndMaintenance: (maintenanceId: string) => req('/api/paoem/maintenance', { method: 'PATCH', body: JSON.stringify({ maintenanceId }) }),
  paoemGetBroadcasts: () => req('/api/paoem/broadcasts'),
  paoemCreateBroadcast: (data: any) => req('/api/paoem/broadcasts', { method: 'POST', body: JSON.stringify(data) }),
  paoemSearch: (q: string) => req(`/api/paoem/search?q=${encodeURIComponent(q)}`),
  paoemGetCommandCenter: () => req('/api/paoem/command-center'),

  // Chapter 14: BSPCM — Billing, Subscriptions, Payments & Commercial Management
  bspmGetPricing: () => req('/api/bspcm/pricing'),
  bspmEstimate: (data: any) => req('/api/bspcm/estimate', { method: 'POST', body: JSON.stringify(data) }),
  bspmGetQuotes: (subdomain?: string) => req(`/api/bspcm/quotes${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  bspmGenerateQuote: (data: any, subdomain?: string) => req(`/api/bspcm/quotes${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'POST', body: JSON.stringify(data) }),
  bspmGetInvoices: (params: string, subdomain?: string) => req(`/api/bspcm/invoices${params ? '?' + params : ''}${subdomain ? `${params ? '&' : '?'}x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  bspmGetPayments: (subdomain?: string) => req(`/api/bspcm/payments${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  bspmInitiatePayment: (data: any, subdomain?: string) => req(`/api/bspcm/payments/initiate${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'POST', body: JSON.stringify(data) }),
  bspmVerifyPayment: (data: any) => req('/api/bspcm/payments/verify', { method: 'POST', body: JSON.stringify(data) }),
  bspmGetNegotiations: (subdomain?: string) => req(`/api/bspcm/negotiations${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  bspmRequestNegotiation: (data: any, subdomain?: string) => req(`/api/bspcm/negotiations${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'POST', body: JSON.stringify(data) }),
  bspmUpdateNegotiation: (negotiationId: string, data: any, subdomain?: string) => req(`/api/bspcm/negotiations/${negotiationId}${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'PATCH', body: JSON.stringify(data) }),
  bspmGetRevenue: () => req('/api/bspcm/revenue'),
  bspmGoLive: (data: any, subdomain?: string) => req(`/api/bspcm/golive${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'POST', body: JSON.stringify(data) }),
  bspmUpdateSubscription: (data: any, subdomain?: string) => req(`/api/bspcm/subscription${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'POST', body: JSON.stringify(data) }),
  bspmFinancialReport: (data: any, subdomain?: string) => req(`/api/bspcm/financial-reports${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'POST', body: JSON.stringify(data) }),
  bspmWhiteLabel: (data: any, subdomain?: string) => req(`/api/bspcm/whitelabel${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'POST', body: JSON.stringify(data) }),

  // Chapter 13: RAEI — Reporting, Analytics & Election Intelligence
  raeiGetPlatform: () => req('/api/raei/platform'),
  raeiGetOrg: (subdomain?: string) => req(`/api/raei/org${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  raeiGetElection: (electionId: string, subdomain?: string) => req(`/api/raei/election/${electionId}${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  raeiGetHistorical: (subdomain?: string) => req(`/api/raei/historical${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  raeiGetInsights: (subdomain?: string) => req(`/api/raei/insights${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  raeiGenerateReport: (data: any, subdomain?: string) => req(`/api/raei/reports${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'POST', body: JSON.stringify(data) }),
  raeiGetCertification: (electionId: string, subdomain?: string) => req(`/api/raei/certification/${electionId}${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  raeiGetReplay: (electionId: string, subdomain?: string) => req(`/api/raei/replay/${electionId}${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  // Observer reports (structured submission)
  raeiGetObserverReports: (params: string, subdomain?: string) => req(`/api/raei/observer-reports${params ? '?' + params : ''}${subdomain ? `${params ? '&' : '?'}x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  raeiSubmitObserverReport: (data: any, subdomain?: string) => req(`/api/raei/observer-reports${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'POST', body: JSON.stringify(data) }),
  raeiUpdateObserverReport: (reportId: string, data: any, subdomain?: string) => req(`/api/raei/observer-reports/${reportId}${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'PATCH', body: JSON.stringify(data) }),
  raeiDeleteObserverReport: (reportId: string, subdomain?: string) => req(`/api/raei/observer-reports/${reportId}${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'DELETE' }),
  // Data retention policy
  raeiGetDataRetention: (subdomain?: string) => req(`/api/raei/data-retention${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  raeiUpdateDataRetention: (data: any, subdomain?: string) => req(`/api/raei/data-retention${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Chapter 12: CNSE — Communication, Notification & Support Ecosystem
  cnseSend: (data: any, subdomain?: string) => req(`/api/cnse/send${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'POST', body: JSON.stringify(data) }),
  cnseGetTemplates: (params: string, subdomain?: string) => req(`/api/cnse/templates${params ? '?' + params : ''}${subdomain ? `${params ? '&' : '?'}x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  cnseCreateTemplate: (data: any, subdomain?: string) => req(`/api/cnse/templates${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'POST', body: JSON.stringify(data) }),
  cnseUpdateTemplate: (data: any, subdomain?: string) => req(`/api/cnse/templates${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'PATCH', body: JSON.stringify(data) }),
  cnseGetAnnouncements: (params: string, subdomain?: string) => req(`/api/cnse/announcements${params ? '?' + params : ''}${subdomain ? `${params ? '&' : '?'}x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  cnseCreateAnnouncement: (data: any, subdomain?: string) => req(`/api/cnse/announcements${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'POST', body: JSON.stringify(data) }),
  cnseDeleteAnnouncement: (id: string, subdomain?: string) => req(`/api/cnse/announcements?id=${id}${subdomain ? `&x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'DELETE' }),
  cnseGetTimeline: (params: string, subdomain?: string) => req(`/api/cnse/timeline${params ? '?' + params : ''}${subdomain ? `${params ? '&' : '?'}x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  cnseGetAnalytics: (params: string, subdomain?: string) => req(`/api/cnse/analytics${params ? '?' + params : ''}${subdomain ? `${params ? '&' : '?'}x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  cnseGetNotifications: (params: string, subdomain?: string) => req(`/api/cnse/notifications${params ? '?' + params : ''}${subdomain ? `${params ? '&' : '?'}x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  cnseMarkNotificationRead: (data: any, subdomain?: string) => req(`/api/cnse/notifications${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Chapter 11: EIFDIRS — Election Integrity, Fraud Detection & Incident Response
  getEifdirsEvents: (params: string, subdomain?: string) => req(`/api/eifdirs/events${params ? '?' + params : ''}${subdomain ? `${params ? '&' : '?'}x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  getEifdirsIncidents: (params: string, subdomain?: string) => req(`/api/eifdirs/incidents${params ? '?' + params : ''}${subdomain ? `${params ? '&' : '?'}x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  getEifdirsIncident: (incidentId: string, subdomain?: string) => req(`/api/eifdirs/incidents/${incidentId}${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  updateEifdirsIncident: (incidentId: string, data: any, subdomain?: string) => req(`/api/eifdirs/incidents/${incidentId}${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'PATCH', body: JSON.stringify(data) }),
  getEifdirsDashboard: (subdomain?: string) => req(`/api/eifdirs/dashboard${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  eifdirsLockdown: (data: any, subdomain?: string) => req(`/api/eifdirs/lockdown${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'POST', body: JSON.stringify(data) }),
  getEifdirsCertificate: (electionId: string, subdomain?: string) => req(`/api/eifdirs/certificate/${electionId}${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  generateEifdirsCertificate: (electionId: string, subdomain?: string) => req(`/api/eifdirs/certificate/${electionId}${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`, { method: 'POST' }),
  getEifdirsTransparencyReport: (electionId: string) => req(`/api/eifdirs/transparency/${electionId}`),
  getEifdirsForensicReplay: (electionId: string, subdomain?: string) => req(`/api/eifdirs/forensic-replay/${electionId}${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),
  getEifdirsElectionStatus: (electionId: string, subdomain?: string) => req(`/api/eifdirs/election/${electionId}${subdomain ? `?x-vw-org=${encodeURIComponent(subdomain)}` : ''}`),

  // Public live results (shareable URL)
  getPublicResults: (electionId: string) => req(`/api/elections/${electionId}/public-results`),
  // Public verification portal for certified elections (shareable URL)
  getVerificationPortal: (electionId: string) => req(`/api/elections/${electionId}/verification-portal`),
  // Public voter status portal (cross-org, no auth) — check registration +
  // voting history + receipts WITHOUT revealing vote choices.
  checkVoterStatus: (identifier: string) => req('/api/voter-status', { method: 'POST', body: JSON.stringify({ identifier }) }),


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
  // @deprecated — use api.submitVote() via /api/workspace/ballot/submit instead.
  // The legacy /api/vote/cast route writes to EncryptedVote (not VoteRecord)
  // and is not visible to live results, RLA, or exports. Retained only for
  // backward compatibility — do not use in new code.
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

  // Per-election export & reports — returns a direct-download URL for use
  // with window.open() or <a href download>. The browser handles auth via
  // the existing HttpOnly cookies (credentials:'include' isn't honoured by
  // window.open, but the cookies are sent automatically for same-origin
  // navigations, which is what we want here).
  exportElectionData: (
    electionId: string,
    type: 'results' | 'audit' | 'voters' | 'full',
    format: 'csv' | 'json' | 'printable',
    subdomain?: string,
  ) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const q = new URLSearchParams()
    q.set('type', type)
    q.set('format', format)
    if (subdomain) q.set('x-vw-org', subdomain)
    return `${origin}/api/workspace/elections/${electionId}/export?${q.toString()}`
  },

  // Public printable official result sheet — opens in a new tab. No auth
  // required (it's a PUBLIC endpoint), so the URL can be shared externally.
  getPrintableResultSheet: (electionId: string, subdomain?: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const q = new URLSearchParams()
    if (subdomain) q.set('x-vw-org', subdomain)
    const qs = q.toString()
    return `${origin}/api/workspace/elections/${electionId}/export/printable${qs ? `?${qs}` : ''}`
  },

  // Public certificate
  getCertificate: () => req('/api/results/certificate'),
}
