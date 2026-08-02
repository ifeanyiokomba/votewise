import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { deleteIntegration, updateIntegrationStatus } from '@/lib/aidp'

export const dynamic = 'force-dynamic'

// PATCH /api/aidp/integrations/[integrationId] — Update status
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ integrationId: string }> }) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error

  const { integrationId } = await params
  const body = await req.json().catch(() => ({}))

  if (body.action === 'delete') {
    await deleteIntegration(orgResult.id, integrationId)
    return json({ ok: true, message: 'Integration deleted' })
  }

  await updateIntegrationStatus(orgResult.id, integrationId, body.status, body.error)
  return json({ ok: true, message: 'Integration updated' })
}
