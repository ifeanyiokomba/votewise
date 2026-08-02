import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import { issueCertificationSeal, listCertificationSeals, ensureCertSealsSeeded } from '@/lib/tqasgr'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth || (auth.role !== 'SUPER_ADMIN' && auth.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }
  await ensureCertSealsSeeded().catch(() => {})
  return json({ seals: await listCertificationSeals(20) })
}

export async function POST(req: NextRequest) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth || (auth.role !== 'SUPER_ADMIN' && auth.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }
  const body = await req.json().catch(() => ({}))
  if (!body.electionId || !body.electionName) return errorJson('electionId and electionName required', 400)
  const seal = await issueCertificationSeal(body)
  return json({ seal, message: `Certification seal issued: ${seal.certificationId}` })
}
