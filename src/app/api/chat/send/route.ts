import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson, getClientIp, writeAudit, logVoterActivity } from '@/lib/election'
import { randomToken } from '@/lib/crypto'

export const dynamic = 'force-dynamic'

// POST /api/chat/send
// Voter sends a message. Body: { message, attachments?, escalate? }
// - message: text content
// - attachments: array of { type: 'image'|'file', name, dataUrl } (base64)
// - escalate: if true, marks the thread for human response (not just bot)
// Returns the bot reply (LLM) and stores both messages.
export async function POST(req: NextRequest) {
  const token =
    req.headers.get('x-voter-token') ||
    req.headers.get('x-session-token') ||
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return errorJson('No voter session', 401)

  const voter = await db.voter.findUnique({ where: { sessionToken: token }, select: { id: true, matric: true, fullName: true } })
  if (!voter) return errorJson('Voter not found', 401)

  const body = await req.json().catch(() => ({}))
  const message = String(body.message || '').trim()
  const attachments = Array.isArray(body.attachments) ? body.attachments : []
  const escalate = !!body.escalate

  if (!message && attachments.length === 0) return errorJson('Message or attachment required', 400)
  if (message.length > 5000) return errorJson('Message too long', 400)

  // Find or create a thread for this voter
  let threadId = body.threadId
  if (!threadId) {
    const existing = await db.chatMessage.findFirst({ where: { voterId: voter.id }, orderBy: { createdAt: 'desc' } })
    threadId = existing?.threadId || randomToken(8)
  }

  // Store the voter's message
  const voterMsg = await db.chatMessage.create({
    data: {
      voterId: voter.id,
      sender: 'VOTER',
      content: message || '(attachment)',
      attachments: attachments.length > 0 ? JSON.stringify(attachments) : null,
      threadId,
    },
  })

  await logVoterActivity({
    voterId: voter.id,
    action: 'CHAT_MESSAGE',
    details: { threadId, escalated: escalate, hasAttachments: attachments.length > 0 },
    ipAddress: getClientIp(req),
  })

  // If escalated, don't generate a bot reply — wait for human response
  if (escalate) {
    return json({
      ok: true,
      threadId,
      message: voterMsg,
      reply: null,
      escalated: true,
      note: 'Your message has been sent to the electoral committee. An officer will respond shortly.',
    })
  }

  // Generate a bot reply via LLM
  try {
    const history = await db.chatMessage.findMany({
      where: { threadId },
      orderBy: { createdAt: 'asc' },
      take: 8,
      select: { sender: true, content: true },
    })

    const ZAI = (await import('z-ai-web-dev-sdk')).default
    const zai = await ZAI.create()
    const SYSTEM_PROMPT = `You are "AfriBot", the official AI assistant for the AfriVote SUG electronic voting platform at a Nigerian Federal University's Students' Union Government (SUG) election. Help students with voting questions. Be concise, friendly, and culturally appropriate for Nigerian university students. Keep replies under 120 words. If the user wants to speak to a human, suggest they tap "Talk to an Officer".`

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: SYSTEM_PROMPT },
        ...history.map((h) => ({ role: h.sender === 'VOTER' ? 'user' : 'assistant', content: h.content })),
        { role: 'user', content: message || 'I sent an attachment' },
      ],
      thinking: { type: 'disabled' },
    })
    const reply = completion.choices[0]?.message?.content || 'I received your message. How can I help you with the election?'

    const botMsg = await db.chatMessage.create({
      data: {
        voterId: voter.id,
        sender: 'BOT',
        content: reply,
        threadId,
      },
    })

    return json({ ok: true, threadId, message: voterMsg, reply: botMsg, escalated: false })
  } catch (e: any) {
    // If LLM fails, store a fallback message
    const fallback = "I'm having trouble connecting right now. If urgent, tap 'Talk to an Officer' to speak with a human."
    const botMsg = await db.chatMessage.create({
      data: { voterId: voter.id, sender: 'BOT', content: fallback, threadId },
    })
    return json({ ok: true, threadId, message: voterMsg, reply: botMsg, escalated: false })
  }
}
