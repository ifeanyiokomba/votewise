import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import { listReportDefinitions, createReportDefinition, ensureReportDefinitionsSeeded, getReportStats } from '@/lib/domains/report-generator'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth) return errorJson('Unauthorized', 401)
  await ensureReportDefinitionsSeeded().catch(() => {})
  const url = new URL(req.url)
  const org = url.searchParams.get('org') || undefined
  const [definitions, stats] = await Promise.all([listReportDefinitions(org), getReportStats(org)])
  return json({ definitions, stats })
}

export async function POST(req: NextRequest) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth) return errorJson('Unauthorized', 401)
  const body = await req.json().catch(() => ({}))
  if (!body.name || !body.type) return errorJson('name and type required', 400)
  const def = await createReportDefinition(body)
  return json({ definition: def, message: 'Report definition created' })
}
