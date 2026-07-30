import { NextRequest } from 'next/server'
import { json, errorJson, getElectionContext, isVotingOpen, getClientIp, writeAudit } from '@/lib/election'
import { generateReceiptCode, hashVoter } from '@/lib/crypto'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// POST /api/vote/cast
// Body: { selections: { [positionId]: candidateId | 'NOTA' } }
// Atomic transaction: marks voter hasVoted, inserts vote rows (with receipt
// codes), writes audit log. Returns ALL receipt codes so the voter can verify
// their vote later. The vote rows do NOT reference the voter id — only an
// opaque hash — so votes remain unlinkable.
export async function POST(req: NextRequest) {
  const token = req.headers.get('x-voter-token') || req.headers.get('x-session-token') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return errorJson('No voter session', 401)

  const body = await req.json().catch(() => ({}))
  const selections: Record<string, string> = body.selections || {}
  if (!selections || Object.keys(selections).length === 0) {
    return errorJson('No selections provided', 400)
  }

  const { election, settings } = await getElectionContext()
  if (!election) return errorJson('Election not configured', 503)
  if (!isVotingOpen(election.status, election.startTime, election.endTime)) {
    return errorJson('Voting is not open', 403)
  }

  const voter = await db.voter.findUnique({ where: { sessionToken: token } })
  if (!voter || !voter.sessionExpiresAt || voter.sessionExpiresAt < new Date()) {
    return errorJson('Voter session expired', 401)
  }
  if (voter.hasVoted) return errorJson('You have already voted', 409)

  // Validate each selection against the voter's eligible positions.
  const eligiblePositions = await db.position.findMany({
    where: {
      id: { in: Object.keys(selections) },
      OR: [
        { scope: 'UNIVERSITY' },
        { scope: 'FACULTY', facultyId: voter.facultyId },
        { scope: 'DEPARTMENT', departmentId: voter.departmentId },
      ],
    },
    include: { candidates: { where: { status: 'APPROVED' } } },
  })

  const eligibleIds = new Set(eligiblePositions.map((p) => p.id))
  for (const posId of Object.keys(selections)) {
    if (!eligibleIds.has(posId)) return errorJson(`Position ${posId} is not eligible for you`, 403)
  }

  // Build vote rows.
  const voterHash = hashVoter(voter.matric)
  const receipts: { positionId: string; positionTitle: string; receiptCode: string }[] = []

  try {
    await db.$transaction(async (tx) => {
      // Re-fetch the voter inside the transaction to double-check hasVoted (race-safe).
      const fresh = await tx.voter.findUnique({ where: { id: voter.id } })
      if (!fresh || fresh.hasVoted) throw new Error('ALREADY_VOTED')

      for (const pos of eligiblePositions) {
        const sel = selections[pos.id]
        const isNota = sel === 'NOTA'
        let candidateId: string | null = null
        if (!isNota) {
          const cand = pos.candidates.find((c) => c.id === sel)
          if (!cand) throw new Error(`Invalid candidate for ${pos.title}`)
          candidateId = cand.id
        } else if (!(settings?.notaEnabled ?? true)) {
          throw new Error('NOTA is not enabled')
        }
        const receiptCode = generateReceiptCode()
        await tx.vote.create({
          data: {
            voterHash,
            candidateId,
            positionId: pos.id,
            isNota,
            receiptCode,
          },
        })
        receipts.push({ positionId: pos.id, positionTitle: pos.title, receiptCode })
      }

      await tx.voter.update({
        where: { id: voter.id },
        data: {
          hasVoted: true,
          votedAt: new Date(),
          sessionToken: null,
          sessionExpiresAt: null,
          otpCode: null,
          otpExpiresAt: null,
        },
      })

      await tx.auditLog.create({
        data: {
          electionId: 'default',
          actorId: voter.id,
          actorRole: 'VOTER',
          actorName: voter.fullName,
          action: 'VOTE_CAST',
          details: JSON.stringify({ positions: receipts.map((r) => r.positionId), count: receipts.length }),
          ip: getClientIp(req),
        },
      })
    })
  } catch (e: any) {
    if (e?.message === 'ALREADY_VOTED') return errorJson('You have already voted', 409)
    console.error('[vote/cast] transaction failed', e)
    return errorJson('Failed to cast vote. Please try again.', 500)
  }

  return json({ ok: true, receipts, votedAt: new Date() })
}
