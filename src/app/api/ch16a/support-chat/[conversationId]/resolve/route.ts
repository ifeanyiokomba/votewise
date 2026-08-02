import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import { resolveConversation } from '@/lib/ch16a/support-chat'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ conversationId: string }> }) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth) return errorJson('Unauthorized', 401)
  const { conversationId } = await params
  try {
    const conv = await resolveConversation(conversationId, auth.sub, auth.email)
    return json({ conversation: conv, message: 'Conversation resolved' })
  } catch (e: any) {
    return errorJson(e.message || 'Failed', 400)
  }
}
