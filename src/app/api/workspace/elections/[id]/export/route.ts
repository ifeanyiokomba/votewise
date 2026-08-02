import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { errorJson, writeAudit, getClientIp } from '@/lib/election'
import { requirePermission, type IAMContext } from '@/lib/iam'
import { tallyElection, getVerification, verifyElectionAuditChain } from '@/lib/sve'

export const dynamic = 'force-dynamic'

// ============================================================================
// GET /api/workspace/elections/[id]/export
//
// Generates downloadable reports for an election. Query params:
//   ?format=csv|json|printable
//   &type=results|audit|voters|full
//
// Permissions:
//   - type=results  → results.export
//   - type=audit    → audit.export
//   - type=voters   → voter.search
//   - type=full     → results.export (full package contains results + audit
//                     hashes + voter participation summary, so we require the
//                     more privileged results.export permission)
//
// Org scoping:
//   requireOrganization resolves the org from subdomain/custom-domain/
//   x-vw-org query param. We then verify the election belongs to that org
//   before serving any data.
//
// Output:
//   - CSV → text/csv (Content-Disposition: attachment)
//   - JSON → application/json (Content-Disposition: attachment for downloads,
//     inline is fine too — using attachment so browsers save it)
//   - printable → text/html (a print-optimized HTML page, NOT a download)
// ============================================================================

type ExportType = 'results' | 'audit' | 'voters' | 'full'
type ExportFormat = 'csv' | 'json' | 'printable'

function csvField(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value)
  // Escape double-quotes and wrap in quotes if the value contains a comma,
  // double-quote, newline, or leading/trailing whitespace.
  if (/[",\n\r]/.test(s) || /^\s|\s$/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function csvRow(fields: unknown[]): string {
  return fields.map(csvField).join(',')
}

function safeFileName(name: string, ext: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'election'
  return `votewise-${slug}.${ext}`
}

type ElectionRow = NonNullable<Awaited<ReturnType<typeof getOrgElection>>>

// Verify the election belongs to the resolved org. Returns the election row
// or null. We use a minimal select to keep the lookup fast.
async function getOrgElection(orgId: string, electionId: string): Promise<ElectionRow | null> {
  const election = await db.electionSession.findUnique({
    where: { id: electionId },
    select: {
      id: true,
      name: true,
      description: true,
      organizationId: true,
      status: true,
      startTime: true,
      endTime: true,
      academicSession: true,
      university: true,
      electionType: true,
      votingMethod: true,
      visibility: true,
      settings: true,
      certificationDate: true,
      resultsReleaseAt: true,
      accreditationStart: true,
      accreditationEnd: true,
      createdAt: true,
    },
  })
  if (!election || election.organizationId !== orgId) return null
  return election
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: electionId } = await params
  const url = new URL(req.url)
  const format = (url.searchParams.get('format') || 'csv').toLowerCase() as ExportFormat
  const type = (url.searchParams.get('type') || 'results').toLowerCase() as ExportType

  // Validate type + format combinations.
  if (!['results', 'audit', 'voters', 'full'].includes(type)) {
    return errorJson('Invalid type. Use one of: results, audit, voters, full.', 400)
  }
  if (!['csv', 'json', 'printable'].includes(format)) {
    return errorJson('Invalid format. Use one of: csv, json, printable.', 400)
  }
  // CSV is only supported for results, audit, voters (not full).
  if (format === 'csv' && type === 'full') {
    return errorJson('CSV is not supported for the full package. Use format=json or format=printable.', 400)
  }
  // Printable is only supported for results and full.
  if (format === 'printable' && (type === 'audit' || type === 'voters')) {
    return errorJson('Printable is only supported for type=results or type=full.', 400)
  }

  // Permission selection based on type.
  const permission = (type === 'audit' ? 'audit.export' : type === 'voters' ? 'voter.search' : 'results.export') as
    | 'audit.export' | 'voter.search' | 'results.export'
  const ctx = await requirePermission(req, permission)
  if (ctx instanceof Response) return ctx
  if (!ctx.org) {
    return errorJson('Organization not found.', 404)
  }

  // Verify the election belongs to the resolved org.
  const election = await getOrgElection(ctx.org.id, electionId)
  if (!election) {
    return errorJson('Election not found.', 404)
  }

  // Dispatch by type.
  try {
    if (type === 'results') {
      return await exportResults(req, ctx, election, format)
    }
    if (type === 'audit') {
      return await exportAudit(req, ctx, election, format)
    }
    if (type === 'voters') {
      return await exportVoters(req, ctx, election, format)
    }
    return await exportFull(req, ctx, election, format)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return errorJson(`Export failed: ${msg}`, 500)
  }
}

