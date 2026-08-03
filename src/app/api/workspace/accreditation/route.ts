import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson, writeAudit, getClientIp } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { getCurrentOfficial } from '@/lib/guards'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/workspace/accreditation — accreditation dashboard.
// Returns summary stats (eligible, accredited, pending, rejected) + rules.
export async function GET(req: NextRequest) {
  // Auth check — closes the endpoint authentication gap (audit finding)
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth) return errorJson('Unauthorized', 401)
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  const electionId = new URL(req.url).searchParams.get('electionId')

  // Count voters by verification/accreditation status
  const where: any = { organizationId: org.id }
  if (electionId) where.electionSessionId = electionId

  const [total, verified, pending, suspended] = await Promise.all([
    db.voter.count({ where }),
    db.voter.count({ where: { ...where, verificationStatus: 'VERIFIED' } }),
    db.voter.count({ where: { ...where, verificationStatus: 'PENDING' } }),
    db.voter.count({ where: { ...where, status: 'SUSPENDED' } }),
  ])

  // Fetch accreditation rules
  const rules = await db.accreditationRule.findMany({
    where: { organizationId: org.id, ...(electionId ? { electionId } : {}) },
    orderBy: { createdAt: 'desc' },
  })

  return json({
    stats: {
      eligible: total,
      accredited: verified,
      pending,
      rejected: suspended,
    },
    rules,
  })
}

// POST /api/workspace/accreditation — create an accreditation rule.
// Body: { name, description?, rules, method, electionId?, workspaceId? }
export async function POST(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  const official = await getCurrentOfficial(req)
  if (!official) return errorJson('Unauthorized', 401)

  const body = await req.json().catch(() => ({}))
  const { name, description, rules, method, electionId, workspaceId } = body
  if (!name || !rules) return errorJson('Name and rules are required', 400)

  const rule = await db.accreditationRule.create({
    data: {
      organizationId: org.id,
      electionId: electionId || null,
      workspaceId: workspaceId || null,
      name: String(name).trim(),
      description: description || null,
      rules: typeof rules === 'string' ? rules : JSON.stringify(rules),
      method: method || 'automatic',
    },
  })

  await writeAudit({
    actorId: official.id, actorRole: official.role, actorName: official.name,
    action: 'ACCREDITATION_RULE_CREATED',
    details: { organizationId: org.id, ruleId: rule.id, name },
    ip: getClientIp(req),
  }).catch(() => {})

  return json({ ok: true, rule })
}
