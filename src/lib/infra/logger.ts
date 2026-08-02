// VoteWise — Centralized Structured Logger (Chapter 17 — Centralized Logging)
//
// Spec: "Aggregate logs from every service. Categories: Application Logs,
// Audit Logs, Security Logs, Infrastructure Logs, API Logs, Deployment Logs.
// Searchable from one dashboard."
//
// This logger writes structured entries to the LogEntry table so every
// service (app, worker, scheduler, fraud-engine, analytics-engine) can be
// queried from a single dashboard at /admin/infrastructure → Logs tab.
//
// Usage:
//   import { logger } from '@/lib/infra/logger'
//   logger.info('Vote recorded', { category: 'audit', service: 'app', requestId, orgId })
//   logger.warn('Rate limit hit', { category: 'security', service: 'app' })
//   logger.error('DB connection lost', { category: 'infrastructure', service: 'app' })

import { db } from '@/lib/db'

export type LogCategory =
  | 'application'
  | 'audit'
  | 'security'
  | 'infrastructure'
  | 'api'
  | 'deployment'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'

export type LogService =
  | 'app'
  | 'worker'
  | 'scheduler'
  | 'notification'
  | 'fraud-engine'
  | 'analytics-engine'
  | 'results-service'

export interface LogContext {
  category?: LogCategory
  service?: LogService
  level?: LogLevel
  requestId?: string
  organizationId?: string
  ipAddress?: string
  metadata?: Record<string, any>
}

class Logger {
  private serviceName: LogService

  constructor(service: LogService = 'app') {
    this.serviceName = service
  }

  /** Create a child logger bound to a specific service. */
  service(s: LogService) {
    return new Logger(s)
  }

  debug(message: string, ctx: LogContext = {}) {
    this.write('debug', message, ctx)
  }

  info(message: string, ctx: LogContext = {}) {
    this.write('info', message, ctx)
  }

  warn(message: string, ctx: LogContext = {}) {
    this.write('warn', message, ctx)
  }

  error(message: string, ctx: LogContext = {}) {
    this.write('error', message, ctx)
  }

  fatal(message: string, ctx: LogContext = {}) {
    this.write('fatal', message, ctx)
  }

  /** Audit log — for election-critical actions (vote cast, admin action, etc.) */
  audit(message: string, ctx: LogContext = {}) {
    this.write('info', message, { ...ctx, category: 'audit' })
  }

  /** Security log — for auth events, fraud signals, rate-limit hits */
  security(message: string, ctx: LogContext = {}) {
    this.write('warn', message, { ...ctx, category: 'security' })
  }

  /** Deployment log — for deploy/rollback events */
  deployment(message: string, ctx: LogContext = {}) {
    this.write('info', message, { ...ctx, category: 'deployment' })
  }

  /** Infrastructure log — for DB/Redis/queue/storage events */
  infrastructure(message: string, ctx: LogContext = {}) {
    this.write('info', message, { ...ctx, category: 'infrastructure' })
  }

  private write(level: LogLevel, message: string, ctx: LogContext) {
    const category = ctx.category || this.inferCategory(level)
    const service = ctx.service || this.serviceName
    const metadata = ctx.metadata ? JSON.stringify(ctx.metadata) : null

    // Always mirror to console for dev visibility + container log shipping
    const ts = new Date().toISOString()
    const consoleMsg = `[${ts}] [${level.toUpperCase()}] [${category}] [${service}] ${message}`
    if (level === 'error' || level === 'fatal') console.error(consoleMsg)
    else if (level === 'warn') console.warn(consoleMsg)
    else console.log(consoleMsg)

    // Persist to the LogEntry table (fire-and-forget; never block the request)
    db.logEntry
      .create({
        data: {
          category,
          level,
          service,
          message,
          metadata,
          requestId: ctx.requestId || null,
          organizationId: ctx.organizationId || null,
          ipAddress: ctx.ipAddress || null,
        },
      })
      .catch(() => {
        // Swallow — logging must NEVER break the request. If the DB is down,
        // the console mirror still goes to the container log stream.
      })
  }

  private inferCategory(level: LogLevel): LogCategory {
    if (level === 'error' || level === 'fatal') return 'infrastructure'
    return 'application'
  }
}

/** Default logger bound to the app service. */
export const logger = new Logger('app')

// ---------------------------------------------------------------------------
// Query helpers (used by the Logs dashboard)
// ---------------------------------------------------------------------------

export interface LogQuery {
  category?: LogCategory
  level?: LogLevel
  service?: LogService
  organizationId?: string
  search?: string
  since?: Date
  limit?: number
}

export async function queryLogs(q: LogQuery = {}) {
  const where: any = {}
  if (q.category) where.category = q.category
  if (q.level) where.level = q.level
  if (q.service) where.service = q.service
  if (q.organizationId) where.organizationId = q.organizationId
  if (q.since) where.createdAt = { gte: q.since }
  if (q.search) where.message = { contains: q.search }

  return db.logEntry.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: Math.min(500, q.limit || 100),
  })
}

export async function getLogStats() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const [total, errors, warnings, byCategory, byService] = await Promise.all([
    db.logEntry.count({ where: { createdAt: { gte: since } } }),
    db.logEntry.count({ where: { level: { in: ['error', 'fatal'] }, createdAt: { gte: since } } }),
    db.logEntry.count({ where: { level: 'warn', createdAt: { gte: since } } }),
    db.logEntry.groupBy({
      by: ['category'],
      where: { createdAt: { gte: since } },
      _count: true,
    }),
    db.logEntry.groupBy({
      by: ['service'],
      where: { createdAt: { gte: since } },
      _count: true,
    }),
  ])

  return {
    total24h: total,
    errors24h: errors,
    warnings24h: warnings,
    byCategory: Object.fromEntries(byCategory.map((c) => [c.category, c._count])),
    byService: Object.fromEntries(byService.map((s) => [s.service, s._count])),
  }
}
