import { NextRequest } from 'next/server'
import { json, errorJson, getClientIp, writeAudit, computeAggregatedResults } from '@/lib/election'
import { requireAdmin } from '@/lib/guards'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// POST /api/admin/election/[action]
// action ∈ { publish, open, close, certify, reset }
export async function POST(req: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  const auth = await requireAdmin(req)
  if (auth instanceof Response) return auth
  const { action } = await params
  const election = await db.election.findUnique({ where: { id: 'default' } })
  if (!election) return errorJson('Election not configured', 404)

  const allowed = ['publish', 'open', 'close', 'certify', 'reset']
  if (!allowed.includes(action)) return errorJson('Unknown action', 400)

  let newStatus = election.status
  if (action === 'publish') newStatus = 'published'
  if (action === 'open') newStatus = 'open'
  if (action === 'close') newStatus = 'closed'
  if (action === 'certify') newStatus = 'certified'
  if (action === 'reset') newStatus = 'setup'

  await db.election.update({ where: { id: 'default' }, data: { status: newStatus } })

  if (action === 'certify') {
    const results = await computeAggregatedResults()
    await db.resultSnapshot.create({
      data: {
        electionId: 'default',
        snapshot: JSON.stringify(results),
        totalVotes: results.turnout.voted,
        turnoutPct: results.turnout.turnoutPct,
        certifiedById: auth.admin!.id,
      },
    })
  }

  await writeAudit({
    actorId: auth.admin!.id,
    actorRole: auth.admin!.role,
    actorName: auth.admin!.name,
    action: `ELECTION_${action.toUpperCase()}`,
    details: { from: election.status, to: newStatus },
    ip: getClientIp(req),
  })
  return json({ ok: true, status: newStatus })
}
