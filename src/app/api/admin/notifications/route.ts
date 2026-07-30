import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson, getClientIp, writeAudit } from '@/lib/election'
import { requireOfficial } from '@/lib/guards'

export const dynamic = 'force-dynamic'

// POST /api/admin/notifications — broadcast a notification to voters.
// Body: { title, message, type, facultyId? }
export async function POST(req: NextRequest) {
  const auth = await requireOfficial(req, 'notification.broadcast')
  if (auth instanceof Response) return auth
  const body = await req.json().catch(() => ({}))
  const { title, message, type = 'INFO', facultyId } = body
  if (!title || !message) return errorJson('title and message are required', 400)
  const election = await db.electionSession.findFirst({ orderBy: { createdAt: 'desc' } })
  const where = facultyId ? { facultyId } : {}
  const voters = await db.voter.findMany({ where, select: { id: true } })
  await db.notification.createMany({
    data: voters.map((v) => ({
      electionSessionId: election?.id || null,
      voterId: v.id, title, message, type,
    })),
  })
  await writeAudit({ actorId: (auth as any).official.id, actorRole: (auth as any).official.role, actorName: (auth as any).official.name, action: 'NOTIFICATION_BROADCAST', details: { title, count: voters.length, facultyId }, ip: getClientIp(req) })
  return json({ ok: true, recipients: voters.length })
}
