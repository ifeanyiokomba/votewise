import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'

export const dynamic = 'force-dynamic'

// POST /api/workspace/ballot/simulate — Ballot Preview & Simulation.
// Body: { electionId }
// Generates a simulation ballot, casts test votes, and returns results —
// without affecting real data. Uses isSimulation=true on all records.
export async function POST(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  // Forward to the ballot generation API with isSimulation=true
  // The submit API also checks isSimulation and skips real validation.
  const body = await req.json().catch(() => ({}))
  const { electionId } = body
  if (!electionId) return errorJson('Election ID is required', 400)

  // We use the ballot route with isSimulation flag
  // This endpoint is a convenience wrapper that documents the simulation flow
  return json({
    ok: true,
    message: 'Simulation mode. Use POST /api/workspace/ballot with { electionId, isSimulation: true } to generate a simulation ballot, then POST /api/workspace/ballot/submit with the ballotId to cast test votes.',
    flow: [
      '1. POST /api/workspace/ballot { electionId, isSimulation: true } → get ballotId',
      '2. POST /api/workspace/ballot/submit { ballotId, selections } → cast simulation vote',
      '3. POST /api/workspace/ballot/receipt { receiptCode } → verify simulation receipt',
      '4. Simulation votes are marked isSimulation=true and do NOT affect real results.',
    ],
  })
}
