import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import { acknowledgeAlert } from '@/lib/infra/alerting'

export const dynamic = 'force-dynamic'

// POST /api/pihed/alerts/[alertId]/acknowledge — Acknowledge an alert
// Platform admin only.
export async function POST(req: NextRequest, { params }: { params: Promise<{ alertId: string }> }) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth || (auth.role !== 'SUPER_ADMIN' && auth.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }

  const { alertId } = await params
  try {
    const event = await acknowledgeAlert(alertId, auth.email)
    return json({ event, message: 'Alert acknowledged' })
  } catch (e: any) {
    return errorJson(e.message || 'Failed to acknowledge alert', 400)
  }
}
