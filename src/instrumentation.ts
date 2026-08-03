// VoteWise — Server-side instrumentation (Next.js 16)
//
// This runs ONCE when the Next.js server starts, in the Node.js runtime
// (not the browser). It's the correct place to:
//   • sync credentials from DB to process.env (so providers work)
//   • register background job handlers
//   • start the periodic scheduler
//   • seed default data
//
// Spec (Chapter 17): "Background Workers", "Monitoring", "Alerting" — all
// need server-side boot initialisation.

export async function register() {
  // Only run on the server (not the edge / browser)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Sync credentials from the database to process.env
    // This loads any API keys saved via /admin/credentials so that
    // Paystack, Resend, Termii, etc. all pick up the configured values.
    try {
      const { syncCredentialsToEnv } = await import('@/lib/domains/credential-manager')
      await syncCredentialsToEnv()
      console.log('[instrumentation] credentials synced from DB to process.env')
    } catch (e) {
      // Non-fatal — .env values still work
      console.log('[instrumentation] credential sync skipped (no DB or table not yet created)')
    }

    const { initInfra } = await import('@/lib/infra/init')
    await initInfra().catch((e) => {
      console.error('[instrumentation] init failed:', e)
    })
  }
}
