import { db } from '@/lib/db'
import { json, getElectionContext } from '@/lib/election'

export const dynamic = 'force-dynamic'

// GET /api/vote-feed — public recent vote feed (last 30 votes with position titles).
export async function GET() {
  const { election } = await getElectionContext()
  if (!election) return json({ feed: [] })
  const recent = await db.encryptedVote.findMany({
    where: { electionSessionId: election.id },
    take: 30,
    orderBy: { createdAt: 'desc' },
    select: { id: true, positionId: true, createdAt: true },
  })
  // Enrich with position titles
  const posIds = [...new Set(recent.map((v) => v.positionId))]
  const positions = await db.position.findMany({ where: { id: { in: posIds } }, select: { id: true, title: true, slug: true } })
  const posMap = new Map(positions.map((p) => [p.id, p]))
  const feed = recent.map((v) => ({
    id: v.id,
    position: posMap.get(v.positionId)?.title || 'Unknown',
    positionSlug: posMap.get(v.positionId)?.slug || '',
    at: v.createdAt,
  }))
  return json({ feed, total: feed.length })
}
