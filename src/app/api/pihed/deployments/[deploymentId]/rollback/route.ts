import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import { rollbackDeployment } from '@/lib/pihed'

export const dynamic = 'force-dynamic'

// POST /api/pihed/deployments/[deploymentId]/rollback
// Rollback a deployment and restore the previous LIVE version.
// Body: { reason?: string }
// Platform admin only.
export async function POST(req: NextRequest, { params }: { params: Promise<{ deploymentId: string }> }) {
  const auth = await verifyAccessToken(readAccessToken(req))
  if (!auth || (auth.role !== 'SUPER_ADMIN' && auth.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }

  const { deploymentId } = await params
  let body: any = {}
  try {
    body = await req.json()
  } catch {
    /* empty */
  }

  try {
    const result = await rollbackDeployment(deploymentId, body.reason)
    return json({
      ...result,
      message: result.restored
        ? 'Rollback complete — previous version restored to LIVE'
        : 'Rollback complete — no previous LIVE version found to restore',
    })
  } catch (e: any) {
    return errorJson(e.message || 'Failed to rollback deployment', 400)
  }
}
