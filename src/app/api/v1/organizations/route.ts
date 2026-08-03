import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import { errorResponse } from '@/lib/errors'
import { schemas, validate } from '@/lib/validation'

export const dynamic = 'force-dynamic'

// GET /api/v1/organizations — list organizations (platform admin only)
export async function GET(req: NextRequest) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth) return errorResponse('UNAUTHORIZED')

  const url = new URL(req.url)
  const status = url.searchParams.get('status')
  const where: any = {}
  if (status) where.status = status

  const orgs = await db.organization.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true, name: true, slug: true, subdomain: true, customDomain: true,
      category: true, status: true, plan: true, createdAt: true,
    },
  })

  return Response.json({ success: true, data: orgs })
}

// POST /api/v1/organizations — create a new organization
export async function POST(req: NextRequest) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth) return errorResponse('UNAUTHORIZED')

  const raw = await req.json().catch(() => ({}))
  const result = validate(schemas.registerOrg, raw)
  if (!result.success) return errorResponse('VALIDATION_ERROR', result.error)

  const { name, subdomain, ownerEmail, ownerName, category } = result.data

  // Check subdomain availability
  const existing = await db.organization.findUnique({ where: { subdomain } }).catch(() => null)
  if (existing) return errorResponse('SUBDOMAIN_TAKEN')

  try {
    const org = await db.organization.create({
      data: {
        name,
        slug: subdomain,
        subdomain,
        ownerEmail,
        ownerName,
        category: category || 'UNIVERSITY',
        status: 'TRIAL',
        plan: 'PAYG',
      },
    })

    return Response.json({ success: true, data: org }, { status: 201 })
  } catch (e: any) {
    return errorResponse('INTERNAL_ERROR')
  }
}
