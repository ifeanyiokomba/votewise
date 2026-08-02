import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken } from '@/lib/auth'
import { suspendOrganization, activateOrganization } from '@/lib/paoem'

export const dynamic = 'force-dynamic'

// PATCH /api/paoem/organizations/[orgId] — Suspend/activate org
// Body: { action: 'suspend' | 'activate', reason? }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const auth = verifyAccessToken(req)
  if (!auth || (auth.role !== 'SUPER_ADMIN' && auth.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }

  const { orgId } = await params
  const body = await req.json().catch(() => ({}))

  if (body.action === 'suspend') {
    await suspendOrganization(orgId, auth.sub, auth.email, body.reason || 'No reason provided')
    return json({ ok: true, message: 'Organization suspended' })
  } else if (body.action === 'activate') {
    await activateOrganization(orgId, auth.sub, auth.email)
    return json({ ok: true, message: 'Organization activated' })
  }

  return errorJson(`Unknown action: ${body.action}`, 400)
}
