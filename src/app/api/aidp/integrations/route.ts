import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { createIntegration, listIntegrations, getIntegrationHealth } from '@/lib/aidp'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/aidp/integrations — List integrations + health
export async function GET(req: NextRequest) {
  // Auth check — closes the endpoint authentication gap (audit finding)
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth) return errorJson('Unauthorized', 401)
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error

  const [integrations, health] = await Promise.all([
    listIntegrations(orgResult.id),
    getIntegrationHealth(orgResult.id),
  ])

  return json({ integrations, health })
}

// POST /api/aidp/integrations — Create integration
export async function POST(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error

  const body = await req.json().catch(() => ({}))
  if (!body.name || !body.type) return errorJson('name and type are required', 400)

  const integration = await createIntegration(orgResult.id, {
    name: body.name,
    type: body.type,
    provider: body.provider,
    config: body.config,
  })

  return json({ ok: true, integration })
}
