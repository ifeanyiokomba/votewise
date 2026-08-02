import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson } from '@/lib/election'

export const dynamic = 'force-dynamic'

// POST /api/receipt/verify  body: { receiptCode }
//
// PUBLIC endpoint — no org context or auth required. Anyone with a receipt
// code can verify that their vote was recorded and counted.
//
// Checks BOTH the new VoteRecord (SVE) and legacy EncryptedVote tables.
// Returns confirmation WITHOUT revealing vote choices (ballot secrecy).
//
// This is receipt-anchored anonymity: the receipt proves participation, not
// which candidate was selected.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const code = String(body.receiptCode || '').trim().toUpperCase()
  if (!code) return errorJson('Receipt code is required', 400)

  // 1. Check the new SVE VoteRecord table.
  const sveVote = await db.voteRecord.findUnique({
    where: { receiptCode: code },
    select: {
      id: true,
      electionId: true,
      positionId: true,
      receiptCode: true,
      createdAt: true,
      isSimulation: true,
      // Deliberately NOT selecting: candidateId, encryptedChoice, voterHash, ipAddress
    },
  })

  if (sveVote) {
    let electionName: string | undefined
    let positionTitle: string | undefined
    if (sveVote.electionId) {
      const election = await db.electionSession.findUnique({
        where: { id: sveVote.electionId },
        select: { name: true },
      })
      electionName = election?.name
    }
    if (sveVote.positionId) {
      const position = await db.position.findUnique({
        where: { id: sveVote.positionId },
        select: { title: true },
      })
      positionTitle = position?.title
    }

    return json({
      valid: true,
      counted: true,
      receiptCode: code,
      electionName,
      position: positionTitle,
      positionTitle,
      votedAt: sveVote.createdAt.toISOString(),
      recordedAt: sveVote.createdAt.toISOString(),
      isSimulation: sveVote.isSimulation,
      message: sveVote.isSimulation
        ? 'This receipt corresponds to a simulation vote (test data). It was not counted in real results.'
        : 'Your vote was successfully recorded and counted. Thank you for participating.',
      note: 'This confirms your vote was recorded and counted. The choice is kept secret to protect ballot secrecy.',
    })
  }

  // 2. Fall back to the legacy EncryptedVote table.
  const legacyVote = await db.encryptedVote.findUnique({
    where: { receiptCode: code },
    include: { position: { select: { title: true, slug: true } } },
  })

  if (legacyVote) {
    let electionName: string | undefined
    if (legacyVote.electionSessionId) {
      const election = await db.electionSession.findUnique({
        where: { id: legacyVote.electionSessionId },
        select: { name: true },
      })
      electionName = election?.name
    }
    return json({
      valid: true,
      counted: true,
      receiptCode: code,
      electionName,
      position: legacyVote.position?.title,
      positionTitle: legacyVote.position?.title,
      votedAt: legacyVote.createdAt.toISOString(),
      recordedAt: legacyVote.createdAt.toISOString(),
      isSimulation: false,
      message: 'Your vote was successfully recorded and counted.',
      note: 'This confirms your vote was recorded and counted. The choice is kept secret to protect ballot secrecy.',
    })
  }

  // 3. Not found in either table.
  return json({
    valid: false,
    counted: false,
    receiptCode: code,
    message: 'Receipt not found. Please check your receipt code and try again. Receipt codes are in the format VW-YYYY-XXXXXXXX.',
  }, 404)
}
