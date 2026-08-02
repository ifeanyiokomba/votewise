import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson } from '@/lib/election'
import { randomToken } from '@/lib/crypto'

export const dynamic = 'force-dynamic'

// GET /api/aidp/oauth/authorize?client_id=...&redirect_uri=...&response_type=code&scope=...&state=...
// OAuth 2.0 authorization endpoint — returns an authorization code
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get('client_id')
  const redirectUri = searchParams.get('redirect_uri')
  const responseType = searchParams.get('response_type')
  const scope = searchParams.get('scope')
  const state = searchParams.get('state')

  if (!clientId || !redirectUri || !responseType) {
    return errorJson('client_id, redirect_uri, and response_type are required', 400)
  }

  if (responseType !== 'code') {
    return errorJson('Only response_type=code is supported', 400)
  }

  // Look up the OAuth client
  const client = await db.oAuthClient.findUnique({
    where: { clientId },
  })
  if (!client || !client.isActive) {
    return errorJson('Invalid client', 401)
  }

  // Verify redirect URI
  const allowedUris: string[] = JSON.parse(client.redirectUris)
  if (!allowedUris.includes(redirectUri)) {
    return errorJson('redirect_uri not allowed', 400)
  }

  // In production: show a consent screen here.
  // For the API, we generate the code directly.
  const code = randomToken(32)

  // In production: store the code with expiry, associate with client + scopes.
  // For now, redirect with the code.
  const redirectUrl = new URL(redirectUri)
  redirectUrl.searchParams.set('code', code)
  if (state) redirectUrl.searchParams.set('state', state)

  return json({
    ok: true,
    code,
    redirect_uri: redirectUrl.toString(),
    scope: scope || JSON.parse(client.scopes).join(' '),
    message: 'In production, this would redirect to the consent screen. For API testing, use the code with /api/aidp/oauth/token.',
  })
}
