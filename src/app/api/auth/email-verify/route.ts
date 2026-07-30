import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson } from '@/lib/election'

export const dynamic = 'force-dynamic'

// POST /api/auth/email-verify  body: { token }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const token = String(body.token || '')
  if (!token) return errorJson('Token is required', 400)
  const official = await db.electionOfficial.findFirst({ where: { emailVerifyToken: token } })
  if (!official) return errorJson('Invalid or expired token', 400)
  await db.electionOfficial.update({ where: { id: official.id }, data: { emailVerified: true, emailVerifyToken: null } })
  return json({ ok: true, message: 'Email verified. You can now sign in.' })
}
