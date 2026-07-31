import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson } from '@/lib/election'

export const dynamic = 'force-dynamic'

// GET /api/organizations/[slug] — public detail of a single organization.
// Includes workspaces, voter groups, member counts, and terminology.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const org = await db.organization.findUnique({
    where: { slug },
    include: {
      terminology: true,
      workspaces: {
        orderBy: { name: 'asc' },
        include: { _count: { select: { voterGroups: true } } },
      },
      _count: { select: { members: true, voterGroups: true, elections: true } },
    },
  })
  if (!org) return errorJson('Organization not found', 404)
  return json({
    organization: {
      id: org.id, name: org.name, slug: org.slug, subdomain: org.subdomain,
      category: org.category, description: org.description,
      logoUrl: org.logoUrl, primaryColour: org.primaryColour, accentColour: org.accentColour,
      status: org.status, plan: org.plan, createdAt: org.createdAt,
      terminology: org.terminology,
      workspaces: org.workspaces.map((w) => ({
        id: w.id, name: w.name, slug: w.slug, code: w.code,
        voterGroupCount: w._count.voterGroups,
      })),
      counts: {
        members: org._count.members,
        voterGroups: org._count.voterGroups,
        workspaces: org.workspaces.length,
        elections: org._count.elections,
      },
    },
  })
}
