import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson, writeAudit, getClientIp } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { getCurrentOfficial } from '@/lib/guards'
import { validateRuleSet, type Rule } from '@/lib/rule-engine'

export const dynamic = 'force-dynamic'

// GET /api/workspace/rules?electionId=xxx — list rule sets + rules for an election.
export async function GET(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult
  const electionId = new URL(req.url).searchParams.get('electionId')

  const ruleSets = await db.ruleSet.findMany({
    where: { organizationId: org.id, ...(electionId ? { electionId } : {}) },
    orderBy: { createdAt: 'desc' },
    include: { rules: { orderBy: { priority: 'desc' } } },
  })

  return json({ ruleSets })
}

// POST /api/workspace/rules — create a rule set with rules.
export async function POST(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  const official = await getCurrentOfficial(req)
  if (!official) return errorJson('Unauthorized', 401)

  const body = await req.json().catch(() => ({}))
  const { name, electionId, rules } = body
  if (!name) return errorJson('Rule set name is required', 400)

  // Validate rules for conflicts
  const validation = validateRuleSet(rules || [])
  if (!validation.valid) {
    return errorJson('Rule validation failed', 400, { issues: validation.issues })
  }

  const ruleSet = await db.ruleSet.create({
    data: {
      organizationId: org.id,
      electionId: electionId || null,
      name: String(name).trim(),
      createdBy: official.id,
      rules: {
        create: (rules || []).map((r: any) => ({
          organizationId: org.id,
          electionId: electionId || null,
          name: r.name,
          description: r.description || null,
          category: r.category,
          conditions: typeof r.conditions === 'string' ? r.conditions : JSON.stringify(r.conditions),
          action: r.action,
          actionParams: r.actionParams ? JSON.stringify(r.actionParams) : null,
          priority: r.priority || 0,
          enabled: r.enabled !== false,
        })),
      },
    },
    include: { rules: true },
  })

  await writeAudit({
    actorId: official.id, actorRole: official.role, actorName: official.name,
    action: 'RULE_SET_CREATED',
    details: { organizationId: org.id, ruleSetId: ruleSet.id, name, ruleCount: rules?.length || 0 },
    ip: getClientIp(req),
  }).catch(() => {})

  return json({ ok: true, ruleSet })
}
