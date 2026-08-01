import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'

export const dynamic = 'force-dynamic'

// GET /api/workspace/imports/[id] — get a single import job's status.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  const { id } = await params
  const job = await db.importJob.findUnique({ where: { id } })
  if (!job || job.organizationId !== org.id)
    return errorJson('Import job not found', 404)

  return json({ job })
}
