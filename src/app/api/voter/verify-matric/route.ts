import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson, getElectionContext, isVotingOpen } from '@/lib/election'
import { RATE_LIMITS } from '@/lib/ratelimit'

export const dynamic = 'force-dynamic'

// POST /api/voter/verify-matric  body: { matric }
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const rl = RATE_LIMITS.authIp(ip)
  if (!rl.allowed) return errorJson('Too many attempts. Please slow down.', 429)

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
  if (!voter) return json({ found: false, message: 'Matriculation number not found in the voter register.' }, 404)
  if (voter.hasVoted) return json({ found: true, hasVoted: true, votedAt: voter.votedAt }, 409)
  if (voter.lockedUntil && voter.lockedUntil > new Date()) return errorJson('Account temporarily locked. Try again later.', 423)

  const channels: string[] = []
  if (voter.institutionEmail || voter.personalEmail) channels.push('EMAIL')
  if (voter.phone) channels.push('SMS', 'WHATSAPP')
  if (channels.length === 0) channels.push('EMAIL')
  const votingOpen = isVotingOpen(election.status, election.startTime, election.endTime)

  return json({
    found: true,
    hasVoted: false,
    voter: {
      fullName: voter.fullName,
      faculty: voter.faculty?.name,
      department: voter.department?.name,
      level: voter.level,
      emailMasked: maskEmail(voter.institutionEmail || voter.personalEmail || ''),
      phoneMasked: voter.phone ? maskPhone(voter.phone) : null,
    },
    channels,
    votingOpen,
    requireAccreditation: settings?.requireAccreditation ?? true,
    requireOtp: settings?.requireOtp ?? true,
  })
}

function maskEmail(e: string) {
  if (!e) return ''
  const [u, d] = e.split('@')
  if (!u || !d) return e
  return `${u.slice(0, Math.min(2, u.length))}${'*'.repeat(Math.max(1, u.length - 2))}@${d}`
}
function maskPhone(p: string) {
  if (p.length < 4) return p
  return `${'*'.repeat(p.length - 4)}${p.slice(-4)}`
}
