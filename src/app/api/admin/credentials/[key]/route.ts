import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { getCurrentOfficial } from '@/lib/guards'
import { deleteCredential } from '@/lib/domains/credential-manager'

export const dynamic = 'force-dynamic'

// DELETE /api/admin/credentials/[key] — remove a credential
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const official = await getCurrentOfficial(req)
  if (!official || (official.role !== 'SUPER_ADMIN' && official.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }

  const { key } = await params
  try {
    await deleteCredential(key)
    return json({ message: `Credential ${key} removed` })
  } catch (e: any) {
    return errorJson(e.message || 'Failed to remove credential', 400)
  }
}
