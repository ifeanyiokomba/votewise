import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { getInvoices, getAllInvoices } from '@/lib/bspcm'
import { verifyAccessToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/bspcm/invoices — List invoices (org or platform-wide for admins)
export async function GET(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error

  const { searchParams } = new URL(req.url)
  const adminView = searchParams.get('admin') === 'true'
  const status = searchParams.get('status') || undefined

  // Platform admins can see all invoices
  const auth = verifyAccessToken(req)
  if (adminView && auth?.role === 'SUPER_ADMIN') {
    const invoices = await getAllInvoices({ status })
    return json({ invoices })
  }

  // Org admins see their own invoices
  const invoices = await getInvoices(orgResult.id)
  return json({ invoices })
}
