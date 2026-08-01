import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { requirePermission } from '@/lib/iam'
import { runRiskLimitingAudit, type RLAResult } from '@/lib/sve'

export const dynamic = 'force-dynamic'

// POST /api/workspace/elections/[id]/audit-rla — Run a Risk-Limiting Audit.
//
// A risk-limiting audit examines a random sample of encrypted ballots,
// decrypts them, and compares the decrypted choices to the reported tally.
// If the sample matches, we have strong statistical evidence the outcome is
// correct (the risk limit is met). If mismatches are found, the audit
// escalates to a full recount.
//
// Requires: audit.export permission (org admin / electoral committee).
// Body: { riskLimit?: number (default 0.10), seed?: string (auto-generated) }
//
// The full audit result is persisted as an ElectionEvent (eventType:
// RISK_LIMITING_AUDIT) so it appears on the election timeline and can be
// retrieved later via GET.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePermission(req, 'audit.export')
  if ('error' in ctx) return ctx.error

  const { id: electionId } = await params
  const election = await db.electionSession.findUnique({
    where: { id: electionId },
    select: { id: true, organizationId: true, name: true, status: true },
  })
  if (!election) return errorJson('Election not found', 404)
  if (election.organizationId !== ctx.org?.id) return errorJson('Election not found', 404)

  // Parse body — both fields are optional.
  const body = await req.json().catch(() => ({}))
  const riskLimit = typeof body.riskLimit === 'number' ? body.riskLimit : 0.10
  if (!Number.isFinite(riskLimit) || riskLimit <= 0 || riskLimit >= 1) {
    return errorJson('riskLimit must be a number between 0 and 1 (exclusive).', 400)
  }
  const seed = typeof body.seed === 'string' && body.seed.trim().length > 0
    ? body.seed.trim()
    : undefined

  // Run the audit.
  let result: RLAResult
  try {
    result = await runRiskLimitingAudit(electionId, { riskLimit, seed })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return errorJson(`Audit failed: ${msg}`, 500)
  }

  // Persist the result as an ElectionEvent so it appears on the timeline and
  // can be retrieved later via GET.
  await db.electionEvent.create({
    data: {
      electionId,
      organizationId: election.organizationId,
      eventType: 'RISK_LIMITING_AUDIT',
      description: `Risk-limiting audit ${result.overallPassed ? 'passed' : 'failed'} — ${result.totalSampled}/${result.totalBallots} ballots sampled, ${result.totalMismatches} mismatch(es), risk limit ${(result.riskLimit * 100).toFixed(1)}%`,
      actorId: ctx.user.id,
      actorName: ctx.user.name,
      metadata: JSON.stringify(result),
    },
  })

  return json({
    ok: true,
    result,
    message: result.overallPassed
      ? `Audit passed — risk limit met. ${result.totalSampled} ballots sampled, all matched the reported tally.`
      : `Audit failed — discrepancies found in ${result.positions.filter((p) => !p.riskLimitMet).length} position(s). A full recount is recommended.`,
  })
}

// GET /api/workspace/elections/[id]/audit-rla — Retrieve the last RLA result.
//
// Returns the most recent Risk-Limiting Audit run for this election (if any).
// The full result is stored in the ElectionEvent.metadata column. Returns 404
// if no audit has been run yet.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  const { id: electionId } = await params
  const election = await db.electionSession.findUnique({
    where: { id: electionId },
    select: { id: true, organizationId: true, name: true },
  })
  if (!election || election.organizationId !== org.id) {
    return errorJson('Election not found', 404)
  }

  const event = await db.electionEvent.findFirst({
    where: { electionId, eventType: 'RISK_LIMITING_AUDIT' },
    orderBy: { createdAt: 'desc' },
  })

  if (!event) {
    return json({ found: false, message: 'No risk-limiting audit has been run yet.' })
  }

  let result: RLAResult | null = null
  try {
    result = JSON.parse(event.metadata || 'null') as RLAResult | null
  } catch {
    result = null
  }

  if (!result) {
    return json({ found: false, message: 'The last audit record could not be parsed.' })
  }

  return json({
    found: true,
    result,
    runAt: event.createdAt.toISOString(),
    runBy: event.actorName,
  })
}
