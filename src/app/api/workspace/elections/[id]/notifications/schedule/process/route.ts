import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson, writeAudit, getClientIp } from '@/lib/election'
import { requirePermission } from '@/lib/iam'
import { processDueNotifications } from '@/lib/notification-processor'

export const dynamic = 'force-dynamic'

// Verify the election belongs to the resolved org.
async function getOrgElection(orgId: string, electionId: string) {
  const election = await db.electionSession.findUnique({
    where: { id: electionId },
    select: { id: true, name: true, organizationId: true, status: true },
  })
  if (!election || election.organizationId !== orgId) return null
  return election
}

// ---------------------------------------------------------------------------
// POST /api/workspace/elections/[id]/notifications/schedule/process
// Manually trigger processing of due scheduled notifications for this
// election. This is the "Send Now" button for testing — it forces the
// processor to run immediately (rather than waiting for the next poll).
//
// Requires: election.manage permission.
//
// Returns a summary { processed, sent, failed, details }.
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePermission(req, 'election.manage')
  if (ctx instanceof Response) return ctx
  if (!ctx.org) return errorJson('Organization not found', 404)
  const { id: electionId } = await params

  const election = await getOrgElection(ctx.org.id, electionId)
  if (!election) return errorJson('Election not found', 404)

  // Run the processor scoped to this election + org.
  const result = await processDueNotifications({
    electionId,
    organizationId: ctx.org.id,
    limit: 100,
  })

  // Write an audit log entry — always, even if nothing was processed.
  await writeAudit({
    actorId: ctx.user.id,
    actorRole: ctx.user.role,
    actorName: ctx.user.name,
    action: 'NOTIFICATION_SCHEDULE_PROCESS',
    details: {
      organizationId: ctx.org.id,
      electionId,
      electionName: election.name,
      processed: result.processed,
      sent: result.sent,
      failed: result.failed,
      details: result.details,
    },
    ip: getClientIp(req),
    electionId,
  }).catch(() => {})

  const message =
    result.processed === 0
      ? 'No scheduled notifications are due right now.'
      : `Processed ${result.processed} scheduled notification${result.processed === 1 ? '' : 's'}: ${result.sent} sent, ${result.failed} failed.`

  return json({ ok: true, ...result, message })
}
