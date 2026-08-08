// VoteWise — Tenant context wrapper (Chapter 2)
//
// The RLS policies in prisma/migrations/manual/0001_chapter2_core_rls.sql
// check current_setting('app.current_org_id', true) on every row. Nothing
// in the app sets that yet — this is the piece that does.
//
// Prisma doesn't have a native per-request Postgres identity the way
// Supabase's PostgREST/JS client does (that model expects auth.uid()/
// auth.jwt() from a per-user connection). The working pattern for a
// Prisma-based app is: open a transaction, set the session variable as
// the first statement inside it (via set_config(..., true), which is
// transaction-local — confirmed directly against a real Postgres
// instance: it does not leak to later queries on the same pooled
// connection after commit), then run the request's queries inside that
// same transaction.
//
// set_config(...) is called via Prisma's tagged-template $executeRaw,
// which parameterizes the value — not $executeRawUnsafe with string
// interpolation. organizationId here should only ever come from
// requireOrganization() (hostname-resolved, server-side), never
// directly from client input, but this doesn't rely on that discipline
// alone.
//
// KNOWN LIMIT, stated plainly: this file is written against a verified
// SQL mechanism (see the psql transcript in the Chapter 2 completion
// notes) and its own control flow is covered by
// chapter2-verification/test-tenant-context.ts using a mocked Prisma
// transaction callback. What it has NOT been tested against is a real
// Prisma client talking to a real database end-to-end — Prisma's engine
// binaries can't be downloaded from this build sandbox (network
// policy blocks binaries.prisma.sh), so that step needs to happen from
// an environment where the Prisma CLI can actually run, before this is
// trusted as fully proven rather than carefully designed.

import { db } from '@/lib/db'
import type { Prisma, PrismaClient } from '@prisma/client'

type TenantTransactionClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

/**
 * Run `fn` inside a transaction with app.current_org_id set to
 * organizationId for the duration of that transaction only. Every
 * tenant-scoped query in `fn` must use the `tx` client it receives, not
 * the top-level `db` export — queries run against `db` directly bypass
 * this entirely and rely on RLS's fail-closed default (zero rows) or,
 * if run as a role with BYPASSRLS, nothing at all. That's exactly why
 * the app's own DATABASE_URL should connect as app_user (see the
 * migration), not a superuser — BYPASSRLS roles make this wrapper a
 * no-op regardless of whether it's called correctly.
 */
export async function withTenantContext<T>(
  organizationId: string,
  fn: (tx: TenantTransactionClient) => Promise<T>,
): Promise<T> {
  if (!organizationId) {
    // Fail loud, not closed-by-accident-and-silent. An empty/undefined
    // organizationId reaching this function is a bug at the call site,
    // not a tenant with no data.
    throw new Error('withTenantContext called without an organizationId')
  }

  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_org_id', ${organizationId}, true)`
    return fn(tx as unknown as TenantTransactionClient)
  })
}
