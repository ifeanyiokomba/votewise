import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { getPricingPlans, seedPricingData } from '@/lib/bspcm'

export const dynamic = 'force-dynamic'

// GET /api/bspcm/pricing — Get all pricing plans (public)
export async function GET() {
  // Seed if needed
  await seedPricingData().catch(() => {})
  const plans = await getPricingPlans()
  return json({
    plans: plans.map((p) => ({
      ...p,
      features: p.features ? JSON.parse(p.features) : [],
    })),
  })
}
