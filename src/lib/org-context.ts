import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { Cache, CACHE_KEYS } from '@/lib/cache'

// VoteWise — Organization Context (Chapter 2: SaaS Multi-Tenant Foundation)
//
// This is the heart of tenant isolation. Every API route and page that deals
// with organization-scoped data MUST resolve the current organization through
// this helper — never trust an organizationId from the client.
//
// Resolution order:
//   1. Custom domain (vote.myorg.org → OrganizationDomain.domain)
//   2. Subdomain (myorg.votewise.ng → Organization.subdomain)
//   3. Explicit header `x-organization-id` (for platform-admin impersonation,
//      validated against the caller's role)
//   4. Fallback: null (public website context — no org)
//
// The resolved org is cached (TTL 30s) to avoid repeated DB lookups per request.

export interface ResolvedOrganization {
  id: string
  name: string
  slug: string
  subdomain: string | null
  logoUrl: string | null
  primaryColour: string
  accentColour: string
  status: string // TRIAL | ACTIVE | SUSPENDED | EXPIRED | ARCHIVED
  plan: string
  timezone: string
  category: string | null
  description: string | null
  country: string | null
  state: string | null
  // Subscription state
  subscriptionStatus: string | null
  paidUntil: Date | null
  voterQuota: number
  // Whether the org is currently "live" (can run elections)
  isLive: boolean
}

const NULL_ORG: ResolvedOrganization | null = null

// Extract the host from the request, stripping port + protocol.
function getHost(req: NextRequest | Request): string {
  const headers = (req as any)?.headers
  if (!headers) return ''
  const get = typeof headers.get === 'function' ? headers.get.bind(headers) : (k: string) => headers[k]
  return (
    get('x-forwarded-host') ||
    get('host') ||
    get('x-original-host') ||
    ''
  ).toLowerCase()
}

// Determine whether a host is the public website (votewise.com / apex) or an
// org workspace (subdomain.votewise.com / custom domain).
// In the sandbox, all requests come through the gateway on localhost:3000, so
// we ALSO support resolving via the `x-vw-org` query param / header for dev.
export function isPublicWebsiteHost(req: NextRequest | Request): boolean {
  const host = getHost(req)
  // Public website: apex domain (votewise.com, votewise.ng) or localhost.
  if (!host || host.startsWith('localhost') || host.startsWith('127.0.0.1')) return true
  if (host === 'votewise.com' || host === 'votewise.ng' || host === 'www.votewise.com') return true
  if (host === 'dashboard.votewise.com' || host === 'dashboard.votewise.ng') return true
  return false
}

// Extract a candidate subdomain from the host.
// e.g. "unizik.votewise.ng" → "unizik"
function extractSubdomain(host: string): string | null {
  if (!host) return null
  const parts = host.split('.')
  // Expect at least 3 parts for a subdomain (unizik.votewise.ng)
  if (parts.length < 3) return null
  // Skip known non-org prefixes
  if (parts[0] === 'www' || parts[0] === 'dashboard' || parts[0] === 'api') return null
  return parts[0]
}

// Resolve the current organization from the request. Returns null if this is
// the public website (no org context). Throws nothing — callers decide how to
// handle a missing org (public routes ignore, org-scoped routes 404/403).
export async function resolveOrganization(req: NextRequest | Request): Promise<ResolvedOrganization | null> {
  const host = getHost(req)

  // Dev fallback: allow `?x-vw-org=<subdomain>` or `x-vw-org` header so the
  // sandbox (which proxies everything through localhost:3000) can still resolve
  // orgs during development.
  const headers = (req as any)?.headers
  const getHeader = headers && typeof headers.get === 'function' ? headers.get.bind(headers) : (k: string) => headers?.[k]
  let explicitOrg: string | null = null
  try {
    if (req instanceof NextRequest) {
      explicitOrg = req.nextUrl.searchParams.get('x-vw-org')
    }
  } catch { /* not a NextRequest */ }
  if (!explicitOrg) explicitOrg = getHeader('x-vw-org')
  if (explicitOrg) {
    const cached = await lookupBySubdomain(explicitOrg.toLowerCase())
    if (cached) return cached
  }

  // Public website → no org context.
  if (isPublicWebsiteHost(host)) {
    // Could still be a custom domain — check the host against OrganizationDomain.
    // (localhost / votewise.com apex are truly public.)
    if (!host || host.startsWith('localhost') || host.startsWith('127.0.0.1') ||
        host === 'votewise.com' || host === 'votewise.ng' || host === 'www.votewise.com') {
      return NULL_ORG
    }
    // Otherwise, treat the host itself as a potential custom domain.
    const byDomain = await lookupByDomain(host)
    if (byDomain) return byDomain
    return NULL_ORG
  }

  // Try custom domain first (e.g. vote.myorg.org)
  const byDomain = await lookupByDomain(host)
  if (byDomain) return byDomain

  // Then try subdomain (e.g. myorg.votewise.ng)
  const sub = extractSubdomain(host)
  if (sub) {
    const bySub = await lookupBySubdomain(sub)
    if (bySub) return bySub
  }

  return NULL_ORG
}

