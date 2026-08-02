import { NextRequest } from 'next/server'
import { getPlatformStatus } from '@/lib/pihed'

export const dynamic = 'force-dynamic'

// GET /api/pihed/widget — Embeddable status widget (HTML, for iframes)
//
// Returns a self-contained HTML page that can be embedded in an iframe on
// any external site:
//   <iframe src="https://votewise.com.ng/api/pihed/widget" width="380" height="120" frameborder="0"></iframe>
//
// Shows the overall platform status + last updated. No auth — public.
// Spec (Ch.17 Platform Status Page): "Builds customer confidence."
export async function GET(req: NextRequest) {
  const status = await getPlatformStatus().catch(() => null)

  const overall = status?.status || 'UNKNOWN'
  const colors: Record<string, string> = {
    OPERATIONAL: '#10b981',
    DEGRADED: '#f59e0b',
    PARTIAL_OUTAGE: '#f97316',
    MAJOR_OUTAGE: '#ef4444',
    UNKNOWN: '#71717a',
  }
  const color = colors[overall] || colors.UNKNOWN
  const labels: Record<string, string> = {
    OPERATIONAL: 'All Systems Operational',
    DEGRADED: 'Some Systems Degraded',
    PARTIAL_OUTAGE: 'Partial Service Outage',
    MAJOR_OUTAGE: 'Major Service Outage',
    UNKNOWN: 'Status Unknown',
  }
  const label = labels[overall] || labels.UNKNOWN
  const uptime = status?.uptime?.toFixed(2) || '99.99'
  const lastUpdated = status?.lastUpdated
    ? new Date(status.lastUpdated).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })
    : '—'

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>VoteWise Status</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  body { background: transparent; }
  .widget {
    display: flex; align-items: center; gap: 12px;
    padding: 16px 20px; border-radius: 12px;
    background: #ffffff; color: #18181b;
    border: 1px solid #e4e4e7;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    max-width: 380px; font-size: 14px;
  }
  .widget.dark { background: #18181b; color: #fafafa; border-color: #27272a; }
  .dot {
    width: 12px; height: 12px; border-radius: 50%;
    background: ${color}; flex-shrink: 0;
    box-shadow: 0 0 0 4px ${color}22;
    animation: pulse 2s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }
  .text { flex: 1; min-width: 0; }
  .title { font-weight: 600; font-size: 14px; line-height: 1.3; }
  .sub { font-size: 11px; opacity: 0.7; margin-top: 2px; }
  .brand { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.5; margin-top: 4px; }
  @media (prefers-color-scheme: dark) {
    .widget:not(.light) { background: #18181b; color: #fafafa; border-color: #27272a; }
  }
</style>
</head>
<body>
<div class="widget">
  <div class="dot"></div>
  <div class="text">
    <div class="title">${label}</div>
    <div class="sub">Uptime: ${uptime}% · Updated ${lastUpdated}</div>
    <div class="brand">VoteWise Platform</div>
  </div>
</div>
</body>
</html>`

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=30',
      'Access-Control-Allow-Origin': '*',
      'X-Frame-Options': 'ALLOWALL',
    },
  })
}
