import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { verifyAccessToken } from '@/lib/auth'
import { getCurrentOfficial } from '@/lib/guards'

export const dynamic = 'force-dynamic'

const DEFAULTS = {
  voteRecordsDays: 2555,
  auditLogsDays: 2555,
  integrityEventsDays: 365,
  incidentsDays: 2555,
  messagesDays: 90,
  supportTicketsDays: 365,
  notificationsDays: 90,
  archiveAfterDays: true,
  autoDeleteEnabled: false,
}

// GET /api/raei/data-retention — Get the org's data retention policy
export async function GET(req: NextRequest) {
  const official = await getCurrentOfficial(req)
  if (!official) return errorJson('Unauthorized', 401)
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error

  let policy = await db.dataRetentionPolicy.findUnique({
    where: { organizationId: orgResult.id },
  })

  // Create default policy if it doesn't exist
  if (!policy) {
    policy = await db.dataRetentionPolicy.create({
      data: { organizationId: orgResult.id, ...DEFAULTS },
    })
  }

  return json({
    ...policy,
    lastPolicyReview: policy.lastPolicyReview?.toISOString() || null,
    createdAt: policy.createdAt.toISOString(),
    updatedAt: policy.updatedAt.toISOString(),
  })
}

// PATCH /api/raei/data-retention — Update the data retention policy
export async function PATCH(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error

  const body = await req.json().catch(() => ({}))
  const auth = verifyAccessToken(req)

  // Ensure policy exists
  let policy = await db.dataRetentionPolicy.findUnique({
    where: { organizationId: orgResult.id },
  })
  if (!policy) {
    policy = await db.dataRetentionPolicy.create({
      data: { organizationId: orgResult.id, ...DEFAULTS },
    })
  }

  // Update fields
  const data: any = { lastPolicyReview: new Date() }
  const intFields = ['voteRecordsDays', 'auditLogsDays', 'integrityEventsDays', 'incidentsDays', 'messagesDays', 'supportTicketsDays', 'notificationsDays']
  for (const f of intFields) {
    if (body[f] !== undefined) data[f] = Math.max(0, parseInt(body[f]) || 0)
  }
  if (body.archiveAfterDays !== undefined) data.archiveAfterDays = !!body.archiveAfterDays
  if (body.autoDeleteEnabled !== undefined) data.autoDeleteEnabled = !!body.autoDeleteEnabled
  if (auth) {
    data.createdById = auth.sub
    data.createdByName = auth.email
  }

  const updated = await db.dataRetentionPolicy.update({
    where: { organizationId: orgResult.id },
    data,
  })

  return json({
    ...updated,
    lastPolicyReview: updated.lastPolicyReview?.toISOString() || null,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  })
}
