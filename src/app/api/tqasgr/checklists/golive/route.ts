import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import { createGoLiveChecklist, getGoLiveChecklist, getGoLiveSummary } from '@/lib/tqasgr'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth) return errorJson('Unauthorized', 401)
  const url = new URL(req.url)
  const orgId = url.searchParams.get('org')
  const electionId = url.searchParams.get('election') || undefined
  if (!orgId) return errorJson('org query param required', 400)
  const [items, summary] = await Promise.all([
    getGoLiveChecklist(orgId, electionId),
    getGoLiveSummary(orgId, electionId),
  ])
  return json({ items, summary })
}

export async function POST(req: NextRequest) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth) return errorJson('Unauthorized', 401)
  const body = await req.json().catch(() => ({}))
  if (!body.organizationId) return errorJson('organizationId is required', 400)
  const items = await createGoLiveChecklist(body.organizationId, body.electionId)
  return json({ items, message: 'Go-live checklist created' })
}
