import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { sha256, randomToken } from '@/lib/crypto'

export const dynamic = 'force-dynamic'

// POST /api/aidp/oauth/register — Register an OAuth application
// Body: { name, redirectUris: [], scopes: [], grantType? }
export async function POST(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error

  const body = await req.json().catch(() => ({}))
  if (!body.name || !body.redirectUris || !Array.isArray(body.redirectUris)) {
    return errorJson('name and redirectUris are required', 400)
  }

  const clientId = `vw_oauth_${randomToken(16)}`
  const clientSecret = randomToken(32)
  const clientSecretHash = sha256(clientSecret)

  const client = await db.oAuthClient.create({
    data: {
      organizationId: orgResult.id,
      name: body.name,
      clientId,
      clientSecretHash,
      redirectUris: JSON.stringify(body.redirectUris),
      scopes: JSON.stringify(body.scopes || []),
      grantType: body.grantType || 'authorization_code',
    },
  })

  return json({
    ok: true,
    client: {
      id: client.id,
      name: client.name,
      clientId,
      clientSecret, // shown only once
      redirectUris: body.redirectUris,
      scopes: body.scopes || [],
      grantType: client.grantType,
    },
  })
}
