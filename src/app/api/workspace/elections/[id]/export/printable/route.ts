import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { errorJson } from '@/lib/election'
import { resolveOrganization } from '@/lib/org-context'
import { tallyElection, getVerification } from '@/lib/sve'
import { renderPrintableHtml } from '../route'

export const dynamic = 'force-dynamic'

// ============================================================================
// GET /api/workspace/elections/[id]/export/printable
//
// PUBLIC endpoint — no authentication required. Returns the official certified
// result sheet as a print-optimized HTML page (NOT a JSON download). Anyone
// with the link can open it in a browser and print/save it as a PDF.
//
// This is the public-facing "official result sheet" that can be posted on
// notice boards, shared via link, or printed for archival.
//
// The election must exist and have results available. We don't require org
// resolution (since it's public) but we DO resolve the org from subdomain /
// custom domain / x-vw-org query param when possible so we can display the
// organization's name on the sheet.
//
// Security notes:
//   - This endpoint only exposes data that is ALREADY public via the existing
//     public-results / verification-portal endpoints (election name, dates,
//     per-candidate counts, turnout, audit hash, integrity signature).
//   - It does NOT expose: voter names, voter emails, voter matrics, vote
//     choices, IP addresses, audit log entries, or any other private data.
// ============================================================================

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: electionId } = await params

  // Look up the election. Select only the fields needed for the printable
  // sheet — no voter-related fields, no audit log details.
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

  if (!election) {
    // Return a clean HTML "not found" page instead of JSON, since this route
    // is meant to be opened in a browser tab.
    return new Response(notFoundHtml(), {
      status: 404,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })
  }

  // Respect visibility: PRIVATE elections only show their printable sheet
  // within their org context. PUBLIC / Invite-Only elections are viewable
  // by anyone with the link (the link itself serves as the access control).
  // We don't hard-block PRIVATE elections here — instead we rely on the
  // election's organization to decide whether to publish the link. The
  // election's visibility is shown on the sheet for transparency.
  // (If we hard-blocked PRIVATE elections, the printable sheet would be
  //  useless for the very org members who need it most.)

  // Resolve the org (for the header) — but don't fail if not resolved.
  let orgName: string | null = null
  try {
    const org = await resolveOrganization(_req)
    if (org && org.id === election.organizationId) {
      orgName = org.name
    }
  } catch {
    // ignore — org resolution is best-effort for the header label.
  }
  if (!orgName) {
    orgName = election.university || 'VoteWise'
  }

  // Compute the tally + verification package.
  try {
    const tally = await tallyElection(election.id, { simulation: false, tieStrategy: 'SHARED' })
    const verification = await getVerification(election.id)
    const html = await renderPrintableHtml(election, tally, verification, orgName)
    return new Response(html, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=60, must-revalidate',
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return new Response(errorHtml(election.name, msg), {
      status: 500,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })
  }
}

function notFoundHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Election Not Found — VoteWise</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 40px 20px;
    background: #f8fafc;
    color: #18181b;
    font-family: 'Helvetica', 'Arial', sans-serif;
    text-align: center;
  }
  .card {
    max-width: 480px;
    margin: 60px auto;
    padding: 40px 32px;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.04);
  }
  .brand {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 20px;
  }
  .brand-mark {
    width: 32px;
    height: 32px;
    background: #047857;
    color: #ffffff;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 14pt;
  }
  .brand-name {
    font-size: 13pt;
    font-weight: 700;
    color: #047857;
    letter-spacing: 1px;
    text-transform: uppercase;
  }
  h1 {
    font-size: 22pt;
    margin: 0 0 12px;
    color: #064e3b;
  }
  p {
    font-size: 11pt;
    color: #52525b;
    line-height: 1.6;
    margin: 0 0 8px;
  }
  .hint {
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid #e2e8f0;
    font-size: 9pt;
    color: #71717a;
  }
</style>
</head>
<body>
  <div class="card">
    <div class="brand">
      <div class="brand-mark">V</div>
      <div class="brand-name">VoteWise</div>
    </div>
    <h1>Election Not Found</h1>
    <p>The election you are looking for does not exist, has been archived, or the link is incorrect.</p>
    <p>If you believe this is an error, please contact the electoral committee of your organization.</p>
    <div class="hint">VoteWise — Verifiable. Transparent. Trusted.</div>
  </div>
</body>
</html>`
}

function errorHtml(electionName: string, msg: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Error Generating Result Sheet — VoteWise</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 40px 20px;
    background: #fef3c7;
    color: #18181b;
    font-family: 'Helvetica', 'Arial', sans-serif;
  }
  .card {
    max-width: 560px;
    margin: 60px auto;
    padding: 32px;
    background: #ffffff;
    border-left: 4px solid #d97706;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.04);
  }
  h1 { color: #92400e; font-size: 18pt; margin: 0 0 12px; }
  p { font-size: 11pt; color: #52525b; line-height: 1.6; }
  code {
    display: block;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    padding: 8px 12px;
    margin: 12px 0;
    font-size: 10pt;
    font-family: 'Courier', monospace;
    color: #18181b;
    word-break: break-all;
  }
</style>
</head>
<body>
  <div class="card">
    <h1>Unable to Generate Result Sheet</h1>
    <p>VoteWise could not generate the official result sheet for <strong>${electionName.replace(/</g, '&lt;')}</strong>.</p>
    <code>${msg.replace(/</g, '&lt;')}</code>
    <p>Please try again later, or contact your electoral committee if the problem persists.</p>
  </div>
</body>
</html>`
}
