import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { generateIntegrityCertificate, getIntegrityCertificate } from '@/lib/eifdirs'
import { verifyAccessToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/eifdirs/certificate/[electionId] — Get integrity certificate
export async function GET(req: NextRequest, { params }: { params: Promise<{ electionId: string }> }) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error

  const { electionId } = await params
  const cert = await getIntegrityCertificate(electionId)
  if (!cert) return errorJson('Certificate not generated yet', 404)

  return json(cert)
}

// POST /api/eifdirs/certificate/[electionId] — Generate/regenerate certificate
export async function POST(req: NextRequest, { params }: { params: Promise<{ electionId: string }> }) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error

  const { electionId } = await params
  const auth = verifyAccessToken(req)

  try {
    const { certificate, reportData } = await generateIntegrityCertificate(
      electionId,
      auth?.sub,
      auth?.email,
    )
    return json({ ok: true, certificate, reportData })
  } catch (e: any) {
    return errorJson(e.message || 'Failed to generate certificate', 500)
  }
}
