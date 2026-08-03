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

export async function screenCandidate(id: string, status: 'APPLICATION' | 'ELIGIBILITY_CHECK' | 'DOCUMENT_REVIEW' | 'APPROVED' | 'MANIFESTO_UPLOAD' | 'CAMPAIGN_ASSETS' | 'PUBLISHED' | 'DISQUALIFIED' | 'WITHDRAWN', notes?: string) {
  const candidate = await db.candidate.update({
    where: { id },
    data: { screeningStatus: status, screeningNotes: notes },
  })

  const eventMap: Record<string, string> = {
    APPROVED: 'CANDIDATE_APPROVED',
    DISQUALIFIED: 'CANDIDATE_DISQUALIFIED',
    WITHDRAWN: 'CANDIDATE_WITHDRAWN',
    PUBLISHED: 'CANDIDATE_APPROVED',
  }
  await emitEvent(eventMap[status] || 'CANDIDATE_SCREENED', {
    electionId: candidate.electionSessionId || undefined,
    data: { candidateId: id, status },
  })

  return candidate
}

/**
 * Part 5 Candidate Workflow (7 stages):
 * APPLICATION → ELIGIBILITY_CHECK → DOCUMENT_REVIEW → APPROVED →
 * MANIFESTO_UPLOAD → CAMPAIGN_ASSETS → PUBLISHED
 */
export const CANDIDATE_WORKFLOW_STAGES = [
  'APPLICATION',
  'ELIGIBILITY_CHECK',
  'DOCUMENT_REVIEW',
  'APPROVED',
  'MANIFESTO_UPLOAD',
  'CAMPAIGN_ASSETS',
  'PUBLISHED',
] as const

export function getCandidateStageLabel(stage: string): string {
  const labels: Record<string, string> = {
    APPLICATION: 'Application Submitted',
    ELIGIBILITY_CHECK: 'Eligibility Check',
    DOCUMENT_REVIEW: 'Document Review',
    APPROVED: 'Approved',
    MANIFESTO_UPLOAD: 'Manifesto Upload',
    CAMPAIGN_ASSETS: 'Campaign Assets',
    PUBLISHED: 'Published',
    DISQUALIFIED: 'Disqualified',
    WITHDRAWN: 'Withdrawn',
  }
  return labels[stage] || stage
}

export function getCandidateStageColor(stage: string): string {
  const colors: Record<string, string> = {
    APPLICATION: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300',
    ELIGIBILITY_CHECK: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    DOCUMENT_REVIEW: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    APPROVED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    MANIFESTO_UPLOAD: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    CAMPAIGN_ASSETS: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    PUBLISHED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    DISQUALIFIED: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
    WITHDRAWN: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300',
  }
  return colors[stage] || colors.APPLICATION
}

export function canTransitionCandidateStage(from: string, to: string): boolean {
  const stages = [...CANDIDATE_WORKFLOW_STAGES, 'DISQUALIFIED', 'WITHDRAWN']
  const fromIdx = stages.indexOf(from)
  const toIdx = stages.indexOf(to)
  if (fromIdx === -1 || toIdx === -1) return false
  // Forward transitions allowed
  if (toIdx > fromIdx) return true
  // DISQUALIFIED and WITHDRAWN are terminal — no transitions out
  if (from === 'DISQUALIFIED' || from === 'WITHDRAWN') return false
  // Allow backward transitions for admin correction (before PUBLISHED)
  if (from === 'PUBLISHED') return false
  return true
}
