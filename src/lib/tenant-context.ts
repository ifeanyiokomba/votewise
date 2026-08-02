// VoteWise — Tenant Context (Enterprise Audit Part 1)
//
// Spec: "Move to a strict tenant context model. Every request should resolve
// the tenant first: Incoming Request → Host Header → Tenant Resolver →
// Tenant Context → Authorization → Business Logic. No service should query
// tenant data without a tenant context."
//
// This module formalizes the tenant resolution flow. It's the single entry
// point for resolving which organization a request belongs to. All downstream
// services (API routes, business logic, database queries) should use the
// resolved TenantContext to scope their data access.
//
// Resolution order (per the audit):
//   1. Custom domain (vote.university.edu.ng → CustomDomain table)
//   2. Subdomain on shared verify domain (mouau.verifyvotes.com)
//   3. Subdomain on main domain (org.votewise.com.ng)
//   4. x-vw-org header (explicit override for API clients)
//   5. ?x-vw-org= query (explicit override for testing)
//   6. x-vw-custom-host header (set by the Next.js proxy)
//   7. Cookie (persists across SPA navigations)
//   8. None (apex domain, localhost — public context)

import { NextRequest } from 'next/server'
import { db } from '@/lib/db'

export interface TenantContext {
  organizationId: string | null
  subdomain: string | null
  domain: string | null
  source: 'custom-domain' | 'shared-subdomain' | 'main-subdomain' | 'header' | 'query' | 'cookie' | 'custom-host' | 'none'
  resolved: boolean
}

const SHARED_VERIFY_DOMAIN = 'verifyvotes.com'
const MAIN_DOMAIN = 'votewise.com.ng'

/**
 * Resolve the tenant context from the request. This is the SINGLE entry
 * point for tenant resolution. All API routes that deal with org-scoped
 * data should call this first.
 *
 * Usage:
 *   const tenant = await resolveTenantContext(req)
 *   if (!tenant.resolved) return errorJson('Organization not specified', 400)
 *   const data = await db.electionSession.findMany({
 *     where: { organizationId: tenant.organizationId }
 *   })
 */
export async function resolveTenantContext(req: NextRequest): Promise<TenantContext> {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || ''
  const cleanHost = host.split(':')[0].toLowerCase()

  // 4. Explicit header override (API clients)
  const headerOrg = req.headers.get('x-vw-org')
  if (headerOrg) {
    const orgId = await orgIdFromSubdomain(headerOrg)
    return {
      organizationId: orgId,
      subdomain: headerOrg,
      domain: cleanHost || null,
      source: 'header',
      resolved: Boolean(orgId),
    }
  }

  // 5. Query string override (?x-vw-org=)
  const queryOrg = req.nextUrl.searchParams.get('x-vw-org')
  if (queryOrg) {
    const orgId = await orgIdFromSubdomain(queryOrg)
    return {
      organizationId: orgId,
      subdomain: queryOrg,
      domain: cleanHost || null,
      source: 'query',
      resolved: Boolean(orgId),
    }
  }

  // 6. Custom host header (set by the proxy for custom domains)
  const customHost = req.headers.get('x-vw-custom-host')
  if (customHost) {
    const orgId = await orgIdFromCustomDomain(customHost)
    return {
      organizationId: orgId,
      subdomain: null,
      domain: customHost,
      source: 'custom-host',
      resolved: Boolean(orgId),
    }
  }

  // Skip localhost / IP addresses (dev environment)
  if (cleanHost === 'localhost' || cleanHost === '' || /^\d+\.\d+\.\d+\.\d+$/.test(cleanHost)) {
    return { organizationId: null, subdomain: null, domain: cleanHost || null, source: 'none', resolved: false }
  }

  // 1. Check if this is a custom domain (vote.university.edu.ng)
  const customDomainOrgId = await orgIdFromCustomDomain(cleanHost)
  if (customDomainOrgId) {
    return {
      organizationId: customDomainOrgId,
      subdomain: null,
      domain: cleanHost,
      source: 'custom-domain',
      resolved: true,
    }
  }

  // 2. Subdomain on the shared verify domain (mouau.verifyvotes.com)
  if (cleanHost.endsWith(`.${SHARED_VERIFY_DOMAIN}`)) {
    const sub = cleanHost.slice(0, -(`.${SHARED_VERIFY_DOMAIN}`).length)
    if (sub && !sub.includes('.')) {
      const orgId = await orgIdFromSubdomain(sub)
      return {
        organizationId: orgId,
        subdomain: sub,
        domain: cleanHost,
        source: 'shared-subdomain',
        resolved: Boolean(orgId),
      }
    }
  }

  // 3. Subdomain on the main domain (org.votewise.com.ng)
  if (cleanHost.endsWith(`.${MAIN_DOMAIN}`)) {
    const sub = cleanHost.slice(0, -(`.${MAIN_DOMAIN}`).length)
    if (sub && !sub.includes('.') && !['www', 'staging', 'api', 'status', 'admin'].includes(sub)) {
      const orgId = await orgIdFromSubdomain(sub)
      return {
        organizationId: orgId,
        subdomain: sub,
        domain: cleanHost,
        source: 'main-subdomain',
        resolved: Boolean(orgId),
      }
    }
  }

  // 7. Cookie (last resort for SPA navigations)
  const cookieOrg = req.cookies.get('vw-org')?.value
  if (cookieOrg) {
    const orgId = await orgIdFromSubdomain(cookieOrg)
    return {
      organizationId: orgId,
      subdomain: cookieOrg,
      domain: cleanHost || null,
      source: 'cookie',
      resolved: Boolean(orgId),
    }
  }

  // 8. None — apex domain, localhost, or unresolvable
  return { organizationId: null, subdomain: null, domain: cleanHost || null, source: 'none', resolved: false }
}

