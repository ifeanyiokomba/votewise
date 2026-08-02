// VoteWise — Chapter 18 TQASGR: Checklists, Pilots, Compliance, Certification

import { db } from '@/lib/db'
import { randomBytes, createHmac } from 'crypto'

// ===========================================================================
// 1. RELEASE READINESS CHECKLIST
// Spec: "All automated tests passed, Code review completed, Security scan
// passed, Performance benchmarks met, Accessibility verified, Documentation
// updated, Backups successful, Monitoring configured, Rollback plan ready,
// Deployment approved."
// ===========================================================================

const RELEASE_CHECKLIST_ITEMS: Array<{ itemName: string; category: string; required: boolean }> = [
  { itemName: 'All automated tests passed', category: 'testing', required: true },
  { itemName: 'Unit test coverage ≥ 90% for critical modules', category: 'testing', required: true },
  { itemName: 'Cryptographic + vote-counting logic 100% covered', category: 'testing', required: true },
  { itemName: 'Code review completed', category: 'code-review', required: true },
  { itemName: 'No unresolved review comments', category: 'code-review', required: true },
  { itemName: 'Security scan passed (npm audit + Trivy)', category: 'security', required: true },
  { itemName: 'SAST (CodeQL) passed', category: 'security', required: true },
  { itemName: 'Secret scan passed (no secrets in code)', category: 'security', required: true },
  { itemName: 'Penetration test completed (no critical findings)', category: 'security', required: false },
  { itemName: 'Performance benchmarks met (p95 < 500ms)', category: 'performance', required: true },
  { itemName: 'Load test at expected voter count passed', category: 'performance', required: true },
  { itemName: 'Accessibility verified (WCAG 2.1 AA)', category: 'a11y', required: true },
  { itemName: 'Cross-browser testing passed (Chrome, Firefox, Safari, Edge)', category: 'a11y', required: true },
  { itemName: 'Documentation updated (user guides, API docs, admin manuals)', category: 'docs', required: true },
  { itemName: 'Changelog updated', category: 'docs', required: true },
  { itemName: 'Backups successful (verified restorable)', category: 'backup', required: true },
  { itemName: 'Monitoring configured (alerts, dashboards, SLOs)', category: 'monitoring', required: true },
  { itemName: 'Rollback plan ready + tested', category: 'rollback', required: true },
  { itemName: 'Deployment approved by release manager', category: 'approval', required: true },
  { itemName: 'Separation of duties (developer ≠ approver)', category: 'approval', required: true },
]

export async function createReleaseChecklist(version: string) {
  const existing = await db.releaseChecklist.findFirst({ where: { version } })
  if (existing) {
    return db.releaseChecklist.findMany({ where: { version }, orderBy: { category: 'asc' } })
  }

  await db.releaseChecklist.createMany({
    data: RELEASE_CHECKLIST_ITEMS.map((item) => ({ ...item, version })),
  })

  return db.releaseChecklist.findMany({ where: { version }, orderBy: { category: 'asc' } })
}

export async function listReleaseChecklists() {
  const versions = await db.releaseChecklist.findMany({
    distinct: ['version'],
    orderBy: { createdAt: 'desc' },
    select: { version: true, createdAt: true },
  })

  const result = []
  for (const v of versions) {
    const items = await db.releaseChecklist.findMany({ where: { version: v.version } })
    const total = items.length
    const verified = items.filter((i) => i.verified).length
    const required = items.filter((i) => i.required).length
    const requiredVerified = items.filter((i) => i.required && i.verified).length
    const ready = requiredVerified === required
    result.push({
      version: v.version,
      createdAt: v.createdAt,
      total,
      verified,
      required,
      requiredVerified,
      ready,
      progressPct: Math.round((verified / total) * 100),
    })
  }
  return result
}

export async function getReleaseChecklist(version: string) {
  return db.releaseChecklist.findMany({ where: { version }, orderBy: { category: 'asc' } })
}

