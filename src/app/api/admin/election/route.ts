import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson, computeAggregatedResults, signSnapshot, getClientIp, writeAudit } from '@/lib/election'
import { requireOfficial } from '@/lib/guards'
import { Cache } from '@/lib/cache'

export const dynamic = 'force-dynamic'

// POST /api/admin/election/[action]  action ∈ {publish, open, close, certify, reset}
export async function POST(req: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  const auth = await requireOfficial(req, 'election.manage')
  if (auth instanceof Response) return auth
  const { action } = await params
  const official = (auth as any).official
  const election = await db.electionSession.findFirst({ orderBy: { createdAt: 'desc' } })
  if (!election) return errorJson('Election not configured', 404)

  const allowed = ['publish', 'open', 'close', 'certify', 'reset']
  if (!allowed.includes(action)) return errorJson('Unknown action', 400)

  let newStatus = election.status
  if (action === 'publish') newStatus = 'PUBLISHED'
  if (action === 'open') newStatus = 'VOTING'
  if (action === 'close') newStatus = 'CLOSED'
  if (action === 'certify') newStatus = 'CERTIFIED'
  if (action === 'reset') newStatus = 'DRAFT'

  await db.electionSession.update({ where: { id: election.id }, data: { status: newStatus } })
  Cache.clear() // bust all caches

  if (action === 'certify') {
    const results = await computeAggregatedResults(true)
    const snapshotJson = JSON.stringify(results)
    await db.resultSnapshot.create({
      data: {
        electionId: election.id,
        snapshot: snapshotJson,
        signature: signSnapshot(snapshotJson),
        totalVotes: results.turnout.voted,
        turnoutPct: results.turnout.turnoutPct,
        certifiedById: official.id,
      },
    })
    // Note: EncryptedVote mirroring has been removed. The legacy
    // /api/vote/cast route is deprecated (returns 410 Gone). All vote
    // casting now goes through VoteRecord via the workspace flow.
    // CandidateTally provides fast live-result reads.
  }

  await writeAudit({
    actorId: official.id, actorRole: official.role, actorName: official.name,
    action: `ELECTION_${action.toUpperCase()}`, details: { from: election.status, to: newStatus }, ip: getClientIp(req),
    electionId: election.id,
  })
  return json({ ok: true, status: newStatus })
}
