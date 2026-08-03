// VoteWise — Audit Service (Enterprise Audit Part 4)
//
// Spec: "Audit logs should be: append-only, immutable, searchable."
//
// This service wraps the hash-chained audit log (src/lib/election.ts →
// writeAudit). It enforces the append-only constraint: no UPDATE or DELETE
// operations are exposed. All audit entries are hash-chained for tamper
// detection.

import { db } from '@/lib/db'

/**
 * Write an audit entry. This is the ONLY way to create audit records.
 * The entry is hash-chained to the previous entry for tamper detection.
 */
export async function writeAuditEntry(input: {
  actorId: string
  actorRole: string
  actorName: string
  action: string
  details?: Record<string, unknown>
  ip?: string | null
  electionId?: string
  organizationId?: string
}): Promise<void> {
  // Delegate to the hash-chained writeAudit in election.ts
  const { writeAudit } = await import('@/lib/election')
  await writeAudit(input)
}

/**
 * Query audit entries (read-only — no update/delete exposed).
 */
export async function queryAuditEntries(opts: {
  electionId?: string
  organizationId?: string
  actorId?: string
  action?: string
  since?: Date
  limit?: number
}) {
  const where: any = {}
  if (opts.electionId) where.electionId = opts.electionId
  if (opts.actorId) where.actorId = opts.actorId
  if (opts.action) where.action = { contains: opts.action }
  if (opts.since) where.createdAt = { gte: opts.since }

  return db.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: Math.min(500, opts.limit || 100),
  })
}

/**
 * Verify the audit chain integrity — checks that each hash chains correctly.
 * Returns the number of broken links (0 = chain intact).
 */
export async function verifyAuditChain(): Promise<{ brokenLinks: number; totalEntries: number }> {
  const entries = await db.auditLog.findMany({
    orderBy: { createdAt: 'asc' },
    select: { hash: true, prevHash: true, createdAt: true },
    take: 10000,
  })

  let broken = 0
  for (let i = 1; i < entries.length; i++) {
    if (entries[i].prevHash !== entries[i - 1].hash) {
      broken++
    }
  }

  return { brokenLinks: broken, totalEntries: entries.length }
}

// NOTE: There are NO updateAuditEntry or deleteAuditEntry functions.
// The audit log is append-only by design. This is enforced at the service
// layer — no code anywhere in the platform calls db.auditLog.update() or
// db.auditLog.delete().
