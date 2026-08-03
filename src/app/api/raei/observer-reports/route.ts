import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { verifyAccessToken } from '@/lib/auth'
import { getCurrentOfficial } from '@/lib/guards'

export const dynamic = 'force-dynamic'

// GET /api/raei/observer-reports?electionId=...
export async function GET(req: NextRequest) {
  const official = await getCurrentOfficial(req)
  if (!official) return errorJson('Unauthorized', 401)
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error

  const electionId = new URL(req.url).searchParams.get('electionId') || undefined

  const reports = await db.observerReport.findMany({
    where: {
      organizationId: orgResult.id,
      ...(electionId ? { electionId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  return json({
    reports: reports.map((r) => ({
      ...r,
      evidence: r.evidence ? JSON.parse(r.evidence) : [],
      attachments: r.attachments ? JSON.parse(r.attachments) : [],
      createdAt: r.createdAt.toISOString(),
      reviewedAt: r.reviewedAt?.toISOString() || null,
    })),
  })
}

// POST /api/raei/observer-reports — Submit an observer report
export async function POST(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error

  const body = await req.json().catch(() => ({}))
  if (!body.observation) return errorJson('Observation is required', 400)

  const auth = verifyAccessToken(req)

  const report = await db.observerReport.create({
    data: {
      organizationId: orgResult.id,
      electionId: body.electionId || null,
      observerId: auth?.sub,
      observerName: auth?.email || body.observerName || 'Observer',
      observation: body.observation,
      severity: body.severity || 'INFO',
      evidence: body.evidence ? JSON.stringify(body.evidence) : null,
      recommendation: body.recommendation || null,
      attachments: body.attachments ? JSON.stringify(body.attachments) : null,
    },
  })

  return json({ ok: true, report })
}
