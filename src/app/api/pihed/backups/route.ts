import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import { listBackups, getBackupStats } from '@/lib/pihed'

export const dynamic = 'force-dynamic'

// GET /api/pihed/backups — List recent backups + summary stats
// Platform admin only.
export async function GET(req: NextRequest) {
  const auth = await verifyAccessToken(readAccessToken(req))
  if (!auth || (auth.role !== 'SUPER_ADMIN' && auth.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }

  const url = new URL(req.url)
  const limit = Math.min(100, Number(url.searchParams.get('limit')) || 30)

  const [backups, stats] = await Promise.all([
    listBackups(limit),
    getBackupStats(),
  ])

  return json({ backups, stats })
}
