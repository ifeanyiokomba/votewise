// VoteWise — Infra Init (Chapter 17)
//
// Registers the periodic-job handlers and starts the in-process scheduler
// so the sandbox (single-process) gets alert evaluation, metric capture,
// and scheduled backups without needing the separate worker/scheduler
// microservices.
//
// In production, this module is a no-op (the worker + scheduler
// microservices handle everything). It's imported once from the app
// layout to ensure it runs server-side.

import { registerHandler, startPeriodicJobs } from '@/lib/jobs'
import { evaluateAlertRules } from '@/lib/infra/alerting'
import { captureSystemMetrics } from '@/lib/pihed'
import { triggerBackup } from '@/lib/pihed'
import { ensureAlertRulesSeeded } from '@/lib/infra/alerting'
import { ensureCostsSeeded } from '@/lib/infra/cost-tracker'
import { ensureInfraSeeded } from '@/lib/pihed'

let initialized = false

export async function initInfra() {
  if (initialized) return
  initialized = true

  // Register in-process handlers (so the sandbox gets alert eval + metrics)
  registerHandler('alert.evaluate', async () => {
    await evaluateAlertRules().catch(() => {})
  })
  registerHandler('metrics.capture', async () => {
    await captureSystemMetrics().catch(() => {})
  })
  registerHandler('backup.scheduled', async (payload: any) => {
    await triggerBackup(payload?.type || 'hourly', 'scheduler').catch(() => {})
  })

  // Start the periodic scheduler (30s interval)
  startPeriodicJobs()

  // Seed default data so dashboards have content on first load
  await ensureAlertRulesSeeded().catch(() => {})
  await ensureCostsSeeded().catch(() => {})
  await ensureInfraSeeded().catch(() => {})
}
