import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import { errorResponse } from '@/lib/errors'
import { schemas, validate } from '@/lib/validation'

export const dynamic = 'force-dynamic'

// GET /api/v1/elections — list elections (org-scoped)
export async function GET(req: NextRequest) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth) return errorResponse('UNAUTHORIZED')

  const url = new URL(req.url)
  const orgId = url.searchParams.get('org')
  const status = url.searchParams.get('status')
  const where: any = {}
  if (orgId) where.organizationId = orgId
  if (status) where.status = status

  const elections = await db.electionSession.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true, name: true, status: true, startTime: true, endTime: true,
      organizationId: true, description: true, category: true,
    },
  })

  return Response.json({ success: true, data: elections })
}

// POST /api/v1/elections — create election
export async function POST(req: NextRequest) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth) return errorResponse('UNAUTHORIZED')

  const raw = await req.json().catch(() => ({}))
  const result = validate(schemas.createElection, raw)
  if (!result.success) return errorResponse('VALIDATION_ERROR', result.error)

  try {
    const election = await db.electionSession.create({
      data: {
        name: result.data.name,
        organizationId: result.data.organizationId,
        description: result.data.description || null,
        startTime: new Date(result.data.startTime as string),
        endTime: new Date(result.data.endTime as string),
        status: 'DRAFT',
      },
    })
    return Response.json({ success: true, data: election }, { status: 201 })
  } catch (e: any) {
    return errorResponse('INTERNAL_ERROR')
  }
}
