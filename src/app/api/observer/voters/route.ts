import { NextRequest } from 'next/server'
import { json } from '@/lib/election'
import { requireObserver } from '@/lib/guards'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/observer/voters — search voter registration status (read-only).
export async function GET(req: NextRequest) {
  const auth = await requireObserver(req)
  if (auth instanceof Response) return auth
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim()
  if (!q) return json({ voters: [] })
  const voters = await db.voter.findMany({
    where: { OR: [{ matric: { contains: q } }, { fullName: { contains: q } }, { email: { contains: q } }, { phone: { contains: q } }] },
    take: 50,
    include: { faculty: { select: { name: true, code: true } }, department: { select: { name: true, code: true } } },
  })
  return json({ voters })
}
