import { json } from '@/lib/election'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/faculties — public list of faculties + departments (for registration/admin forms).
export async function GET() {
  const faculties = await db.faculty.findMany({
    orderBy: { name: 'asc' },
    include: { departments: { orderBy: { name: 'asc' } } },
  })
  return json({ faculties })
}
