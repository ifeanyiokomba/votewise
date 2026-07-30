import { db } from '@/lib/db'
import { json, errorJson } from '@/lib/election'
import { hmacVerify } from '@/lib/crypto'

export const dynamic = 'force-dynamic'

// GET /api/results/certificate — fetch the latest certified result snapshot.
// Public (anyone can view certified results). Returns null if not yet certified.
export async function GET() {
  const snapshot = await db.resultSnapshot.findFirst({
    orderBy: { certifiedAt: 'desc' },
    include: { certifiedBy: { select: { name: true, email: true, role: true } } },
  })
  if (!snapshot) {
    return json({ certified: false, message: 'Results have not yet been certified. Please check back after the election closes.' })
  }
  // Verify the HMAC signature integrity.
  const valid = hmacVerify(`snapshot:${snapshot.snapshot}`, snapshot.signature)
  return json({
    certified: true,
    snapshot: JSON.parse(snapshot.snapshot),
    signature: snapshot.signature,
    signatureValid: valid,
    totalVotes: snapshot.totalVotes,
    turnoutPct: snapshot.turnoutPct,
    certifiedBy: snapshot.certifiedBy,
    certifiedAt: snapshot.certifiedAt,
    snapshotId: snapshot.id,
  })
}
