import { db } from '@/lib/db'
import { json } from '@/lib/election'

export const dynamic = 'force-dynamic'

// GET /api/organizations — public list of all active organizations.
// Used by the public website's "Organizations on VoteWise" directory and the
// organization selector on login. Excludes suspended/expired orgs.
export async function GET() {
  const orgs = await db.organization.findMany({
    where: { status: { in: ['ACTIVE', 'TRIAL'] } },
    select: {
      id: true, name: true, slug: true, subdomain: true, category: true,
      logoUrl: true, primaryColour: true, accentColour: true,
      description: true, createdAt: true,
      _count: { select: { members: true, voterGroups: true, workspaces: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return json({ organizations: orgs })
}
