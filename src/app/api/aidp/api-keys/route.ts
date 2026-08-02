import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { createApiKey, listApiKeys } from '@/lib/aidp'
import { verifyAccessToken } from '@/lib/auth'
import { SCOPES } from '@/lib/aidp/types'

export const dynamic = 'force-dynamic'

// GET /api/aidp/api-keys — List API keys
export async function GET(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const keys = await listApiKeys(orgResult.id)
  return json({ keys })
}

// POST /api/aidp/api-keys — Create API key
export async function POST(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error

  const body = await req.json().catch(() => ({}))
  if (!body.name || !body.scopes || !Array.isArray(body.scopes)) {
    return errorJson('name and scopes are required', 400)
  }

  // Validate scopes
  const validScopes = body.scopes.filter((s: string) => SCOPES.includes(s as any))
  if (validScopes.length === 0) return errorJson('No valid scopes provided', 400)

  const auth = verifyAccessToken(req)
  const key = await createApiKey(orgResult.id, {
    name: body.name,
    scopes: validScopes,
    environment: body.environment,
    expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
  }, auth?.sub, auth?.email)

  return json({ ok: true, key })
}
