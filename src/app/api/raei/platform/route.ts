import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { getPlatformDashboard } from '@/lib/raei'

export const dynamic = 'force-dynamic'

// GET /api/raei/platform — Platform-level intelligence dashboard (super-admin)
export async function GET(req: NextRequest) {
  const dashboard = await getPlatformDashboard()
  return json(dashboard)
}
