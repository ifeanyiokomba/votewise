import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson } from '@/lib/election'
import { getCurrentOfficial } from '@/lib/guards'

export const dynamic = 'force-dynamic'

// GET /api/admin/paystack — return Paystack configuration (masked)
export async function GET(req: NextRequest) {
  const official = await getCurrentOfficial(req)
  if (!official || (official.role !== 'SUPER_ADMIN' && official.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }

  // Read from process.env (synced from credential manager or .env)
  const publicKey = process.env.PAYSTACK_PUBLIC_KEY || ''
  const secretKey = process.env.PAYSTACK_SECRET_KEY || ''
  // Mask the secret key
  const maskedSecret = secretKey ? secretKey.slice(0, 6) + '****' + secretKey.slice(-4) : ''

  // Get price per voter from pricing rules or default
  const pricingRule = await db.pricingRule.findFirst({
    where: { key: 'price_per_voter' },
    select: { value: true },
  }).catch(() => null)

  return json({
    config: {
      publicKey,
      secretKey: maskedSecret,
      pricePerVoter: pricingRule?.value ? Number(pricingRule.value) : 500,
    },
  })
}

// PUT /api/admin/paystack — update Paystack configuration
export async function PUT(req: NextRequest) {
  const official = await getCurrentOfficial(req)
  if (!official || (official.role !== 'SUPER_ADMIN' && official.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }

  const body = await req.json().catch(() => ({}))

  // Update env vars (in production these would go to the credential manager)
  if (body.publicKey) process.env.PAYSTACK_PUBLIC_KEY = body.publicKey
  if (body.secretKey) process.env.PAYSTACK_SECRET_KEY = body.secretKey

  // Update price per voter in pricing rules
  if (body.pricePerVoter) {
    await db.pricingRule.upsert({
      where: { key: 'price_per_voter' },
      create: { key: 'price_per_voter', value: String(body.pricePerVoter), description: 'Price per voter in NGN' },
      update: { value: String(body.pricePerVoter) },
    }).catch(() => {})
  }

  return json({ message: 'Paystack configuration updated successfully' })
}
