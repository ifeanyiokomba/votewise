import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json } from '@/lib/election'
import { requireOfficial } from '@/lib/guards'

export const dynamic = 'force-dynamic'

// GET /api/admin/security-events
export async function GET(req: NextRequest) {
  const auth = await requireOfficial(req, 'security.view')
  if (auth instanceof Response) return auth
  const { searchParams } = new URL(req.url)
  const severity = searchParams.get('severity')
  const resolved = searchParams.get('resolved')
  const where: Record<string, unknown> = {}
  if (severity) where.severity = severity
  if (resolved === 'true') where.resolved = true
  if (resolved === 'false') where.resolved = false
  const events = await db.securityEvent.findMany({
    where, orderBy: { createdAt: 'desc' }, take: 200,
  })
  const summary = {
    critical: await db.securityEvent.count({ where: { severity: 'CRITICAL', resolved: false } }),
    high: await db.securityEvent.count({ where: { severity: 'HIGH', resolved: false } }),
    medium: await db.securityEvent.count({ where: { severity: 'MEDIUM', resolved: false } }),
    low: await db.securityEvent.count({ where: { severity: 'LOW', resolved: false } }),
  }
  return json({ events, summary })
}

// PATCH /api/admin/security-events  body: { id, resolved }
export async function PATCH(req: NextRequest) {
  const auth = await requireOfficial(req, 'security.view')
  if (auth instanceof Response) return auth
  const body = await req.json().catch(() => ({}))
  const updated = await db.securityEvent.update({
    where: { id: body.id },
    data: { resolved: !!body.resolved, resolvedById: (auth as any).official.id, resolvedAt: new Date() },
  })
  return json({ ok: true, event: updated })
}
