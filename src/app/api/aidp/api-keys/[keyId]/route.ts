import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { revokeApiKey } from '@/lib/aidp'
import { verifyAccessToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// DELETE /api/aidp/api-keys/[keyId] — Revoke API key
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ keyId: string }> }) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error

  const { keyId } = await params
  const auth = verifyAccessToken(req)
  await revokeApiKey(orgResult.id, keyId, auth?.email)
  return json({ ok: true, message: 'API key revoked' })
}
