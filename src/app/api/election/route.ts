import { NextRequest } from 'next/server'
import { computeAggregatedResults, getElectionContext, computeLiveStatus, json } from '@/lib/election'

export const dynamic = 'force-dynamic'

// GET /api/election — public election metadata + settings (no live counts).
export async function GET(req: NextRequest) {
  const { election, settings } = await getElectionContext()
  if (!election) return json({ error: 'Election not configured' }, 404)
  const liveStatus = computeLiveStatus(election.status, election.startTime, election.endTime)
  return json({
    name: election.name,
    university: election.university,
    academicSession: election.academicSession,
    status: election.status,
    liveStatus,
    startTime: election.startTime,
    endTime: election.endTime,
    settings: settings
      ? {
          publicLiveResults: settings.publicLiveResults,
          showTurnout: settings.showTurnout,
          requireOtp: settings.requireOtp,
          ballotRandomization: settings.ballotRandomization,
          notaEnabled: settings.notaEnabled,
          otpTtlSeconds: settings.otpTtlSeconds,
        }
      : null,
    now: new Date().toISOString(),
  })
}

// PUT /api/election — admin updates election meta (name, university, times).
export async function PUT(req: NextRequest) {
  const { requireAdmin } = await import('@/lib/guards')
  const auth = await requireAdmin(req)
  if (auth instanceof Response) return auth
  const body = await req.json().catch(() => ({}))
  const { name, university, academicSession, startTime, endTime } = body
  const data: Record<string, unknown> = {}
  if (typeof name === 'string') data.name = name
  if (typeof university === 'string') data.university = university
  if (typeof academicSession === 'string') data.academicSession = academicSession
  if (startTime) data.startTime = new Date(startTime)
  if (endTime) data.endTime = new Date(endTime)
  const { db } = await import('@/lib/db')
  const updated = await db.election.update({ where: { id: 'default' }, data })
  const { writeAudit, getClientIp } = await import('@/lib/election')
  await writeAudit({
    actorId: auth.admin!.id,
    actorRole: auth.admin!.role,
    actorName: auth.admin!.name,
    action: 'ELECTION_UPDATE',
    details: data,
    ip: getClientIp(req),
  })
  return json({ ok: true, election: updated })
}
