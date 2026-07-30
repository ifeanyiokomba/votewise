import { NextRequest } from 'next/server'
import { json, errorJson, getElectionContext, getClientIp } from '@/lib/election'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// POST /api/support/ticket — any visitor can submit a support ticket.
// Body: { matric, fullName, issueType, description, email, phone }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { matric, fullName, issueType, description, email, phone } = body
  if (!matric || !fullName || !issueType || !description) {
    return errorJson('matric, fullName, issueType, description are required', 400)
  }
  // Try to link to an existing voter record.
  const voter = await db.voter.findUnique({ where: { matric: String(matric).toUpperCase() } })
  const ticket = await db.supportTicket.create({
    data: {
      voterId: voter?.id || null,
      voterMatric: String(matric).toUpperCase(),
      voterName: fullName,
      issueType,
      description,
      status: 'OPEN',
      priority: issueType === 'OTP_NOT_RECEIVED' || issueType === 'CANNOT_LOGIN' ? 'HIGH' : 'NORMAL',
    },
  })
  console.log(`[support] new ticket #${ticket.id} from ${matric}: ${issueType}`)
  return json({ ok: true, ticketId: ticket.id, message: 'Your request has been logged. An electoral observer will attend to you shortly.' })
}
