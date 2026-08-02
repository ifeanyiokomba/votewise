// VoteWise — Chapter 16A: Support Chat System
//
// Spec: "Build a collaborative support chat with intelligent assignment,
// automatic reassignment, SLA monitoring, internal notes, and escalation
// workflows."

import { db } from '@/lib/db'
import { logger } from '@/lib/infra/logger'

export type ConversationStatus =
  | 'NEW' | 'ASSIGNED' | 'WAITING_VOTER' | 'WAITING_STAFF'
  | 'ESCALATED' | 'RESOLVED' | 'CLOSED'

export type EscalationLevel = 0 | 1 | 2 | 3 // org admin → observer → votewise → platform

const SLA_MINUTES = {
  URGENT: 5,
  HIGH: 15,
  NORMAL: 30,
  LOW: 60,
}

// ---------------------------------------------------------------------------
// 1. Create a conversation (voter opens chat)
// ---------------------------------------------------------------------------

export async function createConversation(input: {
  organizationId: string
  electionId?: string
  voterId?: string
  voterName?: string
  voterIdentifier?: string
  subject?: string
  category?: string
  priority?: string
}): Promise<any> {
  const priority = input.priority || 'NORMAL'
  const slaDeadline = new Date(Date.now() + (SLA_MINUTES as any)[priority] * 60 * 1000)

  return db.supportConversation.create({
    data: {
      ...input,
      status: 'NEW',
      priority,
      slaDeadline,
      lastMessageAt: new Date(),
    },
  })
}

// ---------------------------------------------------------------------------
// 2. Send a message in a conversation
// ---------------------------------------------------------------------------

export async function sendMessage(input: {
  conversationId: string
  sender: 'VOTER' | 'BOT' | 'OFFICIAL'
  senderId?: string
  senderName?: string
  content: string
  attachments?: Array<{ type: string; name: string; dataUrl: string }>
  isInternalNote?: boolean
}): Promise<any> {
  const conv = await db.supportConversation.findUnique({
    where: { id: input.conversationId },
  })
  if (!conv) throw new Error('Conversation not found')

  // If it's an internal note, store it in StaffNote instead
  if (input.isInternalNote && input.sender === 'OFFICIAL') {
    return db.staffNote.create({
      data: {
        conversationId: input.conversationId,
        authorId: input.senderId || '',
        authorName: input.senderName || 'Staff',
        authorRole: 'ADMIN',
        content: input.content,
      },
    })
  }

  // Store the message in ChatMessage (existing model)
  const message = await db.chatMessage.create({
    data: {
      voterId: conv.voterId,
      officialId: input.sender === 'OFFICIAL' ? input.senderId : null,
      sender: input.sender,
      content: input.content,
      attachments: input.attachments ? JSON.stringify(input.attachments) : null,
      threadId: input.conversationId,
    },
  })

  // Update the conversation
  const updates: any = {
    lastMessageAt: new Date(),
    lastMessagePreview: input.content.slice(0, 100),
    updatedAt: new Date(),
  }

  // If voter sends a message on an assigned conversation, mark WAITING_STAFF
  if (input.sender === 'VOTER' && conv.status === 'WAITING_VOTER') {
    updates.status = 'WAITING_STAFF'
  }
  // If staff sends a message, mark WAITING_VOTER
  if (input.sender === 'OFFICIAL' && conv.status === 'WAITING_STAFF') {
    updates.status = 'WAITING_VOTER'
  }
  // If it was NEW, mark as ASSIGNED (first message from staff)
  if (input.sender === 'OFFICIAL' && conv.status === 'NEW') {
    updates.status = 'ASSIGNED'
  }

  // Increment unread if voter sends and conversation is assigned to someone else
  if (input.sender === 'VOTER') {
    updates.unreadCount = { increment: 1 }
  }

  await db.supportConversation.update({
    where: { id: input.conversationId },
    data: updates,
  })

  return message
}

// ---------------------------------------------------------------------------
// 3. Take (assign) a conversation
// ---------------------------------------------------------------------------

export async function takeConversation(conversationId: string, staffId: string, staffName: string): Promise<any> {
  const conv = await db.supportConversation.findUnique({ where: { id: conversationId } })
  if (!conv) throw new Error('Conversation not found')
  if (conv.assignedToId && conv.assignedToId !== staffId) {
    throw new Error('Conversation is already assigned to another staff member')
  }

  return db.supportConversation.update({
    where: { id: conversationId },
    data: {
      assignedToId: staffId,
      assignedToName: staffName,
      assignedAt: new Date(),
      status: 'ASSIGNED',
      unreadCount: 0,
    },
  })
}

// ---------------------------------------------------------------------------
// 4. Release a conversation (unassign)
// ---------------------------------------------------------------------------

export async function releaseConversation(conversationId: string): Promise<any> {
  return db.supportConversation.update({
    where: { id: conversationId },
    data: {
      assignedToId: null,
      assignedToName: null,
      assignedAt: null,
      status: 'NEW',
    },
  })
}

