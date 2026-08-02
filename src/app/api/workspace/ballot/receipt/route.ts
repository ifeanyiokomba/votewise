import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { verifyReceipt } from '@/lib/sve'

export const dynamic = 'force-dynamic'

// POST /api/workspace/ballot/receipt — Verify a vote receipt.
//
// Confirms the receipt exists and was counted — WITHOUT revealing vote choices.
// This is receipt-anchored anonymity: the voter can prove they voted, but
// no one can determine who they voted for.
//
// Body: { receiptCode }
// Returns: { valid, receiptCode, electionName?, positionTitle?, recordedAt?, message }
//
// Deliberately does NOT return: candidateId, encryptedChoice, voterHash, ipAddress.
export async function POST(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  const body = await req.json().catch(() => ({}))
  const { receiptCode } = body
  if (!receiptCode) return errorJson('Receipt code is required', 400)

  const result = await verifyReceipt(receiptCode, org.id)
  return json(result)
}
