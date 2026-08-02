import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { deleteWebhook } from '@/lib/aidp'

export const dynamic = 'force-dynamic'

// DELETE /api/aidp/webhooks/[webhookId] — Delete webhook
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ webhookId: string }> }) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error

  const { webhookId } = await params
  await deleteWebhook(orgResult.id, webhookId)
  return json({ ok: true, message: 'Webhook deleted' })
}
