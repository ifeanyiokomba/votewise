import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import { listConversations, createConversation, getSupportStats } from '@/lib/ch16a/support-chat'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth) return errorJson('Unauthorized', 401)
  const url = new URL(req.url)
  const org = url.searchParams.get('org')
  const status = url.searchParams.get('status') || undefined
  if (!org) return errorJson('org query param required', 400)
  const [conversations, stats] = await Promise.all([
    listConversations(org, status, 50),
    getSupportStats(org),
  ])
  return json({ conversations, stats })
}

export async function POST(req: NextRequest) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth) return errorJson('Unauthorized', 401)
  const body = await req.json().catch(() => ({}))
  if (!body.organizationId) return errorJson('organizationId required', 400)
  const conv = await createConversation(body)
  return json({ conversation: conv, message: 'Conversation created' })
}
