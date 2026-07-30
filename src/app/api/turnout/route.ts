import { db } from '@/lib/db'
import { json, getElectionContext } from '@/lib/election'

export const dynamic = 'force-dynamic'

// GET /api/turnout — public turnout by faculty (only if showTurnout is enabled).
export async function GET() {
  const { settings } = await getElectionContext()
  if (settings && !settings.showTurnout) {
    return json({ hidden: true, message: 'Turnout data is currently disabled.' })
  }
  const faculties = await db.faculty.findMany({
    include: { _count: { select: { voters: true } } },
    orderBy: { name: 'asc' },
  })
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
  const totalVoters = byFaculty.reduce((a, f) => a + f.total, 0)
  const voted = byFaculty.reduce((a, f) => a + f.voted, 0)
  return json({
    byFaculty,
    summary: {
      totalVoters,
      voted,
      turnoutPct: totalVoters > 0 ? Math.round((voted / totalVoters) * 1000) / 10 : 0,
    },
  })
}
