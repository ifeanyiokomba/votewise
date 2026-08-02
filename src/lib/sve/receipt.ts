// VoteWise — SVE Receipt Module (Chapter 10)
//
// Receipt generation + verification WITHOUT revealing vote choices.
//
// When a vote is recorded, the voter receives a receipt code (e.g.
// VW-2027-00034812). They can verify this code later to confirm their vote
// was counted — but the verification NEVER reveals which candidate they
// voted for. This is "receipt-anchored anonymity": the receipt proves
// participation, not choice.

import { db } from '@/lib/db'
import type { ReceiptVerification } from './types'
import { generateSveReceiptCode } from './crypto'

export { generateSveReceiptCode as generateReceiptCode }

/**
 * Verify a receipt code. Returns whether it exists and was counted, plus
 * metadata that does NOT compromise ballot secrecy (election name, position
 * title, timestamp). Never returns candidateId, encryptedChoice, or voterHash.
 */
export async function verifyReceipt(
  receiptCode: string,
  organizationId?: string,
): Promise<ReceiptVerification> {
  const code = String(receiptCode).toUpperCase().trim()
  if (!code) {
    return { valid: false, receiptCode: code, message: 'Receipt code is required' }
  }

  const vote = await db.voteRecord.findUnique({
    where: { receiptCode: code },
    select: {
      id: true,
      electionId: true,
      positionId: true,
      receiptCode: true,
      createdAt: true,
      isSimulation: true,
      // Deliberately NOT selecting: candidateId, encryptedChoice, iv, voterHash, ipAddress
    },
  })

  if (!vote) {
    return {
      valid: false,
      receiptCode: code,
      message: 'Receipt not found. Please check your receipt code and try again.',
    }
  }

  // If org-scoped, verify the receipt belongs to this org.
  if (organizationId && vote.electionId) {
    const election = await db.electionSession.findUnique({
      where: { id: vote.electionId },
      select: { organizationId: true, name: true },
    })
    if (!election || election.organizationId !== organizationId) {
      return {
        valid: false,
        receiptCode: code,
        message: 'Receipt not found. Please check your receipt code and try again.',
      }
    }
    return {
      valid: true,
      receiptCode: code,
      electionName: election.name,
      recordedAt: vote.createdAt.toISOString(),
      isSimulation: vote.isSimulation,
      message: vote.isSimulation
        ? 'This receipt corresponds to a simulation vote (test data).'
        : 'Your vote was successfully recorded and counted.',
    }
  }

  // Global verification (no org scope) — used by the public receipt verifier.
  let electionName: string | undefined
  let positionTitle: string | undefined
  if (vote.electionId) {
    const election = await db.electionSession.findUnique({
      where: { id: vote.electionId },
      select: { name: true },
    })
    electionName = election?.name
  }
  if (vote.positionId) {
    const position = await db.position.findUnique({
      where: { id: vote.positionId },
      select: { title: true },
    })
    positionTitle = position?.title
  }

  return {
    valid: true,
    receiptCode: code,
    electionName,
    positionTitle,
    recordedAt: vote.createdAt.toISOString(),
    isSimulation: vote.isSimulation,
    message: vote.isSimulation
      ? 'This receipt corresponds to a simulation vote (test data). It was not counted in real results.'
      : 'Your vote was successfully recorded and counted. Thank you for participating.',
  }
}
