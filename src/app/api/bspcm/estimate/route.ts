import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { generateEstimate } from '@/lib/bspcm'

export const dynamic = 'force-dynamic'

// POST /api/bspcm/estimate — Public cost estimator (no auth required)
// Body: { estimatedVoters, estimatedElections?, requestedFeatures?, planName?, orgType? }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  if (!body.estimatedVoters || body.estimatedVoters < 1) {
    return errorJson('estimatedVoters is required', 400)
  }

  try {
    const estimate = await generateEstimate({
      estimatedVoters: parseInt(body.estimatedVoters),
      estimatedElections: body.estimatedElections ? parseInt(body.estimatedElections) : 1,
      requestedFeatures: body.requestedFeatures || [],
      planName: body.planName,
      orgType: body.orgType,
    })
    return json(estimate)
  } catch (e: any) {
    return errorJson(e.message || 'Failed to generate estimate', 500)
  }
}
