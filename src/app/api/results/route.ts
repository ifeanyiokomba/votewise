import { computeAggregatedResults, getElectionContext, json } from '@/lib/election'

export const dynamic = 'force-dynamic'

// GET /api/results — public aggregated results (respects publicLiveResults flag).
export async function GET() {
  const { settings } = await getElectionContext()
  if (settings && !settings.publicLiveResults) {
    return json({ hidden: true, message: 'Live results are currently disabled by the electoral committee.' })
  }
  const data = await computeAggregatedResults()
  return json(data)
}
