import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { generateQuote, getQuotes } from '@/lib/bspcm'
import { getCurrentOfficial } from '@/lib/guards'

export const dynamic = 'force-dynamic'

// GET /api/bspcm/quotes — List quotes for org
export async function GET(req: NextRequest) {
  // Auth check — closes the endpoint authentication gap (audit finding)
  const official = await getCurrentOfficial(req)
  if (!official) return errorJson('Unauthorized', 401)
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const quotes = await getQuotes(orgResult.id)
  return json({ quotes })
}

// POST /api/bspcm/quotes — Generate a quote
export async function POST(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error

  const body = await req.json().catch(() => ({}))
  try {
    const quote = await generateQuote({
      organizationId: orgResult.id,
      organizationName: orgResult.name,
      estimatedVoters: body.estimatedVoters,
      estimatedElections: body.estimatedElections,
      requestedFeatures: body.requestedFeatures,
      planName: body.planName,
      couponCode: body.couponCode,
      notes: body.notes,
    })
    return json({ ok: true, quote })
  } catch (e: any) {
    return errorJson(e.message || 'Failed to generate quote', 500)
  }
}