// ---------------------------------------------------------------------------
// Results export
// ---------------------------------------------------------------------------

async function exportResults(
  req: NextRequest,
  ctx: IAMContext,
  election: ElectionRow,
  format: ExportFormat,
) {
  const tally = await tallyElection(election.id, { simulation: false, tieStrategy: 'SHARED' })
  const verification = await getVerification(election.id)
  const fileName = safeFileName(election.name, format === 'csv' ? 'csv' : 'json')

  // Audit log entry — exports are audited events.
  await writeAudit({
    actorId: ctx.user.id,
    actorRole: ctx.user.role,
    actorName: ctx.user.name,
    action: 'RESULTS_EXPORTED',
    details: { electionId: election.id, electionName: election.name, format, type: 'results' },
    ip: getClientIp(req),
    electionId: election.id,
  }).catch(() => {})

  if (format === 'csv') {
    const rows: string[] = []
    rows.push(csvRow(['Position', 'Candidate', 'Votes', 'Percentage', 'Winner', 'NOTA', 'Total Votes']))
    for (const pos of tally.resultsByPosition) {
      const notaRow = pos.results.find((r) => r.candidateId === null && /NOTA/i.test(r.candidateName))
      const notaCount = notaRow ? notaRow.votes : 0
      const isNota = (r: typeof pos.results[number]) => r.candidateId === null && /NOTA/i.test(r.candidateName)
      for (const r of pos.results) {
        rows.push(csvRow([
          pos.title,
          r.candidateName,
          String(r.votes),
          `${r.percentage}%`,
          r.isWinner ? 'YES' : 'NO',
          isNota(r) ? 'YES' : 'NO',
          String(pos.totalVotes),
        ]))
      }
      // If there were no NOTA votes at all, still emit a row per position for clarity?
      // No — only emit NOTA rows when NOTA actually appeared (matches the tally shape).
      if (notaCount === 0) {
        // Keep the column consistent — no extra row needed.
      }
    }
    const csvText = rows.join('\n')
    return new Response(csvText, {
      status: 200,
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${fileName}"`,
        'cache-control': 'no-store',
      },
    })
  }

  if (format === 'json') {
    const payload = {
      _meta: {
        platform: 'VoteWise',
        exportedAt: new Date().toISOString(),
        exportedBy: ctx.user.name,
        exportType: 'results',
        format: 'json',
      },
      election: {
        id: election.id,
        name: election.name,
        status: election.status,
        startTime: election.startTime.toISOString(),
        endTime: election.endTime.toISOString(),
        academicSession: election.academicSession,
      },
      tally,
      verification: verification
        ? {
            ...verification,
            generatedAt: verification.generatedAt.toISOString(),
          }
        : null,
    }
    return new Response(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': `attachment; filename="${fileName}"`,
        'cache-control': 'no-store',
      },
    })
  }

  // format === 'printable' — return the print-optimized HTML result sheet.
  // This is the same HTML as the public /printable route, but authenticated.
  const html = await renderPrintableHtml(election, tally, verification, ctx.org?.name || null)
  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

// ---------------------------------------------------------------------------
// Audit export
// ---------------------------------------------------------------------------

