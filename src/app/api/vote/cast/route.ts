import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import {
  json, errorJson, getElectionContext, isVotingOpen, getClientIp, writeAudit, recordSecurityEvent, logVoterActivity,
} from '@/lib/election'
import { generateReceiptCode, hashVoter, encryptVote, sha256 } from '@/lib/crypto'
import { RATE_LIMITS } from '@/lib/ratelimit'

export const dynamic = 'force-dynamic'

// POST /api/vote/cast
// Headers: x-voter-token (or x-session-token / Authorization)
// Body: { selections: { [positionId]: candidateId | 'NOTA' }, idempotencyKey? }
//
// Atomic transaction:
//  1. Re-fetch voter inside txn (race-safe hasVoted check).
//  2. Validate each selection against eligible positions (scope).
//  3. Encrypt each choice with AES-256-GCM.
//  4. Insert EncryptedVote rows (unique idempotencyKey + receiptCode).
//  5. Mark voter hasVoted, revoke session.
//  6. Append hash-chained AuditLog.
export async function POST(req: NextRequest) {
  const token =
    req.headers.get('x-voter-token') ||
    req.headers.get('x-session-token') ||
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return errorJson('No voter session', 401)

  const body = await req.json().catch(() => ({}))
  const selections: Record<string, string> = body.selections || {}
  if (!selections || Object.keys(selections).length === 0) return errorJson('No selections provided', 400)

  const { election, settings } = await getElectionContext()
  if (!election) return errorJson('Election not configured', 503)
  if (!isVotingOpen(election.status, election.startTime, election.endTime)) return errorJson('Voting is not open', 403)

  const voter = await db.voter.findUnique({ where: { sessionToken: token } })
  if (!voter || !voter.sessionExpiresAt || voter.sessionExpiresAt < new Date()) return errorJson('Voter session expired', 401)
  if (voter.hasVoted) return errorJson('You have already voted', 409)
  if (voter.flagged) return errorJson('Your account has been flagged. Please contact the Electoral Committee.', 403)

  // Rate limit per voter.
  const rl = RATE_LIMITS.voteCast(voter.id)
  if (!rl.allowed) return errorJson('Too many requests. Please wait a moment.', 429)

  // Accreditation gate.
  if (settings?.requireAccreditation) {
    const acc = await db.accreditation.findUnique({
      where: { voterId_electionSessionId: { voterId: voter.id, electionSessionId: election.id } },
    })
    if (!acc || acc.status !== 'APPROVED') return errorJson('You must complete accreditation before voting.', 403)
  }

  // Validate selections against eligible positions.
  const eligiblePositions = await db.position.findMany({
    where: {
      id: { in: Object.keys(selections) },
      electionSessionId: election.id,
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

  const voterHash = hashVoter(voter.matric)
  const receipts: { positionId: string; positionTitle: string; receiptCode: string }[] = []

  try {
    await db.$transaction(async (tx) => {
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

        // Encrypt the choice.
        const blob = encryptVote({ candidateId, isNota })
        const receiptCode = generateReceiptCode()
        const idempotencyKey = sha256(`${voter.id}|${election.id}|${pos.id}`)

        await tx.encryptedVote.create({
          data: {
            electionSessionId: election.id,
            voterHash,
            positionId: pos.id,
            // Pre-certify: leave candidateId/isNota null (encrypted only).
            candidateId: null,
            isNota: false,
            ciphertext: blob.ciphertext,
            iv: blob.iv,
            keyId: blob.keyId,
            receiptCode,
            idempotencyKey,
          },
        })
        receipts.push({ positionId: pos.id, positionTitle: pos.title, receiptCode })
      }

      await tx.voter.update({
        where: { id: voter.id },
        data: {
          hasVoted: true, votedAt: new Date(),
          sessionToken: null, sessionExpiresAt: null, sessionDeviceId: null,
          otpCode: null, otpExpiresAt: null,
        },
      })

      // Hash-chained audit log (computed inside the txn for ordering).
      const last = await tx.auditLog.findFirst({ orderBy: { createdAt: 'desc' } })
      const { computeAuditHash, AUDIT_GENESIS, randomToken } = await import('@/lib/crypto')
      const prevHash = last?.hash || AUDIT_GENESIS
      const createdAt = new Date()
      const nonce = randomToken(8)
      const detailsStr = JSON.stringify({ positions: receipts.map((r) => r.positionId), count: receipts.length })
      const hash = computeAuditHash({ prevHash, actorId: voter.id, action: 'VOTE_CAST', details: detailsStr, createdAt, nonce })
      await tx.auditLog.create({
        data: {
          electionId: election.id, actorId: voter.id, actorRole: 'VOTER', actorName: voter.fullName,
          action: 'VOTE_CAST', details: detailsStr, ip: getClientIp(req),
          prevHash, hash, nonce, createdAt,
        },
      })
    })
  } catch (e: any) {
    if (e?.message === 'ALREADY_VOTED') return errorJson('You have already voted', 409)
    // Unique constraint on idempotencyKey → replay attempt.
    if (e?.code === 'P2002') {
      await recordSecurityEvent({ severity: 'HIGH', category: 'SUSPICIOUS', actorId: voter.id, ipAddress: getClientIp(req), message: `Replay attempt (idempotencyKey collision) for voter ${voter.matric}` })
      return errorJson('Duplicate vote attempt detected and blocked.', 409)
    }
    console.error('[vote/cast] transaction failed', e)
    return errorJson('Failed to cast vote. Please try again.', 500)
  }

  await logVoterActivity({
    voterId: voter.id, action: 'VOTE_CAST', details: { positions: receipts.length }, ipAddress: getClientIp(req), deviceLabel: req.headers.get('user-agent')?.slice(0, 60),
  })

  // Forward receipt codes to the voter via the same channel used for OTP verification.
  // In sandbox: log to console. In production: dispatch to Resend (email) / Termii (SMS/WA).
  const channel = voter.otpChannel || 'EMAIL'
  const dest = channel === 'EMAIL' ? (voter.institutionEmail || voter.personalEmail) : voter.phone
  const receiptList = receipts.map((r: any) => `${r.positionTitle}: ${r.receiptCode}`).join('\n')
  const receiptMessage = `Dear ${voter.fullName}, your vote has been recorded and counted. Here are your receipt codes (save them to verify your vote later):\n\n${receiptList}\n\nYou can verify any of these codes on the AfriVote homepage. Your vote choice remains secret.`
  console.log(`[RECEIPT FORWARD] ${channel} -> ${dest || voter.matric}:\n${receiptMessage}`)
  // Enqueue async send (no-op transport in sandbox; production uses Resend/Termii)
  const { enqueue } = await import('@/lib/jobs')
  enqueue('receipt.forward', { channel, destination: dest, voterName: voter.fullName, receipts, message: receiptMessage })

  return json({ ok: true, receipts, votedAt: new Date(), receiptChannel: channel, receiptForwarded: !!dest })
}
