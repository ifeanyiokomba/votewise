import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { generateCertificationPackage } from '@/lib/raei'

export const dynamic = 'force-dynamic'

// GET /api/raei/certification/[electionId] — Generate certification package
export async function GET(req: NextRequest, { params }: { params: Promise<{ electionId: string }> }) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error

  const { electionId } = await params
  try {
    const pkg = await generateCertificationPackage(electionId)
    return json(pkg)
  } catch (e: any) {
    return errorJson(e.message || 'Failed to generate certification package', 500)
  }
}