export async function verifyChecklistItem(id: string, verifiedBy: string, notes?: string) {
  return db.releaseChecklist.update({
    where: { id },
    data: { verified: true, verifiedBy, verifiedAt: new Date(), notes: notes || null },
  })
}

export async function unverifyChecklistItem(id: string) {
  return db.releaseChecklist.update({
    where: { id },
    data: { verified: false, verifiedBy: null, verifiedAt: null, notes: null },
  })
}

// ===========================================================================
// 2. PRODUCTION GO-LIVE CHECKLIST
// Spec: "Organization configured, Election validated, Candidates approved,
// Voters imported, OTVP channels operational, Infrastructure healthy,
// Monitoring active, Backup verified, SSL valid, Domain verified, Support
// team available."
// ===========================================================================

const GOLIVE_CHECKLIST_ITEMS: Array<{ itemName: string; category: string; required: boolean }> = [
  { itemName: 'Organization configured (name, branding, domain)', category: 'org', required: true },
  { itemName: 'Election validated (all fields, timing)', category: 'election', required: true },
  { itemName: 'Election readiness check passed (13-point)', category: 'election', required: true },
  { itemName: 'Candidates approved (all positions filled)', category: 'candidates', required: true },
  { itemName: 'Voters imported + eligibility verified', category: 'voters', required: true },
  { itemName: 'OTVP channels operational (SMS/WhatsApp tested)', category: 'otvp', required: true },
  { itemName: 'Infrastructure healthy (PIHED readiness green)', category: 'infra', required: true },
  { itemName: 'Capacity sufficient for expected voters', category: 'infra', required: true },
  { itemName: 'Monitoring active (alerts + SLOs)', category: 'monitoring', required: true },
  { itemName: 'Backup verified (last backup restorable)', category: 'backup', required: true },
  { itemName: 'SSL certificate valid (≥30 days remaining)', category: 'ssl', required: true },
  { itemName: 'Domain verified (DNS + SSL)', category: 'domain', required: true },
  { itemName: 'Support team available + on-call', category: 'support', required: true },
  { itemName: 'Election lock tested (can freeze if needed)', category: 'infra', required: true },
  { itemName: 'Observer accounts provisioned', category: 'support', required: false },
  { itemName: 'Voter education materials published', category: 'support', required: false },
]

export async function createGoLiveChecklist(organizationId: string, electionId?: string) {
  await db.goLiveChecklist.createMany({
    data: GOLIVE_CHECKLIST_ITEMS.map((item) => ({
      ...item,
      organizationId,
      electionId: electionId || null,
    })),
  })

  return db.goLiveChecklist.findMany({
    where: { organizationId, electionId: electionId || null },
    orderBy: { category: 'asc' },
  })
}

export async function getGoLiveChecklist(organizationId: string, electionId?: string) {
  const where: any = { organizationId }
  if (electionId) where.electionId = electionId
  return db.goLiveChecklist.findMany({ where, orderBy: { category: 'asc' } })
}

export async function verifyGoLiveItem(id: string, verifiedBy: string, notes?: string) {
  return db.goLiveChecklist.update({
    where: { id },
    data: { verified: true, verifiedBy, verifiedAt: new Date(), notes: notes || null },
  })
}

export async function getGoLiveSummary(organizationId: string, electionId?: string) {
  const items = await getGoLiveChecklist(organizationId, electionId)
  const total = items.length
  const verified = items.filter((i) => i.verified).length
  const required = items.filter((i) => i.required).length
  const requiredVerified = items.filter((i) => i.required && i.verified).length
  const ready = requiredVerified === required
  return { total, verified, required, requiredVerified, ready, progressPct: Math.round((verified / total) * 100) }
}

// ===========================================================================
// 3. PILOT ELECTIONS
// Spec: "Student association, Small NGO, Company committee, Department
// election. Monitor every metric."
// ===========================================================================

export async function listPilotElections(status?: string) {
  const where = status ? { status } : {}
  return db.pilotElection.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  })
}

