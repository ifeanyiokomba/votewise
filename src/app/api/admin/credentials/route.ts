import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { getCurrentOfficial } from '@/lib/guards'
import { listCredentials, getCredentialStats, setCredential } from '@/lib/domains/credential-manager'

export const dynamic = 'force-dynamic'

// GET /api/admin/credentials — list all credentials + stats (masked values only)
export async function GET(req: NextRequest) {
  const official = await getCurrentOfficial(req)
  if (!official || (official.role !== 'SUPER_ADMIN' && official.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }

  const [credentials, stats] = await Promise.all([
    listCredentials(),
    getCredentialStats(),
  ])

  return json({ credentials, stats })
}

// POST /api/admin/credentials — set or update a credential
export async function POST(req: NextRequest) {
  const official = await getCurrentOfficial(req)
  if (!official || (official.role !== 'SUPER_ADMIN' && official.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }

  const body = await req.json().catch(() => ({}))
  if (!body.key || !body.value) {
    return errorJson('key and value are required', 400)
  }

  try {
    await setCredential(body.key, body.value)
    return json({
      message: `Credential ${body.key} saved successfully`,
      key: body.key,
      masked: body.value.slice(0, 4) + '...' + body.value.slice(-4),
    })
  } catch (e: any) {
    return errorJson(e.message || 'Failed to save credential', 400)
  }
}
