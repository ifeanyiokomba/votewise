import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { getCurrentOfficial } from '@/lib/guards'
import { verifyCredential } from '@/lib/domains/credential-manager'

export const dynamic = 'force-dynamic'

// POST /api/admin/credentials/[key]/verify — test a credential against the provider
export async function POST(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const official = await getCurrentOfficial(req)
  if (!official || (official.role !== 'SUPER_ADMIN' && official.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }

  const { key } = await params
  try {
    const result = await verifyCredential(key)
    return json({ key, ...result })
  } catch (e: any) {
    return errorJson(e.message || 'Verification failed', 400)
  }
}
