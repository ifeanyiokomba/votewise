import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import { errorResponse } from '@/lib/errors'
import { emitEvent } from '@/lib/event-bus'

export const dynamic = 'force-dynamic'

// POST /api/v1/voting/verify-otvp — verify an OTVP code
// Body: { electionId, matricNumber, code }
export async function POST(req: NextRequest) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth) return errorResponse('UNAUTHORIZED')

  const body = await req.json().catch(() => ({}))
  const { electionId, matricNumber, code } = body

  if (!electionId || !matricNumber || !code) {
    return errorResponse('VALIDATION_ERROR', 'electionId, matricNumber, and code are required')
  }

  // Find the voter
  const voter = await db.voter.findFirst({
    where: { matricNumber, electionId },
    select: { id: true },
  }).catch(() => null)

  if (!voter) return errorResponse('VOTE_NOT_ELIGIBLE')

  // Find the OTVP credential
  const credential = await db.votingCredential.findFirst({
    where: {
      voterId: voter.id,
      electionId,
      code,
      status: { in: ['PENDING', 'VERIFIED'] },
    },
    orderBy: { createdAt: 'desc' },
  }).catch(() => null)

  if (!credential) {
    await emitEvent('VOTER_OTP_FAILED', { electionId, voterId: voter.id })
    return errorResponse('OTVP_INVALID')
  }

  // Check expiration
  if (credential.expiresAt < new Date()) {
    await db.votingCredential.update({ where: { id: credential.id }, data: { status: 'EXPIRED' } })
    return errorResponse('OTVP_EXPIRED')
  }

  // Check max attempts
  if (credential.attempts >= 5) {
    await db.votingCredential.update({ where: { id: credential.id }, data: { status: 'EXPIRED' } })
    return errorResponse('OTVP_MAX_ATTEMPTS')
  }

  // Mark as verified
  await db.votingCredential.update({
    where: { id: credential.id },
    data: { status: 'VERIFIED', verifiedAt: new Date() },
  })

  await emitEvent('VOTER_OTP_VERIFIED', { electionId, voterId: voter.id })

  return Response.json({
    success: true,
    data: {
      verified: true,
      credentialId: credential.id,
      message: 'OTVP verified. You can now access the ballot.',
    },
  })
}
