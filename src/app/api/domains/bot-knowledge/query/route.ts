import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { findRelevantKnowledge } from '@/lib/domains/bot-knowledge'

export const dynamic = 'force-dynamic'

// POST /api/domains/bot-knowledge/query — find the best matching knowledge
// entry for a voter query. Public (the chatbot needs this without auth).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  if (!body.query) return errorJson('query is required', 400)
  const url = new URL(req.url)
  const org = url.searchParams.get('org') || undefined
  const match = await findRelevantKnowledge(body.query, org)
  if (!match) {
    return json({ found: false, message: 'I couldn\'t find an answer to that. Let me connect you with a human agent.' })
  }
  return json({ found: true, knowledge: match, answer: match.answer, confidence: match.confidence })
}
