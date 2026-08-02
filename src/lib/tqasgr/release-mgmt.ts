// VoteWise — Chapter 18 TQASGR ext: UAT, Release Management, Doc Validation

import { db } from '@/lib/db'

// ===========================================================================
// 1. UAT (User Acceptance Testing)
// Spec: "Conduct testing with real users. Participants: platform admins,
// org admins, observers, candidates, voters. Collect structured feedback."
// ===========================================================================

export interface UatSessionInput {
  releaseVersion: string
  participantName: string
  participantRole: string
  scenario: string
}

export async function createUatSession(input: UatSessionInput) {
  return db.uatSession.create({
    data: {
      releaseVersion: input.releaseVersion,
      participantName: input.participantName,
      participantRole: input.participantRole,
      scenario: input.scenario,
      status: 'PENDING',
    },
  })
}

export async function listUatSessions(version?: string, status?: string) {
  const where: any = {}
  if (version) where.releaseVersion = version
  if (status) where.status = status
  return db.uatSession.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
}

export async function updateUatSession(id: string, update: {
  status?: string
  feedback?: string
  rating?: number
  issues?: Array<{ severity: string; description: string }>
  approved?: boolean
  startedAt?: Date
  completedAt?: Date
}) {
  return db.uatSession.update({
    where: { id },
    data: {
      ...update,
      issues: update.issues ? JSON.stringify(update.issues) : undefined,
    },
  })
}

export async function getUatStats(version?: string) {
  const where = version ? { releaseVersion: version } : {}
  const [total, completed, approved, blocked, avgRating, byRole] = await Promise.all([
    db.uatSession.count({ where }),
    db.uatSession.count({ where: { ...where, status: 'COMPLETED' } }),
    db.uatSession.count({ where: { ...where, approved: true } }),
    db.uatSession.count({ where: { ...where, status: 'BLOCKED' } }),
    db.uatSession.aggregate({ where: { ...where, rating: { not: null } }, _avg: { rating: true } }),
    db.uatSession.groupBy({ by: ['participantRole'], where, _count: true }),
  ])
  return {
    total,
    completed,
    approved,
    blocked,
    avgRating: avgRating._avg.rating ? Number(avgRating._avg.rating.toFixed(1)) : 0,
    approvalRate: completed > 0 ? Number(((approved / completed) * 100).toFixed(1)) : 0,
    byRole: Object.fromEntries(byRole.map((r) => [r.participantRole, r._count])),
  }
}

// ===========================================================================
// 2. Release Management (Alpha/Beta/RC/Stable)
// Spec: "Support: Alpha, Beta, Release Candidate (RC), Stable. Feature
// flags should allow gradual rollout."
// ===========================================================================

export interface ReleaseTrackInput {
  version: string
  phase: string // alpha | beta | rc | stable
  changelog?: string
  featureFlags?: Array<{ flag: string; enabled: boolean }>
  createdBy: string
  createdByName: string
}

export async function createReleaseTrack(input: ReleaseTrackInput) {
  return db.releaseTrack.create({
    data: {
      version: input.version,
      phase: input.phase,
      changelog: input.changelog || null,
      featureFlags: input.featureFlags ? JSON.stringify(input.featureFlags) : null,
      knownIssues: JSON.stringify([]),
      createdBy: input.createdBy,
      createdByName: input.createdByName,
    },
  })
}

export async function listReleaseTracks(phase?: string) {
  const where = phase ? { phase } : {}
  return db.releaseTrack.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
}

export async function updateReleaseTrack(version: string, update: {
  phase?: string
  releaseDate?: Date
  rolloutPct?: number
  featureFlags?: Array<{ flag: string; enabled: boolean }>
  changelog?: string
  knownIssues?: Array<{ issue: string; severity: string; workaround?: string }>
  status?: string
  approvedBy?: string
  approvedAt?: Date
}) {
  return db.releaseTrack.update({
    where: { version },
    data: {
      ...update,
      featureFlags: update.featureFlags ? JSON.stringify(update.featureFlags) : undefined,
      knownIssues: update.knownIssues ? JSON.stringify(update.knownIssues) : undefined,
    },
  })
}

export async function getReleaseStats() {
  const [total, alpha, beta, rc, stable, live, rolledBack] = await Promise.all([
    db.releaseTrack.count(),
    db.releaseTrack.count({ where: { phase: 'alpha' } }),
    db.releaseTrack.count({ where: { phase: 'beta' } }),
    db.releaseTrack.count({ where: { phase: 'rc' } }),
    db.releaseTrack.count({ where: { phase: 'stable' } }),
    db.releaseTrack.count({ where: { status: 'LIVE' } }),
    db.releaseTrack.count({ where: { status: 'ROLLED_BACK' } }),
  ])
  return { total, alpha, beta, rc, stable, live, rolledBack }
}

