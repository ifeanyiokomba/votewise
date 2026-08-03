// VoteWise — AI-Powered Election Monitoring Assistant (Part 5, Section 19)
//
// Spec: "Introduce an operational assistant that monitors: OTVP delivery
// failures, unusual authentication patterns, queue backlogs, slow response
// times, fraud indicators, support backlog. It should notify admins with
// recommendations rather than taking autonomous actions."

import { db } from '@/lib/db'
import { logger } from '@/lib/infra/logger'
import { getLiveMetrics } from '@/lib/pihed'

export interface MonitoringAlert {
  id: string
  severity: 'info' | 'warning' | 'high' | 'critical'
  category: string
  title: string
  description: string
  recommendation: string
  metric?: { value: number; threshold: number; unit: string }
  timestamp: string
}

export interface MonitoringReport {
  overallHealth: 'healthy' | 'degraded' | 'critical'
  alerts: MonitoringAlert[]
  summary: {
    totalAlerts: number
    critical: number
    high: number
    warning: number
    info: number
  }
  recommendations: string[]
  generatedAt: string
}

/**
 * Run the AI-powered election monitoring assistant. Scans all operational
 * metrics and generates recommendations (never takes autonomous action).
 *
 * Per spec: "notify admins with recommendations rather than taking
 * autonomous actions."
 */
export async function runMonitoringAssistant(organizationId?: string): Promise<MonitoringReport> {
  const alerts: MonitoringAlert[] = []
  const recommendations: string[] = []

  // 1. Check OTVP delivery failures
  const otpFailures = await checkOtpDeliveryFailures(organizationId)
  alerts.push(...otpFailures.alerts)
  recommendations.push(...otpFailures.recommendations)

  // 2. Check authentication patterns
  const authPatterns = await checkAuthPatterns(organizationId)
  alerts.push(...authPatterns.alerts)
  recommendations.push(...authPatterns.recommendations)

  // 3. Check queue backlogs
  const queueBacklogs = await checkQueueBacklogs(organizationId)
  alerts.push(...queueBacklogs.alerts)
  recommendations.push(...queueBacklogs.recommendations)

  // 4. Check response times
  const responseTimes = await checkResponseTimes(organizationId)
  alerts.push(...responseTimes.alerts)
  recommendations.push(...responseTimes.recommendations)

  // 5. Check fraud indicators
  const fraudIndicators = await checkFraudIndicators(organizationId)
  alerts.push(...fraudIndicators.alerts)
  recommendations.push(...fraudIndicators.recommendations)

  // 6. Check support backlog
  const supportBacklog = await checkSupportBacklog(organizationId)
  alerts.push(...supportBacklog.alerts)
  recommendations.push(...supportBacklog.recommendations)

  // 7. Check system metrics
  const systemMetrics = await checkSystemMetrics()
  alerts.push(...systemMetrics.alerts)
  recommendations.push(...systemMetrics.recommendations)

  // Compute overall health
  const critical = alerts.filter((a) => a.severity === 'critical').length
  const high = alerts.filter((a) => a.severity === 'high').length
  const warning = alerts.filter((a) => a.severity === 'warning').length
  const info = alerts.filter((a) => a.severity === 'info').length

  const overallHealth: MonitoringReport['overallHealth'] =
    critical > 0 ? 'critical' : high > 2 ? 'degraded' : 'healthy'

  const report: MonitoringReport = {
    overallHealth,
    alerts: alerts.sort((a, b) => {
      const order = { critical: 0, high: 1, warning: 2, info: 3 }
      return order[a.severity] - order[b.severity]
    }),
    summary: {
      totalAlerts: alerts.length,
      critical,
      high,
      warning,
      info,
    },
    recommendations: [...new Set(recommendations)], // deduplicate
    generatedAt: new Date().toISOString(),
  }

  // Log the report
  logger.info(`[ai-monitor] Report: ${overallHealth} — ${alerts.length} alerts (${critical} critical, ${high} high, ${warning} warning)`, {
    category: 'infrastructure',
    service: 'app',
    metadata: { overallHealth, alertCount: alerts.length },
  })

  return report
}

// ---------------------------------------------------------------------------
// Individual monitors
// ---------------------------------------------------------------------------