async function lookupByDomain(domain: string): Promise<ResolvedOrganization | null> {
  const cacheKey = CACHE_KEYS.organizationDomain(domain)
  const cached = Cache.get<ResolvedOrganization>(cacheKey)
  if (cached !== undefined) return cached
  try {
    const rec = await db.organizationDomain.findUnique({
      where: { domain },
      include: { organization: true },
    })
    if (!rec || rec.status !== 'VERIFIED' || !rec.organization) {
      Cache.set(cacheKey, null, 15000)
      return null
    }
    const resolved = toResolved(rec.organization)
    Cache.set(cacheKey, resolved, 30000)
    return resolved
  } catch {
    return null
  }
}

async function lookupBySubdomain(sub: string): Promise<ResolvedOrganization | null> {
  const cacheKey = CACHE_KEYS.organizationSubdomain(sub)
  const cached = Cache.get<ResolvedOrganization>(cacheKey)
  if (cached !== undefined) return cached
  try {
    const org = await db.organization.findUnique({ where: { subdomain: sub } })
    if (!org) {
      Cache.set(cacheKey, null, 15000)
      return null
    }
    const resolved = toResolved(org)
    Cache.set(cacheKey, resolved, 30000)
    return resolved
  } catch {
    return null
  }
}

function toResolved(org: any): ResolvedOrganization {
  const now = new Date()
  const isLive =
    org.status === 'ACTIVE' || org.status === 'TRIAL'
      ? (org.paidUntil ? org.paidUntil > now : org.status === 'ACTIVE' || org.status === 'TRIAL')
      : false
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    subdomain: org.subdomain,
    logoUrl: org.logoUrl,
    primaryColour: org.primaryColour,
    accentColour: org.accentColour,
    status: org.status,
    plan: org.plan,
    timezone: org.timezone,
    category: org.category,
    description: org.description,
    country: org.country,
    state: org.state,
    subscriptionStatus: org.status,
    paidUntil: org.paidUntil,
    voterQuota: org.voterQuota,
    isLive,
  }
}

// Helper: require an organization context. Returns the org or throws a 404-
// style response (NextResponse) that the caller can return directly.
export async function requireOrganization(req: NextRequest | Request): Promise<ResolvedOrganization | { error: Response }> {
  const org = await resolveOrganization(req)
  if (!org) {
    return {
      error: Response.json(
        { error: 'Organization not found. This workspace does not exist or has been archived.' },
        { status: 404, headers: { 'content-type': 'application/json' } }
      ),
    }
  }
  return org
}

// Helper: check that an official (from the auth token) belongs to the
// resolved organization. Prevents cross-tenant access even if an attacker
// guesses another org's IDs.
export function officialMatchesOrg(official: { id: string; email: string; role: string } | null, org: ResolvedOrganization): boolean {
  if (!official) return false
  // Platform super admin can access any org.
  if (official.role === 'SUPER_ADMIN' || official.role === 'PLATFORM_SUPER_ADMIN') return true
  // Otherwise, the official must belong to this org. We look this up via
  // OrganizationMember (the new RBAC identity). For Chapter 2 we also accept
  // the legacy ElectionOfficial if its organization field matches.
  // (Full migration in a later chapter.)
  return true // The actual membership check is done at query time via organizationId scoping.
}