export async function ensureReleaseTracksSeeded() {
  const count = await db.releaseTrack.count()
  if (count > 0) return

  const now = Date.now()
  await db.releaseTrack.createMany({
    data: [
      {
        version: 'v18.0.0',
        phase: 'stable',
        releaseDate: new Date(now - 2 * 24 * 60 * 60 * 1000),
        rolloutPct: 100,
        changelog: '## Chapter 18 — Testing, QA, Security Certification & Go-Live Readiness\n\n- Complete automated testing pipeline (24 suites, 180+ test cases)\n- Election integrity test suite\n- Fraud simulation (8 attack scenarios)\n- SLO tracking with error budgets\n- Postmortem system\n- Scheduled maintenance windows\n- Compliance frameworks (ISO 27001, SOC 2, GDPR, NDPR)\n- Certification seals with HMAC-SHA256 signatures\n- Admin QA Console at /admin/quality\n- Public certification verification at /certify/[id]',
        featureFlags: JSON.stringify([
          { flag: 'tqasgr_console', enabled: true },
          { flag: 'certification_seals', enabled: true },
          { flag: 'slo_tracking', enabled: true },
          { flag: 'postmortems', enabled: true },
        ]),
        knownIssues: JSON.stringify([]),
        status: 'LIVE',
        approvedBy: 'cto@votewise.com.ng',
        approvedAt: new Date(now - 2 * 24 * 60 * 60 * 1000),
        createdBy: 'system',
        createdByName: 'Platform Team',
      },
      {
        version: 'v18.1.0',
        phase: 'rc',
        rolloutPct: 25,
        changelog: '## v18.1.0 Release Candidate\n\n- Soak testing framework\n- Chaos engineering suite\n- UAT session management\n- Release management (Alpha/Beta/RC/Stable)\n- Documentation validation\n- VoteWise Master Blueprint v1.0',
        featureFlags: JSON.stringify([
          { flag: 'soak_testing', enabled: true },
          { flag: 'chaos_engineering', enabled: true },
          { flag: 'uat_sessions', enabled: true },
        ]),
        knownIssues: JSON.stringify([
          { issue: 'Minor: widget iframe height on Safari iOS', severity: 'minor', workaround: 'Use fixed height' },
        ]),
        status: 'LIVE',
        createdBy: 'system',
        createdByName: 'Platform Team',
      },
      {
        version: 'v18.2.0',
        phase: 'beta',
        rolloutPct: 0,
        changelog: '## v18.2.0 Beta\n\n- Mobile app PWA support\n- Offline voting queue\n- Biometric voter verification (pilot)',
        featureFlags: JSON.stringify([
          { flag: 'pwa_support', enabled: false },
          { flag: 'offline_voting', enabled: false },
        ]),
        knownIssues: JSON.stringify([]),
        status: 'SCHEDULED',
        createdBy: 'system',
        createdByName: 'Platform Team',
      },
    ],
  })
}

// ===========================================================================
// 3. Documentation Validation
// Spec: "Ensure every release updates: user guides, API documentation,
// administrator manuals, observer manuals, deployment documentation, change logs."
// ===========================================================================

const DOC_TYPES = [
  { docType: 'user-guide', docName: 'Voter Guide — How to Vote', required: true },
  { docType: 'user-guide', docName: 'Organization Guide — Setup & Configuration', required: true },
  { docType: 'api-docs', docName: 'API Reference (REST + WebSocket)', required: true },
  { docType: 'api-docs', docName: 'API Authentication & Scopes', required: true },
  { docType: 'admin-manual', docName: 'Platform Admin Manual', required: true },
  { docType: 'admin-manual', docName: 'Organization Admin Manual', required: true },
  { docType: 'observer-manual', docName: 'Observer Manual — Monitoring & Reporting', required: true },
  { docType: 'deployment-doc', docName: 'Deployment Guide (Docker + K8s)', required: true },
  { docType: 'deployment-doc', docName: 'Infrastructure as Code (Terraform)', required: true },
  { docType: 'deployment-doc', docName: 'Disaster Recovery Plan', required: true },
  { docType: 'changelog', docName: 'Release Changelog', required: true },
  { docType: 'changelog', docName: 'Migration Guide (if applicable)', required: false },
]

export async function createDocValidation(version: string) {
  const existing = await db.docValidation.findFirst({ where: { version } })
  if (existing) {
    return db.docValidation.findMany({ where: { version }, orderBy: { docType: 'asc' } })
  }

  await db.docValidation.createMany({
    data: DOC_TYPES.map((d) => ({ ...d, version })),
  })

  return db.docValidation.findMany({ where: { version }, orderBy: { docType: 'asc' } })
}

export async function listDocValidations() {
  const versions = await db.docValidation.findMany({
    distinct: ['version'],
    orderBy: { createdAt: 'desc' },
    select: { version: true, createdAt: true },
  })

  const result = []
  for (const v of versions) {
    const items = await db.docValidation.findMany({ where: { version: v.version } })
    const total = items.length
    const verified = items.filter((i) => i.verified).length
    const required = items.filter((i) => i.required).length
    const requiredVerified = items.filter((i) => i.required && i.verified).length
    result.push({
      version: v.version,
      createdAt: v.createdAt,
      total,
      verified,
      required,
      requiredVerified,
      ready: requiredVerified === required,
      progressPct: Math.round((verified / total) * 100),
    })
  }
  return result
}

export async function getDocValidation(version: string) {
  return db.docValidation.findMany({ where: { version }, orderBy: { docType: 'asc' } })
}

export async function verifyDocValidation(id: string, verifiedBy: string, docUrl?: string, notes?: string) {
  return db.docValidation.update({
    where: { id },
    data: { verified: true, verifiedBy, verifiedAt: new Date(), docUrl: docUrl || null, notes: notes || null },
  })
}
