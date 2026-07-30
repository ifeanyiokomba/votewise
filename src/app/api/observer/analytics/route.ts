import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json } from '@/lib/election'
import { requireOfficial } from '@/lib/guards'

export const dynamic = 'force-dynamic'

// GET /api/observer/analytics — live analytics (observer role).
export async function GET(req: NextRequest) {
  const auth = await requireOfficial(req, 'analytics.view')
  if (auth instanceof Response) return auth
  const ctx = (auth as any).ctx

  const voterWhere = ctx.role === 'FACULTY_OFFICER' ? { facultyId: ctx.scopeFacultyId }
    : ctx.role === 'DEPARTMENT_OFFICER' ? { departmentId: ctx.scopeDepartmentId } : {}

  const [totalVoters, voted, pending, ticketsOpen, ticketsResolved, totalVotes] = await Promise.all([
    db.voter.count({ where: voterWhere }),
    db.voter.count({ where: { ...voterWhere, hasVoted: true } }),
    db.voter.count({ where: { ...voterWhere, hasVoted: false } }),
    db.supportTicket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
    db.supportTicket.count({ where: { status: 'RESOLVED' } }),
    db.encryptedVote.count(),
  ])

  // Turnout by faculty (unless scoped).
  const faculties = ctx.role === 'FACULTY_OFFICER'
    ? await db.faculty.findMany({ where: { id: ctx.scopeFacultyId }, include: { _count: { select: { voters: true } } } })
    : await db.faculty.findMany({ include: { _count: { select: { voters: true } } } })
  const votedByFaculty = await db.voter.groupBy({ by: ['facultyId'], where: { ...voterWhere, hasVoted: true }, _count: true })
  const votedFacMap = new Map(votedByFaculty.map((f) => [f.facultyId, f._count]))
  const byFaculty = faculties.map((f) => ({
    id: f.id, name: f.name, code: f.code, total: f._count.voters,
    voted: votedFacMap.get(f.id) || 0,
    pct: f._count.voters > 0 ? Math.round(((votedFacMap.get(f.id) || 0) / f._count.voters) * 1000) / 10 : 0,
  }))

  const votedByLevel = await db.voter.groupBy({ by: ['level'], where: { ...voterWhere, hasVoted: true }, _count: true })
  const totalByLevel = await db.voter.groupBy({ by: ['level'], where: voterWhere, _count: true })
  const levelMap = new Map(totalByLevel.map((l) => [l.level, l._count]))
  const byLevel = votedByLevel.map((l) => ({ level: l.level, voted: l._count, total: levelMap.get(l.level) || 0 }))

  const since = new Date(Date.now() - 60 * 60 * 1000)
  const recent = await db.encryptedVote.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } })
  const election = await db.electionSession.findFirst({ orderBy: { createdAt: 'desc' } })

  return json({
    election: election ? { name: election.name, status: election.status, startTime: election.startTime, endTime: election.endTime } : null,
    summary: { totalVoters, voted, pending, turnoutPct: totalVoters > 0 ? Math.round((voted / totalVoters) * 1000) / 10 : 0, totalVotes, ticketsOpen, ticketsResolved },
    byFaculty, byLevel,
    recentVotes: recent.map((r) => r.createdAt),
  })
}
