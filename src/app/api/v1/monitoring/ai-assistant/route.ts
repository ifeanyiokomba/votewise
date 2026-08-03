import { NextRequest } from 'next/server'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import { errorResponse } from '@/lib/errors'
import { runMonitoringAssistant } from '@/lib/domains/ai-monitor'

export const dynamic = 'force-dynamic'

// GET /api/v1/monitoring/ai-assistant — run the AI election monitoring assistant
// Returns alerts + recommendations (never takes autonomous action)
export async function GET(req: NextRequest) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth) return errorResponse('UNAUTHORIZED')

  const url = new URL(req.url)
  const orgId = url.searchParams.get('org') || undefined

  const report = await runMonitoringAssistant(orgId)

  return Response.json({ success: true, data: report })
}
