import { NextRequest } from 'next/server'
import { json, errorJson, getElectionContext, isVotingOpen, getClientIp, writeAudit } from '@/lib/election'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// POST /api/voter/verify-matric
// Body: { matric }
// Checks the matric exists in the voter register. Returns the voter's public
// profile (name, faculty, department, level) and the OTP channels available to
// them (EMAIL if email present, SMS if phone present, WHATSAPP if phone present).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const matric = String(body.matric || '').trim().toUpperCase()
  if (!matric) return errorJson('Matriculation number is required', 400)

  const { election, settings } = await getElectionContext()
  if (!election) return errorJson('Election is not configured', 503)

  const voter = await db.voter.findUnique({
    where: { matric },
    include: {
      faculty: { select: { name: true, code: true } },
      department: { select: { name: true, code: true } },
    },
  })
  if (!voter) {
    return json({ found: false, message: 'Matriculation number not found in the voter register.' }, 404)
  }
  if (voter.hasVoted) {
    return json({ found: true, hasVoted: true, votedAt: voter.votedAt }, 409)
  }

  const channels: string[] = []
  if (voter.email) channels.push('EMAIL')
  if (voter.phone) channels.push('SMS', 'WHATSAPP')
  if (channels.length === 0) channels.push('EMAIL') // fallback

  // Voting window check — we still allow OTP verification early so voters can
  // pre-authenticate, but casting the vote is blocked outside the window.
  const votingOpen = isVotingOpen(election.status, election.startTime, election.endTime)

  return json({
    found: true,
    hasVoted: false,
    voter: {
      fullName: voter.fullName,
      faculty: voter.faculty?.name,
      department: voter.department?.name,
      level: voter.level,
      emailMasked: voter.email ? maskEmail(voter.email) : null,
      phoneMasked: voter.phone ? maskPhone(voter.phone) : null,
    },
    channels,
    votingOpen,
    requireOtp: settings?.requireOtp ?? true,
  })
}

function maskEmail(e: string) {
  const [u, d] = e.split('@')
  if (!u || !d) return e
  const head = u.slice(0, Math.min(2, u.length))
  return `${head}${'*'.repeat(Math.max(1, u.length - 2))}@${d}`
}
function maskPhone(p: string) {
  if (p.length < 4) return p
  return `${'*'.repeat(p.length - 4)}${p.slice(-4)}`
}
