import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/tenant/current — returns the tenant for the authenticated official.
export async function GET(req: NextRequest) {
  const token = readAccessToken(req)
  const payload = await verifyAccessToken(token)
  if (!payload) return json({ tenant: null })
  const official = await db.electionOfficial.findUnique({
    where: { id: payload.sub },
    select: { tenantId: true },
  })
  if (!official?.tenantId) return json({ tenant: null })
  const tenant = await db.tenant.findUnique({ where: { id: official.tenantId } })
  return json({ tenant })
}
