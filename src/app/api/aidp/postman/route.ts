import { NextRequest } from 'next/server'
import { json } from '@/lib/election'
import { generatePostmanCollection } from '@/lib/aidp/api-docs'

export const dynamic = 'force-dynamic'

// GET /api/aidp/postman — Download Postman collection (public)
export async function GET() {
  const collection = generatePostmanCollection()
  return json(collection)
}