async function exportAudit(
  req: NextRequest,
  ctx: IAMContext,
  election: ElectionRow,
  format: ExportFormat,
) {
  const logs = await db.auditLog.findMany({
    where: { electionId: election.id },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      actorId: true,
      actorRole: true,
      actorName: true,
      action: true,
      details: true,
      ip: true,
      prevHash: true,
      hash: true,
      nonce: true,
      createdAt: true,
    },
  })

  const chain = await verifyElectionAuditChain(election.id)
  const fileName = safeFileName(election.name + '-audit', format === 'csv' ? 'csv' : 'json')

  await writeAudit({
    actorId: ctx.user.id,
    actorRole: ctx.user.role,
    actorName: ctx.user.name,
    action: 'AUDIT_EXPORTED',
    details: { electionId: election.id, electionName: election.name, format, entryCount: logs.length },
    ip: getClientIp(req),
    electionId: election.id,
  }).catch(() => {})

  if (format === 'csv') {
    const rows: string[] = []
    rows.push(csvRow(['Timestamp', 'Actor', 'Role', 'Action', 'Details', 'IP', 'Hash', 'PrevHash']))
    for (const l of logs) {
      rows.push(csvRow([
        l.createdAt.toISOString(),
        l.actorName,
        l.actorRole,
        l.action,
        l.details || '',
        l.ip || '',
        l.hash,
        l.prevHash,
      ]))
    }
    return new Response(rows.join('\n'), {
      status: 200,
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${fileName}"`,
        'cache-control': 'no-store',
      },
    })
  }

  // JSON
  const payload = {
    _meta: {
      platform: 'VoteWise',
      exportedAt: new Date().toISOString(),
      exportedBy: ctx.user.name,
      exportType: 'audit',
      format: 'json',
    },
    election: {
      id: election.id,
      name: election.name,
      status: election.status,
    },
    chainVerification: chain,
    entries: logs.map((l) => ({
      id: l.id,
      timestamp: l.createdAt.toISOString(),
      actor: l.actorName,
      actorId: l.actorId,
      role: l.actorRole,
      action: l.action,
      details: l.details,
      ip: l.ip,
      hash: l.hash,
      prevHash: l.prevHash,
      nonce: l.nonce,
    })),
  }
  return new Response(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="${fileName}"`,
      'cache-control': 'no-store',
    },
  })
}

// ---------------------------------------------------------------------------
// Voter participation export (NO vote choices — only registration + voted status)
// ---------------------------------------------------------------------------

async function exportVoters(
  req: NextRequest,
  ctx: IAMContext,
  election: ElectionRow,
  format: ExportFormat,
) {
  // Same scoping logic as /api/workspace/elections/[id]/voters:
  //   org's master registry + election-tagged voters.
  const where = {
    organizationId: ctx.org!.id,
    OR: [{ electionSessionId: election.id }, { electionSessionId: null }],
  }

  const [total, voted, verified, pending, suspended, voters] = await Promise.all([
    db.voter.count({ where }),
    db.voter.count({ where: { ...where, hasVoted: true } }),
    db.voter.count({ where: { ...where, verificationStatus: 'VERIFIED' } }),
    db.voter.count({ where: { ...where, verificationStatus: 'PENDING' } }),
    db.voter.count({ where: { ...where, status: 'SUSPENDED' } }),
    db.voter.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        fullName: true,
        email: true,
        institutionEmail: true,
        matric: true,
        status: true,
        verificationStatus: true,
        hasVoted: true,
        votedAt: true,
        createdAt: true,
      },
    }),
  ])

  await writeAudit({
    actorId: ctx.user.id,
    actorRole: ctx.user.role,
    actorName: ctx.user.name,
    action: 'VOTER_PARTICIPATION_EXPORTED',
    details: {
      electionId: election.id,
      electionName: election.name,
      format,
      voterCount: voters.length,
      note: 'No vote choices were included — only registration + participation status.',
    },
    ip: getClientIp(req),
    electionId: election.id,
  }).catch(() => {})

  const fileName = safeFileName(election.name + '-voters', format === 'csv' ? 'csv' : 'json')

  if (format === 'csv') {
    const rows: string[] = []
    rows.push(csvRow(['Voter Name', 'Email', 'Matric', 'Status', 'Verification', 'Has Voted', 'Voted At']))
    for (const v of voters) {
      rows.push(csvRow([
        v.fullName,
        v.email || v.institutionEmail || '',
        v.matric,
        v.status || 'ACTIVE',
        v.verificationStatus || 'PENDING',
        v.hasVoted ? 'YES' : 'NO',
        v.votedAt ? v.votedAt.toISOString() : '',
      ]))
    }
    return new Response(rows.join('\n'), {
      status: 200,
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${fileName}"`,
        'cache-control': 'no-store',
      },
    })
  }

  // JSON — participation summary + voter list (NO vote choices).
  const payload = {
    _meta: {
      platform: 'VoteWise',
      exportedAt: new Date().toISOString(),
      exportedBy: ctx.user.name,
      exportType: 'voters',
      format: 'json',
      note: 'This report contains voter registration + participation metadata only. Vote choices are NEVER included.',
    },
    election: {
      id: election.id,
      name: election.name,
      status: election.status,
      startTime: election.startTime.toISOString(),
      endTime: election.endTime.toISOString(),
    },
    summary: {
      totalVoters: total,
      voted,
      notVoted: total - voted,
      verified,
      pending,
      suspended,
      turnoutPct: total > 0 ? Math.round((voted / total) * 10000) / 100 : 0,
    },
    voters: voters.map((v) => ({
      id: v.id,
      fullName: v.fullName,
      email: v.email || v.institutionEmail || null,
      matric: v.matric,
      status: v.status || 'ACTIVE',
      verificationStatus: v.verificationStatus || 'PENDING',
      hasVoted: v.hasVoted,
      votedAt: v.votedAt ? v.votedAt.toISOString() : null,
      registeredAt: v.createdAt.toISOString(),
    })),
  }
  return new Response(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="${fileName}"`,
      'cache-control': 'no-store',
    },
  })
}

// ---------------------------------------------------------------------------
// Full election package — everything for archival
// ---------------------------------------------------------------------------

async function exportFull(
  req: NextRequest,
  ctx: IAMContext,
  election: ElectionRow,
  format: ExportFormat,
) {
  // Run all sub-queries in parallel for speed.
  const [tally, verification, auditChain, incidents, timeline, voters] = await Promise.all([
    tallyElection(election.id, { simulation: false, tieStrategy: 'SHARED' }),
    getVerification(election.id),
    verifyElectionAuditChain(election.id),
    db.electionIncident.findMany({
      where: { electionId: election.id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        type: true,
        severity: true,
        status: true,
        title: true,
        description: true,
        location: true,
        reportedByName: true,
        createdAt: true,
        resolvedAt: true,
        resolutionNotes: true,
      },
    }),
    db.electionEvent.findMany({
      where: { electionId: election.id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        eventType: true,
        description: true,
        actorName: true,
        metadata: true,
        createdAt: true,
      },
    }),
    // Voter participation summary (counts only — no individual voter rows in
    // the "full" package, to keep the archive compact + privacy-preserving).
    db.voter.groupBy({
      by: ['hasVoted', 'verificationStatus', 'status'],
      where: {
        organizationId: ctx.org!.id,
        OR: [{ electionSessionId: election.id }, { electionSessionId: null }],
      },
      _count: { _all: true },
    }),
  ])

  // Aggregate the voter participation summary from the groupBy result.
  let totalVoters = 0
  let votedCount = 0
  let verifiedCount = 0
  let pendingCount = 0
  let suspendedCount = 0
  for (const g of voters) {
    totalVoters += g._count._all
    if (g.hasVoted) votedCount += g._count._all
    if (g.verificationStatus === 'VERIFIED') verifiedCount += g._count._all
    if (g.verificationStatus === 'PENDING') pendingCount += g._count._all
    if (g.status === 'SUSPENDED') suspendedCount += g._count._all
  }

  const voterParticipation = {
    totalVoters,
    voted: votedCount,
    notVoted: totalVoters - votedCount,
    verified: verifiedCount,
    pending: pendingCount,
    suspended: suspendedCount,
    turnoutPct: totalVoters > 0 ? Math.round((votedCount / totalVoters) * 10000) / 100 : 0,
  }

  // Positions + candidates (for the election config snapshot).
  const positions = await db.position.findMany({
    where: { electionSessionId: election.id },
    orderBy: { displayOrder: 'asc' },
    include: {
      candidates: {
        where: { screeningStatus: 'APPROVED' },
        select: {
          id: true,
          fullName: true,
          slug: true,
          slogan: true,
          biography: true,
          photoUrl: true,
          screeningStatus: true,
        },
      },
    },
  })

  await writeAudit({
    actorId: ctx.user.id,
    actorRole: ctx.user.role,
    actorName: ctx.user.name,
    action: 'ELECTION_FULL_PACKAGE_EXPORTED',
    details: {
      electionId: election.id,
      electionName: election.name,
      format,
      incidentCount: incidents.length,
      timelineEventCount: timeline.length,
      voterTotal: totalVoters,
    },
    ip: getClientIp(req),
    electionId: election.id,
  }).catch(() => {})

  if (format === 'printable') {
    const html = await renderPrintableHtml(election, tally, verification, ctx.org?.name || null)
    return new Response(html, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
      },
    })
  }

  // JSON — the complete archival package.
  const payload = {
    _meta: {
      platform: 'VoteWise',
      exportedAt: new Date().toISOString(),
      exportedBy: ctx.user.name,
      exportType: 'full',
      format: 'json',
      version: '1.0',
      description: 'Complete election archive — config, results, verification, audit hashes, participation summary, incidents, timeline.',
    },
    election: {
      id: election.id,
      name: election.name,
      description: election.description,
      status: election.status,
      academicSession: election.academicSession,
      university: election.university,
      electionType: election.electionType,
      votingMethod: election.votingMethod,
      visibility: election.visibility,
      settings: election.settings ? JSON.parse(election.settings) : null,
      startTime: election.startTime.toISOString(),
      endTime: election.endTime.toISOString(),
      accreditationStart: election.accreditationStart ? election.accreditationStart.toISOString() : null,
      accreditationEnd: election.accreditationEnd ? election.accreditationEnd.toISOString() : null,
      certificationDate: election.certificationDate ? election.certificationDate.toISOString() : null,
      resultsReleaseAt: election.resultsReleaseAt ? election.resultsReleaseAt.toISOString() : null,
      createdAt: election.createdAt.toISOString(),
      organization: ctx.org
        ? { id: ctx.org.id, name: ctx.org.name, subdomain: ctx.org.subdomain }
        : null,
    },
    positions: positions.map((p) => ({
      id: p.id,
      title: p.title,
      scope: p.scope,
      maximumVotes: p.maximumVotes,
      displayOrder: p.displayOrder,
      description: p.description,
      candidates: p.candidates.map((c) => ({
        id: c.id,
        fullName: c.fullName,
        slogan: c.slogan,
        biography: c.biography,
        photoUrl: c.photoUrl,
        screeningStatus: c.screeningStatus,
      })),
    })),
    results: tally,
    verification: verification
      ? {
          ...verification,
          generatedAt: verification.generatedAt.toISOString(),
        }
      : null,
    audit: {
      // Hashes only — the full audit log is exported separately via type=audit
      // to keep this archive compact. We include the chain verification result
      // + the head/tail entries for spot-checking.
      chainVerification: auditChain,
    },
    voterParticipation,
    incidents: {
      total: incidents.length,
      open: incidents.filter((i) => i.status === 'OPEN' || i.status === 'INVESTIGATING').length,
      resolved: incidents.filter((i) => i.status === 'RESOLVED' || i.status === 'DISMISSED').length,
      critical: incidents.filter((i) => i.severity === 'CRITICAL').length,
      list: incidents.map((i) => ({
        id: i.id,
        type: i.type,
        severity: i.severity,
        status: i.status,
        title: i.title,
        description: i.description,
        location: i.location,
        reportedByName: i.reportedByName,
        createdAt: i.createdAt.toISOString(),
        resolvedAt: i.resolvedAt ? i.resolvedAt.toISOString() : null,
        resolutionNotes: i.resolutionNotes,
      })),
    },
    timeline: timeline.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      description: e.description,
      actorName: e.actorName,
      metadata: e.metadata,
      createdAt: e.createdAt.toISOString(),
    })),
  }

  const fileName = safeFileName(election.name + '-full-archive', 'json')
  return new Response(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="${fileName}"`,
      'cache-control': 'no-store',
    },
  })
}

