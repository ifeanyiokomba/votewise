import { NextRequest } from 'next/server'
import { json } from '@/lib/election'
import { runReadinessCheck } from '@/lib/pihed'

export const dynamic = 'force-dynamic'

// GET /api/pihed/health — Basic health check (for load balancer / Docker)
export async function GET() {
  try {
    const result = await runReadinessCheck()
    const status = result.ready ? 200 : 503
    return json({ ok: result.ready, ...result }, status)
  } catch (e: any) {
    return json({ ok: false, error: e.message }, 503)
  }
}
