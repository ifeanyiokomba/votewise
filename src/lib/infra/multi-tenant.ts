// VoteWise — Subdomain-based Multi-Tenant Routing (Chapter 17 — Multi-Tenant Routing)
//
// Spec: "Every organization gets: mouau.verifyvotes.com, unilag.verifyvotes.com,
// company.verifyvotes.com. Routing automatically identifies the organization
// and loads the correct workspace."
//
// This module resolves the organization from the request's Host header.
// Order of precedence:
//   1. Custom domain (vote.university.edu.ng → CustomDomain row)
//   2. Subdomain on the shared verify domain (mouau.verifyvotes.com → org subdomain)
//   3. Subdomain on the main domain (org.votewise.com.ng → org subdomain)
//   4. x-vw-org header / ?x-vw-org query (explicit override, for API clients)
//   5. x-vw-org cookie (persists across page navigations)

import { NextRequest } from 'next/server'
import { db } from '@/lib/db'

const SHARED_VERIFY_DOMAIN = 'verifyvotes.com'
const MAIN_DOMAIN = 'votewise.com.ng'

export interface OrgResolution {
  organizationId: string | null
  subdomain: string | null
  source: 'custom-domain' | 'shared-subdomain' | 'main-subdomain' | 'header' | 'query' | 'cookie' | 'none'
  domain: string | null
}

/**
 * Resolve the organization from the request. Does NOT throw — returns
 * { organizationId: null } if no org could be resolved.
 */
export async function resolveOrgFromRequest(req: NextRequest): Promise<OrgResolution> {
  const host = req.headers.get('host') || ''
  const cleanHost = host.split(':')[0].toLowerCase()  // strip port

  // 4. Explicit header override (API clients)
  const headerOrg = req.headers.get('x-vw-org')
  if (headerOrg) {
    return { organizationId: null, subdomain: headerOrg, source: 'header', domain: cleanHost || null }
  }

  // 5. Query string override (?x-vw-org=)
  const queryOrg = req.nextUrl.searchParams.get('x-vw-org')
  if (queryOrg) {
    return { organizationId: null, subdomain: queryOrg, source: 'query', domain: cleanHost || null }
  }

  // Skip localhost / IP addresses (dev environment)
  if (cleanHost === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(cleanHost) || cleanHost === '') {
    return { organizationId: null, subdomain: null, source: 'none', domain: cleanHost || null }
  }

  // 1. Check if this is a custom domain (vote.university.edu.ng)
  const customDomain = await db.customDomain.findUnique({
    where: { domain: cleanHost },
    select: { organizationId: true, status: true },
  }).catch(() => null)

  if (customDomain?.status === 'ACTIVE') {
    return {
      organizationId: customDomain.organizationId,
      subdomain: null,
      source: 'custom-domain',
      domain: cleanHost,
    }
  }

  // 2. Subdomain on the shared verify domain (mouau.verifyvotes.com)
  if (cleanHost.endsWith(`.${SHARED_VERIFY_DOMAIN}`)) {
    const sub = cleanHost.slice(0, -(`.${SHARED_VERIFY_DOMAIN}`).length)
    if (sub && !sub.includes('.')) {  // single-label subdomain
      return {
        organizationId: await orgIdFromSubdomain(sub),
        subdomain: sub,
        source: 'shared-subdomain',
        domain: cleanHost,
      }
    }
  }

  // 3. Subdomain on the main domain (org.votewise.com.ng)
  if (cleanHost.endsWith(`.${MAIN_DOMAIN}`)) {
    const sub = cleanHost.slice(0, -(`.${MAIN_DOMAIN}`).length)
    if (sub && !sub.includes('.') && sub !== 'www' && sub !== 'staging' && sub !== 'api') {
      return {
        organizationId: await orgIdFromSubdomain(sub),
        subdomain: sub,
        source: 'main-subdomain',
        domain: cleanHost,
      }
    }
  }

  // 5. Cookie (last resort for SPA navigations)
  const cookieOrg = req.cookies.get('vw-org')?.value
  if (cookieOrg) {
    return { organizationId: null, subdomain: cookieOrg, source: 'cookie', domain: cleanHost || null }
  }

  return { organizationId: null, subdomain: null, source: 'none', domain: cleanHost || null }
}

async function orgIdFromSubdomain(subdomain: string): Promise<string | null> {
  const org = await db.organization.findUnique({
    where: { subdomain },
    select: { id: true },
  }).catch(() => null)
  return org?.id || null
}

/**
 * Get the list of all organization domains (for the multi-tenant routing
 * info display in the admin console).
 */
export async function listOrgDomains() {
  const [customDomains, orgSubdomains] = await Promise.all([
    db.customDomain.findMany({
      where: { status: 'ACTIVE' },
      select: { domain: true, organizationId: true },
      take: 200,
    }),
    db.organization.findMany({
      where: { subdomain: { not: null } },
      select: { id: true, name: true, subdomain: true },
      take: 200,
    }),
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
