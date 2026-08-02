import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'
import { getPostmortem, updatePostmortem, deletePostmortem } from '@/lib/infra/postmortem'

export const dynamic = 'force-dynamic'

// GET /api/pihed/postmortems/[id] — get a single postmortem (with parsed JSON fields)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth || (auth.role !== 'SUPER_ADMIN' && auth.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }

  const { id } = await params
  const pm = await getPostmortem(id)
  if (!pm) return errorJson('Postmortem not found', 404)
  return json({ postmortem: pm })
}

// PATCH /api/pihed/postmortems/[id] — update a postmortem
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth || (auth.role !== 'SUPER_ADMIN' && auth.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }

  const { id } = await params
  const body = await req.json().catch(() => ({}))

  try {
    const pm = await updatePostmortem(id, { ...body, reviewedBy: auth.email })
    return json({ postmortem: pm, message: 'Postmortem updated' })
  } catch (e: any) {
    return errorJson(e.message || 'Failed to update postmortem', 400)
  }
}

// DELETE /api/pihed/postmortems/[id] — delete a postmortem
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth || (auth.role !== 'SUPER_ADMIN' && auth.role !== 'PLATFORM_SUPER_ADMIN')) {
    return errorJson('Forbidden — platform admin only', 403)
  }

  const { id } = await params
  try {
    await deletePostmortem(id)
    return json({ message: 'Postmortem deleted' })
  } catch (e: any) {
    return errorJson(e.message || 'Failed to delete postmortem', 400)
  }
}
