import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson } from '@/lib/election'
import { sha256, randomToken } from '@/lib/crypto'
import { signAccessToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// POST /api/aidp/oauth/token — Exchange authorization code or client credentials for access token
// Body: { grant_type: 'client_credentials', client_id, client_secret }
//    OR { grant_type: 'authorization_code', client_id, client_secret, code, redirect_uri }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))

  if (!body.grant_type || !body.client_id || !body.client_secret) {
    return errorJson('grant_type, client_id, and client_secret are required', 400)
  }

  // Look up the OAuth client
  const client = await db.oAuthClient.findUnique({
    where: { clientId: body.client_id },
  })
  if (!client || !client.isActive) {
    return errorJson('Invalid client', 401)
  }

  // Verify client secret
  const secretHash = sha256(body.client_secret)
  if (secretHash !== client.clientSecretHash) {
    return errorJson('Invalid client secret', 401)
  }

  if (body.grant_type === 'client_credentials') {
    // Issue a JWT access token for the organization
    const token = await signAccessToken({
      sub: `oauth_${client.id}`,
      role: 'OAUTH_CLIENT',
      name: client.name,
      email: `oauth@${client.organizationId}`,
    })

    return json({
      access_token: token,
      token_type: 'Bearer',
      expires_in: 3600,
      scope: JSON.parse(client.scopes).join(' '),
    })
  }

  if (body.grant_type === 'authorization_code') {
    // In production: validate the authorization code, check redirect_uri, etc.
    // For now, return a token if the client is valid
    if (!body.code) return errorJson('authorization code is required', 400)

    const token = await signAccessToken({
      sub: `oauth_${client.id}`,
      role: 'OAUTH_CLIENT',
      name: client.name,
      email: `oauth@${client.organizationId}`,
    })

    return json({
      access_token: token,
      token_type: 'Bearer',
      expires_in: 3600,
      scope: JSON.parse(client.scopes).join(' '),
    })
  }

  return errorJson(`Unsupported grant_type: ${body.grant_type}`, 400)
}