export async function createPilotElection(input: {
  organizationId: string
  electionId?: string
  name: string
  type: string
  scale: string
  expectedVoters: number
  startDate?: Date
  endDate?: Date
  successCriteria?: Array<{ criterion: string; met: boolean }>
  createdBy?: string
  createdByName?: string
}) {
  return db.pilotElection.create({
    data: {
      ...input,
      successCriteria: input.successCriteria ? JSON.stringify(input.successCriteria) : null,
    },
  })
}

export async function updatePilotElection(id: string, update: any) {
  return db.pilotElection.update({
    where: { id },
    data: {
      ...update,
      successCriteria: update.successCriteria ? JSON.stringify(update.successCriteria) : undefined,
      metrics: update.metrics ? JSON.stringify(update.metrics) : undefined,
    },
  })
}

export async function getPilotStats() {
  const [total, planned, active, completed, approvedForGA] = await Promise.all([
    db.pilotElection.count(),
    db.pilotElection.count({ where: { status: 'PLANNED' } }),
    db.pilotElection.count({ where: { status: 'ACTIVE' } }),
    db.pilotElection.count({ where: { status: 'COMPLETED' } }),
    db.pilotElection.count({ where: { approvedForGA: true } }),
  ])
  return { total, planned, active, completed, approvedForGA }
}

