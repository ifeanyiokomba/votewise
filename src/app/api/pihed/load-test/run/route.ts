import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import { runLoadTest } from '@/lib/infra/load-test'

export const dynamic = 'force-dynamic'

// POST /api/pihed/load-test/run — Run a load test
// Body: { preset: '10k'|'50k'|'100k'|'500k'|'1m' }
// Platform admin only.
//
// In the sandbox this simulates the test (3s). In production it would
// invoke k6 as a subprocess and stream results.
export async function POST(req: NextRequest) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth || (auth.role !== 'SUPER_ADMIN' && auth.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }

  const body = await req.json().catch(() => ({}))
  const preset = body.preset || '10k'

  try {
    const result = await runLoadTest(preset)
    return json({ result, message: `Load test complete: ${result.verdict}` })
  } catch (e: any) {
    return errorJson(e.message || 'Failed to run load test', 400)
  }
}
