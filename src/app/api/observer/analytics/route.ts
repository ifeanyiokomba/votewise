import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { requireObserver } from '@/lib/guards'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/observer/analytics — live analytics for observers.
export async function GET(req: NextRequest) {
  const auth = await requireObserver(req)
  if (auth instanceof Response) return auth

  const [totalVoters, voted, pending, ticketsOpen, ticketsResolved, totalVotes] = await Promise.all([
    db.voter.count(),
    db.voter.count({ where: { hasVoted: true } }),
    db.voter.count({ where: { hasVoted: false } }),
    db.supportTicket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
    db.supportTicket.count({ where: { status: 'RESOLVED' } }),
    db.vote.count(),
  ])

  // Turnout by faculty.
  const faculties = await db.faculty.findMany({ include: { _count: { select: { voters: true } } } })
  const votedByFaculty = await db.voter.groupBy({
    by: ['facultyId'],
    where: { hasVoted: true },
    _count: true,
  })
  const votedFacMap = new Map(votedByFaculty.map((f) => [f.facultyId, f._count]))
  const byFaculty = faculties.map((f) => ({
    id: f.id,
    name: f.name,
    code: f.code,
    total: f._count.voters,
    voted: votedFacMap.get(f.id) || 0,
    pct: f._count.voters > 0 ? Math.round(((votedFacMap.get(f.id) || 0) / f._count.voters) * 1000) / 10 : 0,
  }))

  // Turnout by level.
  const votedByLevel = await db.voter.groupBy({ by: ['level'], where: { hasVoted: true }, _count: true })
  const totalByLevel = await db.voter.groupBy({ by: ['level'], _count: true })
  const levelMap = new Map(totalByLevel.map((l) => [l.level, l._count]))
  const byLevel = votedByLevel.map((l) => ({ level: l.level, voted: l._count, total: levelMap.get(l.level) || 0 }))

  // Recent votes (last hour timeline).
  const since = new Date(Date.now() - 60 * 60 * 1000)
  const recent = await db.vote.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } })

  const election = await db.election.findUnique({ where: { id: 'default' } })

  return json({
    election: election ? { name: election.name, status: election.status, startTime: election.startTime, endTime: election.endTime } : null,
    summary: { totalVoters, voted, pending, turnoutPct: totalVoters > 0 ? Math.round((voted / totalVoters) * 1000) / 10 : 0, totalVotes, ticketsOpen, ticketsResolved },
    byFaculty,
    byLevel,
    recentVotes: recent.map((r) => r.createdAt),
  })
}
