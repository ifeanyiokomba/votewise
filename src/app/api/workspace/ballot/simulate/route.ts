import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { runSimulation, resetSimulation, previewBallot, listSimulations } from '@/lib/sve'

export const dynamic = 'force-dynamic'

// POST /api/workspace/ballot/simulate — Ballot Preview & Simulation.
//
// Before an election goes live, administrators can simulate the entire
// voting process. This lets them verify:
// - Ballot layout + candidate order
// - Voting rules + eligibility
// - Result calculations
// - Receipt verification
//
// All simulation records are marked isSimulation=true and do NOT affect real
// results. resetSimulation() clears them for a clean re-run.
//
// Body: { electionId, action: 'preview' | 'cast' | 'reset' | 'list', selections? }
//   - preview: generate a simulation ballot (no vote cast)
//   - cast: generate ballot + cast test vote + return simulated results
//   - reset: delete all simulation data for this election
//   - list: list recent simulation runs
export async function POST(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  const body = await req.json().catch(() => ({}))
  const { electionId, action = 'preview', selections } = body
  if (!electionId) return errorJson('Election ID is required', 400)

  // Verify the election belongs to this org.
  const { db } = await import('@/lib/db')
  const election = await db.electionSession.findUnique({
    where: { id: electionId },
    select: { id: true, organizationId: true, name: true, status: true },
  })
  if (!election || election.organizationId !== org.id) {
    return errorJson('Election not found', 404)
  }

  switch (action) {
    case 'preview': {
      const ballot = await previewBallot(electionId)
      return json({ ok: true, ballot, message: 'Simulation ballot preview. No vote recorded.' })
    }
    case 'cast': {
      if (!selections || Object.keys(selections).length === 0) {
        return errorJson('Selections are required for the cast action', 400)
      }
      const result = await runSimulation(electionId, selections)
      return json({ ok: true, simulation: result, message: 'Simulation vote recorded. Use action=reset to clear.' })
    }
    case 'reset': {
      const result = await resetSimulation(electionId)
      return json({ ok: true, ...result, message: `Cleared ${result.deletedVotes} simulation votes and ${result.deletedBallots} ballots.` })
    }
    case 'list': {
      const runs = await listSimulations(electionId)
      return json({ ok: true, runs })
    }
    default:
      return errorJson(`Unknown action: ${action}. Valid actions: preview, cast, reset, list.`, 400)
  }
}
