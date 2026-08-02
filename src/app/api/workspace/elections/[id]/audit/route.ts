import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { computeAuditHash, AUDIT_GENESIS } from '@/lib/crypto'

export const dynamic = 'force-dynamic'

// GET /api/workspace/elections/[id]/audit — Hash-chained audit log viewer.
//
// Returns every AuditLog entry for this election, sorted newest-first, plus a
// chain verification result. The chain verification walks every record in
// chronological order, recomputes its hash with computeAuditHash(), and checks
// that:
//   1. Each row's prevHash equals the previous row's hash (link integrity).
//   2. The recomputed hash matches the stored hash (self-integrity).
//
// Any tampering — modifying a field, deleting a row, or reordering — breaks the
// chain and is reported here.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult
  const { id } = await params

  // Verify the election belongs to this org.
  const election = await db.electionSession.findUnique({
    where: { id },
    select: { id: true, organizationId: true, name: true },
  })
  if (!election || election.organizationId !== org.id) {
    return errorJson('Election not found', 404)
  }

  // Fetch every audit log row for this election, in chronological order for
  // chain verification. We'll reverse for display afterwards.
  const allLogs = await db.auditLog.findMany({
    where: { electionId: id },
    orderBy: { createdAt: 'asc' },
  })

  // Walk the chain in chronological order.
  let chainIntact = true
  let totalChecked = 0
  let brokenAt: string | undefined
  let prevHash = AUDIT_GENESIS
  for (const log of allLogs) {
    totalChecked++
    // 1. Link check: this row's prevHash must match the previous row's hash.
    if (log.prevHash !== prevHash) {
      chainIntact = false
      brokenAt = log.id
      break
    }
    // 2. Self-integrity: recompute this row's hash and compare.
    const recomputed = computeAuditHash({
      prevHash,
      actorId: log.actorId,
      action: log.action,
      details: log.details,
      createdAt: log.createdAt,
      nonce: log.nonce,
    })
    if (recomputed !== log.hash) {
      chainIntact = false
      brokenAt = log.id
      break
    }
    prevHash = log.hash
  }

  // For display: newest first.
  const logs = [...allLogs].reverse().map((l) => ({
    id: l.id,
    actorId: l.actorId,
    actorRole: l.actorRole,
    actorName: l.actorName,
    action: l.action,
    resource: l.resource,
    resourceId: l.resourceId,
    details: l.details,
    ip: l.ip,
    device: l.device,
    browser: l.browser,
    prevHash: l.prevHash,
    hash: l.hash,
    nonce: l.nonce,
    createdAt: l.createdAt.toISOString(),
  }))

  return json({
    logs,
    chainIntact,
    totalChecked,
    brokenAt,
    electionId: id,
    electionName: election.name,
  })
}
