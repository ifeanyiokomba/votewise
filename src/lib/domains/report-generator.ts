// VoteWise — Report Generator (Enterprise Audit Part 2)
//
// Manages ReportDefinition, GeneratedReport, ScheduledReport, ReportDownload.
// Spec: "Report, GeneratedReport, ScheduledReport, ReportDownload."

import { db } from '@/lib/db'

// ---------------------------------------------------------------------------
// ReportDefinition
// ---------------------------------------------------------------------------

export const REPORT_TYPES = [
  'ELECTION_SUMMARY',
  'TURNOUT',
  'CERTIFICATION',
  'AUDIT_TRAIL',
  'OBSERVER',
  'INTEGRITY',
  'FINANCIAL',
  'ANALYTICS',
] as const

export interface ReportDefinitionInput {
  organizationId?: string
  name: string
  type: string
  description?: string
  format?: string
  template?: string
  accessLevel?: string
}

export async function createReportDefinition(input: ReportDefinitionInput) {
  return db.reportDefinition.create({
    data: {
      organizationId: input.organizationId || null,
      name: input.name,
      type: input.type,
      description: input.description || null,
      format: input.format || 'PDF',
      template: input.template || null,
      accessLevel: input.accessLevel || 'ORG_ADMIN',
    },
  })
}

export async function listReportDefinitions(organizationId?: string) {
  const where = organizationId
    ? { OR: [{ organizationId }, { organizationId: null }] }
    : {}
  return db.reportDefinition.findMany({ where, orderBy: { type: 'asc' } })
}

// ---------------------------------------------------------------------------
// GeneratedReport
// ---------------------------------------------------------------------------

export async function createGeneratedReport(input: {
  organizationId?: string
  electionId?: string
  definitionId?: string
  reportName: string
  reportType: string
  format: string
  storageKey: string
  fileSizeBytes?: number
  generatedBy?: string
  generatedByName?: string
  parameters?: Record<string, any>
  status?: string
}) {
  return db.generatedReport.create({
    data: {
      ...input,
      parameters: input.parameters ? JSON.stringify(input.parameters) : null,
      status: input.status || 'COMPLETED',
    },
  })
}

export async function listGeneratedReports(organizationId?: string, electionId?: string, limit: number = 50) {
  const where: any = {}
  if (organizationId) where.organizationId = organizationId
  if (electionId) where.electionId = electionId
  return db.generatedReport.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}

export async function getGeneratedReport(id: string) {
  const report = await db.generatedReport.findUnique({ where: { id } })
  if (!report) return null
  return {
    ...report,
    parameters: report.parameters ? JSON.parse(report.parameters) : null,
  }
}

// ---------------------------------------------------------------------------
// ScheduledReport
// ---------------------------------------------------------------------------

export async function createScheduledReport(input: {
  organizationId?: string
  electionId?: string
  definitionId?: string
  cronExpression: string
  recipients: string[]
  enabled?: boolean
}) {
  return db.scheduledReport.create({
    data: {
      ...input,
      recipients: JSON.stringify(input.recipients),
      enabled: input.enabled ?? true,
    },
  })
}

export async function listScheduledReports(organizationId?: string) {
  const where = organizationId ? { organizationId } : {}
  const reports = await db.scheduledReport.findMany({ where, orderBy: { createdAt: 'desc' } })
  return reports.map((r) => ({ ...r, recipients: JSON.parse(r.recipients) }))
}

// ---------------------------------------------------------------------------
// ReportDownload
// ---------------------------------------------------------------------------

export async function recordReportDownload(reportId: string, downloadedBy: string, downloadedByName?: string, ipAddress?: string) {
  return db.reportDownload.create({
    data: { reportId, downloadedBy, downloadedByName, ipAddress },
  })
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export async function getReportStats(organizationId?: string) {
  const where = organizationId ? { organizationId } : {}
  const [definitions, generated, scheduled, downloads] = await Promise.all([
    db.reportDefinition.count(),
    db.generatedReport.count({ where }),
    db.scheduledReport.count({ where: { ...where, enabled: true } }),
    db.reportDownload.count(),
  ])
  return { definitions, generated, scheduled, downloads }
}

/**
 * Seed default report definitions.
 */
export async function ensureReportDefinitionsSeeded() {
  const count = await db.reportDefinition.count()
  if (count > 0) return

  const defaults = REPORT_TYPES.map((type) => ({
    name: type.split('_').map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(' ') + ' Report',
    type,
    description: `Standard ${type.toLowerCase().replace(/_/g, ' ')} report`,
    format: 'PDF',
    accessLevel: 'ORG_ADMIN',
  }))

  await db.reportDefinition.createMany({ data: defaults })
}
