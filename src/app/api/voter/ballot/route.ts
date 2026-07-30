import { NextRequest } from 'next/server'
import { json, errorJson, getElectionContext, isVotingOpen, seededShuffle } from '@/lib/election'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/voter/ballot — returns the positions this voter is eligible to vote
// in, with candidates (shuffled per-session if ballotRandomization is on).
export async function GET(req: NextRequest) {
  const token = req.headers.get('x-voter-token') || req.headers.get('x-session-token') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return errorJson('No voter session', 401)
  const voter = await db.voter.findUnique({
    where: { sessionToken: token },
    include: { faculty: { select: { name: true, code: true } }, department: { select: { name: true, code: true } } },
  })
  if (!voter || !voter.sessionExpiresAt || voter.sessionExpiresAt < new Date()) {
    return errorJson('Voter session expired', 401)
  }
  if (voter.hasVoted) return errorJson('You have already voted', 403)

  const { election, settings } = await getElectionContext()
  if (!election) return errorJson('Election not configured', 503)
  const votingOpen = isVotingOpen(election.status, election.startTime, election.endTime)
  // Allow viewing the ballot before open, but the cast endpoint will enforce the window.

  // Eligible positions: UNIVERSITY-wide, this voter's FACULTY, this voter's DEPARTMENT.
  const positions = await db.position.findMany({
    where: {
      OR: [
        { scope: 'UNIVERSITY' },
        { scope: 'FACULTY', facultyId: voter.facultyId },
        { scope: 'DEPARTMENT', departmentId: voter.departmentId },
      ],
    },
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
          manifesto: true,
          level: true,
          facultyId: true,
          departmentId: true,
        },
      },
      faculty: { select: { name: true, code: true } },
      department: { select: { name: true, code: true } },
    },
  })

  const seed = settings?.ballotRandomization ? `${voter.id}:${voter.sessionToken}` : 'fixed'
  const ballot = positions.map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    scope: p.scope,
    description: p.description,
    faculty: p.faculty,
    department: p.department,
    candidates: settings?.ballotRandomization ? seededShuffle(p.candidates, seed + p.id) : p.candidates,
    notaEnabled: settings?.notaEnabled ?? true,
  }))

  return json({
    voter: {
      fullName: voter.fullName,
      matric: voter.matric,
      faculty: voter.faculty?.name,
      department: voter.department?.name,
      level: voter.level,
    },
    election: {
      name: election.name,
      votingOpen,
      startTime: election.startTime,
      endTime: election.endTime,
    },
    positions: ballot,
  })
}
