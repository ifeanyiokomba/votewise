import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getElectionContext, computeLiveStatus, json, errorJson } from '@/lib/election'
import { requireOfficial } from '@/lib/guards'
import { writeAudit, getClientIp } from '@/lib/election'

export const dynamic = 'force-dynamic'

// GET /api/election — public election metadata + settings.
export async function GET() {
  const { election, settings } = await getElectionContext()
  if (!election) return json({ error: 'Election not configured' }, 404)
  return json({
    id: election.id,
    name: election.name,
    university: election.university,
    academicSession: election.academicSession,
    status: election.status,
    liveStatus: computeLiveStatus(election.status, election.startTime, election.endTime),
    startTime: election.startTime,
    endTime: election.endTime,
    accreditationStart: election.accreditationStart,
    accreditationEnd: election.accreditationEnd,
    settings: settings
      ? {
          publicLiveResults: settings.publicLiveResults,
          showTurnout: settings.showTurnout,
          requireOtp: settings.requireOtp,
          requireAccreditation: settings.requireAccreditation,
          ballotRandomization: settings.ballotRandomization,
          notaEnabled: settings.notaEnabled,
          singleDeviceEnforcement: settings.singleDeviceEnforcement,
          otpTtlSeconds: settings.otpTtlSeconds,
        }
      : null,
    now: new Date().toISOString(),
  })
}

// PUT /api/election — admin updates election meta.
export async function PUT(req: NextRequest) {
  const auth = await requireOfficial(req, 'election.manage')
  if (auth instanceof Response) return auth
  const body = await req.json().catch(() => ({}))
  const { name, university, academicSession, startTime, endTime, accreditationStart, accreditationEnd } = body
  const data: Record<string, unknown> = {}
  if (typeof name === 'string') data.name = name
  if (typeof university === 'string') data.university = university
  if (typeof academicSession === 'string') data.academicSession = academicSession
  if (startTime) data.startTime = new Date(startTime)
  if (endTime) data.endTime = new Date(endTime)
  if (accreditationStart) data.accreditationStart = new Date(accreditationStart)
  if (accreditationEnd) data.accreditationEnd = new Date(accreditationEnd)
  const updated = await db.electionSession.update({ where: { id: (auth as any).official ? await currentElectionId() : 'default' } as any, data })
  await writeAudit({ actorId: (auth as any).official.id, actorRole: (auth as any).official.role, actorName: (auth as any).official.name, action: 'ELECTION_UPDATE', details: data, ip: getClientIp(req) })
  return json({ ok: true, election: updated })
}

async function currentElectionId() {
  const e = await db.electionSession.findFirst({ orderBy: { createdAt: 'desc' } })
  return e?.id || 'default'
}
