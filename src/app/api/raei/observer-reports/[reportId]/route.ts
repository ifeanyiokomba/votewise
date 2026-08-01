import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { verifyAccessToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// PATCH /api/raei/observer-reports/[reportId] — Review/update an observer report
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ reportId: string }> }) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error

  const { reportId } = await params
  const body = await req.json().catch(() => ({}))
  const auth = verifyAccessToken(req)

  const existing = await db.observerReport.findUnique({ where: { id: reportId } })
  if (!existing || existing.organizationId !== orgResult.id) {
    return errorJson('Report not found', 404)
  }

  const data: any = {}
  if (body.status) data.status = body.status
  if (body.status === 'REVIEWED' || body.status === 'ACCEPTED' || body.status === 'REJECTED') {
    data.reviewedBy = auth?.email
    data.reviewedAt = new Date()
  }

  const report = await db.observerReport.update({ where: { id: reportId }, data })
  return json({ ok: true, report })
}

// DELETE /api/raei/observer-reports/[reportId]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ reportId: string }> }) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error

  const { reportId } = await params
  const existing = await db.observerReport.findUnique({ where: { id: reportId } })
  if (!existing || existing.organizationId !== orgResult.id) {
    return errorJson('Report not found', 404)
  }

  await db.observerReport.delete({ where: { id: reportId } })
  return json({ ok: true })
}
