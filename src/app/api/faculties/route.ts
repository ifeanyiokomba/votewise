import { db } from '@/lib/db'
import { json } from '@/lib/election'

export const dynamic = 'force-dynamic'

export async function GET() {
  const faculties = await db.faculty.findMany({
    orderBy: { name: 'asc' },
    include: { departments: { orderBy: { name: 'asc' } } },
  })
  return json({ faculties })
}
