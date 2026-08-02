// VoteWise — Read Replica Database Client (Chapter 17 — Database Scaling)
//
// Spec: "Separate workloads: Primary Database → Read Replica → Analytics
// Database → Archive Database. Reporting should never slow down voting."
//
// This module provides a `dbReplica` client that points to the PostgreSQL
// read replica when DATABASE_REPLICA_URL is set. All reporting/analytics
// queries should use `dbReplica` instead of `db` (the primary) so that
// heavy report generation never competes with vote recording for DB
// connections.
//
// In the sandbox (SQLite, no replica), dbReplica === db (the primary).
// The interface is identical so call sites don't branch.

import { PrismaClient } from '@prisma/client'
import { db as primaryDb } from '@/lib/db'

let replicaClient: PrismaClient | null = null

/**
 * Get the read-replica Prisma client. Falls back to the primary if no
 * DATABASE_REPLICA_URL is configured (sandbox / staging).
 */
export function getDbReplica(): PrismaClient {
  if (replicaClient) return replicaClient

  const replicaUrl = process.env.DATABASE_REPLICA_URL
  if (!replicaUrl || replicaUrl === process.env.DATABASE_URL) {
    // No replica configured — use the primary
    return primaryDb
  }

  // Create a dedicated client for the replica
  replicaClient = new PrismaClient({
    log: ['error', 'warn'],
    datasources: {
      db: { url: replicaUrl },
    },
  })

  return replicaClient
}

/**
 * The read-replica client (or the primary if no replica is configured).
 * Use this for ALL read-heavy analytics/reporting queries:
 *
 *   import { dbReplica } from '@/lib/infra/db-replica'
 *   const results = await dbReplica.voteRecord.findMany({ ... })
 *
 * Vote RECORDING (writes) MUST still use the primary `db`:
 *
 *   import { db } from '@/lib/db'
 *   await db.voteRecord.create({ ... })
 */
export const dbReplica = getDbReplica()

/**
 * Check if a real read replica is configured.
 */
export function hasReadReplica(): boolean {
  const replicaUrl = process.env.DATABASE_REPLICA_URL
  return Boolean(replicaUrl && replicaUrl !== process.env.DATABASE_URL)
}
