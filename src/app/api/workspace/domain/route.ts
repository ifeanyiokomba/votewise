import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson, writeAudit, getClientIp } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { getCurrentOfficial } from '@/lib/guards'
import { Cache } from '@/lib/cache'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/workspace/domain — list the org's connected domains.
export async function GET(req: NextRequest) {
  // Auth check — closes the endpoint authentication gap (audit finding)
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth) return errorJson('Unauthorized', 401)
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  const domains = await db.organizationDomain.findMany({
    where: { organizationId: org.id },
    orderBy: { createdAt: 'desc' },
  })
  return json({ domains })
}

// POST /api/workspace/domain — connect a custom domain.
// Body: { domain: "vote.myorg.org" }
// Chapter 2: in this sandbox we cannot do real DNS lookups, so we mark the
// domain as PENDING and provide DNS instructions. A cron/worker would verify
// DNS asynchronously and flip status → VERIFIED. For demo purposes we auto-
// verify after creation.
export async function POST(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  const official = await getCurrentOfficial(req)
  if (!official) return errorJson('Unauthorized', 401)
  if (official.role !== 'SUPER_ADMIN' && official.role !== 'PLATFORM_SUPER_ADMIN' && official.role !== 'ORG_OWNER') {
    return errorJson('Only the organization owner can connect a custom domain', 403)
  }

  const body = await req.json().catch(() => ({}))
  const domain = String(body.domain || '').toLowerCase().trim()
  if (!domain) return errorJson('Domain is required', 400)
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) return errorJson('Invalid domain format', 400)

  // Check uniqueness — no two orgs can share a domain.
  const existing = await db.organizationDomain.findUnique({ where: { domain } })
  if (existing && existing.organizationId !== org.id) {
    return errorJson('This domain is already connected to another organization', 409)
  }

  // DNS verification — in production this would do a real CNAME/A lookup.
  // For Chapter 2 demo, we mark as VERIFIED immediately and provide DNS
  // instructions in the response.
  const rec = await db.organizationDomain.upsert({
    where: { domain },
    create: {
      organizationId: org.id,
      domain,
      isPrimary: body.isPrimary ?? true,
      status: 'VERIFIED', // auto-verify in demo
      dnsVerifiedAt: new Date(),
    },
    update: {
      organizationId: org.id,
      status: 'VERIFIED',
      dnsVerifiedAt: new Date(),
      disconnectedAt: null,
    },
  })

  // Invalidate the domain cache so the next request resolves correctly.
  Cache.del(`org:dom:${domain}`)

  await writeAudit({
    actorId: official.id, actorRole: official.role, actorName: official.name,
    action: 'DOMAIN_CONNECTED',
    details: { organizationId: org.id, domain },
    ip: getClientIp(req),
  }).catch(() => {})

  return json({
    ok: true,
    domain: rec,
    dnsInstructions: `Create a CNAME record pointing ${domain} → cname.votewise.com.ng (or an A record pointing to the VoteWise load balancer IP).`,
  })
}

// DELETE /api/workspace/domain — disconnect a custom domain.
// Body: { domain: "vote.myorg.org" }
export async function DELETE(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  const official = await getCurrentOfficial(req)
  if (!official) return errorJson('Unauthorized', 401)
  if (official.role !== 'SUPER_ADMIN' && official.role !== 'PLATFORM_SUPER_ADMIN' && official.role !== 'ORG_OWNER') {
    return errorJson('Only the organization owner can disconnect a custom domain', 403)
  }

  const body = await req.json().catch(() => ({}))
  const domain = String(body.domain || '').toLowerCase().trim()
  if (!domain) return errorJson('Domain is required', 400)

  await db.organizationDomain.deleteMany({ where: { domain, organizationId: org.id } })
  Cache.del(`org:dom:${domain}`)

  await writeAudit({
    actorId: official.id, actorRole: official.role, actorName: official.name,
    action: 'DOMAIN_DISCONNECTED',
    details: { organizationId: org.id, domain },
    ip: getClientIp(req),
  }).catch(() => {})

  return json({ ok: true })
}
