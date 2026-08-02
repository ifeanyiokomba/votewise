import { NextRequest } from 'next/server'
import { json, errorJson } from '@/lib/election'
import { generateTransparencyReport } from '@/lib/eifdirs'

export const dynamic = 'force-dynamic'

// GET /api/eifdirs/transparency/[electionId] — Public transparency report
// No auth required — anyone can view the public version.
export async function GET(req: NextRequest, { params }: { params: Promise<{ electionId: string }> }) {
  const { electionId } = await params
  const report = await generateTransparencyReport(electionId)
  if (!report) return errorJson('Transparency report not available. Election may not be certified yet.', 404)

  return json(report)
}
