import { json } from '@/lib/election'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/positions — public list of positions + approved candidates (manifesto info).
export async function GET() {
  const positions = await db.position.findMany({
    orderBy: { order: 'asc' },
    include: {
      candidates: {
        where: { status: 'APPROVED' },
        orderBy: { displayOrder: 'asc' },
        select: {
          id: true,
          fullName: true,
          slug: true,
          photoUrl: true,
          slogan: true,
          manifesto: true,
          level: true,
          facultyId: true,
          departmentId: true,
        },
      },
      faculty: { select: { id: true, name: true, code: true } },
      department: { select: { id: true, name: true, code: true } },
    },
  })
  return json({ positions })
}
