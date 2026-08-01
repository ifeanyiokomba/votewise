import { NextRequest } from 'next/server'
import { json, errorJson, getClientIp } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { initiateLockdown, releaseLockdown } from '@/lib/eifdirs'
import { verifyAccessToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// POST /api/eifdirs/lockdown — Initiate or release emergency lockdown
// Body: { electionId, action: 'initiate' | 'release', reason }
export async function POST(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error

  const body = await req.json().catch(() => ({}))
  const { electionId, action, reason } = body
  if (!electionId || !action || !reason) {
    return errorJson('electionId, action, and reason are required', 400)
  }

  const auth = verifyAccessToken(req)
  const adminName = auth?.email || 'Unknown'
  const adminId = auth?.sub || 'unknown'

  if (action === 'initiate') {
    await initiateLockdown(electionId, reason, adminId, adminName)
    return json({ ok: true, message: 'Emergency lockdown initiated. All voting frozen.' })
  } else if (action === 'release') {
    await releaseLockdown(electionId, reason, adminId, adminName)
    return json({ ok: true, message: 'Emergency lockdown released. Voting resumed.' })
  }

  return errorJson(`Unknown action: ${action}`, 400)
}
