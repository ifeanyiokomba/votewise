import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import { listFraudRules, createFraudRule, ensureFraudRulesSeeded, getFraudEngineStats } from '@/lib/domains/fraud-engine'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth || (auth.role !== 'SUPER_ADMIN' && auth.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }
  await ensureFraudRulesSeeded().catch(() => {})
  const url = new URL(req.url)
  const org = url.searchParams.get('org') || undefined
  const [rules, stats] = await Promise.all([listFraudRules(org), getFraudEngineStats(org)])
  return json({ rules, stats })
}

export async function POST(req: NextRequest) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth || (auth.role !== 'SUPER_ADMIN' && auth.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }
  const body = await req.json().catch(() => ({}))
  if (!body.name || !body.detector) return errorJson('name and detector required', 400)
  const rule = await createFraudRule(body)
  return json({ rule, message: 'Fraud rule created' })
}
