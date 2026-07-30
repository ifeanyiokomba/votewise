import { NextRequest } from 'next/server'
import { computeAggregatedResults, json, errorJson } from '@/lib/election'
import { requireOfficial } from '@/lib/guards'

export const dynamic = 'force-dynamic'

// GET /api/results/export?format=csv|json
// Allowed for any official with results.export capability.
export async function GET(req: NextRequest) {
  const auth = await requireOfficial(req, 'results.export')
  if (auth instanceof Response) return auth
  const { searchParams } = new URL(req.url)
  const format = (searchParams.get('format') || 'csv').toLowerCase()
  const data = await computeAggregatedResults(true)
  if (format === 'json') {
    return json(data, 200, { 'content-disposition': 'attachment; filename="afrivote-results.json"' })
  }
  if (format === 'csv') {
    const rows: string[] = []
    rows.push('Position,Scope,Candidate,Party,Votes,Percentage,NOTA,Total Votes')
    for (const p of data.positions) {
      for (const c of p.candidates) {
        rows.push(csv([p.title, p.scope, c.fullName, c.politicalParty?.acronym || '', String(c.votes), `${c.pct}%`, String(p.notaVotes), String(p.totalVotes)]))
      }
      if (p.notaVotes > 0) rows.push(csv([p.title, p.scope, 'None of the Above', '', String(p.notaVotes), `${p.totalVotes > 0 ? Math.round((p.notaVotes / p.totalVotes) * 1000) / 10 : 0}%`, String(p.notaVotes), String(p.totalVotes)]))
    }
    const csvText = rows.join('\n')
    return new Response(csvText, {
      status: 200,
      headers: {
        'content-type': 'text/csv',
        'content-disposition': 'attachment; filename="afrivote-results.csv"',
      },
    })
  }
  return errorJson('Unsupported format. Use csv or json.', 400)
}

function csv(fields: string[]): string {
  return fields.map((f) => {
    const s = String(f ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }).join(',')
}