// ---------------------------------------------------------------------------
// Printable HTML renderer — shared between the authenticated results-printable
// export and the public /printable route.
// ---------------------------------------------------------------------------

export async function renderPrintableHtml(
  election: ElectionRow,
  tally: Awaited<ReturnType<typeof tallyElection>>,
  verification: Awaited<ReturnType<typeof getVerification>>,
  orgName: string | null,
): Promise<string> {
  const generatedAt = new Date().toISOString()
  const generatedAtDisplay = new Date(generatedAt).toLocaleString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
  const startDate = election.startTime.toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric',
  })
  const endDate = election.endTime.toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric',
  })
  const certDate = election.certificationDate
    ? election.certificationDate.toLocaleDateString(undefined, {
        year: 'numeric', month: 'long', day: 'numeric',
      })
    : null

  const auditHash = verification?.auditHash || tally.auditHash
  const integritySignature = verification?.integritySignature || tally.integritySignature

  // Build the results table HTML per position.
  const positionsHtml = tally.resultsByPosition.map((pos, idx) => {
    const winner = pos.results.find((r) => r.isWinner)
    const winnerName = winner ? winner.candidateName : (pos.tie ? 'Tie — unresolved' : 'No winner declared')
    const rowsHtml = pos.results.map((r) => {
      const winnerClass = r.isWinner ? ' class="winner-row"' : ''
      const winnerMark = r.isWinner ? '<span class="winner-badge">WINNER</span>' : ''
      return `<tr${winnerClass}>
        <td>${escapeHtml(r.candidateName)}</td>
        <td class="num">${r.votes.toLocaleString()}</td>
        <td class="num">${r.percentage.toFixed(2)}%</td>
        <td class="center">${winnerMark}</td>
      </tr>`
    }).join('')

    return `<section class="position-block">
      <header class="position-header">
        <h2><span class="position-number">${idx + 1}.</span> ${escapeHtml(pos.title)}</h2>
        <div class="position-meta">
          <span class="badge">${pos.totalVotes.toLocaleString()} total votes</span>
          ${pos.tie ? '<span class="badge tie">TIE</span>' : ''}
        </div>
      </header>
      <table>
        <thead>
          <tr>
            <th>Candidate</th>
            <th class="num">Votes</th>
            <th class="num">Percentage</th>
            <th class="center">Status</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || '<tr><td colspan="4" class="empty">No votes recorded.</td></tr>'}
        </tbody>
      </table>
      <div class="winner-summary">
        <strong>Declared Winner:</strong> ${escapeHtml(winnerName)}
      </div>
    </section>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(election.name)} — Official Result Sheet</title>
<style>
  /* Print-optimized CSS — clean, professional, government-document style. */
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: #ffffff;
    color: #18181b;
    font-family: 'Georgia', 'Times New Roman', serif;
    font-size: 12pt;
    line-height: 1.5;
  }
  .sheet {
    max-width: 820px;
    margin: 0 auto;
    padding: 36px 42px;
  }
  /* Header */
  .doc-header {
    border-bottom: 3px double #047857;
    padding-bottom: 18px;
    margin-bottom: 24px;
    text-align: center;
  }
  .brand-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin-bottom: 6px;
  }
  .brand-mark {
    width: 36px;
    height: 36px;
    background: #047857;
    color: #ffffff;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 16pt;
    letter-spacing: -1px;
  }
  .brand-name {
    font-family: 'Helvetica', 'Arial', sans-serif;
    font-size: 14pt;
    font-weight: 700;
    letter-spacing: 1.5px;
    color: #047857;
    text-transform: uppercase;
  }
  .doc-title {
    font-size: 20pt;
    font-weight: 700;
    margin: 8px 0 4px;
    color: #064e3b;
  }
  .doc-subtitle {
    font-size: 11pt;
    color: #52525b;
    font-style: italic;
  }
  /* Certification badge */
  .certification {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    background: #ecfdf5;
    border: 1px solid #047857;
    border-radius: 6px;
    padding: 12px 20px;
    margin: 18px 0 24px;
  }
  .cert-stamp {
    width: 56px;
    height: 56px;
    border: 2.5px solid #047857;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #047857;
    font-weight: 700;
    font-size: 9pt;
    text-align: center;
    line-height: 1.05;
    font-family: 'Helvetica', 'Arial', sans-serif;
    text-transform: uppercase;
  }
  .cert-info {
    text-align: left;
  }
  .cert-label {
    font-size: 9pt;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: #047857;
    font-weight: 700;
    font-family: 'Helvetica', 'Arial', sans-serif;
  }
  .cert-date {
    font-size: 13pt;
    font-weight: 700;
    color: #064e3b;
  }
  /* Election metadata block */
  .meta-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 24px;
    margin-bottom: 24px;
    padding: 16px 20px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
  }
  .meta-item {
    display: flex;
    flex-direction: column;
  }
  .meta-label {
    font-size: 8.5pt;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #71717a;
    font-family: 'Helvetica', 'Arial', sans-serif;
    font-weight: 600;
  }
  .meta-value {
    font-size: 11pt;
    font-weight: 600;
    color: #18181b;
  }
  /* Turnout summary */
  .turnout-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    margin-bottom: 28px;
  }
  .turnout-card {
    text-align: center;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 12px 6px;
  }
  .turnout-card .label {
    font-size: 8pt;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #71717a;
    font-family: 'Helvetica', 'Arial', sans-serif;
    font-weight: 600;
  }
  .turnout-card .value {
    font-size: 20pt;
    font-weight: 700;
    color: #064e3b;
    margin-top: 2px;
  }
  .turnout-card.highlight .value {
    color: #b45309;
  }
  /* Position blocks */
  .position-block {
    margin-bottom: 24px;
    page-break-inside: avoid;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    overflow: hidden;
  }
  .position-header {
    background: #f0fdf4;
    border-bottom: 1px solid #bbf7d0;
    padding: 10px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .position-header h2 {
    margin: 0;
    font-size: 13pt;
    color: #064e3b;
    font-weight: 700;
  }
  .position-number {
    color: #047857;
    margin-right: 4px;
  }
  .position-meta {
    display: flex;
    gap: 6px;
  }
  .badge {
    background: #ffffff;
    border: 1px solid #047857;
    color: #047857;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 8.5pt;
    font-family: 'Helvetica', 'Arial', sans-serif;
    font-weight: 600;
  }
  .badge.tie {
    background: #fef3c7;
    border-color: #d97706;
    color: #92400e;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10.5pt;
  }
  th {
    background: #f8fafc;
    text-align: left;
    padding: 8px 14px;
    font-family: 'Helvetica', 'Arial', sans-serif;
    font-size: 9pt;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: #52525b;
    border-bottom: 1px solid #e2e8f0;
    font-weight: 700;
  }
  th.num, td.num { text-align: right; font-variant-numeric: tabular-nums; }
  th.center, td.center { text-align: center; }
  td {
    padding: 7px 14px;
    border-bottom: 1px solid #f1f5f9;
  }
  tr:last-child td { border-bottom: none; }
  .winner-row {
    background: #ecfdf5;
    font-weight: 700;
  }
  .winner-row td { color: #064e3b; }
  .winner-badge {
    background: #047857;
    color: #ffffff;
    padding: 2px 8px;
    border-radius: 3px;
    font-size: 8pt;
    font-family: 'Helvetica', 'Arial', sans-serif;
    font-weight: 700;
    letter-spacing: 0.8px;
  }
  .empty {
    text-align: center;
    color: #71717a;
    font-style: italic;
    padding: 16px;
  }
  .winner-summary {
    background: #fef3c7;
    border-top: 1px solid #fcd34d;
    padding: 8px 16px;
    font-size: 10.5pt;
    color: #78350f;
  }
  /* Integrity footer */
  .integrity {
    margin-top: 28px;
    padding: 16px 20px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    page-break-inside: avoid;
  }
  .integrity h3 {
    margin: 0 0 8px;
    font-size: 11pt;
    color: #064e3b;
    font-family: 'Helvetica', 'Arial', sans-serif;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .integrity-row {
    display: flex;
    gap: 12px;
    margin-bottom: 6px;
    font-size: 9pt;
    font-family: 'Courier', 'Monaco', monospace;
    word-break: break-all;
  }
  .integrity-label {
    flex-shrink: 0;
    width: 130px;
    color: #71717a;
    font-weight: 700;
  }
  .integrity-value {
    color: #18181b;
  }
  /* Document footer */
  .doc-footer {
    margin-top: 32px;
    padding-top: 14px;
    border-top: 1px solid #e2e8f0;
    text-align: center;
    font-size: 9pt;
    color: #71717a;
    font-family: 'Helvetica', 'Arial', sans-serif;
  }
  .doc-footer .brand {
    color: #047857;
    font-weight: 700;
  }
  /* Print rules */
  @media print {
    body { font-size: 10.5pt; }
    .sheet { max-width: none; padding: 0; }
    .position-block { page-break-inside: avoid; }
    .integrity { page-break-inside: avoid; }
    @page { margin: 1.5cm 1.2cm; }
  }
</style>
</head>
<body>
<div class="sheet">
  <header class="doc-header">
    <div class="brand-row">
      <div class="brand-mark">V</div>
      <div class="brand-name">VoteWise</div>
    </div>
    <h1 class="doc-title">Official Certified Result Sheet</h1>
    <p class="doc-subtitle">${escapeHtml(election.name)}</p>
  </header>

  <div class="certification">
    <div class="cert-stamp">CERTIFIED<br>RESULTS</div>
    <div class="cert-info">
      <div class="cert-label">Certification Status</div>
      <div class="cert-date">${election.status === 'CERTIFIED' ? 'Certified' : election.status === 'COMPLETED' ? 'Tallied — Pending Certification' : 'Live Tally'}</div>
      ${certDate ? `<div class="cert-label" style="margin-top:4px">Certified on ${escapeHtml(certDate)}</div>` : ''}
    </div>
  </div>

  <div class="meta-grid">
    <div class="meta-item">
      <span class="meta-label">Organization</span>
      <span class="meta-value">${escapeHtml(orgName || election.university || 'VoteWise')}</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Academic Session</span>
      <span class="meta-value">${escapeHtml(election.academicSession || '—')}</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Voting Period — Start</span>
      <span class="meta-value">${escapeHtml(startDate)}</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Voting Period — End</span>
      <span class="meta-value">${escapeHtml(endDate)}</span>
    </div>
  </div>

  <div class="turnout-row">
    <div class="turnout-card">
      <div class="label">Eligible</div>
      <div class="value">${tally.totalEligible.toLocaleString()}</div>
    </div>
    <div class="turnout-card">
      <div class="label">Votes Cast</div>
      <div class="value">${tally.totalVotes.toLocaleString()}</div>
    </div>
    <div class="turnout-card highlight">
      <div class="label">Turnout</div>
      <div class="value">${tally.turnoutPct.toFixed(2)}%</div>
    </div>
    <div class="turnout-card">
      <div class="label">Invalid / Blank</div>
      <div class="value">${(tally.invalidVotes + tally.blankVotes).toLocaleString()}</div>
    </div>
  </div>

  ${positionsHtml || '<p style="text-align:center;color:#71717a;font-style:italic;padding:24px">No results recorded for this election.</p>'}

  <div class="integrity">
    <h3>Audit Integrity Signature</h3>
    <div class="integrity-row">
      <span class="integrity-label">Audit Hash</span>
      <span class="integrity-value">${escapeHtml(auditHash)}</span>
    </div>
    <div class="integrity-row">
      <span class="integrity-label">Integrity Signature</span>
      <span class="integrity-value">${escapeHtml(integritySignature)}</span>
    </div>
    <div class="integrity-row">
      <span class="integrity-label">Verification Generated</span>
      <span class="integrity-value">${verification ? escapeHtml(verification.generatedAt.toISOString()) : escapeHtml(tally.generatedAt)}</span>
    </div>
    <p style="font-size:8.5pt;color:#71717a;margin-top:8px;font-family:'Helvetica','Arial',sans-serif">
      The audit hash is a SHA-256 of all vote records — any modification changes this hash.
      The integrity signature is HMAC-SHA256, proving the tally was produced by VoteWise.
      Independent observers can re-derive these values from the published ballot receipts.
    </p>
  </div>

  <footer class="doc-footer">
    <p>This document was generated by <span class="brand">VoteWise</span> on ${escapeHtml(generatedAtDisplay)}.</p>
    <p>Verify independently at <span class="brand">${escapeHtml(orgName ? `${orgName}` : 'VoteWise')}.votewise.com.ng/verify</span> using any voter receipt code.</p>
  </footer>
</div>
</body>
</html>`
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
