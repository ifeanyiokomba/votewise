// VoteWise — CSV Import Validation (Enterprise Audit Part 4)
//
// Spec: "Voter import: CSV format, duplicate voters, invalid emails,
// invalid phone numbers."
//
// Validates each row of a voter import CSV before it reaches the database.

export interface VoterCsvRow {
  fullName: string
  matricNumber: string
  email?: string
  phone?: string
  whatsapp?: string
  faculty?: string
  department?: string
  level?: string
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  sanitized: Partial<VoterCsvRow>
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_REGEX = /^\+?[\d\s-]{8,15}$/
const MATRIC_REGEX = /^[A-Za-z0-9\/\-]{3,30}$/

// Prohibited words in organization names (spec: "prohibited words")
const PROHIBITED_WORDS = ['admin', 'root', 'system', 'votewise', 'null', 'undefined']

/**
 * Validate a single voter CSV row.
 */
export function validateVoterRow(row: Partial<VoterCsvRow>): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const sanitized: Partial<VoterCsvRow> = {}

  // Full name — required, 2-100 chars
  if (!row.fullName || row.fullName.trim().length < 2) {
    errors.push('Full name is required (min 2 characters)')
  } else if (row.fullName.length > 100) {
    errors.push('Full name is too long (max 100 characters)')
  } else {
    sanitized.fullName = row.fullName.trim()
  }

  // Matric number — required, valid format
  if (!row.matricNumber || row.matricNumber.trim().length < 3) {
    errors.push('Matric number is required (min 3 characters)')
  } else if (!MATRIC_REGEX.test(row.matricNumber)) {
    errors.push('Matric number contains invalid characters')
  } else {
    sanitized.matricNumber = row.matricNumber.trim().toUpperCase()
  }

  // Email — optional, but if provided must be valid
  if (row.email) {
    if (!EMAIL_REGEX.test(row.email)) {
      errors.push(`Invalid email: ${row.email}`)
    } else {
      sanitized.email = row.email.trim().toLowerCase()
    }
  } else {
    warnings.push('No email provided — OTVP will not be delivered via email')
  }

  // Phone — optional, but if provided must be valid
  if (row.phone) {
    if (!PHONE_REGEX.test(row.phone)) {
      errors.push(`Invalid phone number: ${row.phone}`)
    } else {
      sanitized.phone = row.phone.trim()
    }
  } else {
    warnings.push('No phone provided — OTVP will not be delivered via SMS')
  }

  // WhatsApp — optional
  if (row.whatsapp) {
    if (!PHONE_REGEX.test(row.whatsapp)) {
      errors.push(`Invalid WhatsApp number: ${row.whatsapp}`)
    } else {
      sanitized.whatsapp = row.whatsapp.trim()
    }
  }

  // At least one contact method required
  if (!sanitized.email && !sanitized.phone && !sanitized.whatsapp) {
    errors.push('At least one contact method (email, phone, or WhatsApp) is required')
  }

  // Faculty/Department/Level — optional but recommended
  if (!row.faculty) warnings.push('No faculty specified')
  if (!row.department) warnings.push('No department specified')
  if (!row.level) warnings.push('No level specified')

  if (row.faculty) sanitized.faculty = row.faculty.trim()
  if (row.department) sanitized.department = row.department.trim()
  if (row.level) sanitized.level = row.level.trim()

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    sanitized,
  }
}

/**
 * Validate an organization name (spec: "name length, prohibited words,
 * duplicate domains").
 */
export function validateOrgName(name: string): { valid: boolean; error?: string } {
  if (!name || name.trim().length < 2) {
    return { valid: false, error: 'Organization name must be at least 2 characters' }
  }
  if (name.length > 200) {
    return { valid: false, error: 'Organization name must be less than 200 characters' }
  }
  const lower = name.toLowerCase()
  for (const word of PROHIBITED_WORDS) {
    if (lower.includes(word)) {
      return { valid: false, error: `Organization name contains prohibited word: "${word}"` }
    }
  }
  return { valid: true }
}

/**
 * Validate a subdomain (spec: "duplicate domains").
 */
export function validateSubdomain(subdomain: string): { valid: boolean; error?: string } {
  if (!subdomain || subdomain.length < 2) {
    return { valid: false, error: 'Subdomain must be at least 2 characters' }
  }
  if (subdomain.length > 30) {
    return { valid: false, error: 'Subdomain must be less than 30 characters' }
  }
  if (!/^[a-z0-9-]+$/.test(subdomain)) {
    return { valid: false, error: 'Subdomain must be lowercase alphanumeric (a-z, 0-9, -)' }
  }
  if (subdomain.startsWith('-') || subdomain.endsWith('-')) {
    return { valid: false, error: 'Subdomain cannot start or end with a hyphen' }
  }
  const reserved = ['admin', 'api', 'www', 'mail', 'ftp', 'localhost', 'status', 'staging', 'demo', 'test', 'support', 'help', 'blog', 'docs']
  if (reserved.includes(subdomain)) {
    return { valid: false, error: `Subdomain "${subdomain}" is reserved` }
  }
  return { valid: true }
}

/**
 * Validate a batch of CSV rows. Returns per-row results + summary.
 */
export function validateCsvBatch(rows: Partial<VoterCsvRow>[]): {
  results: ValidationResult[]
  validCount: number
  errorCount: number
  duplicateMatrics: string[]
} {
  const results = rows.map((row) => validateVoterRow(row))
  const validCount = results.filter((r) => r.valid).length
  const errorCount = results.filter((r) => !r.valid).length

  // Check for duplicate matric numbers within the batch
  const matricCounts = new Map<string, number>()
  for (const row of rows) {
    if (row.matricNumber) {
      const upper = row.matricNumber.toUpperCase()
      matricCounts.set(upper, (matricCounts.get(upper) || 0) + 1)
    }
  }
  const duplicateMatrics = Array.from(matricCounts.entries())
    .filter(([_, count]) => count > 1)
    .map(([matric, _]) => matric)

  return { results, validCount, errorCount, duplicateMatrics }
}
