import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import { runAllSuites } from '@/lib/tqasgr/test-runner'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth || (auth.role !== 'SUPER_ADMIN' && auth.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }
  try {
    const summary = await runAllSuites(auth.sub, auth.email)
    return json({ summary, message: `Ran ${summary.completed} suites: ${summary.passed} passed, ${summary.failed} failed` })
  } catch (e: any) {
    return errorJson(e.message || 'Failed to run all suites', 400)
  }
}
