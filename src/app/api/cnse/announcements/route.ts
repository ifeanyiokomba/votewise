import { NextRequest } from 'next/server'
import { db } from '@/lib/cnse/safe-db'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { verifyAccessToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/cnse/announcements?electionId=...
export async function GET(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  const electionId = new URL(req.url).searchParams.get('electionId') || undefined

  const announcements = await db.announcement.findMany({
    where: {
      organizationId: org.id,
      ...(electionId ? { electionId } : {}),
      isPublished: true,
    },
    orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
    take: 50,
  })

  return json({ announcements })
}

// POST /api/cnse/announcements — Create an announcement
export async function POST(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  const body = await req.json().catch(() => ({}))
  if (!body.title || !body.body) return errorJson('title and body are required', 400)

  const auth = verifyAccessToken(req)

  const announcement = await db.announcement.create({
    data: {
      organizationId: org.id,
      electionId: body.electionId || null,
      title: body.title,
      body: body.body,
      type: body.type || 'INFO',
      targetAudience: body.targetAudience || 'ALL',
      isPinned: body.isPinned || false,
      createdById: auth?.sub,
      createdByName: auth?.email,
    },
  })

  return json({ ok: true, announcement })
}

// DELETE /api/cnse/announcements?id=...
export async function DELETE(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return errorJson('Announcement ID is required', 400)

  const announcement = await db.announcement.findUnique({ where: { id } })
  if (!announcement || announcement.organizationId !== orgResult.id) {
    return errorJson('Announcement not found', 404)
  }

  await db.announcement.update({ where: { id }, data: { isPublished: false } })
  return json({ ok: true })
}
