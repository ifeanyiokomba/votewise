import { NextRequest } from 'next/server'
import { json } from '@/lib/election'
import { API_CHANGELOG } from '@/lib/aidp/api-docs'

export const dynamic = 'force-dynamic'

// GET /api/aidp/changelog — API changelog (public)
export async function GET() {
  return json({ changelog: API_CHANGELOG })
}
