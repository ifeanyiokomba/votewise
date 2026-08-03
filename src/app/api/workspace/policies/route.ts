import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { BUILTIN_POLICIES } from '@/lib/rule-engine'
import { getCurrentOfficial } from '@/lib/guards'

export const dynamic = 'force-dynamic'

// GET /api/workspace/policies — list policy library (built-in + org-specific).
export async function GET(req: NextRequest) {
  // Auth check — closes the endpoint authentication gap (audit finding)
  const official = await getCurrentOfficial(req)
  if (!official) return errorJson('Unauthorized', 401)
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  const orgPolicies = await db.policyLibrary.findMany({
    where: { organizationId: org.id },
    orderBy: { createdAt: 'desc' },
  })

  // Merge built-in policies (from code) with org policies (from DB)
  const builtIn = BUILTIN_POLICIES.map((p) => ({
    id: `builtin-${p.category.toLowerCase()}`,
    name: p.name,
    description: p.description,
    category: p.category,
    isBuiltIn: true,
    policy: p.policy,
  }))

  return json({ policies: [...builtIn, ...orgPolicies] })
}

// POST /api/workspace/policies — save a custom policy.
export async function POST(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  const body = await req.json().catch(() => ({}))
  const { name, description, category, policy } = body
  if (!name || !policy) return errorJson('Name and policy are required', 400)

  const saved = await db.policyLibrary.create({
    data: {
      organizationId: org.id,
      name: String(name).trim(),
      description: description || null,
      category: category || 'CUSTOM',
      isBuiltIn: false,
      policy: typeof policy === 'string' ? policy : JSON.stringify(policy),
    },
  })

  return json({ ok: true, policy: saved })
}
