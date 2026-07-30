import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson, getClientIp, writeAudit, logVoterActivity } from '@/lib/election'
import { deviceFromRequest } from '@/lib/device'

export const dynamic = 'force-dynamic'

// POST /api/voter/accredit — record accreditation for this election session.
// Must be called before /api/vote/cast (if requireAccreditation is on).
export async function POST(req: NextRequest) {
  const token =
    req.headers.get('x-voter-token') ||
    req.headers.get('x-session-token') ||
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return errorJson('No voter session', 401)
  const voter = await db.voter.findUnique({ where: { sessionToken: token } })
  if (!voter || !voter.sessionExpiresAt || voter.sessionExpiresAt < new Date()) return errorJson('Voter session expired', 401)
  if (voter.hasVoted) return errorJson('You have already voted', 409)

  const { election } = await (await import('@/lib/election')).getElectionContext()
  const sessionId = election?.id || null
  const device = deviceFromRequest(req)

  // Upsert accreditation (unique per voter+session).
  const acc = await db.accreditation.upsert({
    where: { voterId_electionSessionId: { voterId: voter.id, electionSessionId: sessionId || '' } },
    create: {
      voterId: voter.id, electionSessionId: sessionId,
      status: 'APPROVED', channel: 'MATRIC',
      deviceFingerprint: device.fingerprint, ipAddress: device.ipAddress,
    },
    update: { status: 'APPROVED', deviceFingerprint: device.fingerprint, ipAddress: device.ipAddress, accreditedAt: new Date() },
  })
  await writeAudit({
    actorId: voter.id, actorRole: 'VOTER', actorName: voter.fullName,
    action: 'VOTER_ACCREDITED', details: { device: device.label }, ip: getClientIp(req),
  })
  await logVoterActivity({
    voterId: voter.id, action: 'ACCREDIT', details: { device: device.label }, ipAddress: getClientIp(req), deviceLabel: device.label,
  })
  return json({ ok: true, accredited: true, accreditationId: acc.id })
}
