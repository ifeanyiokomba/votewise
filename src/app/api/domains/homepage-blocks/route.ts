import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import { listHomepageBlocks, createHomepageBlock } from '@/lib/domains/portal-customization'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const org = url.searchParams.get('org')
  if (!org) return errorJson('org query param required', 400)
  return json({ blocks: await listHomepageBlocks(org) })
}

export async function POST(req: NextRequest) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth) return errorJson('Unauthorized', 401)
  const body = await req.json().catch(() => ({}))
  if (!body.organizationId || !body.blockType) return errorJson('organizationId and blockType required', 400)
  const block = await createHomepageBlock(body)
  return json({ block, message: 'Homepage block created' })
}
