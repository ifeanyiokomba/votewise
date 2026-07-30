import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { randomToken } from '@/lib/crypto'
import { json, errorJson } from '@/lib/election'

export const dynamic = 'force-dynamic'

// POST /api/auth/password-reset/request  body: { email }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const email = String(body.email || '').trim().toLowerCase()
  if (!email) return errorJson('Email is required', 400)
  const official = await db.electionOfficial.findUnique({ where: { email } })
  if (!official) {
    // Don't reveal whether the email exists (anti-enumeration).
    return json({ ok: true, message: 'If that account exists, a reset link has been sent.' })
  }
  const token = randomToken(24)
  await db.electionOfficial.update({
    where: { id: official.id },
    data: { passwordResetToken: token, passwordResetExpiresAt: new Date(Date.now() + 30 * 60 * 1000) },
  })
  console.log(`[password-reset] token for ${email}: ${token}`)
  return json({ ok: true, message: 'If that account exists, a reset link has been sent.', devToken: process.env.NODE_ENV === 'production' ? undefined : token })
}
