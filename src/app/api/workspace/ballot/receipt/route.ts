import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'

export const dynamic = 'force-dynamic'

// POST /api/workspace/ballot/receipt — Verify a vote receipt.
// Body: { receiptCode }
// Confirms the receipt exists and was counted — WITHOUT revealing vote choices.
export async function POST(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  const body = await req.json().catch(() => ({}))
  const { receiptCode } = body
  if (!receiptCode) return errorJson('Receipt code is required', 400)

  const vote = await db.voteRecord.findUnique({
    where: { receiptCode: String(receiptCode).toUpperCase() },
    select: {
      id: true, electionId: true, positionId: true, receiptCode: true,
      createdAt: true, isSimulation: true,
      // Deliberately NOT selecting: candidateId, encryptedChoice, voterHash
    },
  })

  if (!vote || (vote.electionId && org.id)) {
    // Check org ownership via election
    if (vote) {
      const election = await db.electionSession.findUnique({ where: { id: vote.electionId || '' }, select: { organizationId: true } })
      if (election && election.organizationId !== org.id) return errorJson('Receipt not found', 404)
    }
  }

  if (!vote) return json({ valid: false, message: 'Receipt not found. Please check your receipt code.' })

  return json({
    valid: true,
    message: 'Receipt verified — your vote was recorded and counted.',
    receiptCode: vote.receiptCode,
    recordedAt: vote.createdAt,
    isSimulation: vote.isSimulation,
    // We do NOT reveal: which candidate, which position, or voter identity
  })
}
