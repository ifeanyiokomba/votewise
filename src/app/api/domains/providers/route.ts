import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import { listProviders, createProvider, getProviderStats, ensureProvidersSeeded } from '@/lib/domains/communication-providers'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth) return errorJson('Unauthorized', 401)
  await ensureProvidersSeeded().catch(() => {})
  const url = new URL(req.url)
  const org = url.searchParams.get('org') || undefined
  const channel = url.searchParams.get('channel') as any || undefined
  const [providers, stats] = await Promise.all([listProviders(org, channel), getProviderStats(org)])
  return json({ providers, stats })
}

export async function POST(req: NextRequest) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth || (auth.role !== 'SUPER_ADMIN' && auth.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }
  const body = await req.json().catch(() => ({}))
  if (!body.channel || !body.providerName || !body.displayName) {
    return errorJson('channel, providerName, displayName required', 400)
  }
  const provider = await createProvider(body)
  return json({ provider, message: 'Provider created' })
}
