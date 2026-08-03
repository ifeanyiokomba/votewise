// VoteWise — OTVP Service (Enterprise Audit Part 4)
//
// Spec: "OTVP should not be part of voting logic. Create a separate service."
//
// This service is a thin wrapper around src/lib/ch16a/otp-delivery.ts that
// provides a clean domain interface. The actual implementation (multi-channel
// delivery, fallback, retry, rate limiting, delivery tracking) lives in
// ch16a/otp-delivery.ts. This file exists to formalize the domain boundary.

export {
  generateAndDeliverOtp,
  resendOtp,
  getOtpDeliveryStats,
  listOtpDeliveries,
} from '@/lib/ch16a/otp-delivery'

export type { OtpChannel, OtpDeliveryConfig } from '@/lib/ch16a/otp-delivery'

/**
 * Verify an OTVP code — returns the credential ID if valid.
 * This is the entry point for the voting flow: voter enters OTVP →
 * this verifies it → a voting session is created.
 */
export async function verifyOtp(input: {
  voterId: string
  electionId: string
  code: string
}): Promise<{ valid: boolean; credentialId?: string; error?: string }> {
  const { db } = await import('@/lib/db')
  const { emitEvent } = await import('@/lib/event-bus')

  const credential = await (db as any).votingCredential.findFirst({
    where: {
      voterId: input.voterId,
      electionId: input.electionId,
      code: input.code,
      status: { in: ['PENDING', 'VERIFIED'] },
    },
    orderBy: { createdAt: 'desc' },
  }).catch(() => null)

  if (!credential) {
    await emitEvent('VOTER_OTP_FAILED', {
      electionId: input.electionId,
      voterId: input.voterId,
    })
    return { valid: false, error: 'OTVP_INVALID' }
  }

  if (credential.expiresAt < new Date()) {
    await (db as any).votingCredential.update({
      where: { id: credential.id },
      data: { status: 'EXPIRED' },
    })
    return { valid: false, error: 'OTVP_EXPIRED' }
  }

  if (credential.attempts >= 5) {
    await (db as any).votingCredential.update({
      where: { id: credential.id },
      data: { status: 'EXPIRED' },
    })
    return { valid: false, error: 'OTVP_MAX_ATTEMPTS' }
  }

  await (db as any).votingCredential.update({
    where: { id: credential.id },
    data: { status: 'VERIFIED', verifiedAt: new Date() },
  })

  await emitEvent('VOTER_OTP_VERIFIED', {
    electionId: input.electionId,
    voterId: input.voterId,
  })

  return { valid: true, credentialId: credential.id }
}
