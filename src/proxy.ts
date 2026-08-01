import { NextResponse, type NextRequest } from 'next/server'

// VoteWise — Multi-tenant Proxy (Chapter 2)
//
// Resolves the current organization from the request host (subdomain or custom
// domain) and exposes it to downstream API routes + pages via headers:
//   - x-vw-org-id        : the resolved organizationId (or empty)
//   - x-vw-org-subdomain : the resolved subdomain (or empty)
//   - x-vw-org-host      : the original host (for debugging)
//
// In the sandbox, all external traffic is proxied through localhost:3000 by
// the gateway, so subdomains arrive as either:
//   - the `x-forwarded-host` header (set by Caddy), OR
//   - the `?x-vw-org=<subdomain>` query param (for explicit dev/testing).
//
// This middleware is intentionally lightweight — it only resolves + forwards.
// The heavy lifting (DB lookup, caching) happens in `resolveOrganization()`
// inside the API routes, which reads these headers.

export function proxy(req: NextRequest) {
  const host =
    req.headers.get('x-forwarded-host') ||
    req.headers.get('host') ||
    ''

  // Allow explicit org override via query param (sandbox dev / platform admin).
  const orgParam = req.nextUrl.searchParams.get('x-vw-org')
  if (orgParam) {
    const res = NextResponse.next()
    res.headers.set('x-vw-org', orgParam.toLowerCase())
    res.headers.set('x-vw-org-host', host)
    return res
  }

  // Otherwise, forward the host so resolveOrganization() can parse the subdomain.
  const res = NextResponse.next()
  if (host) {
    res.headers.set('x-vw-org-host', host)
  }
  return res
}

export const config = {
  // Run on all routes except static assets.
  matcher: ['/((?!_next/static|_next/image|favicon.png|logo-votewise.png|hero-platform.png|robots.txt).*)'],
}
