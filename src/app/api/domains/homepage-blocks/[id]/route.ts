import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import { updateHomepageBlock, deleteHomepageBlock } from '@/lib/domains/portal-customization'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth) return errorJson('Unauthorized', 401)
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const block = await updateHomepageBlock(id, body)
  return json({ block, message: 'Block updated' })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth) return errorJson('Unauthorized', 401)
  const { id } = await params
  await deleteHomepageBlock(id)
  return json({ message: 'Block deleted' })
}
