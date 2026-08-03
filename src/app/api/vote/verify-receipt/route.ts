import { NextRequest } from 'next/server'
import { json } from '@/lib/election'

export const dynamic = 'force-dynamic'

// POST /api/vote/verify-receipt — DEPRECATED.
// This route is retired. The canonical receipt verification endpoints are:
//   - POST /api/receipt/verify (public, no auth)
//   - POST /api/workspace/ballot/receipt (authenticated, org-scoped)
//   - POST /api/v1/voting/receipt (v1 API, public)
//
// This stub exists for backwards compatibility — it proxies to the canonical
// route so old clients don't break, but should not be used for new code.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  // Proxy to the canonical route
  const res = await fetch(new URL('/api/receipt/verify', req.url), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  return json(data, res.status as any)
}
