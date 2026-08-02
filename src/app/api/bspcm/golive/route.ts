import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { generateEstimate } from '@/lib/bspcm'

export const dynamic = 'force-dynamic'

// POST /api/bspcm/golive — Go Live wizard: validate + estimate + prepare payment
// Body: { electionId }
export async function POST(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error

  const body = await req.json().catch(() => ({}))
  const { electionId } = body
  if (!electionId) return errorJson('electionId is required', 400)

  // Step 1: Validate election readiness
  const election = await db.electionSession.findUnique({
    where: { id: electionId },
    select: {
      id: true, name: true, status: true, startTime: true, endTime: true,
      organizationId: true, settings: true,
      positions: { select: { id: true, title: true, candidates: { select: { id: true, status: true } } } },
    },
  })
  if (!election || election.organizationId !== orgResult.id) {
    return errorJson('Election not found', 404)
  }

  const checks: Array<{ name: string; passed: boolean; message?: string }> = []

  // Check: Election configured
  checks.push({ name: 'Election configured', passed: !!election.name, message: !election.name ? 'Election name not set' : undefined })

  // Check: Positions configured
  const positionsWithCandidates = election.positions.filter((p) => p.candidates.some((c) => c.status === 'APPROVED'))
  checks.push({ name: 'Positions configured', passed: election.positions.length > 0, message: election.positions.length === 0 ? 'No positions added' : undefined })

  // Check: Candidates complete
  checks.push({ name: 'Candidates complete', passed: positionsWithCandidates.length > 0, message: positionsWithCandidates.length === 0 ? 'No approved candidates' : undefined })

  // Check: Voters imported
  const voterCount = await db.voter.count({ where: { OR: [{ electionSessionId: electionId }, { organizationId: orgResult.id }] } })
  checks.push({ name: 'Voters imported', passed: voterCount > 0, message: voterCount === 0 ? 'No voters imported' : undefined })

  // Check: Election is not already live
  checks.push({ name: 'Election not already live', passed: election.status !== 'LIVE', message: election.status === 'LIVE' ? 'Election is already live' : undefined })

  // Check: Voting window is valid
  const now = new Date()
  checks.push({ name: 'Voting window valid', passed: election.endTime > now, message: election.endTime <= now ? 'Voting window has expired' : undefined })

  // Check: No critical errors (from EIFDIRS)
  const criticalIncidents = await db.fraudIncident.count({
    where: { electionId, severity: 'CRITICAL', status: { in: ['DETECTED', 'OPEN', 'ASSIGNED', 'INVESTIGATING'] } },
  })
  checks.push({ name: 'No critical errors', passed: criticalIncidents === 0, message: criticalIncidents > 0 ? `${criticalIncidents} critical incident(s) unresolved` : undefined })

  const canGoLive = checks.every((c) => c.passed)

  // Step 2: Generate estimate if validation passes
  let estimate = null
  if (canGoLive) {
    const settings = election.settings ? JSON.parse(election.settings) : {}
    const requestedFeatures: string[] = []
    if (settings.notifySms) requestedFeatures.push('sms_credits')
    if (settings.notifyWhatsapp) requestedFeatures.push('whatsapp_notifications')

    estimate = await generateEstimate({
      estimatedVoters: voterCount,
      estimatedElections: 1,
      requestedFeatures,
      planName: 'PAYG',
      orgType: orgResult.category || undefined,
    })
  }

  return json({
    checks,
    canGoLive,
    estimate,
    election: {
      id: election.id,
      name: election.name,
      status: election.status,
      voterCount,
      positionCount: election.positions.length,
      candidateCount: election.positions.reduce((sum, p) => sum + p.candidates.length, 0),
    },
  })
}
