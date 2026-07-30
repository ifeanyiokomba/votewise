import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json } from '@/lib/election'
import { requireOfficial } from '@/lib/guards'

export const dynamic = 'force-dynamic'

// GET /api/admin/activity — real-time voter activity feed.
// Shows login, verify, accredit, vote events (NOT vote choices).
export async function GET(req: NextRequest) {
  const auth = await requireOfficial(req, 'analytics.view')
  if (auth instanceof Response) return auth

  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')
  const limit = Math.min(200, parseInt(searchParams.get('limit') || '100', 10))

  const where: Record<string, unknown> = {}
  if (action) where.action = action

  const logs = await db.voterActivityLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      voter: { select: { id: true, matric: true, fullName: true, faculty: { select: { name: true } }, department: { select: { name: true } }, level: true, flagged: true, hasVoted: true } },
      actionBy: { select: { name: true, role: true } },
    },
  })

  // Summary counts by action
  const summary = {
    login: await db.voterActivityLog.count({ where: { action: 'LOGIN' } }),
    verify_matric: await db.voterActivityLog.count({ where: { action: 'VERIFY_MATRIC' } }),
    send_otp: await db.voterActivityLog.count({ where: { action: 'SEND_OTP' } }),
    verify_otp: await db.voterActivityLog.count({ where: { action: 'VERIFY_OTP' } }),
    accredit: await db.voterActivityLog.count({ where: { action: 'ACCREDIT' } }),
    vote_cast: await db.voterActivityLog.count({ where: { action: 'VOTE_CAST' } }),
    flagged: await db.voterActivityLog.count({ where: { action: 'FLAG' } }),
  }

  return json({ logs, summary })
}
