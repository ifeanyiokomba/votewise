import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import { runTestSuite } from '@/lib/tqasgr/test-runner'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ suiteId: string }> }) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth || (auth.role !== 'SUPER_ADMIN' && auth.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }
  const { suiteId } = await params
  try {
    const run = await runTestSuite(suiteId, auth.sub, auth.email)
    return json({ run, message: `Suite run completed: ${run.status}` })
  } catch (e: any) {
    return errorJson(e.message || 'Failed to run suite', 400)
  }
}