async function checkOtpDeliveryFailures(orgId?: string): Promise<{ alerts: MonitoringAlert[]; recommendations: string[] }> {
  const alerts: MonitoringAlert[] = []
  const recommendations: string[] = []
  const where = orgId ? { organizationId: orgId } : {}

  const failedOtps = await db.otpDeliveryAttempt.count({
    where: { ...where, status: 'FAILED', createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
  }).catch(() => 0)

  if (failedOtps > 10) {
    alerts.push({
      id: `otp-failures-${Date.now()}`,
      severity: 'critical',
      category: 'OTVP',
      title: 'High OTVP Delivery Failure Rate',
      description: `${failedOtps} OTP deliveries failed in the last hour. Voters may not be receiving their voting codes.`,
      recommendation: 'Check SMS/Email provider health. Consider switching to a backup provider. Monitor the OTP Delivery Queue in the Election Operations Console.',
      metric: { value: failedOtps, threshold: 10, unit: 'failures/hour' },
      timestamp: new Date().toISOString(),
    })
    recommendations.push('Investigate OTVP delivery failures — check provider health and consider failover.')
  } else if (failedOtps > 3) {
    alerts.push({
      id: `otp-warnings-${Date.now()}`,
      severity: 'warning',
      category: 'OTVP',
      title: 'OTVP Delivery Failures Detected',
      description: `${failedOtps} OTP deliveries failed in the last hour.`,
      recommendation: 'Monitor the OTP Delivery Queue. If failures continue, check provider configuration.',
      metric: { value: failedOtps, threshold: 3, unit: 'failures/hour' },
      timestamp: new Date().toISOString(),
    })
  }

  return { alerts, recommendations }
}

async function checkAuthPatterns(orgId?: string): Promise<{ alerts: MonitoringAlert[]; recommendations: string[] }> {
  const alerts: MonitoringAlert[] = []
  const recommendations: string[] = []

  const failedAuths = await db.voterActivityLog.count({
    where: { action: 'OTP_FAILED', createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) } },
  }).catch(() => 0)

  if (failedAuths > 20) {
    alerts.push({
      id: `auth-anomaly-${Date.now()}`,
      severity: 'high',
      category: 'Authentication',
      title: 'Unusual Authentication Failure Pattern',
      description: `${failedAuths} failed OTP verifications in the last 30 minutes. This may indicate a brute-force attack or widespread voter confusion.`,
      recommendation: 'Review failed authentication attempts in the Election Operations Console. Check if the failures are from a single IP (possible attack) or distributed (possible UX issue).',
      metric: { value: failedAuths, threshold: 20, unit: 'failures/30min' },
      timestamp: new Date().toISOString(),
    })
    recommendations.push('Investigate authentication failure pattern — possible brute-force or UX issue.')
  }

  return { alerts, recommendations }
}

async function checkQueueBacklogs(orgId?: string): Promise<{ alerts: MonitoringAlert[]; recommendations: string[] }> {
  const alerts: MonitoringAlert[] = []
  const recommendations: string[] = []

  const queueDepth = await db.messageQueue.count({
    where: { status: 'QUEUED' },
  }).catch(() => 0)

  if (queueDepth > 500) {
    alerts.push({
      id: `queue-backlog-${Date.now()}`,
      severity: 'high',
      category: 'Queue',
      title: 'Message Queue Backlog',
      description: `${queueDepth} messages queued. Deliveries may be delayed.`,
      recommendation: 'Scale up the notification worker service. Check if the SMS/Email provider is rate-limiting. Consider increasing worker replicas.',
      metric: { value: queueDepth, threshold: 500, unit: 'queued messages' },
      timestamp: new Date().toISOString(),
    })
    recommendations.push('Scale up notification workers — queue backlog detected.')
  } else if (queueDepth > 100) {
    alerts.push({
      id: `queue-warning-${Date.now()}`,
      severity: 'warning',
      category: 'Queue',
      title: 'Queue Depth Increasing',
      description: `${queueDepth} messages queued.`,
      recommendation: 'Monitor the queue. If it continues growing, scale up workers.',
      metric: { value: queueDepth, threshold: 100, unit: 'queued messages' },
      timestamp: new Date().toISOString(),
    })
  }

  return { alerts, recommendations }
}

async function checkResponseTimes(orgId?: string): Promise<{ alerts: MonitoringAlert[]; recommendations: string[] }> {
  const alerts: MonitoringAlert[] = []
  const recommendations: string[] = []

  const metrics = await getLiveMetrics()

  if (metrics.avgLatencyMs > 800) {
    alerts.push({
      id: `latency-high-${Date.now()}`,
      severity: 'high',
      category: 'Performance',
      title: 'API Response Time Exceeding Threshold',
      description: `Average API latency is ${Math.round(metrics.avgLatencyMs)}ms (threshold: 500ms). Voters may experience delays.`,
      recommendation: 'Check database query performance. Consider scaling up application replicas. Review slow queries in the monitoring dashboard.',
      metric: { value: Math.round(metrics.avgLatencyMs), threshold: 500, unit: 'ms' },
      timestamp: new Date().toISOString(),
    })
    recommendations.push('Investigate API latency — check DB performance and consider scaling.')
  }

  if (metrics.errorRate > 5) {
    alerts.push({
      id: `error-rate-${Date.now()}`,
      severity: 'critical',
      category: 'Performance',
      title: 'High API Error Rate',
      description: `API error rate is ${metrics.errorRate.toFixed(1)}% (threshold: 5%). Voters may be unable to vote.`,
      recommendation: 'Check application logs immediately. Look for database errors, provider outages, or code issues. Consider pausing the election if errors are critical.',
      metric: { value: metrics.errorRate, threshold: 5, unit: '%' },
      timestamp: new Date().toISOString(),
    })
    recommendations.push('CRITICAL: High API error rate — check logs and consider pausing election.')
  }

  return { alerts, recommendations }
}

