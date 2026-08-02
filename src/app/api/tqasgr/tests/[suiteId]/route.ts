import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import { getTestSuite, listTestRuns } from '@/lib/tqasgr/test-runner'

export const dynamic = 'force-dynamic'

// GET /api/tqasgr/tests/[suiteId] — suite detail with cases + recent runs.
// Used by the QA Console "expand test cases" feature (Ch.18 TQASGR UI).
export async function GET(req: NextRequest, { params }: { params: Promise<{ suiteId: string }> }) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth || (auth.role !== 'SUPER_ADMIN' && auth.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }
  const { suiteId } = await params
  const suite = await getTestSuite(suiteId)
  if (!suite) return errorJson('Test suite not found', 404)
  const runs = await listTestRuns(5, suiteId)
  return json({ suite, cases: suite.cases, runs })
}
