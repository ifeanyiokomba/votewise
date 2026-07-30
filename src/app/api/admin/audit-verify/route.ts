import { NextRequest } from 'next/server'
import { json, verifyAuditChain } from '@/lib/election'
import { requireOfficial } from '@/lib/guards'

export const dynamic = 'force-dynamic'

// GET /api/admin/audit-verify — walks the hash chain, returns integrity report.
export async function GET(req: NextRequest) {
  const auth = await requireOfficial(req, 'audit.view')
  if (auth instanceof Response) return auth
  const result = await verifyAuditChain()
  return json(result)
}
