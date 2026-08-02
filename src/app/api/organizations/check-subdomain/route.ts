import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson } from '@/lib/election'

export const dynamic = 'force-dynamic'

// GET /api/organizations/check-subdomain?sub=marketunion
// Returns availability + suggestions if taken. Used in Step 4 of registration.
export async function GET(req: NextRequest) {
  const sub = req.nextUrl.searchParams.get('sub')?.toLowerCase().trim() || ''
  if (!sub) return errorJson('Subdomain is required', 400)
  if (!/^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(sub)) {
    return errorJson('Subdomain must be 3-30 chars, lowercase letters, numbers, hyphens only', 400)
  }

  const existing = await db.organization.findUnique({ where: { subdomain: sub } })
  if (!existing) {
    return json({ available: true, subdomain: sub, url: `${sub}.votewise.com.ng` })
  }

  // Generate suggestions.
  const suggestions = [
    `${sub}-ng`,
    `${sub}01`,
    `${sub}hq`,
    `${sub}official`,
    `${sub}-${Math.random().toString(36).slice(2, 5)}`,
  ].filter((s) => s.length <= 30)

  // Filter out taken suggestions.
  const taken = await db.organization.findMany({
    where: { subdomain: { in: suggestions } },
    select: { subdomain: true },
  })
  const takenSet = new Set(taken.map((t) => t.subdomain))
  const availableSuggestions = suggestions.filter((s) => !takenSet.has(s))

  return json({
    available: false,
    subdomain: sub,
    message: `${sub}.votewise.com.ng is already taken`,
    suggestions: availableSuggestions.map((s) => ({ subdomain: s, url: `${s}.votewise.com.ng` })),
  })
}
