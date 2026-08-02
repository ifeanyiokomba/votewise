import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { errorJson } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { getCurrentOfficial } from '@/lib/guards'

export const dynamic = 'force-dynamic'

// GET /api/workspace/voters/import-template
//
// Generates and returns a CSV template that matches the organization's
// configured VoterField definitions. If the org has no custom voter fields,
// falls back to a sensible default (firstName, lastName, email, phone, matric).
//
// Always includes 2-3 example rows so officials can see the expected format.
//
// Response: a `text/csv` file with Content-Disposition: attachment.
export async function GET(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  // Workspace routes require an authenticated official — the template reflects
  // org-specific configuration, so we never expose it to anonymous callers.
  const official = await getCurrentOfficial(req)
  if (!official) return errorJson('Unauthorized', 401)

  // Pull the org's dynamic voter field definitions, ordered by displayOrder.
  // These are the custom fields the org has set up (e.g. "Matric Number",
  // "Employee ID", "Department", "Faculty").
  const customFields = await db.voterField.findMany({
    where: { organizationId: org.id },
    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
  })

  // Build the column list.
  // Always include the canonical voter identity columns first; then append
  // any custom VoterFields the org has defined. If the org has NO custom
  // fields, we add `matric` as a useful default (most academic institutions
  // need it).
  const baseColumns = ['firstName', 'lastName', 'email', 'phone']
  const hasCustomMatric = customFields.some(
    (f) => f.key.toLowerCase() === 'matric' || f.key.toLowerCase() === 'matricnumber',
  )
  if (!hasCustomMatric) baseColumns.push('matric')

  const customColumns = customFields.map((f) => f.key)
  const columns = [...baseColumns, ...customColumns]

  // Build 2-3 example rows so users see the expected format. The examples
  // use realistic Nigerian-style names + values to match the platform's
  // primary audience. Extra keys beyond `columns` are simply ignored.
  const examples: Record<string, string>[] = [
    {
      firstName: 'Adaobi',
      lastName: 'Okonkwo',
      email: 'adaobi.okonkwo@example.edu.ng',
      phone: '+2348012345678',
      matric: 'CSC/2021/001',
      department: 'Computer Science',
      faculty: 'Science',
      level: '400',
      employeeId: 'EMP-0001',
      membershipNumber: 'MEM-2024-001',
    },
    {
      firstName: 'Ibrahim',
      lastName: 'Musah',
      email: 'ibrahim.musah@example.edu.ng',
      phone: '+2348098765432',
      matric: 'ECO/2020/045',
      department: 'Economics',
      faculty: 'Social Sciences',
      level: '300',
      employeeId: 'EMP-0002',
      membershipNumber: 'MEM-2024-002',
    },
    {
      firstName: 'Fatima',
      lastName: 'Bello',
      email: 'fatima.bello@example.edu.ng',
      phone: '+2348055544332',
      matric: 'LAW/2022/110',
      department: 'Law',
      faculty: 'Law',
      level: '200',
      employeeId: 'EMP-0003',
      membershipNumber: 'MEM-2024-003',
    },
  ]

  // Compose CSV.
  const headerRow = columns.map(csvEscape).join(',')
  const dataRows = examples.map((ex) =>
    columns
      .map((col) => csvEscape(ex[col] !== undefined ? String(ex[col]) : ''))
      .join(','),
  )
  const csvText = [headerRow, ...dataRows].join('\n')

  return new Response(csvText, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="votewise-voter-template.csv"',
      // Hint to browsers + the gateway: this is a static-ish artifact and
      // safe to cache briefly per-org.
      'cache-control': 'private, max-age=30',
    },
  })
}

// Minimal CSV escape: wrap in quotes if the value contains a comma, newline,
// or double-quote; double up any embedded double-quotes.
function csvEscape(value: string): string {
  const s = String(value ?? '')
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}
