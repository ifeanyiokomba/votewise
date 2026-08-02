// VoteWise — Bot Knowledge (Enterprise Audit Part 2)
//
// Manages BotKnowledge entries — the FAQ knowledge base the AI chatbot
// uses to answer common election questions.
// Spec: "BotKnowledge — FAQ items the bot uses to answer questions."

import { db } from '@/lib/db'

export interface BotKnowledgeInput {
  organizationId?: string
  question: string
  answer: string
  category?: string
  keywords?: string[]
  enabled?: boolean
}

export async function createBotKnowledge(input: BotKnowledgeInput) {
  return db.botKnowledge.create({
    data: {
      organizationId: input.organizationId || null,
      question: input.question,
      answer: input.answer,
      category: input.category || 'SUPPORT',
      keywords: input.keywords ? JSON.stringify(input.keywords) : null,
      enabled: input.enabled ?? true,
    },
  })
}

export async function listBotKnowledge(organizationId?: string) {
  const where = organizationId
    ? { OR: [{ organizationId }, { organizationId: null }] }
    : {}
  const items = await db.botKnowledge.findMany({ where, orderBy: { category: 'asc' } })
  return items.map((k) => ({
    ...k,
    keywords: k.keywords ? JSON.parse(k.keywords) : [],
  }))
}

export async function updateBotKnowledge(id: string, update: Partial<BotKnowledgeInput>) {
  const data: any = { ...update }
  if (update.keywords) data.keywords = JSON.stringify(update.keywords)
  return db.botKnowledge.update({ where: { id }, data })
}

export async function deleteBotKnowledge(id: string) {
  return db.botKnowledge.delete({ where: { id } })
}

/**
 * Find the best matching knowledge entry for a voter query.
 * Uses keyword matching + category hints.
 */
export async function findRelevantKnowledge(query: string, organizationId?: string): Promise<any | null> {
  const items = await listBotKnowledge(organizationId)
  const normalizedQuery = query.toLowerCase()

  let bestMatch: any = null
  let bestScore = 0

  for (const item of items) {
    if (!item.enabled) continue
    let score = 0
    // Keyword matches
    for (const kw of item.keywords) {
      if (normalizedQuery.includes(kw.toLowerCase())) score += 10
    }
    // Question word overlap
    const queryWords = normalizedQuery.split(/\s+/)
    const questionWords = item.question.toLowerCase().split(/\s+/)
    for (const qw of queryWords) {
      if (qw.length > 3 && questionWords.includes(qw)) score += 2
    }
    if (score > bestScore) {
      bestScore = score
      bestMatch = item
    }
  }

  // Record a hit on the matched entry
  if (bestMatch && bestScore > 0) {
    await db.botKnowledge.update({
      where: { id: bestMatch.id },
      data: { hitCount: { increment: 1 } },
    }).catch(() => {})
  }

  return bestScore > 0 ? { ...bestMatch, confidence: Math.min(1, bestScore / 30) } : null
}

/**
 * Record voter feedback on a bot answer.
 */
export async function recordBotFeedback(knowledgeId: string, helpful: boolean) {
  if (helpful) {
    await db.botKnowledge.update({
      where: { id: knowledgeId },
      data: { helpfulCount: { increment: 1 } },
    }).catch(() => {})
  }
}

/**
 * Seed default knowledge base entries.
 */
export async function ensureBotKnowledgeSeeded() {
  const count = await db.botKnowledge.count()
  if (count > 0) return

  const defaults: BotKnowledgeInput[] = [
    { question: 'How do I vote?', answer: 'To cast your vote: 1) Click "Cast Vote" on the homepage. 2) Enter your matriculation number. 3) Verify your identity. 4) You\'ll receive a One-Time Voting Password (OTVP) via SMS/Email. 5) Enter the OTVP to authenticate. 6) Select your candidates and submit. 7) You\'ll receive a receipt code as proof.', category: 'VOTING', keywords: ['vote', 'cast', 'how', 'ballot'] },
    { question: 'I didn\'t receive my OTVP. What should I do?', answer: 'If you didn\'t receive your OTVP: 1) Check your spam folder for the email. 2) Ensure your phone number is correct. 3) Wait 2-3 minutes — delivery can be delayed during peak times. 4) If still missing, click "Resend OTVP" or contact support. 5) You can request up to 5 resends per hour.', category: 'OTP', keywords: ['otvp', 'otp', 'receive', 'code', 'password', 'didn\'t', 'didnt'] },
    { question: 'Am I eligible to vote?', answer: 'To check your eligibility, go to "Verify Eligibility" on the homepage and enter your matriculation number. The system will show your faculty, department, and level, and confirm if you\'re registered to vote. No login required.', category: 'ELIGIBILITY', keywords: ['eligible', 'eligibility', 'register', 'registered', 'matric', 'can i vote'] },
    { question: 'When does voting close?', answer: 'Voting times are shown on the election timetable page. The countdown timer on the homepage shows exactly when voting opens and closes. Make sure to cast your vote before the deadline — late votes are not accepted.', category: 'TIMETABLE', keywords: ['close', 'end', 'deadline', 'when', 'time', 'voting'] },
    { question: 'How do I verify my receipt?', answer: 'To verify your vote was recorded: 1) Go to "Verify Receipt" on the homepage. 2) Enter your receipt ID (e.g., VW-UNILAG-2028-00823918). 3) The system confirms your vote was recorded — it never reveals your candidate selection. This protects your vote secrecy.', category: 'RECEIPT', keywords: ['receipt', 'verify', 'confirm', 'check', 'proof'] },
    { question: 'Where can I see the candidates?', answer: 'Visit the "Candidates" page from the homepage. You can browse by position (President, Vice President, Secretary, etc.) and view each candidate\'s photo, biography, manifesto, and campaign promises.', category: 'CANDIDATES', keywords: ['candidate', 'candidates', 'who', 'running', 'manifesto'] },
    { question: 'Is my vote secret?', answer: 'Yes. Your vote is completely secret. The system uses AES-256 encryption to protect your ballot. Your receipt confirms your vote was recorded but never reveals your candidate selection. No one — not even the platform administrators — can link your identity to your vote.', category: 'VOTING', keywords: ['secret', 'privacy', 'anonymous', 'safe', 'secure'] },
    { question: 'What if I make a mistake while voting?', answer: 'You can change your selection before submitting. Once you click "Submit Vote", your vote is final and cannot be changed. Take your time to review your selections before submitting.', category: 'VOTING', keywords: ['mistake', 'change', 'wrong', 'edit', 'correct'] },
  ]

  await db.botKnowledge.createMany({
    data: defaults.map((d) => ({
      ...d,
      keywords: d.keywords ? JSON.stringify(d.keywords) : null,
    })),
  })
}
