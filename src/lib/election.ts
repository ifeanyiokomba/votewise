// Election status helpers + shared result aggregation.
import { db } from '@/lib/db'

export type ElectionStatus = 'setup' | 'published' | 'open' | 'closed' | 'certified'

export function computeLiveStatus(
  status: string,
  start: Date,
  end: Date
): ElectionStatus {
  const now = new Date()
  if (status === 'certified') return 'certified'
  if (status === 'setup') return 'setup'
  if (now >= start && now < end) return 'open'
  if (now >= end) return 'closed'
  return (status as ElectionStatus) || 'setup'
}

export function isVotingOpen(status: string, start: Date, end: Date): boolean {
  return computeLiveStatus(status, start, end) === 'open'
}

export async function getElectionContext() {
  const election = await db.election.findUnique({ where: { id: 'default' } })
  const settings = await db.electionSetting.findUnique({ where: { id: 'default' } })
  return { election, settings }
}

export async function writeAudit(entry: {
  actorId: string
  actorRole: string
  actorName: string
  action: string
  details?: Record<string, unknown>
  ip?: string | null
}) {
  try {
    await db.auditLog.create({
      data: {
        electionId: 'default',
        actorId: entry.actorId,
        actorRole: entry.actorRole,
        actorName: entry.actorName,
        action: entry.action,
        details: entry.details ? JSON.stringify(entry.details) : null,
        ip: entry.ip || null,
      },
    })
  } catch (e) {
    console.error('[audit] failed to write log', e)
  }
}

// Fisher–Yates shuffle (seedable) for ballot randomization.
export function seededShuffle<T>(arr: T[], seed: string): T[] {
  const out = [...arr]
  // simple deterministic PRNG (xmur3 + sfc32)
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let a = h >>> 0
  const rand = () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// Standard JSON response helpers.
export function json(body: unknown, status = 200, extra: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...extra },
  })
}

export function errorJson(message: string, status = 400, details?: unknown) {
  return json({ error: message, details }, status)
}

export function getClientIp(req: Request): string | null {
  return req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null
}

// Aggregated results (same shape as the websocket service emits).
export async function computeAggregatedResults() {
  const { election, settings } = await getElectionContext()
  const positions = await db.position.findMany({
    orderBy: { order: 'asc' },
    include: {
      candidates: {
        where: { status: 'APPROVED' },
        orderBy: { displayOrder: 'asc' },
        select: {
          id: true,
          fullName: true,
          slug: true,
          photoUrl: true,
          slogan: true,
          facultyId: true,
          departmentId: true,
          level: true,
          manifesto: true,
        },
      },
    },
  })
  const votes = await db.vote.findMany({ select: { positionId: true, candidateId: true, isNota: true } })

  const positionResults = positions.map((p) => {
    const posVotes = votes.filter((v) => v.positionId === p.id)
    const total = posVotes.length
    const candidates = p.candidates.map((c) => ({
      ...c,
      votes: posVotes.filter((v) => v.candidateId === c.id).length,
    }))
    const notaVotes = posVotes.filter((v) => v.isNota).length
    return {
      id: p.id,
      title: p.title,
      slug: p.slug,
      scope: p.scope,
      description: p.description,
      totalVotes: total,
      notaVotes: settings?.notaEnabled ? notaVotes : 0,
      candidates: candidates
        .map((c) => ({ ...c, pct: total > 0 ? Math.round((c.votes / total) * 1000) / 10 : 0 }))
        .sort((a, b) => b.votes - a.votes),
    }
  })

  const totalVoters = await db.voter.count()
  const voted = await db.voter.count({ where: { hasVoted: true } })
  const turnoutPct = totalVoters > 0 ? Math.round((voted / totalVoters) * 1000) / 10 : 0

  return {
    election: election
      ? {
          name: election.name,
          university: election.university,
          academicSession: election.academicSession,
          status: election.status,
          startTime: election.startTime,
          endTime: election.endTime,
          liveStatus: computeLiveStatus(election.status, election.startTime, election.endTime),
          publicResults: settings?.publicLiveResults ?? true,
        }
      : null,
    settings: settings
      ? {
          publicLiveResults: settings.publicLiveResults,
          showTurnout: settings.showTurnout,
          requireOtp: settings.requireOtp,
          ballotRandomization: settings.ballotRandomization,
          notaEnabled: settings.notaEnabled,
        }
      : null,
    positions: positionResults,
    turnout: { totalVoters, voted, turnoutPct, remaining: totalVoters - voted },
    generatedAt: new Date().toISOString(),
  }
}
