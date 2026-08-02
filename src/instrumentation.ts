// VoteWise — Server-side instrumentation (Next.js 16)
//
// This runs ONCE when the Next.js server starts, in the Node.js runtime
// (not the browser). It's the correct place to:
//   • register background job handlers
//   • start the periodic scheduler
//   • seed default data
//
// Spec (Chapter 17): "Background Workers", "Monitoring", "Alerting" — all
// need server-side boot initialisation.

export async function register() {
  // Only run on the server (not the edge / browser)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initInfra } = await import('@/lib/infra/init')
    await initInfra().catch((e) => {
      console.error('[instrumentation] init failed:', e)
    })
  }
}
