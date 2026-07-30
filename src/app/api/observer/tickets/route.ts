import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, getClientIp, writeAudit } from '@/lib/election'
import { requireOfficial } from '@/lib/guards'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireOfficial(req, 'ticket.triage')
  if (auth instanceof Response) return auth
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const where: Record<string, unknown> = {}
  if (status) where.status = status
  const tickets = await db.supportTicket.findMany({ where, orderBy: [{ status: 'asc' }, { createdAt: 'desc' }], take: 200 })
  return json({ tickets })
}
