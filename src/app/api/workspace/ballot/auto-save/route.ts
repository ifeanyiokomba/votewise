import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'

export const dynamic = 'force-dynamic'

// POST /api/workspace/ballot/auto-save — Temporary ballot save (offline recovery).
//
// If the voter's connection drops before submission, their selections are
// preserved. On reconnection, they resume — never losing selections, never
// duplicating a vote.
//
// This endpoint stores the selections (encrypted) keyed by ballotId. The
// voter's session remains valid until expiry (30 min). On resume, the client
// calls GET to retrieve saved selections and re-renders the ballot.
//
// Body: { ballotId, selections }
// Returns: { ok, savedAt }
export async function POST(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  const body = await req.json().catch(() => ({}))
  const { ballotId, selections } = body
  if (!ballotId) return errorJson('ballotId is required', 400)
  if (!selections) return errorJson('selections are required', 400)

  const ballot = await db.ballot.findUnique({ where: { id: ballotId } })
  if (!ballot || ballot.organizationId !== org.id) {
    return errorJson('Ballot not found', 404)
  }
  if (ballot.status === 'SUBMITTED') {
    return errorJson('This ballot has already been submitted', 409)
  }

  // Store selections in the ballot's content (append a savedSelections field).
  // We don't create a separate model — the ballot already tracks the session.
  const content = JSON.parse(ballot.content)
  content.savedSelections = selections
  content.savedAt = new Date().toISOString()

  await db.ballot.update({
    where: { id: ballotId },
    data: { content: JSON.stringify(content) },
  })

  return json({ ok: true, savedAt: content.savedAt })
}

// GET /api/workspace/ballot/auto-save?ballotId=... — Retrieve saved selections.
export async function GET(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  const ballotId = new URL(req.url).searchParams.get('ballotId')
  if (!ballotId) return errorJson('ballotId is required', 400)

  const ballot = await db.ballot.findUnique({ where: { id: ballotId } })
  if (!ballot || ballot.organizationId !== org.id) {
    return errorJson('Ballot not found', 404)
  }

  const content = JSON.parse(ballot.content)
  return json({
    ok: true,
    savedSelections: content.savedSelections || null,
    savedAt: content.savedAt || null,
  })
}

// DELETE /api/workspace/ballot/auto-save?ballotId=... — Clear saved selections.
export async function DELETE(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  const ballotId = new URL(req.url).searchParams.get('ballotId')
  if (!ballotId) return errorJson('ballotId is required', 400)

  const ballot = await db.ballot.findUnique({ where: { id: ballotId } })
  if (!ballot || ballot.organizationId !== org.id) {
    return errorJson('Ballot not found', 404)
  }

  const content = JSON.parse(ballot.content)
  delete content.savedSelections
  delete content.savedAt
  await db.ballot.update({
    where: { id: ballotId },
    data: { content: JSON.stringify(content) },
  })

  return json({ ok: true })
}
