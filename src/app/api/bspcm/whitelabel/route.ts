import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { enableWhiteLabel, disableWhiteLabel } from '@/lib/bspcm'
import { verifyAccessToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// POST /api/bspcm/whitelabel — Enable or disable white label licensing
// Body: { action: 'enable' | 'disable' }
export async function POST(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error

  const body = await req.json().catch(() => ({}))
  if (!body.action) return errorJson('action is required', 400)

  const auth = verifyAccessToken(req)
  const userName = auth?.email || 'Admin'

  try {
    if (body.action === 'enable') {
      await enableWhiteLabel(orgResult.id, userName)
      return json({ ok: true, message: 'White label licensing enabled. VoteWise branding will be hidden.' })
    } else if (body.action === 'disable') {
      await disableWhiteLabel(orgResult.id, userName)
      return json({ ok: true, message: 'White label licensing disabled.' })
    }
    return errorJson(`Unknown action: ${body.action}`, 400)
  } catch (e: any) {
    return errorJson(e.message || 'Failed to update white label', 500)
  }
}
