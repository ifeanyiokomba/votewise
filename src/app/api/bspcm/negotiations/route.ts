import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { verifyAccessToken } from '@/lib/auth'
import { getCurrentOfficial } from '@/lib/guards'

export const dynamic = 'force-dynamic'

// GET /api/bspcm/negotiations — List negotiations
export async function GET(req: NextRequest) {
  const official = await getCurrentOfficial(req)
  if (!official) return errorJson('Unauthorized', 401)
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error

  const negotiations = await db.negotiation.findMany({
    where: { organizationId: orgResult.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return json({
    negotiations: negotiations.map((n) => ({
      ...n,
      thread: n.thread ? JSON.parse(n.thread) : [],
      createdAt: n.createdAt.toISOString(),
      resolvedAt: n.resolvedAt?.toISOString() || null,
    })),
  })
}

// POST /api/bspcm/negotiations — Request custom pricing
export async function POST(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error

  const body = await req.json().catch(() => ({}))
  if (!body.message) return errorJson('Message is required', 400)

  const auth = verifyAccessToken(req)

  const negotiation = await db.negotiation.create({
    data: {
      organizationId: orgResult.id,
      organizationName: orgResult.name,
      requestType: body.requestType || 'CUSTOM_PRICING',
      message: body.message,
      proposedAmount: body.proposedAmount || null,
      currency: 'NGN',
      voterCount: body.voterCount || null,
      electionCount: body.electionCount || null,
      orgType: body.orgType || null,
      status: 'REQUESTED',
      thread: JSON.stringify([
        { author: auth?.email || orgResult.name, message: body.message, timestamp: new Date().toISOString(), role: 'ORG' },
      ]),
    },
  })

  return json({ ok: true, negotiation })
}
