import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import { updateBotKnowledge, deleteBotKnowledge } from '@/lib/domains/bot-knowledge'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth) return errorJson('Unauthorized', 401)
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const item = await updateBotKnowledge(id, body)
  return json({ knowledge: item, message: 'Knowledge entry updated' })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth) return errorJson('Unauthorized', 401)
  const { id } = await params
  await deleteBotKnowledge(id)
  return json({ message: 'Knowledge entry deleted' })
}
