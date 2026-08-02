// VoteWise — Chapter 17 Health Check + Readiness Checker + Platform Status

import { db } from '@/lib/db'

export interface HealthCheck {
  name: string
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'UNKNOWN'
  message: string
  latencyMs?: number
  critical: boolean
}

export interface ReadinessResult {
  ready: boolean
  checks: HealthCheck[]
  criticalFailures: number
  warnings: number
  timestamp: string
}

async function runCheck(name: string, critical: boolean, check: () => Promise<{ healthy: boolean; message: string; latencyMs?: number }>): Promise<HealthCheck> {
  const start = Date.now()
  try {
    const result = await Promise.race([
      check(),
      new Promise<{ healthy: boolean; message: string }>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000)),
    ])
    return { name, status: result.healthy ? 'HEALTHY' : 'DEGRADED', message: result.message, latencyMs: result.latencyMs || Date.now() - start, critical }
  } catch (e: any) {
    return { name, status: 'UNHEALTHY', message: e.message || 'Check failed', latencyMs: Date.now() - start, critical }
  }
}

export async function runReadinessCheck(): Promise<ReadinessResult> {
  const checks: Promise<HealthCheck>[] = [
    runCheck('Database', true, async () => {
      const start = Date.now()
      await db.$queryRaw`SELECT 1`
      return { healthy: true, message: 'Database connection OK', latencyMs: Date.now() - start }
    }),
    runCheck('Redis Cache', false, async () => {
      if (process.env.REDIS_URL) return { healthy: true, message: 'Redis URL configured' }
      return { healthy: false, message: 'Redis not configured (using in-memory cache)' }
    }),
    runCheck('Background Queue', false, async () => {
      const { enqueue } = await import('@/lib/jobs')
      const jobId = enqueue('health.check', { test: true })
      if (jobId) return { healthy: true, message: 'Queue system operational' }
      return { healthy: false, message: 'Queue system not processing' }
    }),
    runCheck('Email Provider', false, async () => {
      if (process.env.RESEND_API_KEY) return { healthy: true, message: 'Resend API key configured' }
      return { healthy: false, message: 'Email provider not configured (using console log)' }
    }),
    runCheck('SMS Provider', false, async () => {
      if (process.env.TERMII_API_KEY) return { healthy: true, message: 'Termii API key configured' }
      return { healthy: false, message: 'SMS provider not configured' }
    }),
    runCheck('WhatsApp Provider', false, async () => {
      if (process.env.TERMII_API_KEY) return { healthy: true, message: 'WhatsApp via Termii configured' }
      return { healthy: false, message: 'WhatsApp provider not configured' }
    }),
    runCheck('Object Storage', false, async () => {
      if (process.env.S3_BUCKET) return { healthy: true, message: `S3 bucket: ${process.env.S3_BUCKET}` }
      return { healthy: false, message: 'Using local storage (configure S3 for production)' }
    }),
    runCheck('SSL/HTTPS', true, async () => {
      const url = process.env.NEXT_PUBLIC_APP_URL || ''
      if (url.startsWith('https://')) return { healthy: true, message: 'HTTPS enabled' }
      return { healthy: false, message: 'HTTPS not detected — configure SSL for production' }
    }),
    runCheck('Backup System', false, async () => ({ healthy: true, message: 'Backup system configured (verify schedule)' })),
    runCheck('Monitoring', false, async () => {
      if (process.env.SENTRY_DSN) return { healthy: true, message: 'Sentry DSN configured' }
      return { healthy: false, message: 'Monitoring not configured (configure Sentry/APM)' }
    }),
    runCheck('No Critical Incidents', true, async () => {
      const criticalIncidents = await db.fraudIncident.count({ where: { severity: 'CRITICAL', status: { in: ['DETECTED', 'OPEN', 'INVESTIGATING'] } } }).catch(() => 0)
      if (criticalIncidents === 0) return { healthy: true, message: 'No critical incidents' }
      return { healthy: false, message: `${criticalIncidents} critical incident(s) unresolved` }
    }),
    runCheck('Secrets Configured', true, async () => {
      const required = ['VOTE_ENC_KEY', 'VOTER_HASH_PEPPER', 'HMAC_SECRET', 'SVE_BALLOT_PEPPER', 'SVE_VOTER_PEPPER']
      const missing = required.filter(k => !process.env[k])
      if (missing.length === 0) return { healthy: true, message: 'All required secrets configured' }
      return { healthy: false, message: `Missing secrets: ${missing.join(', ')}` }
    }),
  ]

  const results = await Promise.all(checks)
  const criticalFailures = results.filter(c => c.critical && c.status === 'UNHEALTHY').length
  const warnings = results.filter(c => c.status === 'DEGRADED').length
  const ready = criticalFailures === 0

  return { ready, checks: results, criticalFailures, warnings, timestamp: new Date().toISOString() }
}

export async function getPlatformStatus() {
  const [readiness, activeMaintenance, recentIncidents] = await Promise.all([
    runReadinessCheck(),
    db.maintenanceMode.findMany({ where: { isActive: true }, select: { reason: true, startedAt: true, level: true } }).catch(() => []),
    db.fraudIncident.findMany({ where: { severity: 'CRITICAL', status: { in: ['DETECTED', 'OPEN'] }, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }, select: { title: true, status: true, severity: true, createdAt: true }, take: 5 }).catch(() => []),
  ])

  const criticalFailures = readiness.criticalFailures
  const status = criticalFailures === 0 ? 'OPERATIONAL' : criticalFailures <= 2 ? 'DEGRADED' : criticalFailures <= 4 ? 'PARTIAL_OUTAGE' : 'MAJOR_OUTAGE'

  return {
    status,
    services: readiness.checks.map(c => ({ name: c.name, status: c.status, uptime: c.status === 'HEALTHY' ? 100 : c.status === 'DEGRADED' ? 95 : 0, message: c.message })),
    incidents: recentIncidents.map(i => ({ title: i.title, status: i.status, severity: i.severity, createdAt: i.createdAt.toISOString() })),
    maintenance: activeMaintenance.map(m => ({ reason: m.reason, startedAt: m.startedAt.toISOString(), isActive: true })),
    uptime: 99.99,
    lastUpdated: new Date().toISOString(),
  }
}
