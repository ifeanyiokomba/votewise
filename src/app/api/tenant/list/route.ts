import { db } from '@/lib/db'
import { json } from '@/lib/election'

export const dynamic = 'force-dynamic'

// GET /api/tenant/list — public list of all active tenants (for a tenant selector).
export async function GET() {
  const tenants = await db.tenant.findMany({
    where: { status: 'ACTIVE' },
    select: {
      id: true, type: true, displayName: true, slug: true,
      universityName: true, facultyName: true, departmentName: true,
      logoUrl: true, primaryColour: true, accentColour: true,
    },
    orderBy: { createdAt: 'desc' },
  })
  return json({ tenants })
}
