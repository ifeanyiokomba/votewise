import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { sendMessage, sendTemplatedMessage } from '@/lib/cnse'

export const dynamic = 'force-dynamic'

// POST /api/cnse/send — Send a message through the communication engine
// Body: { recipientId, recipientName, recipientAddress, channel, fallbackChannels?,
//         category, priority?, subject, body, templateId?, variables?, language? }
export async function POST(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  const body = await req.json().catch(() => ({}))

  // If templateId or category+channel is provided, use templated send
  if (body.templateId || (body.category && body.channel && body.variables)) {
    const result = await sendTemplatedMessage({
      organizationId: org.id,
      electionId: body.electionId,
      recipientId: body.recipientId,
      recipientName: body.recipientName,
      recipientAddress: body.recipientAddress,
      channel: body.channel,
      fallbackChannels: body.fallbackChannels,
      category: body.category,
      priority: body.priority,
      templateId: body.templateId,
      variables: body.variables,
      language: body.language,
    })
    return json({ ok: true, ...result })
  }

  // Direct send (no template)
  const result = await sendMessage({
    organizationId: org.id,
    electionId: body.electionId,
    recipientId: body.recipientId,
    recipientName: body.recipientName,
    recipientAddress: body.recipientAddress,
    channel: body.channel,
    fallbackChannels: body.fallbackChannels,
    category: body.category,
    priority: body.priority,
    subject: body.subject,
    body: body.body,
  })

  return json({ ok: true, ...result })
}
