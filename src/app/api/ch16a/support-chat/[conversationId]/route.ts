import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import { getConversationMessages, sendMessage, closeConversation } from '@/lib/ch16a/support-chat'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ conversationId: string }> }) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth) return errorJson('Unauthorized', 401)
  const { conversationId } = await params
  const data = await getConversationMessages(conversationId)
  return json(data)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ conversationId: string }> }) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth) return errorJson('Unauthorized', 401)
  const { conversationId } = await params
  const body = await req.json().catch(() => ({}))
  const message = await sendMessage({
    conversationId,
    sender: body.sender || 'OFFICIAL',
    senderId: auth.sub,
    senderName: auth.email,
    content: body.content,
    attachments: body.attachments,
    isInternalNote: body.isInternalNote,
  })
  return json({ message, message_text: 'Message sent' })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ conversationId: string }> }) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth) return errorJson('Unauthorized', 401)
  const { conversationId } = await params
  const body = await req.json().catch(() => ({}))
  if (body.action === 'close') {
    const conv = await closeConversation(conversationId)
    return json({ conversation: conv, message: 'Conversation closed' })
  }
  return errorJson('Unknown action', 400)
}
