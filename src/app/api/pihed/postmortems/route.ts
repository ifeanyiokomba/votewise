import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import { listPostmortems, createPostmortem, getPostmortemStats, ensurePostmortemSeeded } from '@/lib/infra/postmortem'

export const dynamic = 'force-dynamic'

// GET /api/pihed/postmortems — list postmortems + stats
// Query: ?status=draft|published|archived&limit=30
// Platform admin only.
export async function GET(req: NextRequest) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth || (auth.role !== 'SUPER_ADMIN' && auth.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }

  await ensurePostmortemSeeded().catch(() => {})

  const url = new URL(req.url)
  const status = url.searchParams.get('status') || undefined
  const limit = Math.min(100, Number(url.searchParams.get('limit')) || 30)

  const [postmortems, stats] = await Promise.all([
    listPostmortems(limit, status),
    getPostmortemStats(),
  ])

  return json({ postmortems, stats })
}

// POST /api/pihed/postmortems — create a new postmortem
export async function POST(req: NextRequest) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth || (auth.role !== 'SUPER_ADMIN' && auth.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }

  const body = await req.json().catch(() => ({}))
  if (!body.title || !body.summary || !body.rootCause) {
    return errorJson('title, summary, and rootCause are required', 400)
  }

  try {
    const pm = await createPostmortem(body, { id: auth.sub, name: auth.email })
    return json({ postmortem: pm, message: 'Postmortem created' })
  } catch (e: any) {
    return errorJson(e.message || 'Failed to create postmortem', 400)
  }
}
