import { NextRequest } from 'next/server'
import { json } from '@/lib/election'
import { getCertificationSeal } from '@/lib/tqasgr'

export const dynamic = 'force-dynamic'

// GET /api/tqasgr/certify/[certificationId] — PUBLIC verification
// Anyone can verify a certification seal by its ID (VW-2027-000184).
export async function GET(req: NextRequest, { params }: { params: Promise<{ certificationId: string }> }) {
  const { certificationId } = await params
  const seal = await getCertificationSeal(certificationId)
  if (!seal) return json({ error: 'Certification not found', certificationId }, 404)
  return json({ seal })
}
