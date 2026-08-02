import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import { listHomepageBanners, createHomepageBanner } from '@/lib/domains/portal-customization'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const org = url.searchParams.get('org')
  const activeOnly = url.searchParams.get('active') === 'true'
  if (!org) return errorJson('org query param required', 400)
  return json({ banners: await listHomepageBanners(org, activeOnly) })
}

export async function POST(req: NextRequest) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth) return errorJson('Unauthorized', 401)
  const body = await req.json().catch(() => ({}))
  if (!body.organizationId || !body.title || !body.message) return errorJson('organizationId, title, message required', 400)
  const banner = await createHomepageBanner(body)
  return json({ banner, message: 'Banner created' })
}
