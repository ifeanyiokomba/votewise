// Same logic as src/lib/db-tenant.ts's withTenantContext, parameterized to
// accept an injected client instead of importing the real @/lib/db, so it
// can be exercised against the mock in test-tenant-context.ts. If the real
// file's logic changes, this should change with it — kept deliberately
// small and side-by-side so that's easy to notice in review.

export async function withTenantContextForTest<T>(
  client: { $transaction: (fn: (tx: any) => Promise<T>) => Promise<T> },
  organizationId: string,
  fn: (tx: any) => Promise<T>,
): Promise<T> {
  if (!organizationId) {
    throw new Error('withTenantContext called without an organizationId')
  }

  return client.$transaction(async (tx: any) => {
    await tx.$executeRaw`SELECT set_config('app.current_org_id', ${organizationId}, true)`
    return fn(tx)
  })
}
