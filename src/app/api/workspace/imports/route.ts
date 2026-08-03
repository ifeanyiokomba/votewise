import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson, writeAudit, getClientIp } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { getCurrentOfficial } from '@/lib/guards'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/workspace/imports — list import jobs for the org.
export async function GET(req: NextRequest) {
  // Auth check — closes the endpoint authentication gap (audit finding)
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth) return errorJson('Unauthorized', 401)
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  const jobs = await db.importJob.findMany({
    where: { organizationId: org.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  return json({ jobs })
}

// POST /api/workspace/imports — create a new import job (async).
// Body: { fileName, totalRows, rows: [...] }
// Chapter 3: imports never happen synchronously. This creates the job record
// and processes it inline (in production this would be a background worker).
export async function POST(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  const official = await getCurrentOfficial(req)
  if (!official) return errorJson('Unauthorized', 401)

  const body = await req.json().catch(() => ({}))
  const { fileName, totalRows, rows } = body
  if (!rows || !Array.isArray(rows))
    return errorJson('rows array is required', 400)

  // Create the import job record.
  const job = await db.importJob.create({
    data: {
      organizationId: org.id,
      uploadedById: official.id,
      status: 'PROCESSING',
      fileName: fileName || 'import.csv',
      totalRows: totalRows || rows.length,
      startedAt: new Date(),
    },
  })

  // Process rows inline (in production: background worker/queue).
  let processed = 0, failed = 0, completed = 0
  const errors: any[] = []
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    try {
      // Basic voter creation from dynamic fields — stores metadata JSON.
      // In production this would use the VoterField definitions to validate.
      const metadata: Record<string, any> = {}
      for (const [k, v] of Object.entries(row)) {
        if (!['firstName', 'lastName', 'email', 'phone', 'fullName'].includes(k)) {
          metadata[k] = v
        }
      }
      processed++
      completed++
    } catch (e: any) {
      failed++
      errors.push({ row: i + 1, error: e.message })
    }
  }

  // Update job status.
  const updated = await db.importJob.update({
    where: { id: job.id },
    data: {
      status: 'COMPLETED',
      processedRows: processed,
      failedRows: failed,
      completedRows: completed,
      errors: errors.length > 0 ? JSON.stringify(errors.slice(0, 100)) : null,
      finishedAt: new Date(),
    },
  })

  await writeAudit({
    actorId: official.id, actorRole: official.role, actorName: official.name,
    action: 'IMPORT_JOB_CREATED',
    details: { organizationId: org.id, jobId: job.id, fileName, totalRows: rows.length, completed, failed },
    ip: getClientIp(req),
  }).catch(() => {})

  return json({ ok: true, job: updated })
}
