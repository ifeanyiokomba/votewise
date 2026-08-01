import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { sha256, hmacSign, randomToken } from '@/lib/crypto'

export const dynamic = 'force-dynamic'

// POST /api/workspace/ballot — Generate a secure ballot dynamically.
// Body: { electionId, voterId, isSimulation? }
// Returns: ballot with positions + candidates + integrity token + signature.
export async function POST(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  const body = await req.json().catch(() => ({}))
  const { electionId, voterId, isSimulation } = body
  if (!electionId) return errorJson('Election ID is required', 400)

  const election = await db.electionSession.findUnique({
    where: { id: electionId },
    include: {
      positions: {
        orderBy: { displayOrder: 'asc' },
        where: { /* could filter by scope */ },
        include: {
          candidates: {
            where: { status: 'APPROVED', screeningStatus: 'APPROVED' },
            orderBy: { displayOrder: 'asc' },
            select: { id: true, fullName: true, slug: true, photoUrl: true, slogan: true, manifesto: true, politicalPartyId: true },
          },
        },
      },
    },
  })

  if (!election || election.organizationId !== org.id)
    return errorJson('Election not found', 404)

  // Check election is live (skip for simulation)
  if (!isSimulation) {
    const now = new Date()
    if (now < election.startTime) return errorJson('Voting has not opened yet', 403)
    if (now >= election.endTime) return errorJson('Voting has closed', 403)
  }

  // Build ballot content
  const content = JSON.stringify({
    electionId: election.id,
    electionName: election.name,
    positions: election.positions.map((p) => ({
      positionId: p.id,
      title: p.title,
      maximumVotes: p.maximumVotes || 1,
      candidates: p.candidates.map((c) => ({
        id: c.id,
        name: c.fullName,
        photo: c.photoUrl,
        slogan: c.slogan,
        manifesto: c.manifesto,
      })),
    })),
  })

  // Generate integrity token + digital signature
  const voterHash = voterId ? sha256(`${voterId}:votewise-pepper-v2`) : sha256(`sim-${Date.now()}`)
  const integrityToken = sha256(content + voterHash + Date.now())
  const digitalSignature = hmacSign(`ballot:${integrityToken}`)
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000) // 30 min ballot validity

  // Store ballot
  const ballot = await db.ballot.create({
    data: {
      organizationId: org.id,
      electionId,
      voterId: voterId || null,
      content,
      integrityToken,
      digitalSignature,
      version: 1,
      expiresAt,
      status: 'GENERATED',
      isSimulation: !!isSimulation,
    },
  })

  return json({
    ballotId: ballot.id,
    content: JSON.parse(content),
    integrityToken,
    digitalSignature,
    expiresAt,
    isSimulation: !!isSimulation,
  })
}
