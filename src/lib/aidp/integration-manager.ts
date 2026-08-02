// VoteWise — Chapter 16 Integration Manager
//
// Manages connections to external systems (SIS, HR, identity providers, etc.)
// and tracks sync health.

import { db } from '@/lib/db'
import { recordEvent } from '@/lib/eifdirs'
import type { IntegrationCreate, IntegrationType } from './types'

/**
 * Create a new integration connection.
 */
export async function createIntegration(organizationId: string, input: IntegrationCreate, createdBy?: string) {
  const integration = await db.integration.create({
    data: {
      organizationId,
      name: input.name,
      type: input.type,
      provider: input.provider || null,
      config: input.config ? JSON.stringify(input.config) : null,
      status: 'DISCONNECTED',
    },
  })

  await recordEvent({
    organizationId,
    eventType: 'SETTINGS_CHANGED',
    category: 'ADMIN',
    severity: 'INFO',
    description: `Integration '${input.name}' (${input.type}) added`,
    actorId: createdBy,
    actorRole: 'ADMIN',
  })

  return {
    ...integration,
    config: integration.config ? JSON.parse(integration.config) : null,
    lastSyncAt: integration.lastSyncAt?.toISOString() || null,
    createdAt: integration.createdAt.toISOString(),
    updatedAt: integration.updatedAt.toISOString(),
  }
}

/**
 * List integrations for an organization.
 */
export async function listIntegrations(organizationId: string) {
  const integrations = await db.integration.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
  })
  return integrations.map((i) => ({
    ...i,
    config: i.config ? JSON.parse(i.config) : null,
    lastSyncAt: i.lastSyncAt?.toISOString() || null,
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
  }))
}

/**
 * Update integration status (e.g. mark as connected, syncing, error).
 */
export async function updateIntegrationStatus(organizationId: string, integrationId: string, status: string, error?: string) {
  const integration = await db.integration.findUnique({ where: { id: integrationId } })
  if (!integration || integration.organizationId !== organizationId) throw new Error('Integration not found')

  await db.integration.update({
    where: { id: integrationId },
    data: { status, lastError: error || null },
  })
}

/**
 * Record a sync event for an integration.
 */
export async function recordSync(organizationId: string, integrationId: string, status: 'SUCCESS' | 'PARTIAL' | 'FAILED', error?: string) {
  const integration = await db.integration.findUnique({ where: { id: integrationId } })
  if (!integration || integration.organizationId !== organizationId) throw new Error('Integration not found')

  await db.integration.update({
    where: { id: integrationId },
    data: {
      lastSyncAt: new Date(),
      lastSyncStatus: status,
      lastError: status === 'FAILED' ? error : null,
      syncCount: { increment: 1 },
      status: status === 'FAILED' ? 'ERROR' : 'CONNECTED',
    },
  })
}

/**
 * Delete an integration.
 */
export async function deleteIntegration(organizationId: string, integrationId: string) {
  const integration = await db.integration.findUnique({ where: { id: integrationId } })
  if (!integration || integration.organizationId !== organizationId) throw new Error('Integration not found')
  await db.integration.delete({ where: { id: integrationId } })
}

/**
 * Get integration health summary for an organization.
 */
export async function getIntegrationHealth(organizationId: string) {
  const integrations = await db.integration.findMany({
    where: { organizationId },
    select: { id: true, name: true, type: true, provider: true, status: true, lastSyncAt: true, lastSyncStatus: true, lastError: true },
  })

  return {
    total: integrations.length,
    connected: integrations.filter((i) => i.status === 'CONNECTED').length,
    disconnected: integrations.filter((i) => i.status === 'DISCONNECTED').length,
    error: integrations.filter((i) => i.status === 'ERROR').length,
    syncing: integrations.filter((i) => i.status === 'SYNCING').length,
    integrations: integrations.map((i) => ({
      ...i,
      lastSyncAt: i.lastSyncAt?.toISOString() || null,
    })),
  }
}

// ---------------------------------------------------------------------------
// API Logging
// ---------------------------------------------------------------------------

export async function logApiRequest(opts: {
  organizationId?: string
  apiKeyId?: string
  method: string
  endpoint: string
  statusCode: number
  latencyMs: number
  ipAddress?: string
  userAgent?: string
  requestId?: string
  error?: string
}) {
  await db.apiLog.create({
    data: {
      organizationId: opts.organizationId || null,
      apiKeyId: opts.apiKeyId || null,
      method: opts.method,
      endpoint: opts.endpoint,
      statusCode: opts.statusCode,
      latencyMs: opts.latencyMs,
      ipAddress: opts.ipAddress || null,
      userAgent: opts.userAgent || null,
      requestId: opts.requestId || null,
      error: opts.error || null,
    },
  }).catch(() => {}) // best-effort — don't fail the request if logging fails
}

export async function getApiStats(organizationId: string): Promise<{
  totalRequests: number
  totalErrors: number
  avgLatencyMs: number
  errorRate: number
  topEndpoints: Array<{ endpoint: string; count: number; avgLatency: number }>
  requestsPerHour: number
}> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000) // last 24 hours

  const [total, errors, logs] = await Promise.all([
    db.apiLog.count({ where: { organizationId, createdAt: { gte: since } } }),
    db.apiLog.count({ where: { organizationId, createdAt: { gte: since }, statusCode: { gte: 400 } } }),
    db.apiLog.findMany({
      where: { organizationId, createdAt: { gte: since } },
      select: { endpoint: true, latencyMs: true },
      take: 1000,
    }),
  ])

  const avgLatencyMs = logs.length > 0 ? Math.round(logs.reduce((sum, l) => sum + l.latencyMs, 0) / logs.length) : 0

  // Top endpoints
  const endpointMap: Record<string, { count: number; totalLatency: number }> = {}
  for (const log of logs) {
    if (!endpointMap[log.endpoint]) endpointMap[log.endpoint] = { count: 0, totalLatency: 0 }
    endpointMap[log.endpoint].count++
    endpointMap[log.endpoint].totalLatency += log.latencyMs
  }
  const topEndpoints = Object.entries(endpointMap)
    .map(([endpoint, data]) => ({ endpoint, count: data.count, avgLatency: Math.round(data.totalLatency / data.count) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const requestsPerHour = logs.filter((l) => new Date(l.endpoint) > oneHourAgo).length // approximation

  return {
    totalRequests: total,
    totalErrors: errors,
    avgLatencyMs,
    errorRate: total > 0 ? Math.round((errors / total) * 10000) / 100 : 0,
    topEndpoints,
    requestsPerHour,
  }
}