// ---------------------------------------------------------------------------
// 5. Escalate a conversation
// ---------------------------------------------------------------------------

export async function escalateConversation(conversationId: string, escalatedBy: string, reason?: string): Promise<any> {
  const conv = await db.supportConversation.findUnique({ where: { id: conversationId } })
  if (!conv) throw new Error('Conversation not found')

  const nextLevel = Math.min(3, conv.escalationLevel + 1)
  const levelLabels = ['Organization Admin', 'Observer', 'VoteWise Support', 'Platform Administrator']

  logger.audit(`Conversation escalated to level ${nextLevel} (${levelLabels[nextLevel]})`, {
    category: 'audit',
    service: 'app',
    metadata: { conversationId, escalatedBy, reason },
  })

  return db.supportConversation.update({
    where: { id: conversationId },
    data: {
      escalationLevel: nextLevel,
      status: 'ESCALATED',
      priority: nextLevel >= 2 ? 'URGENT' : 'HIGH',
      // Reset assignment so the next tier can pick it up
      assignedToId: null,
      assignedToName: null,
      assignedAt: null,
    },
  })
}

// ---------------------------------------------------------------------------
// 6. Resolve + close
// ---------------------------------------------------------------------------

export async function resolveConversation(conversationId: string, resolvedBy: string, resolution: string): Promise<any> {
  return db.supportConversation.update({
    where: { id: conversationId },
    data: {
      status: 'RESOLVED',
      resolvedAt: new Date(),
      resolvedBy,
      resolution,
    },
  })
}

export async function closeConversation(conversationId: string): Promise<any> {
  return db.supportConversation.update({
    where: { id: conversationId },
    data: { status: 'CLOSED' },
  })
}

// ---------------------------------------------------------------------------
// 7. Automatic SLA breach detection + reassignment
// ---------------------------------------------------------------------------

export async function checkSlaBreaches() {
  const now = new Date()
  const breached = await db.supportConversation.findMany({
    where: {
      status: { in: ['NEW', 'ASSIGNED', 'WAITING_STAFF'] },
      slaDeadline: { lt: now },
      slaBreached: false,
    },
  })

  for (const conv of breached) {
    await db.supportConversation.update({
      where: { id: conv.id },
      data: { slaBreached: true },
    })
    logger.warn(`SLA breached for conversation ${conv.id}`, {
      category: 'infrastructure',
      service: 'app',
      metadata: { conversationId: conv.id, slaDeadline: conv.slaDeadline },
    })
  }

  // Auto-release conversations where the assigned staff hasn't responded in SLA
  const stale = await db.supportConversation.findMany({
    where: {
      status: 'WAITING_STAFF',
      assignedToId: { not: null },
      slaDeadline: { lt: now },
    },
  })

  for (const conv of stale) {
    await releaseConversation(conv.id)
    logger.audit(`Auto-released stale conversation ${conv.id} (SLA breach)`, {
      category: 'audit',
      service: 'app',
      metadata: { conversationId: conv.id, previousAssignee: conv.assignedToName },
    })
  }

  return { breached: breached.length, autoReleased: stale.length }
}

// ---------------------------------------------------------------------------
// 8. Query helpers
// ---------------------------------------------------------------------------

export async function listConversations(organizationId: string, status?: string, limit = 50) {
  const where: any = { organizationId }
  if (status) where.status = status
  return db.supportConversation.findMany({
    where,
    orderBy: { lastMessageAt: 'desc' },
    take: limit,
  })
}

export async function getConversationMessages(conversationId: string, limit = 100) {
  const [messages, notes] = await Promise.all([
    db.chatMessage.findMany({
      where: { threadId: conversationId },
      orderBy: { createdAt: 'asc' },
      take: limit,
    }),
    db.staffNote.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  return {
    messages: messages.map((m) => ({
      ...m,
      attachments: m.attachments ? JSON.parse(m.attachments) : null,
    })),
    internalNotes: notes,
  }
}

export async function getSupportStats(organizationId: string, electionId?: string) {
  const where: any = { organizationId }
  if (electionId) where.electionId = electionId

  const [total, open, assigned, unassigned, escalated, slaBreached, resolved, avgResponseMs] = await Promise.all([
    db.supportConversation.count({ where }),
    db.supportConversation.count({ where: { ...where, status: { in: ['NEW', 'ASSIGNED', 'WAITING_VOTER', 'WAITING_STAFF', 'ESCALATED'] } } }),
    db.supportConversation.count({ where: { ...where, assignedToId: { not: null } } }),
    db.supportConversation.count({ where: { ...where, assignedToId: null, status: { in: ['NEW'] } } }),
    db.supportConversation.count({ where: { ...where, status: 'ESCALATED' } }),
    db.supportConversation.count({ where: { ...where, slaBreached: true } }),
    db.supportConversation.count({ where: { ...where, status: 'RESOLVED' } }),
    // Avg response time would need a subquery; approximate for now
    Promise.resolve(0),
  ])

  return {
    total,
    open,
    assigned,
    unassigned,
    escalated,
    slaBreached,
    resolved,
    avgResponseMs,
  }
}
