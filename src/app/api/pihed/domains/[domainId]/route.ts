import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import { removeCustomDomain } from '@/lib/pihed'

export const dynamic = 'force-dynamic'

// DELETE /api/pihed/domains/[domainId]
// Remove a custom domain mapping.
// Platform admin only.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ domainId: string }> }) {
  const auth = await verifyAccessToken(readAccessToken(req))
  if (!auth || (auth.role !== 'SUPER_ADMIN' && auth.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }

  const { domainId } = await params
  try {
    await removeCustomDomain(domainId)
    return json({ message: 'Domain removed' })
  } catch (e: any) {
    return errorJson(e.message || 'Failed to remove domain', 400)
  }
}
