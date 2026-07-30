// AfriVote SUG — cleanup duplicate candidates.
// Keeps the candidate with the most votes (or the oldest) per (name, position)
// and reassigns any votes from duplicates to the kept candidate, then deletes
// the duplicates.

import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

async function main() {
  const candidates = await db.candidate.findMany({
    include: { position: { select: { id: true, title: true } } },
  })
  // Group by (fullName + positionId)
  const groups = new Map<string, typeof candidates>()
  for (const c of candidates) {
    const key = `${c.fullName}|${c.positionId}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(c)
  }
  let deleted = 0
  for (const [, group] of groups) {
    if (group.length <= 1) continue
    // Count votes per candidate
    const withCounts = await Promise.all(
      group.map(async (c) => ({
        c,
        votes: await db.encryptedVote.count({ where: { candidateId: c.id } }),
      }))
    )
    // Sort: most votes first, then oldest
    withCounts.sort((a, b) => b.votes - a.votes || a.c.createdAt.getTime() - b.c.createdAt.getTime())
    const keep = withCounts[0].c
    const dups = withCounts.slice(1)
    console.log(`  ${keep.fullName} (${keep.position.title}): keeping ${keep.id} (${withCounts[0].votes} votes), removing ${dups.length} dups`)
    for (const d of dups) {
      // Reassign any votes on the duplicate to the kept candidate
      await db.encryptedVote.updateMany({ where: { candidateId: d.c.id }, data: { candidateId: keep.id } })
      await db.candidate.delete({ where: { id: d.c.id } })
      deleted++
    }
  }
  console.log(`[cleanup] deleted ${deleted} duplicate candidates`)
  // Verify
  const after = await db.candidate.count()
  console.log(`[cleanup] ${after} candidates remain`)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => db.$disconnect())
