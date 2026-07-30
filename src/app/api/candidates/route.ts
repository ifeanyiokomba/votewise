import { NextRequest } from 'next/server'
import { json } from '@/lib/election'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/candidates — list all approved candidates (public).
export async function GET() {
  const candidates = await db.candidate.findMany({
    where: { status: 'APPROVED' },
    orderBy: [{ position: { order: 'asc' } }, { displayOrder: 'asc' }],
    include: {
      position: { select: { id: true, title: true, slug: true, scope: true } },
      faculty: { select: { id: true, name: true, code: true } },
      department: { select: { id: true, name: true, code: true } },
    },
  })
  return json({ candidates })
}
