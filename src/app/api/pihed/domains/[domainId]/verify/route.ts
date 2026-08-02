import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import { verifyCustomDomain } from '@/lib/pihed'

export const dynamic = 'force-dynamic'

// POST /api/pihed/domains/[domainId]/verify
// Verify a custom domain's DNS TXT record and issue SSL.
// Platform admin only.
export async function POST(req: NextRequest, { params }: { params: Promise<{ domainId: string }> }) {
  const auth = await verifyAccessToken(readAccessToken(req))
  if (!auth || (auth.role !== 'SUPER_ADMIN' && auth.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }

  const { domainId } = await params
  try {
    const record = await verifyCustomDomain(domainId)
    const success = record.status === 'ACTIVE'
    return json({
      domain: record,
      message: success
        ? 'DNS verified & SSL certificate issued (90-day Let\'s Encrypt)'
        : 'DNS verification failed — ensure the TXT record is published',
    }, success ? 200 : 400)
  } catch (e: any) {
    return errorJson(e.message || 'Failed to verify domain', 400)
  }
}
