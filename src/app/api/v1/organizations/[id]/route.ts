import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import { errorResponse } from '@/lib/errors'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth) return errorResponse('UNAUTHORIZED')

  const { id } = await params
  const org = await db.organization.findUnique({
    where: { id },
    select: {
      id: true, name: true, slug: true, subdomain: true, customDomain: true,
      category: true, description: true, logoUrl: true, primaryColour: true,
      accentColour: true, status: true, plan: true, country: true, state: true,
      createdAt: true,
    },
  })

  if (!org) return errorResponse('ORGANIZATION_NOT_FOUND')

  return Response.json({ success: true, data: org })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth) return errorResponse('UNAUTHORIZED')

  const { id } = await params
  const body = await req.json().catch(() => ({}))

  const org = await db.organization.update({
    where: { id },
    data: {
      ...(body.name && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.category && { category: body.category }),
      ...(body.primaryColour && { primaryColour: body.primaryColour }),
      ...(body.accentColour && { accentColour: body.accentColour }),
    },
  }).catch(() => null)

  if (!org) return errorResponse('ORGANIZATION_NOT_FOUND')

  return Response.json({ success: true, data: org })
}
