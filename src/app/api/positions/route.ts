import { db } from '@/lib/db'
import { json } from '@/lib/election'

export const dynamic = 'force-dynamic'

export async function GET() {
  const positions = await db.position.findMany({
    orderBy: { order: 'asc' },
    include: {
      candidates: {
        where: { status: 'APPROVED' },
        orderBy: { displayOrder: 'asc' },
        select: {
          id: true, fullName: true, slug: true, photoUrl: true, slogan: true,
          manifesto: true, campaignVideoUrl: true, level: true, facultyId: true, departmentId: true,
          politicalParty: { select: { id: true, name: true, acronym: true, colour: true } },
        },
      },
      faculty: { select: { id: true, name: true, code: true } },
      department: { select: { id: true, name: true, code: true } },
    },
  })
  return json({ positions })
}
