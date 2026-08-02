import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import { toggleAlertRule } from '@/lib/infra/alerting'

export const dynamic = 'force-dynamic'

// PATCH /api/pihed/alerts/rules/[ruleId]/toggle — Enable/disable an alert rule
// Body: { enabled: boolean }
// Platform admin only.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ ruleId: string }> }) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth || (auth.role !== 'SUPER_ADMIN' && auth.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }

  const { ruleId } = await params
  const body = await req.json().catch(() => ({}))
  if (typeof body.enabled !== 'boolean') {
    return errorJson('enabled (boolean) is required', 400)
  }

  try {
    const rule = await toggleAlertRule(ruleId, body.enabled)
    return json({ rule, message: `Alert rule ${body.enabled ? 'enabled' : 'disabled'}` })
  } catch (e: any) {
    return errorJson(e.message || 'Failed to toggle rule', 400)
  }
}