async function checkFraudIndicators(orgId?: string): Promise<{ alerts: MonitoringAlert[]; recommendations: string[] }> {
  const alerts: MonitoringAlert[] = []
  const recommendations: string[] = []
  const where = orgId ? { organizationId: orgId } : {}

  const criticalIncidents = await db.fraudIncident.count({
    where: { ...where, severity: 'CRITICAL', status: { in: ['DETECTED', 'OPEN', 'INVESTIGATING'] } },
  }).catch(() => 0)

  if (criticalIncidents > 0) {
    alerts.push({
      id: `fraud-critical-${Date.now()}`,
      severity: 'critical',
      category: 'Fraud',
      title: 'Critical Fraud Incidents Active',
      description: `${criticalIncidents} critical fraud incident(s) are unresolved. Election integrity may be at risk.`,
      recommendation: 'Review fraud incidents in the Security Center. Consider triggering an ElectionLock if the incidents are severe. Notify the electoral committee.',
      metric: { value: criticalIncidents, threshold: 0, unit: 'critical incidents' },
      timestamp: new Date().toISOString(),
    })
    recommendations.push('URGENT: Review critical fraud incidents — election integrity at risk.')
  }

  return { alerts, recommendations }
}

async function checkSupportBacklog(orgId?: string): Promise<{ alerts: MonitoringAlert[]; recommendations: string[] }> {
  const alerts: MonitoringAlert[] = []
  const recommendations: string[] = []
  const where = orgId ? { organizationId: orgId } : {}

  const unassigned = await db.supportConversation.count({
    where: { ...where, status: 'NEW', assignedToId: null },
  }).catch(() => 0)

  const slaBreached = await db.supportConversation.count({
    where: { ...where, slaBreached: true, status: { in: ['NEW', 'ASSIGNED', 'WAITING_STAFF'] } },
  }).catch(() => 0)

  if (unassigned > 5) {
    alerts.push({
      id: `support-backlog-${Date.now()}`,
      severity: 'warning',
      category: 'Support',
      title: 'Support Conversations Unassigned',
      description: `${unassigned} support conversations are waiting for an agent. Voters may be stuck.`,
      recommendation: 'Assign more support agents. Check if any observers are available to take conversations.',
      metric: { value: unassigned, threshold: 5, unit: 'unassigned' },
      timestamp: new Date().toISOString(),
    })
    recommendations.push('Assign support agents — voters are waiting for help.')
  }

  if (slaBreached > 0) {
    alerts.push({
      id: `sla-breach-${Date.now()}`,
      severity: 'high',
      category: 'Support',
      title: 'SLA Breached on Support Conversations',
      description: `${slaBreached} conversation(s) have breached their response SLA. Voters are waiting too long.`,
      recommendation: 'Prioritize SLA-breached conversations. Consider escalating to VoteWise support if the team is overwhelmed.',
      metric: { value: slaBreached, threshold: 0, unit: 'SLA breaches' },
      timestamp: new Date().toISOString(),
    })
    recommendations.push('Handle SLA-breached support conversations immediately.')
  }

  return { alerts, recommendations }
}

async function checkSystemMetrics(): Promise<{ alerts: MonitoringAlert[]; recommendations: string[] }> {
  const alerts: MonitoringAlert[] = []
  const recommendations: string[] = []
  const metrics = await getLiveMetrics()

  if (metrics.memoryMb > 1000) {
    alerts.push({
      id: `memory-high-${Date.now()}`,
      severity: 'warning',
      category: 'Infrastructure',
      title: 'High Memory Usage',
      description: `Application memory usage is ${Math.round(metrics.memoryMb)}MB. Possible memory leak under sustained load.`,
      recommendation: 'Monitor memory trend. If it continues growing, consider restarting the application process or scaling up to more replicas.',
      metric: { value: Math.round(metrics.memoryMb), threshold: 1000, unit: 'MB' },
      timestamp: new Date().toISOString(),
    })
    recommendations.push('Monitor memory usage — possible leak under load.')
  }

  return { alerts, recommendations }
}
