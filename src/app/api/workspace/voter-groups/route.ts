import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { getCurrentOfficial } from '@/lib/guards'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/workspace/voter-groups — list all voter groups.
export async function GET(req: NextRequest) {
  // Auth check — closes the endpoint authentication gap (audit finding)
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth) return errorJson('Unauthorized', 401)
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  const groups = await db.voterGroup.findMany({
    where: { organizationId: org.id },
    orderBy: { name: 'asc' },
    include: { _count: { select: { voters: true } } },
  })
  return json({ groups })
}

// POST /api/workspace/voter-groups — create a voter group (static or dynamic).
// Body: { name, code?, description?, workspaceId?, isDynamic?, rules? }
// rules = [{ field: "faculty", operator: "equals", value: "Engineering" }]
export async function POST(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  const official = await getCurrentOfficial(req)
  if (!official) return errorJson('Unauthorized', 401)

  const body = await req.json().catch(() => ({}))
  const { name, code, description, workspaceId, isDynamic, rules } = body
  if (!name) return errorJson('Group name is required', 400)

  const slug = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  const group = await db.voterGroup.create({
    data: {
      organizationId: org.id,
      workspaceId: workspaceId || null,
      name: String(name).trim(),
      slug,
      code: code || null,
      description: description || null,
      isDynamic: !!isDynamic,
      rules: rules ? JSON.stringify(rules) : null,
    },
  }).catch(() => null)

  if (!group) return errorJson('Failed to create group (slug may already exist)', 500)

  // If dynamic, evaluate rules to count matching voters
  if (isDynamic && rules) {
    const count = await evaluateDynamicGroup(org.id, rules)
    await db.voterGroup.update({ where: { id: group.id }, data: { voterCount: count } })
    group.voterCount = count
  }

  return json({ ok: true, group })
}

// Evaluate dynamic group rules against voter metadata.
// rules = [{ field: "faculty", operator: "equals", value: "Engineering" }]
export async function evaluateDynamicGroup(organizationId: string, rules: any[]): Promise<number> {
  const voters = await db.voter.findMany({
    where: { organizationId },
    select: { id: true, metadata: true },
  })

  let count = 0
  for (const voter of voters) {
    if (!voter.metadata) continue
    try {
      const meta = JSON.parse(voter.metadata)
      const matches = rules.every((rule: any) => {
        const val = meta[rule.field]
        if (rule.operator === 'equals') return val === rule.value
        if (rule.operator === 'contains') return String(val || '').includes(rule.value)
        if (rule.operator === 'in') return Array.isArray(rule.value) && rule.value.includes(val)
        if (rule.operator === 'not_equals') return val !== rule.value
        return false
      })
      if (matches) count++
    } catch {}
  }
  return count
}
