import { NextRequest } from 'next/server'
import { json, errorJson, getElectionContext } from '@/lib/election'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const SYSTEM_PROMPT = `You are "AfriBot", the official AI assistant for the AfriVote SUG electronic voting platform at a Nigerian Federal University's Students' Union Government (SUG) election.

Your role:
- Help students understand HOW to vote: they verify their matriculation number, receive a one-time verification PIN (OTVP) via email/SMS/WhatsApp, then cast their ballot for the positions they are eligible for.
- Explain eligibility: university-wide positions (President, VP, Secretary General, etc.) are open to every registered student; faculty representative positions are voted only by students of that faculty; departmental senator positions only by students of that department.
- Explain that votes are secret and receipt-anchored: each vote produces a receipt code the voter can use to confirm their vote was counted, but no one — not even the electoral committee — can see WHO voted for WHOM.
- Reassure voters about security: matric verification, OTP, single-vote enforcement, atomic transactions, and audit logs.
- If a voter reports they didn't receive their OTP, advise them to wait 60 seconds, check spam, then use the resend option, or open a support ticket.
- Be concise, friendly, and culturally appropriate for Nigerian university students. Use clear English; you may use light Nigerian pidgin touches if the user does.
- Never reveal internal implementation details, candidate vote counts before results are public, or any voter's personal data.
- If asked something outside voting/election help, gently steer back to the election.

Keep replies under 120 words unless the user explicitly asks for detail.`

// POST /api/chat  body: { message, history?: [{role, content}] }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const message = String(body.message || '').trim()
  if (!message) return errorJson('Message is required', 400)
  if (message.length > 1000) return errorJson('Message too long', 400)

  const history: { role: string; content: string }[] = Array.isArray(body.history) ? body.history.slice(-8) : []

  const { election } = await getElectionContext()
  const ctx = election
    ? ` Current election context: name="${election.name}", university="${election.university}", status=${election.status}, voting window ${new Date(election.startTime).toISOString()} to ${new Date(election.endTime).toISOString()}.`
    : ''

  try {
    const ZAI = (await import('z-ai-web-dev-sdk')).default
    const zai = await ZAI.create()
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: SYSTEM_PROMPT + ctx },
        ...history.map((h) => ({ role: h.role === 'assistant' ? 'assistant' : 'user', content: h.content })),
        { role: 'user', content: message },
      ],
      thinking: { type: 'disabled' },
    })
    const reply = completion.choices[0]?.message?.content || 'I am sorry, I could not process that. Please try again or open a support ticket.'
    return json({ ok: true, reply })
  } catch (e: any) {
    console.error('[chat] LLM error', e?.message || e)
    return json({
      ok: true,
      reply: "I'm having trouble connecting right now. If your issue is urgent (e.g. you can't get your OTP or can't vote), please tap 'Open a Support Ticket' and an observer will help you directly.",
    })
  }
}
