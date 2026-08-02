// VoteWise — Chapter 16 API Versioning & Documentation
//
// Handles API versioning (/api/v1/, /api/v2/) and provides the API
// documentation catalog for the Developer Portal.

import { db } from '@/lib/db'

// Current API version
export const CURRENT_API_VERSION = 'v1'
export const SUPPORTED_VERSIONS = ['v1']

// API module catalog for documentation
export interface ApiModule {
  name: string
  description: string
  endpoints: Array<{
    method: string
    path: string
    description: string
    scopes?: string[]
    public?: boolean
  }>
}

export const API_MODULES: ApiModule[] = [
  {
    name: 'Authentication',
    description: 'Login, logout, session management, 2FA',
    endpoints: [
      { method: 'POST', path: '/api/auth/login', description: 'Login with email + password' },
      { method: 'POST', path: '/api/auth/logout', description: 'Logout and revoke session' },
      { method: 'GET', path: '/api/auth/me', description: 'Get current user session' },
      { method: 'POST', path: '/api/auth/refresh', description: 'Refresh access token' },
      { method: 'POST', path: '/api/auth/2fa/verify', description: 'Verify TOTP code for 2FA' },
    ],
  },
  {
    name: 'Organizations',
    description: 'Organization registration, management, branding',
    endpoints: [
      { method: 'POST', path: '/api/organizations/register', description: 'Register a new organization', public: true },
      { method: 'GET', path: '/api/organizations', description: 'List all organizations', public: true },
      { method: 'GET', path: '/api/workspace/dashboard', description: 'Get org dashboard', scopes: ['read:organizations'] },
      { method: 'PATCH', path: '/api/workspace/settings', description: 'Update org settings', scopes: ['write:organizations'] },
    ],
  },
  {
    name: 'Elections',
    description: 'Election CRUD, lifecycle, validation',
    endpoints: [
      { method: 'GET', path: '/api/workspace/elections', description: 'List elections', scopes: ['read:elections'] },
      { method: 'POST', path: '/api/workspace/elections', description: 'Create election', scopes: ['write:elections'] },
      { method: 'GET', path: '/api/workspace/elections/[id]', description: 'Get election details', scopes: ['read:elections'] },
      { method: 'PATCH', path: '/api/workspace/elections/[id]', description: 'Update election', scopes: ['write:elections'] },
      { method: 'POST', path: '/api/workspace/elections/[id]/duplicate', description: 'Duplicate election', scopes: ['manage:elections'] },
      { method: 'GET', path: '/api/workspace/elections/[id]/validate', description: 'Validate election readiness', scopes: ['read:elections'] },
      { method: 'POST', path: '/api/bspcm/golive', description: 'Go Live wizard (validate + estimate + activate)', scopes: ['manage:elections'] },
    ],
  },
  {
    name: 'Voting',
    description: 'Ballot generation, vote casting, receipts',
    endpoints: [
      { method: 'POST', path: '/api/workspace/ballot/session/start', description: 'Start voting session' },
      { method: 'POST', path: '/api/workspace/ballot', description: 'Generate secure ballot' },
      { method: 'POST', path: '/api/workspace/ballot/submit', description: 'Cast vote (atomic transaction)' },
      { method: 'POST', path: '/api/workspace/ballot/receipt', description: 'Verify receipt', scopes: ['read:results'] },
      { method: 'POST', path: '/api/workspace/ballot/simulate', description: 'Ballot simulation (no real data)', scopes: ['manage:elections'] },
      { method: 'POST', path: '/api/receipt/verify', description: 'Public receipt verification', public: true },
    ],
  },
  {
    name: 'Results',
    description: 'Live results, tallying, verification packages',
    endpoints: [
      { method: 'GET', path: '/api/elections/[id]/public-results', description: 'Public live results', public: true },
      { method: 'GET', path: '/api/workspace/elections/[id]/live', description: 'Live monitor (org)', scopes: ['read:results'] },
      { method: 'POST', path: '/api/workspace/elections/[id]/tally', description: 'Tally + lock results', scopes: ['election.certify'] },
      { method: 'GET', path: '/api/workspace/elections/[id]/verification', description: 'Verification package', scopes: ['read:results'] },
      { method: 'GET', path: '/api/elections/[id]/verification-portal', description: 'Public verification portal', public: true },
    ],
  },
  {
    name: 'Voters',
    description: 'Voter registry, import, bulk operations',
    endpoints: [
      { method: 'GET', path: '/api/workspace/voters', description: 'List voters', scopes: ['read:voters'] },
      { method: 'POST', path: '/api/workspace/voters', description: 'Add voter', scopes: ['write:voters'] },
      { method: 'PATCH', path: '/api/workspace/voters', description: 'Bulk actions (suspend/reactivate)', scopes: ['write:voters'] },
      { method: 'GET', path: '/api/workspace/voters/import-template', description: 'Download CSV template', scopes: ['import:voters'] },
      { method: 'POST', path: '/api/voter-status', description: 'Public voter status check', public: true },
    ],
  },
  {
    name: 'Candidates',
    description: 'Candidate management, screening',
    endpoints: [
      { method: 'GET', path: '/api/workspace/elections/[id]/candidates', description: 'List candidates', scopes: ['read:candidates'] },
      { method: 'POST', path: '/api/workspace/elections/[id]/candidates', description: 'Add candidate', scopes: ['write:candidates'] },
      { method: 'POST', path: '/api/workspace/elections/[id]/candidates/[id]/screen', description: 'Screen candidate', scopes: ['candidate.screen'] },
    ],
  },
  {
    name: 'Notifications',
    description: 'Communication center, templates, announcements',
    endpoints: [
      { method: 'POST', path: '/api/cnse/send', description: 'Send message', scopes: ['write:notifications'] },
      { method: 'GET', path: '/api/cnse/templates', description: 'List templates', scopes: ['read:notifications'] },
      { method: 'GET', path: '/api/cnse/timeline', description: 'Communication timeline', scopes: ['read:notifications'] },
      { method: 'GET', path: '/api/cnse/analytics', description: 'Delivery analytics', scopes: ['read:notifications'] },
    ],
  },
  {
    name: 'Payments',
    description: 'Billing, invoices, payments, subscriptions',
    endpoints: [
      { method: 'GET', path: '/api/bspcm/pricing', description: 'Get pricing plans', public: true },
      { method: 'POST', path: '/api/bspcm/estimate', description: 'Cost estimator', public: true },
      { method: 'GET', path: '/api/bspcm/invoices', description: 'List invoices', scopes: ['read:billing'] },
      { method: 'POST', path: '/api/bspcm/payments/initiate', description: 'Initiate payment', scopes: ['write:billing'] },
      { method: 'POST', path: '/api/bspcm/payments/verify', description: 'Verify payment', scopes: ['write:billing'] },
      { method: 'GET', path: '/api/bspcm/revenue', description: 'Revenue dashboard (admin)' },
    ],
  },
  {
    name: 'Security',
    description: 'Fraud detection, incidents, integrity',
    endpoints: [
      { method: 'GET', path: '/api/eifdirs/dashboard', description: 'Security dashboard', scopes: ['read:security'] },
      { method: 'GET', path: '/api/eifdirs/events', description: 'Event stream', scopes: ['read:security'] },
      { method: 'GET', path: '/api/eifdirs/incidents', description: 'Incident list', scopes: ['read:security'] },
      { method: 'POST', path: '/api/eifdirs/lockdown', description: 'Emergency lockdown', scopes: ['security.manage'] },
      { method: 'GET', path: '/api/eifdirs/forensic-replay/[id]', description: 'Forensic replay', scopes: ['audit.view'] },
    ],
  },
  {
    name: 'Integrations',
    description: 'API keys, webhooks, external systems',
    endpoints: [
      { method: 'GET', path: '/api/aidp/api-keys', description: 'List API keys', scopes: ['manage:api_keys'] },
      { method: 'POST', path: '/api/aidp/api-keys', description: 'Create API key', scopes: ['manage:api_keys'] },
      { method: 'GET', path: '/api/aidp/webhooks', description: 'List webhooks', scopes: ['manage:webhooks'] },
      { method: 'POST', path: '/api/aidp/webhooks', description: 'Create webhook', scopes: ['manage:webhooks'] },
      { method: 'GET', path: '/api/aidp/integrations', description: 'List integrations', scopes: ['read:organizations'] },
      { method: 'GET', path: '/api/aidp/stats', description: 'API usage stats', scopes: ['read:audit'] },
      { method: 'GET', path: '/api/aidp/scopes', description: 'Available scopes + events', public: true },
    ],
  },
  {
    name: 'Reports',
    description: 'Analytics, intelligence, certification packages',
    endpoints: [
      { method: 'GET', path: '/api/raei/org', description: 'Org intelligence dashboard', scopes: ['read:reports'] },
      { method: 'GET', path: '/api/raei/election/[id]', description: 'Election dashboard', scopes: ['read:results'] },
      { method: 'POST', path: '/api/raei/reports', description: 'Generate report', scopes: ['read:reports'] },
      { method: 'GET', path: '/api/raei/certification/[id]', description: 'Certification package', scopes: ['read:results'] },
      { method: 'GET', path: '/api/raei/replay/[id]', description: 'Election replay studio', scopes: ['audit.view'] },
    ],
  },
]

