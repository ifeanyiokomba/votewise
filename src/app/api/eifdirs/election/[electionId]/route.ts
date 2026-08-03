import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { getCurrentOfficial } from '@/lib/guards'
import {
  getElectionRiskScore, getElectionIntegrityScore, scoreToThreatLevel, getElectionLock,
} from '@/lib/eifdirs'

export const dynamic = 'force-dynamic'

// GET /api/eifdirs/election/[electionId] — Per-election security status
// Returns integrity score, threat level, and election lock info.
export async function GET(req: NextRequest, { params }: { params: Promise<{ electionId: string }> }) {
  // Auth check — closes the endpoint authentication gap (audit finding)
  const official = await getCurrentOfficial(req)
  if (!official) return errorJson('Unauthorized', 401)
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error

  const { electionId } = await params

  const election = await db.electionSession.findUnique({
    where: { id: electionId },
    select: { id: true, name: true, status: true, organizationId: true, startTime: true, endTime: true },
  })
  if (!election || election.organizationId !== orgResult.id) {
    return errorJson('Election not found', 404)
  }

  const [riskAssessment, integrityScore, lock] = await Promise.all([
    getElectionRiskScore(electionId),
    getElectionIntegrityScore(electionId),
    getElectionLock(electionId),
  ])

  return json({
    election: {
      id: election.id,
      name: election.name,
      status: election.status,
      startTime: election.startTime,
      endTime: election.endTime,
    },
    integrityScore,
    riskScore: riskAssessment.score,
    threatLevel: scoreToThreatLevel(riskAssessment.score),
    riskFactors: riskAssessment.factors,
    lock: lock || null,
  })
}
