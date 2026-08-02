import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import { listBotKnowledge, createBotKnowledge, ensureBotKnowledgeSeeded } from '@/lib/domains/bot-knowledge'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth) return errorJson('Unauthorized', 401)
  await ensureBotKnowledgeSeeded().catch(() => {})
  const url = new URL(req.url)
  const org = url.searchParams.get('org') || undefined
  return json({ knowledge: await listBotKnowledge(org) })
}

export async function POST(req: NextRequest) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth) return errorJson('Unauthorized', 401)
  const body = await req.json().catch(() => ({}))
  if (!body.question || !body.answer) return errorJson('question and answer required', 400)
  const item = await createBotKnowledge(body)
  return json({ knowledge: item, message: 'Knowledge entry created' })
}
