import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/workspace/elections/[id]/notifications/templates
// Returns a static list of notification templates for common election
// scenarios. Each template has placeholders ({electionName}, {endTime},
// {hours}, {electionId}) that the UI fills in before sending.
//
// Org-scoped via requireOrganization — anyone authenticated inside the org
// can view the templates (they're just static text).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Auth check — closes the endpoint authentication gap (audit finding)
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth) return errorJson('Unauthorized', 401)
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult
  const { id: electionId } = await params

  // Verify the election belongs to the resolved org and pull context the
  // templates can pre-fill (name + end time + hours remaining).
  const election = await db.electionSession.findUnique({
    where: { id: electionId },
    select: { id: true, name: true, organizationId: true, status: true, startTime: true, endTime: true },
  })
  if (!election || election.organizationId !== org.id) {
    return errorJson('Election not found', 404)
  }

  const electionName = election.name
  const endTimeStr = election.endTime instanceof Date
    ? election.endTime.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : String(election.endTime)
  const hoursRemaining = election.endTime instanceof Date
    ? Math.max(0, Math.round((election.endTime.getTime() - Date.now()) / 3_600_000))
    : 0

  const templates = [
    {
      id: 'voting-opens',
      title: 'Voting is Now Open',
      message: `Voting is now open for ${electionName}. Cast your vote before ${endTimeStr}.`,
      type: 'SUCCESS',
      description: 'Announce that voting has opened for this election. Pre-fills the election name and end time.',
    },
    {
      id: 'voting-closes-soon',
      title: 'Voting Closes Soon',
      message: `Voting closes in ${hoursRemaining} hours. Cast your vote now!`,
      type: 'WARNING',
      description: 'Urgent reminder sent a few hours before voting closes. Pre-fills the hours remaining.',
    },
    {
      id: 'results-published',
      title: 'Results Published',
      message: `Results for ${electionName} have been published. View them at /results/${electionId}.`,
      type: 'SUCCESS',
      description: 'Notify voters that the election results are now public. Pre-fills the election name + results URL.',
    },
    {
      id: 'election-reminder',
      title: 'Election Reminder',
      message: `This is a reminder to vote in ${electionName}. Your voice matters — make it count.`,
      type: 'INFO',
      description: 'A gentle nudge to voters who haven\'t voted yet. Pre-fills the election name.',
    },
    {
      id: 'custom',
      title: '',
      message: '',
      type: 'INFO',
      description: 'A blank template — write your own title and message from scratch.',
    },
  ]

  return json({
    templates,
    election: {
      id: election.id,
      name: election.name,
      status: election.status,
      startTime: election.startTime instanceof Date ? election.startTime.toISOString() : String(election.startTime),
      endTime: election.endTime instanceof Date ? election.endTime.toISOString() : String(election.endTime),
      hoursRemaining,
    },
  })
}
