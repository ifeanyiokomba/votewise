import { db } from '@/lib/db'
import { json } from '@/lib/election'

export const dynamic = 'force-dynamic'

export async function GET() {
  const candidates = await db.candidate.findMany({
    where: { status: 'APPROVED' },
    orderBy: [{ position: { order: 'asc' } }, { displayOrder: 'asc' }],
    include: {
      position: { select: { id: true, title: true, slug: true, scope: true } },
      faculty: { select: { id: true, name: true, code: true } },
      department: { select: { id: true, name: true, code: true } },
      politicalParty: { select: { id: true, name: true, acronym: true, colour: true } },
    },
  })
  return json({ candidates })
}
