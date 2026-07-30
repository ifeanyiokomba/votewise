import { NextRequest } from 'next/server'
import { json, getClientIp, writeAudit } from '@/lib/election'
import { requireObserver } from '@/lib/guards'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/observer/tickets — list support tickets (open first).
export async function GET(req: NextRequest) {
  const auth = await requireObserver(req)
  if (auth instanceof Response) return auth
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const where: Record<string, unknown> = {}
  if (status) where.status = status
  const tickets = await db.supportTicket.findMany({
    where,
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 200,
  })
  return json({ tickets })
}
