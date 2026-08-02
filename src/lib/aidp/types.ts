// VoteWise — Chapter 16 AIDP Types

export type ApiKeyEnvironment = 'production' | 'sandbox'
export type OAuthGrantType = 'authorization_code' | 'client_credentials'
export type WebhookEvent =
  | 'election.created' | 'election.published' | 'election.started' | 'election.closed'
  | 'election.certified' | 'vote.completed' | 'result.published'
  | 'payment.successful' | 'support.ticket.created' | 'incident.created'
  | 'voter.imported' | 'organization.updated'
export type IntegrationType = 'SIS' | 'HR' | 'IDENTITY' | 'MEMBERSHIP' | 'LMS' | 'ERP' | 'CUSTOM'
export type IntegrationStatus = 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'SYNCING'

export interface ApiKeyCreate {
  name: string
  scopes: string[]
  environment?: ApiKeyEnvironment
  expiresAt?: Date
}

export interface ApiKeyResult {
  id: string
  name: string
  keyPrefix: string
  fullKey: string  // only returned once on creation
  scopes: string[]
  environment: string
  expiresAt: string | null
  createdAt: string
}

export interface WebhookCreate {
  url: string
  name: string
  events: WebhookEvent[]
}

export interface WebhookDeliveryResult {
  id: string
  eventType: string
  status: string
  attempts: number
  responseCode: number | null
  deliveredAt: string | null
  createdAt: string
}

export interface IntegrationCreate {
  name: string
  type: IntegrationType
  provider?: string
  config?: Record<string, any>
}

export interface ApiStats {
  totalRequests: number
  totalErrors: number
  avgLatencyMs: number
  errorRate: number
  topEndpoints: Array<{ endpoint: string; count: number; avgLatency: number }>
  requestsPerHour: number
  rateLimitHits: number
}

// API permission scopes
export const SCOPES = [
  'read:organizations', 'write:organizations',
  'read:elections', 'write:elections', 'manage:elections',
  'read:voters', 'write:voters', 'import:voters',
  'read:candidates', 'write:candidates',
  'read:positions', 'write:positions',
  'read:results', 'read:reports',
  'read:notifications', 'write:notifications',
  'read:support', 'write:support',
  'read:audit', 'read:security',
  'read:billing', 'write:billing',
  'manage:webhooks', 'manage:api_keys',
] as const

// Webhook event catalog
export const WEBHOOK_EVENTS: Array<{ event: WebhookEvent; description: string }> = [
  { event: 'election.created', description: 'A new election was created' },
  { event: 'election.published', description: 'An election was published' },
  { event: 'election.started', description: 'Voting opened for an election' },
  { event: 'election.closed', description: 'Voting closed for an election' },
  { event: 'election.certified', description: 'Election results were certified' },
  { event: 'vote.completed', description: 'A voter cast their vote' },
  { event: 'result.published', description: 'Results were published publicly' },
  { event: 'payment.successful', description: 'A payment was successfully verified' },
  { event: 'support.ticket.created', description: 'A new support ticket was opened' },
  { event: 'incident.created', description: 'A security incident was detected' },
  { event: 'voter.imported', description: 'Voters were imported (bulk)' },
  { event: 'organization.updated', description: 'Organization settings were updated' },
]
