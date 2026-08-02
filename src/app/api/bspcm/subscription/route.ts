import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { upgradeSubscription, downgradeSubscription, processRenewalReminders } from '@/lib/bspcm'
import { verifyAccessToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// POST /api/bspcm/subscription — Upgrade or downgrade subscription
// Body: { action: 'upgrade' | 'downgrade', newPlan }
export async function POST(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error

  const body = await req.json().catch(() => ({}))
  if (!body.action || !body.newPlan) return errorJson('action and newPlan are required', 400)

  const auth = verifyAccessToken(req)
  const userName = auth?.email || 'Admin'

  try {
    if (body.action === 'upgrade') {
      await upgradeSubscription(orgResult.id, body.newPlan, userName)
      return json({ ok: true, message: `Subscription upgraded to ${body.newPlan}` })
    } else if (body.action === 'downgrade') {
      await downgradeSubscription(orgResult.id, body.newPlan, userName)
      return json({ ok: true, message: `Subscription downgraded to ${body.newPlan}` })
    }
    return errorJson(`Unknown action: ${body.action}`, 400)
  } catch (e: any) {
    return errorJson(e.message || 'Failed to update subscription', 400)
  }
}

// GET /api/bspcm/subscription?action=renewal-reminders — Process renewal reminders (admin/cron)
export async function GET(req: NextRequest) {
  const action = new URL(req.url).searchParams.get('action')
  if (action === 'renewal-reminders') {
    const result = await processRenewalReminders()
    return json({ ok: true, ...result })
  }
  return errorJson('Unknown action', 400)
}
