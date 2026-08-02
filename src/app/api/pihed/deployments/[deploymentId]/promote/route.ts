import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import { promoteCanary } from '@/lib/pihed'

export const dynamic = 'force-dynamic'

// POST /api/pihed/deployments/[deploymentId]/promote
// Promote a canary deployment to the next traffic percentage (25→50→100).
// Platform admin only.
export async function POST(req: NextRequest, { params }: { params: Promise<{ deploymentId: string }> }) {
  const auth = await verifyAccessToken(readAccessToken(req))
  if (!auth || (auth.role !== 'SUPER_ADMIN' && auth.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }

  const { deploymentId } = await params
  try {
    const updated = await promoteCanary(deploymentId)
    return json({ deployment: updated, message: `Canary promoted to ${updated.canaryPct}%` })
  } catch (e: any) {
    return errorJson(e.message || 'Failed to promote canary', 400)
  }
}
