import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson, getClientIp, writeAudit, logVoterActivity, recordSecurityEvent } from '@/lib/election'
import { requireOfficial } from '@/lib/guards'

export const dynamic = 'force-dynamic'

// POST /api/admin/voters/[id]/flag — flag or unflag a voter.
// Body: { flagged: boolean, reason?: string }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOfficial(req, 'voter.manage')
  if (auth instanceof Response) return auth
  const official = (auth as any).official
  const { id } = await params

  const body = await req.json().catch(() => ({}))
  const flagged = !!body.flagged
  const reason = body.reason ? String(body.reason) : null

  const voter = await db.voter.findUnique({ where: { id }, select: { id: true, matric: true, fullName: true, flagged: true } })
  if (!voter) return errorJson('Voter not found', 404)

  await db.voter.update({
    where: { id },
    data: flagged
      ? { flagged: true, flaggedReason: reason, flaggedById: official.id, flaggedAt: new Date() }
      : { flagged: false, flaggedReason: null, flaggedById: null, flaggedAt: null },
  })

  await logVoterActivity({
    voterId: id,
    actionById: official.id,
    action: flagged ? 'FLAG' : 'UNFLAG',
    details: { reason, matric: voter.matric },
    ipAddress: getClientIp(req),
  })
  await writeAudit({
    actorId: official.id, actorRole: official.role, actorName: official.name,
    action: flagged ? 'VOTER_FLAGGED' : 'VOTER_UNFLAGGED',
    details: { voterId: id, matric: voter.matric, reason },
    ip: getClientIp(req),
  })
  if (flagged) {
    await recordSecurityEvent({
      severity: 'HIGH', category: 'SUSPICIOUS',
      actorId: official.id, actorEmail: official.email, ipAddress: getClientIp(req),
      message: `Voter ${voter.matric} (${voter.fullName}) flagged: ${reason || 'no reason given'}`,
    })
  }

  return json({ ok: true, flagged, voter: { id, matric: voter.matric, flagged } })
}
