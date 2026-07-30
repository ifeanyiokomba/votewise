import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson } from '@/lib/election'
import { requireOfficial } from '@/lib/guards'

export const dynamic = 'force-dynamic'

// GET /api/admin/voters/[id] — full voter detail with accreditation, devices, notifications.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOfficial(req, 'voter.search')
  if (auth instanceof Response) return auth
  const { id } = await params
  const voter = await db.voter.findUnique({
    where: { id },
    include: {
      faculty: { select: { name: true, code: true } },
      department: { select: { name: true, code: true } },
      programme: { select: { name: true, code: true } },
      accreditations: { select: { id: true, status: true, channel: true, deviceFingerprint: true, ipAddress: true, accreditedAt: true }, take: 5, orderBy: { accreditedAt: 'desc' } },
      devices: { select: { id: true, fingerprint: true, label: true, ipAddress: true, trusted: true, firstSeen: true, lastSeen: true }, take: 10, orderBy: { lastSeen: 'desc' } },
      supportTickets: { select: { id: true, issueType: true, status: true, createdAt: true }, take: 5, orderBy: { createdAt: 'desc' } },
      notifications: { select: { id: true, title: true, type: true, readAt: true, createdAt: true }, take: 5, orderBy: { createdAt: 'desc' } },
    },
  })
  if (!voter) return errorJson('Voter not found', 404)
  return json({ voter })
}
