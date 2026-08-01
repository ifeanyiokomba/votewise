import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, getClientIp, writeAudit } from '@/lib/election'
import { requireOfficial } from '@/lib/guards'
import { getOrgScope } from '@/lib/org-scope'

export const dynamic = 'force-dynamic'

// GET /api/admin/audit-logs — tenant-scoped by organizationId.
export async function GET(req: NextRequest) {
  const auth = await requireOfficial(req, 'audit.view')
  if (auth instanceof Response) return auth
  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const pageSize = Math.min(200, parseInt(searchParams.get('pageSize') || '100', 10))
  const action = searchParams.get('action')
  const { org } = await getOrgScope(req)
  const where: Record<string, unknown> = {}
  if (org) where.election = { organizationId: org.id }
  if (action) where.action = { contains: action }
  const [total, logs] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
  ])
  return json({ logs, total, page, pageSize, totalPages: Math.ceil(total / pageSize) })
}