/**
 * Resolve tenant from a subdomain string (for use in non-request contexts
 * like Server Components where you only have the subdomain).
 */
export async function resolveTenantFromSubdomain(subdomain: string): Promise<TenantContext> {
  const orgId = await orgIdFromSubdomain(subdomain)
  return {
    organizationId: orgId,
    subdomain,
    domain: `${subdomain}.${MAIN_DOMAIN}`,
    source: 'shared-subdomain',
    resolved: Boolean(orgId),
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function orgIdFromSubdomain(subdomain: string): Promise<string | null> {
  const org = await db.organization.findUnique({
    where: { subdomain },
    select: { id: true, status: true },
  }).catch(() => null)
  // Only return org ID if the org is active (not suspended/archived)
  if (!org || org.status === 'SUSPENDED' || org.status === 'ARCHIVED') return null
  return org.id
}

async function orgIdFromCustomDomain(domain: string): Promise<string | null> {
  const customDomain = await db.customDomain.findUnique({
    where: { domain },
    select: { organizationId: true, status: true },
  }).catch(() => null)
  if (!customDomain || customDomain.status !== 'ACTIVE') return null
  return customDomain.organizationId
}

/**
 * List all tenant domains (for the admin multi-tenant routing dashboard).
 */
export async function listTenantDomains() {
  const [customDomains, orgSubdomains] = await Promise.all([
    db.customDomain.findMany({
      where: { status: 'ACTIVE' },
      select: { domain: true, organizationId: true },
      take: 200,
    }).catch(() => []),
    db.organization.findMany({
      where: { subdomain: { not: null }, status: { in: ['TRIAL', 'ACTIVE'] } },
      select: { id: true, name: true, subdomain: true },
      take: 200,
    }).catch(() => []),
  ])

  return {
    customDomains: customDomains.map((d) => ({
      domain: d.domain,
      organizationId: d.organizationId,
      type: 'custom' as const,
    })),
    subdomains: orgSubdomains.map((o) => ({
      domain: `${o.subdomain}.${SHARED_VERIFY_DOMAIN}`,
      organizationId: o.id,
      organizationName: o.name,
      type: 'subdomain' as const,
    })),
    mainSubdomains: orgSubdomains.map((o) => ({
      domain: `${o.subdomain}.${MAIN_DOMAIN}`,
      organizationId: o.id,
      organizationName: o.name,
      type: 'main-subdomain' as const,
    })),
  }
}
