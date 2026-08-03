// VoteWise — Candidate Service (Enterprise Audit Part 4)
//
// Owns: candidate CRUD, screening workflow, profile management.

import { db } from '@/lib/db'
import { emitEvent } from '@/lib/event-bus'

export async function listCandidates(electionId: string, positionId?: string) {
  const where: any = { electionSessionId: electionId }
  if (positionId) where.positionId = positionId
  return db.candidate.findMany({
    where,
    orderBy: { fullName: 'asc' },
    select: {
      id: true, fullName: true, slug: true, photoUrl: true, slogan: true,
      positionId: true, screeningStatus: true, biography: true, manifesto: true,
      campaignVideoUrl: true, department: true, level: true,
    },
  })
}

export async function getCandidate(id: string) {
  return db.candidate.findUnique({ where: { id } })
}

export async function createCandidate(data: any) {
  const candidate = await db.candidate.create({ data })
  await emitEvent('CANDIDATE_NOMINATED', {
    electionId: candidate.electionSessionId || undefined,
    data: { candidateId: candidate.id, name: candidate.fullName },
  })
  return candidate
}

export async function screenCandidate(id: string, status: 'APPROVED' | 'DISQUALIFIED' | 'WITHDRAWN', notes?: string) {
  const candidate = await db.candidate.update({
    where: { id },
    data: { screeningStatus: status, screeningNotes: notes },
  })

  const eventMap: Record<string, string> = {
    APPROVED: 'CANDIDATE_APPROVED',
    DISQUALIFIED: 'CANDIDATE_DISQUALIFIED',
    WITHDRAWN: 'CANDIDATE_WITHDRAWN',
  }
  await emitEvent(eventMap[status] || 'CANDIDATE_SCREENED', {
    electionId: candidate.electionSessionId || undefined,
    data: { candidateId: id, status },
  })

  return candidate
}
