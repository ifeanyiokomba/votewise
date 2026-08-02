import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson } from '@/lib/election'
import { getVerification, tallyElection, verifyElectionAuditChain } from '@/lib/sve'
import { computeAuditHash as computeSveAuditHash } from '@/lib/sve/crypto'
import { hmacVerify, AUDIT_GENESIS } from '@/lib/crypto'

export const dynamic = 'force-dynamic'

// GET /api/elections/[id]/verification-portal
//
// PUBLIC endpoint — no org context, no auth required. Anyone with the
// election ID can view the full verification package for a CERTIFIED
// election. This is the public-facing "trust but verify" portal:
//
//   1. Election must be CERTIFIED — otherwise return 404.
//   2. Returns the stored ElectionVerification package (totals, auditHash,
//      integritySignature, generatedAt).
//   3. Returns the full decrypted tally (per-position results, winners).
//   4. Walks the global audit-log hash chain and reports whether it is
//      intact (any tampering anywhere breaks the chain).
//   5. Recomputes the integrity signature from the stored auditHash and
//      compares to the stored signature (HMAC-SHA256).
//   6. Recomputes the audit hash from live vote records and compares to
//      the stored audit hash — proves the recorded votes match what was
//      tallied.
//   7. Counts vote records for cross-verification against totalVotes.
//
// `verified` is true only if ALL of:
//   - election.status === 'CERTIFIED'
//   - chain intact
//   - signature valid
//   - vote count matches (recomputed auditHash === stored auditHash)
//
// This is the cryptographic receipt for the whole election. Anyone can
// share the URL `/verify/[electionId]` and any visitor can independently
// re-verify by re-running these checks.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: electionId } = await params

  // 1. Load the election — must exist and be CERTIFIED.
  const election = await db.electionSession.findUnique({
    where: { id: electionId },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      certificationDate: true,
      startTime: true,
      endTime: true,
      university: true,
      academicSession: true,
      organizationId: true,
      votingMethod: true,
    },
  })

  if (!election) {
    return errorJson(
      'Election not found. The verification portal only works for certified elections. Check the link and try again.',
      404,
    )
  }

  if (election.status !== 'CERTIFIED') {
    return errorJson(
      `This election is not yet certified (current status: ${election.status}). The public verification portal is only available after an election has been officially certified by the electoral committee.`,
      404,
      { status: election.status, electionId },
    )
  }

  // 2. Get the organization name (for context — no auth needed, just display).
  let organizationName: string | undefined
  let organizationSubdomain: string | undefined
  if (election.organizationId) {
    const org = await db.organization.findUnique({
      where: { id: election.organizationId },
      select: { name: true, subdomain: true },
    })
    organizationName = org?.name
    organizationSubdomain = org?.subdomain || undefined
  }

  // 3. Load the stored verification package (must exist for certified elections).
  const stored = await getVerification(electionId)

  // 4. Compute the live tally (decrypts every vote to produce authoritative
  //    results + winners). This is the certified result.
  const tally = await tallyElection(electionId, { simulation: false })

  // 5. Verify the audit-log hash chain for THIS election. The election-
  //    scoped chain check walks every audit entry for this election,
  //    recomputes each hash (self-integrity), and verifies each prevHash
  //    links to a valid hash (either the previous entry in this election,
  //    a hash in the global audit log, or a known genesis anchor). Any
  //    tampering with this election's audit entries breaks the chain.
  const chainResult = await verifyElectionAuditChain(electionId)

  // 6. Count vote records for cross-verification.
  const voteRecordCount = await db.voteRecord.count({
    where: { electionId, isSimulation: false },
  })

  // 7. Recompute the audit hash from the live vote records and compare to
  //    the stored hash. If they match, the recorded votes have not been
  //    modified since certification.
  const liveVotes = await db.voteRecord.findMany({
    where: { electionId, isSimulation: false },
    select: { id: true, receiptCode: true, positionId: true, createdAt: true },
    orderBy: { id: 'asc' },
  })
  const recomputedAuditHash = computeSveAuditHash(liveVotes.map((v) => ({
    id: v.id,
    receiptCode: v.receiptCode,
    positionId: v.positionId || '',
    createdAt: v.createdAt,
  })))

  const storedAuditHash = stored?.auditHash || tally.auditHash
  const auditHashMatches = recomputedAuditHash === storedAuditHash

  // 8. Verify the integrity signature (HMAC-SHA256 over the audit hash).
  const storedSignature = stored?.integritySignature || tally.integritySignature
  const signatureValid = hmacVerify(`verification:${storedAuditHash}`, storedSignature)

  // 9. Build the per-check status list (used by the UI to render the
  //    verification banner with specific pass/fail per check).
  //
  //    The "vote count matches" check is the cryptographic guarantee: the
  //    recomputed audit hash (SHA-256 of ALL vote records sorted by ID)
  //    matches the stored audit hash. This proves the exact same set of
  //    vote records that was used to compute the certified tally is still
  //    present — no additions, no deletions, no modifications.
  const certified = election.status === 'CERTIFIED'
  const chainIntact = !!chainResult.intact
  const voteCountMatches = auditHashMatches

  const checks = [
    {
      key: 'certified',
      label: 'Election is certified',
      passed: certified,
      detail: certified
        ? `Certified${election.certificationDate ? ' on ' + new Date(election.certificationDate).toLocaleDateString() : ''}`
        : `Status: ${election.status}`,
    },
    {
      key: 'chain',
      label: 'Audit chain is intact',
      passed: chainIntact,
      detail: chainIntact
        ? `${chainResult.totalChecked} entries verified for this election`
        : `Broken at entry ${(chainResult.brokenAt || '').slice(-8) || 'unknown'}`,
    },
    {
      key: 'signature',
      label: 'Integrity signature is valid',
      passed: signatureValid,
      detail: signatureValid
        ? 'HMAC-SHA256 re-verified successfully'
        : 'Signature does not match recomputed HMAC',
    },
    {
      key: 'votes',
      label: 'Vote count matches',
      passed: voteCountMatches,
      detail: voteCountMatches
        ? `${voteRecordCount} vote records match the certified audit hash`
        : `Recomputed audit hash does not match — ${voteRecordCount} records present`,
    },
  ]

  const verified = certified && chainIntact && signatureValid && voteCountMatches

  // 10. Assemble the final response.
  return json({
    // Election context
    electionId: election.id,
    electionName: election.name,
    description: election.description,
    organizationName,
    organizationSubdomain,
    university: election.university,
    academicSession: election.academicSession,
    votingMethod: election.votingMethod,
    status: election.status,
    certificationDate: election.certificationDate?.toISOString() || null,
    votingWindow: {
      start: election.startTime.toISOString(),
      end: election.endTime.toISOString(),
    },

    // Verification package (stored + recomputed)
    verification: {
      totalEligible: stored?.totalEligible ?? tally.totalEligible,
      totalVotes: stored?.totalVotes ?? tally.totalVotes,
      invalidVotes: stored?.invalidVotes ?? tally.invalidVotes,
      blankVotes: stored?.blankVotes ?? tally.blankVotes,
      turnoutPct: stored?.turnoutPct ?? tally.turnoutPct,
      auditHash: storedAuditHash,
      recomputedAuditHash,
      auditHashMatches,
      integritySignature: storedSignature,
      signatureValid,
      generatedAt: (stored?.generatedAt || new Date()).toISOString(),
    },

    // Certified results (decrypted tally with winner highlighting)
    resultsByPosition: tally.resultsByPosition,

    // Chain integrity (election-scoped)
    chain: {
      intact: chainIntact,
      totalChecked: chainResult.totalChecked,
      brokenAt: chainResult.brokenAt,
      electionEntries: chainResult.electionEntries,
      genesis: AUDIT_GENESIS,
      head: chainResult.head.map((l) => ({
        id: l.id,
        action: l.action,
        actorName: l.actorName,
        actorRole: l.actorRole,
        prevHash: l.prevHash,
        hash: l.hash,
        createdAt: l.createdAt.toISOString(),
      })),
      tail: chainResult.tail.map((l) => ({
        id: l.id,
        action: l.action,
        actorName: l.actorName,
        actorRole: l.actorRole,
        prevHash: l.prevHash,
        hash: l.hash,
        createdAt: l.createdAt.toISOString(),
      })),
      hiddenMiddleCount: chainResult.hiddenMiddleCount,
    },

    // Cross-verification
    voteRecordCount,

    // Overall
    checks,
    verified,

    // Footer info
    generatedAt: (stored?.generatedAt || new Date()).toISOString(),
    portalUrl: `/verify/${election.id}`,
    publicResultsUrl: `/results/${election.id}`,
  })
}
