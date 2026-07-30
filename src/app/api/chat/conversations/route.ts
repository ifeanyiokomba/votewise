import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json } from '@/lib/election'
import { requireOfficial } from '@/lib/guards'

export const dynamic = 'force-dynamic'

// GET /api/chat/conversations — list all voter conversations for officials.
// Returns the latest message per thread + voter info.
export async function GET(req: NextRequest) {
  const auth = await requireOfficial(req, 'ticket.triage')
  if (auth instanceof Response) return auth

  // Get the latest message per threadId
  const messages = await db.chatMessage.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { voter: { select: { id: true, matric: true, fullName: true, faculty: { select: { name: true } }, department: { select: { name: true } }, level: true } } },
  })
  // Group by threadId, keeping the latest message per thread
  const threadsMap = new Map<string, any>()
  for (const m of messages) {
    if (!threadsMap.has(m.threadId)) {
      const thread = threadsMap.get(m.threadId) || { threadId: m.threadId, voter: m.voter, lastMessage: m, messages: [] }
      thread.lastMessage = m
      thread.voter = m.voter
      threadsMap.set(m.threadId, thread)
    }
  }
  // For each thread, count unread (messages from VOTER with readAt null)
  const threads = Array.from(threadsMap.values())
  for (const t of threads) {
    t.unreadCount = await db.chatMessage.count({
      where: { threadId: t.threadId, sender: 'VOTER', readAt: null },
    })
  }
  return json({ conversations: threads })
}

// POST /api/chat/reply — official replies to a voter conversation.
export async function POST(req: NextRequest) {
  const auth = await requireOfficial(req, 'ticket.triage')
  if (auth instanceof Response) return auth
  const official = (auth as any).official

  const body = await req.json().catch(() => ({}))
  const { threadId, message } = body
  if (!threadId || !message) return json({ error: 'threadId and message are required' }, 400)

  // Find the voter from the thread
  const existing = await db.chatMessage.findFirst({ where: { threadId }, select: { voterId: true } })
  if (!existing?.voterId) return json({ error: 'Conversation not found' }, 404)

  const msg = await db.chatMessage.create({
    data: {
      voterId: existing.voterId,
      officialId: official.id,
      sender: 'OFFICIAL',
      content: String(message),
      threadId,
    },
  })

  // Mark all prior VOTER messages in this thread as read
  await db.chatMessage.updateMany({
    where: { threadId, sender: 'VOTER', readAt: null },
    data: { readAt: new Date() },
  })

  return json({ ok: true, message: msg })
}
