import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import { listCustomDomains, addCustomDomain, getDomainStats } from '@/lib/pihed'

export const dynamic = 'force-dynamic'

// GET /api/pihed/domains — List custom domains + stats
// Query: ?org=<organizationId>  →  filter by org
// Platform admin only.
export async function GET(req: NextRequest) {
  const auth = await verifyAccessToken(readAccessToken(req))
  if (!auth || (auth.role !== 'SUPER_ADMIN' && auth.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }

  const url = new URL(req.url)
  const orgId = url.searchParams.get('org') || undefined

  const [domains, stats] = await Promise.all([
    listCustomDomains(orgId),
    getDomainStats(),
  ])

  return json({ domains, stats })
}

// POST /api/pihed/domains — Register a new custom domain
// Body: { organizationId, domain, type?: 'subdomain'|'apex'|'wildcard', primary?: boolean }
export async function POST(req: NextRequest) {
  const auth = await verifyAccessToken(readAccessToken(req))
  if (!auth || (auth.role !== 'SUPER_ADMIN' && auth.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }

  const body = await req.json().catch(() => ({}))
  if (!body.organizationId || !body.domain) {
    return errorJson('organizationId and domain are required', 400)
  }

  // Basic domain format validation
  const domainRegex = /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i
  if (!domainRegex.test(String(body.domain))) {
    return errorJson('Invalid domain format', 400)
  }

  try {
    const record = await addCustomDomain(
      body.organizationId,
      String(body.domain).toLowerCase(),
      body.type || 'subdomain',
      Boolean(body.primary),
    )
    return json({ domain: record, message: 'Domain registered — add the TXT record to verify' })
  } catch (e: any) {
    return errorJson(e.message || 'Failed to register domain', 400)
  }
}