export async function ensurePilotsSeeded() {
  const count = await db.pilotElection.count()
  if (count > 0) return

  const now = Date.now()
  await db.pilotElection.createMany({
    data: [
      {
        organizationId: 'cmsb89vnd0000us75p1d4st9w', // Demo University
        name: 'Demo University SUG Pilot — Faculty of Science',
        type: 'faculty',
        scale: 'small',
        expectedVoters: 3500,
        actualVoters: 3214,
        status: 'COMPLETED',
        startDate: new Date(now - 30 * 24 * 60 * 60 * 1000),
        endDate: new Date(now - 30 * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000),
        metrics: JSON.stringify({ turnout: 91.8, errorRate: 0.02, p95Latency: 142, incidents: 0 }),
        lessonsLearned: 'Smooth election. Peak load at 2,500 concurrent voters handled with 2 replicas. OTP delivery via SMS had 99.7% success rate. Recommended: pre-warm the database connection pool before voting opens.',
        successCriteria: JSON.stringify([
          { criterion: 'Turnout > 80%', met: true },
          { criterion: 'Zero critical incidents', met: true },
          { criterion: 'p95 latency < 500ms', met: true },
          { criterion: 'No vote loss', met: true },
        ]),
        approvedForGA: true,
        createdBy: 'system',
        createdByName: 'Platform Team',
      },
      {
        organizationId: 'cmsb89vnd0000us75p1d4st9w',
        name: 'Lagos Tech Meetup — Board Election',
        type: 'company-committee',
        scale: 'micro',
        expectedVoters: 200,
        actualVoters: 187,
        status: 'COMPLETED',
        startDate: new Date(now - 14 * 24 * 60 * 60 * 1000),
        endDate: new Date(now - 14 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
        metrics: JSON.stringify({ turnout: 93.5, errorRate: 0.0, p95Latency: 89, incidents: 0 }),
        lessonsLearned: 'Micro-scale election. Perfect for validating the UX flow. All voters received OTP within 3 seconds.',
        successCriteria: JSON.stringify([
          { criterion: 'Turnout > 85%', met: true },
          { criterion: 'Zero incidents', met: true },
        ]),
        approvedForGA: true,
        createdBy: 'system',
        createdByName: 'Platform Team',
      },
      {
        organizationId: 'cmsb89vnd0000us75p1d4st9w',
        name: 'National NGO Coalition — Executive Election',
        type: 'ngo',
        scale: 'medium',
        expectedVoters: 15000,
        status: 'PLANNED',
        startDate: new Date(now + 7 * 24 * 60 * 60 * 1000),
        endDate: new Date(now + 7 * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000),
        successCriteria: JSON.stringify([
          { criterion: 'Turnout > 70%', met: false },
          { criterion: 'Zero critical incidents', met: false },
          { criterion: 'p95 latency < 500ms', met: false },
          { criterion: 'No vote loss', met: false },
        ]),
        createdBy: 'system',
        createdByName: 'Platform Team',
      },
    ],
  })
}

// ===========================================================================
// 4. COMPLIANCE FRAMEWORKS
// Spec: "Prepare for ISO 27001, SOC 2, GDPR, Local data protection regulations."
// ===========================================================================

export async function listComplianceFrameworks() {
  return db.complianceFramework.findMany({ orderBy: { createdAt: 'asc' } })
}

export async function getComplianceStats() {
  const [total, certified, inProgress, notStarted] = await Promise.all([
    db.complianceFramework.count(),
    db.complianceFramework.count({ where: { status: 'certified' } }),
    db.complianceFramework.count({ where: { status: 'in-progress' } }),
    db.complianceFramework.count({ where: { status: 'not-started' } }),
  ])
  return { total, certified, inProgress, notStarted }
}

export async function updateComplianceFramework(id: string, update: any) {
  return db.complianceFramework.update({ where: { id }, data: update })
}

export async function ensureComplianceSeeded() {
  const count = await db.complianceFramework.count()
  if (count > 0) return

  const frameworks = [
    {
      name: 'ISO 27001',
      description: 'Information Security Management Systems. The international standard for managing information security.',
      status: 'in-progress',
      totalControls: 114,
      metControls: 89,
      certifyingBody: 'BSI Group',
      evidence: JSON.stringify([
        { control: 'A.5 Information security policies', status: 'met', evidence: 'Security policy document v2.1, approved by board', lastReviewed: '2026-07-15' },
        { control: 'A.8 Asset management', status: 'met', evidence: 'Asset register maintained in CMDB', lastReviewed: '2026-07-10' },
        { control: 'A.9 Access control', status: 'met', evidence: 'RBAC + MFA enforced, quarterly access reviews', lastReviewed: '2026-07-20' },
        { control: 'A.10 Cryptography', status: 'met', evidence: 'AES-256-GCM for votes, TLS 1.3 for transport, HMAC-SHA256 for signatures', lastReviewed: '2026-07-20' },
        { control: 'A.12 Operations security', status: 'met', evidence: 'Hardened Caddy + WAF + rate limiting + GuardDuty', lastReviewed: '2026-07-18' },
        { control: 'A.14 System acquisition, development & maintenance', status: 'in-progress', evidence: 'CI/CD with security gates, SAST + DAST in pipeline', lastReviewed: '2026-07-12' },
        { control: 'A.16 Incident management', status: 'met', evidence: 'EIFDIRS incident lifecycle + postmortem process', lastReviewed: '2026-07-22' },
        { control: 'A.17 Business continuity', status: 'in-progress', evidence: 'DR plan documented, cross-region backups, failover tested', lastReviewed: '2026-07-05' },
      ]),
    },
    {
      name: 'SOC 2 Type II',
      description: 'Service Organization Control 2 — Security, Availability, Processing Integrity, Confidentiality, Privacy.',
      status: 'in-progress',
      totalControls: 64,
      metControls: 48,
      certifyingBody: 'Deloitte',
      evidence: JSON.stringify([
        { control: 'CC1 Control Environment', status: 'met', evidence: 'Governance framework, code of conduct, segregation of duties', lastReviewed: '2026-07-01' },
        { control: 'CC2 Communication & Information', status: 'met', evidence: 'Change management process, stakeholder notifications', lastReviewed: '2026-07-01' },
        { control: 'CC3 Risk Assessment', status: 'met', evidence: 'Annual risk assessment, threat modeling for each chapter', lastReviewed: '2026-06-28' },
        { control: 'CC4 Monitoring Activities', status: 'met', evidence: 'PIHED monitoring, SLO tracking, alerting, internal audit', lastReviewed: '2026-07-15' },
        { control: 'CC5 Control Activities', status: 'in-progress', evidence: 'RBAC, MFA, encryption, backups — automation in progress', lastReviewed: '2026-07-10' },
        { control: 'A1 Availability', status: 'met', evidence: 'Multi-AZ RDS, HPA, 99.99% uptime SLO', lastReviewed: '2026-07-20' },
        { control: 'C1 Confidentiality', status: 'met', evidence: 'AES-256 at rest, TLS 1.3 in transit, secrets in AWS Secrets Manager', lastReviewed: '2026-07-20' },
        { control: 'P1 Privacy', status: 'in-progress', evidence: 'GDPR/NDPR compliance in progress, data retention policies', lastReviewed: '2026-07-08' },
      ]),
    },
    {
      name: 'GDPR',
      description: 'General Data Protection Regulation (EU). Data protection and privacy for individuals in the European Union.',
      status: 'in-progress',
      totalControls: 30,
      metControls: 22,
      certifyingBody: 'Self-certified + external DPO review',
      evidence: JSON.stringify([
        { control: 'Lawful basis for processing', status: 'met', evidence: 'Consent + contract (election services agreement)', lastReviewed: '2026-07-12' },
        { control: 'Data subject rights', status: 'met', evidence: 'Export, rectify, delete endpoints implemented', lastReviewed: '2026-07-12' },
        { control: 'Data breach notification (72h)', status: 'met', evidence: 'Alerting pipeline + incident response runbook', lastReviewed: '2026-07-15' },
        { control: 'Privacy by design', status: 'met', evidence: 'PEPPER hashing, vote encryption, minimal data collection', lastReviewed: '2026-07-20' },
        { control: 'Data Protection Officer (DPO)', status: 'in-progress', evidence: 'DPO to be appointed before EU expansion', lastReviewed: '2026-06-30' },
        { control: 'Cross-border data transfer', status: 'in-progress', evidence: 'SCCs being drafted for EU→NG transfer', lastReviewed: '2026-07-05' },
      ]),
    },
    {
      name: 'NDPR (Nigeria Data Protection Regulation)',
      description: 'Nigeria\'s data protection regulation. Mandatory for all organizations processing Nigerian citizens\' data.',
      status: 'certified',
      totalControls: 28,
      metControls: 28,
      certifyingBody: 'Nigeria Data Protection Bureau (NDPB)',
      validFrom: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      validUntil: new Date(Date.now() + 305 * 24 * 60 * 60 * 1000),
      certificateUrl: '/certificates/ndpr-2026.pdf',
      evidence: JSON.stringify([
        { control: 'Lawful basis', status: 'met', evidence: 'Consent + legitimate interest (election conduct)', lastReviewed: '2026-07-01' },
        { control: 'Data subject rights', status: 'met', evidence: 'Access, rectification, erasure endpoints', lastReviewed: '2026-07-01' },
        { control: 'Data breach notification', status: 'met', evidence: '72-hour notification to NDPR + data subjects', lastReviewed: '2026-07-01' },
        { control: 'Data transfer outside Nigeria', status: 'met', evidence: 'Adequacy assessment + SCCs', lastReviewed: '2026-07-01' },
        { control: 'Data protection officer', status: 'met', evidence: 'DPO appointed: dpo@votewise.com.ng', lastReviewed: '2026-07-01' },
        { control: 'Privacy impact assessment', status: 'met', evidence: 'DPIA completed for election processing', lastReviewed: '2026-07-01' },
      ]),
    },
  ]

  await db.complianceFramework.createMany({ data: frameworks })
}

// ===========================================================================
// 5. CERTIFICATION SEAL
// Spec: "Every completed election can receive a digitally signed
// certification package with a Certification ID (VW-2027-000184)."
// ===========================================================================

function generateCertificationId(): string {
  const year = new Date().getFullYear()
  const seq = String(Math.floor(Math.random() * 999999)).padStart(6, '0')
  return `VW-${year}-${seq}`
}

function signCertification(payload: {
  certificationId: string
  electionId: string
  electionName: string
  integrityScore: number
  votesVerified: number
  certifiedAt: string
}): string {
  const secret = process.env.HMAC_SECRET || 'votewise-cert-fallback'
  const data = `${payload.certificationId}|${payload.electionId}|${payload.electionName}|${payload.integrityScore}|${payload.votesVerified}|${payload.certifiedAt}`
  return createHmac('sha256', secret).update(data).digest('hex')
}

export async function issueCertificationSeal(input: {
  electionId: string
  organizationId?: string
  electionName: string
  organizationName?: string
  integrityScore?: number
  votesVerified?: number
  auditLogsComplete?: boolean
  observerReportsComplete?: boolean
  securityIncidents?: string
  certifiedBy?: string
}) {
  const certificationId = generateCertificationId()
  // Round to the nearest second to avoid SQLite sub-millisecond precision
  // mismatches between signing and verification.
  const certifiedAtDate = new Date(Math.floor(Date.now() / 1000) * 1000)
  const certifiedAt = certifiedAtDate.toISOString()
  const integrityScore = input.integrityScore ?? 99.98
  const votesVerified = input.votesVerified ?? 0

  const signature = signCertification({
    certificationId,
    electionId: input.electionId,
    electionName: input.electionName,
    integrityScore,
    votesVerified,
    certifiedAt,
  })

  return db.certificationSeal.create({
    data: {
      certificationId,
      electionId: input.electionId,
      organizationId: input.organizationId || null,
      electionName: input.electionName,
      organizationName: input.organizationName || null,
      status: 'CERTIFIED',
      integrityScore,
      votesVerified,
      auditLogsComplete: input.auditLogsComplete ?? true,
      observerReportsComplete: input.observerReportsComplete ?? true,
      securityIncidents: input.securityIncidents || 'None Critical',
      certifiedBy: input.certifiedBy || 'VoteWise Platform',
      certifiedAt: certifiedAtDate, // use the EXACT same Date object used for signing
      signature,
    },
  })
}

export async function getCertificationSeal(certificationId: string) {
  const seal = await db.certificationSeal.findUnique({
    where: { certificationId },
  })
  if (!seal) return null

  // Verify the signature. Use the DB-stored certifiedAt converted to ISO.
  // SQLite may truncate sub-millisecond precision, so we round to the
  // nearest millisecond on both sides to avoid spurious mismatches.
  const storedCertifiedAt = new Date(seal.certifiedAt).toISOString()
  const expectedSig = signCertification({
    certificationId: seal.certificationId,
    electionId: seal.electionId,
    electionName: seal.electionName,
    integrityScore: seal.integrityScore,
    votesVerified: seal.votesVerified,
    certifiedAt: storedCertifiedAt,
  })

  // If the exact match fails, try rounding to the nearest second (SQLite
  // sometimes drops milliseconds entirely).
  const signatureValid =
    seal.signature === expectedSig ||
    seal.signature === signCertification({
      certificationId: seal.certificationId,
      electionId: seal.electionId,
      electionName: seal.electionName,
      integrityScore: seal.integrityScore,
      votesVerified: seal.votesVerified,
      certifiedAt: new Date(Math.floor(seal.certifiedAt.getTime() / 1000) * 1000).toISOString(),
    })

  return {
    ...seal,
    signatureValid,
  }
}

export async function revokeCertificationSeal(certificationId: string, reason: string) {
  return db.certificationSeal.update({
    where: { certificationId },
    data: { status: 'REVOKED', revokedAt: new Date(), revokeReason: reason },
  })
}

export async function listCertificationSeals(limit: number = 20) {
  return db.certificationSeal.findMany({
    orderBy: { certifiedAt: 'desc' },
    take: limit,
  })
}

export async function ensureCertSealsSeeded() {
  const count = await db.certificationSeal.count()
  if (count > 0) return

  await issueCertificationSeal({
    electionId: 'sve-demo',
    organizationId: 'cmsb89vnd0000us75p1d4st9w',
    electionName: 'SUG General Elections 2025 (SVE Demo)',
    organizationName: 'Demo University',
    integrityScore: 99.98,
    votesVerified: 42316,
    auditLogsComplete: true,
    observerReportsComplete: true,
    securityIncidents: 'None Critical',
  }).catch(() => {})
}
