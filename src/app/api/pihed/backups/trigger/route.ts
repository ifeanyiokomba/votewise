import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import { triggerBackup } from '@/lib/pihed'

export const dynamic = 'force-dynamic'

// POST /api/pihed/backups/trigger — Trigger a manual backup
// Body: { type?: 'manual' | 'hourly' | 'daily' }
// Platform admin only.
export async function POST(req: NextRequest) {
  const auth = await verifyAccessToken(readAccessToken(req))
  if (!auth || (auth.role !== 'SUPER_ADMIN' && auth.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }

  let body: any = {}
  try {
    body = await req.json()
  } catch {
    /* empty */
  }

  const type = ['manual', 'hourly', 'daily', 'weekly', 'monthly'].includes(body.type)
    ? body.type
    : 'manual'

  const record = await triggerBackup(type, auth.email)
  return json({ backup: record, message: 'Backup completed successfully' })
}