// API changelog
export const API_CHANGELOG: Array<{ version: string; date: string; changes: string[] }> = [
  {
    version: 'v1.0',
    date: '2026-08-01',
    changes: [
      'Initial API release',
      'Authentication: JWT + API Keys + OAuth client model',
      'Voting: Secure ballot generation, atomic vote recording, receipt verification',
      'Results: Live results, tallying, verification packages, forensic replay',
      'Security: Fraud detection, incident management, emergency lockdown',
      'Billing: Pricing engine, quotes, invoices, payments (Paystack/Flutterwave/Stripe)',
      'Integrations: API keys, webhooks, external system connections',
      'Analytics: Platform/org/election dashboards, AI insights, historical comparison',
      'Communication: Multi-channel messaging, templates, delivery tracking',
    ],
  },
]

// Postman collection generator
export function generatePostmanCollection(): any {
  const items: any[] = []
  for (const mod of API_MODULES) {
    const modItems = mod.endpoints.map((ep) => ({
      name: `${ep.method} ${ep.path}`,
      request: {
        method: ep.method,
        header: [
          { key: 'Content-Type', value: 'application/json' },
          { key: 'x-vw-org', value: '{{subdomain}}' },
          ...(ep.scopes ? [{ key: 'Authorization', value: 'Bearer {{api_key}}' }] : []),
        ],
        url: {
          raw: `{{base_url}}${ep.path}`,
          host: ['{{base_url}}'],
          path: ep.path.split('/').filter(Boolean),
        },
        description: ep.description,
      },
    }))
    items.push({ name: mod.name, item: modItems })
  }
  return {
    info: {
      name: 'VoteWise API Collection',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      description: 'Complete VoteWise Election Platform API — all endpoints across all modules.',
    },
    variable: [
      { key: 'base_url', value: 'https://votewise.com.ng' },
      { key: 'subdomain', value: 'demo' },
      { key: 'api_key', value: 'vw_your_api_key_here' },
    ],
    item: items,
  }
}
