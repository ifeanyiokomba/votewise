// VoteWise — Election Rules Engine (Chapter 9)
//
// The "brain" of VoteWise. Evaluates configurable rules against voter metadata
// and election context. Every decision is explainable and auditable.
//
// Rule structure (JSON):
// {
//   logic: "AND" | "OR",
//   groups: [
//     { field: "faculty", operator: "equals", value: "Engineering" },
//     { field: "level", operator: "greater_than", value: "300" },
//     { logic: "OR", groups: [...] } // nested
//   ]
// }

export type Operator =
  | 'equals' | 'not_equals' | 'contains' | 'starts_with' | 'ends_with'
  | 'greater_than' | 'less_than' | 'between' | 'in_list' | 'not_in_list'
  | 'exists' | 'does_not_exist'

export type RuleCategory =
  | 'ELIGIBILITY' | 'ACCREDITATION' | 'AUTHENTICATION' | 'VOTING'
  | 'CANDIDATES' | 'RESULTS' | 'NOTIFICATIONS' | 'OBSERVERS'
  | 'SUPPORT' | 'SECURITY' | 'AUTOMATION'

export type RuleAction =
  | 'ALLOW' | 'DENY' | 'REQUIRE' | 'NOTIFY' | 'AUTOMATE' | 'FLAG' | 'REJECT'

export interface Condition {
  field: string
  operator: Operator
  value: any
}

export interface ConditionGroup {
  logic: 'AND' | 'OR'
  groups: (Condition | ConditionGroup)[]
}

export interface Rule {
  id: string
  name: string
  category: RuleCategory
  conditions: ConditionGroup
  action: RuleAction
  actionParams?: any
  priority: number
  enabled: boolean
}

export interface VoterContext {
  voterId: string
  metadata: Record<string, any>
  email?: string
  phone?: string
  status?: string
  verificationStatus?: string
  hasVoted?: boolean
  accredited?: boolean
}

export interface ElectionContext {
  electionId: string
  startTime: Date
  endTime: Date
  status: string
  settings?: Record<string, any>
}

export interface EvaluationResult {
  passed: boolean
  ruleId: string
  ruleName: string
  category: string
  action: string
  failedCondition?: {
    field: string
    operator: string
    expected: any
    actual: any
  }
  explanation: string
}

// Evaluate a single condition against a voter's data.
function evaluateCondition(condition: Condition, voter: VoterContext): { passed: boolean; actual: any } {
  // Check standard fields first, then fall back to metadata
  let actual: any
  if (condition.field === 'email') actual = voter.email
  else if (condition.field === 'phone') actual = voter.phone
  else if (condition.field === 'status') actual = voter.status
  else if (condition.field === 'verificationStatus') actual = voter.verificationStatus
  else if (condition.field === 'hasVoted') actual = voter.hasVoted
  else if (condition.field === 'accredited') actual = voter.accredited
  else actual = voter.metadata?.[condition.field]

  const expected = condition.value

  switch (condition.operator) {
    case 'equals':
      return { passed: String(actual) === String(expected), actual }
    case 'not_equals':
      return { passed: String(actual) !== String(expected), actual }
    case 'contains':
      return { passed: String(actual || '').includes(String(expected)), actual }
    case 'starts_with':
      return { passed: String(actual || '').startsWith(String(expected)), actual }
    case 'ends_with':
      return { passed: String(actual || '').endsWith(String(expected)), actual }
    case 'greater_than':
      return { passed: Number(actual) > Number(expected), actual }
    case 'less_than':
      return { passed: Number(actual) < Number(expected), actual }
    case 'between':
      return { passed: Number(actual) >= Number(expected[0]) && Number(actual) <= Number(expected[1]), actual }
    case 'in_list':
      return { passed: Array.isArray(expected) && expected.map(String).includes(String(actual)), actual }
    case 'not_in_list':
      return { passed: Array.isArray(expected) && !expected.map(String).includes(String(actual)), actual }
    case 'exists':
      return { passed: actual !== undefined && actual !== null && actual !== '', actual }
    case 'does_not_exist':
      return { passed: actual === undefined || actual === null || actual === '', actual }
    default:
      return { passed: false, actual }
  }
}

// Evaluate a condition group (with nested AND/OR logic).
function evaluateGroup(group: ConditionGroup, voter: VoterContext): { passed: boolean; failedCondition?: any } {
  if (!group.groups || group.groups.length === 0) return { passed: true }

  const results: { passed: boolean; failedCondition?: any }[] = []

  for (const item of group.groups) {
    if ('logic' in item && 'groups' in item) {
      // Nested condition group
      results.push(evaluateGroup(item as ConditionGroup, voter))
    } else {
      // Single condition
      const cond = item as Condition
      const { passed, actual } = evaluateCondition(cond, voter)
      if (!passed) {
        results.push({
          passed: false,
          failedCondition: {
            field: cond.field,
            operator: cond.operator,
            expected: cond.value,
            actual,
          },
        })
      } else {
        results.push({ passed: true })
      }
    }
  }

  if (group.logic === 'AND') {
    const failed = results.find((r) => !r.passed)
    return { passed: !failed, failedCondition: failed?.failedCondition }
  } else {
    // OR — passed if any passes
    const passed = results.some((r) => r.passed)
    const failed = passed ? undefined : results[0]?.failedCondition
    return { passed, failedCondition: failed }
  }
}

// Evaluate a full rule against a voter.
export function evaluateRule(rule: Rule, voter: VoterContext): EvaluationResult {
  if (!rule.enabled) {
    return {
      passed: true, // disabled rules don't block
      ruleId: rule.id,
      ruleName: rule.name,
      category: rule.category,
      action: rule.action,
      explanation: `Rule "${rule.name}" is disabled — skipped.`,
    }
  }

  let conditions: ConditionGroup
  try {
    conditions = typeof rule.conditions === 'string' ? JSON.parse(rule.conditions) : rule.conditions
  } catch {
    return {
      passed: false,
      ruleId: rule.id,
      ruleName: rule.name,
      category: rule.category,
      action: rule.action,
      explanation: `Rule "${rule.name}" has invalid condition JSON.`,
    }
  }

  const { passed, failedCondition } = evaluateGroup(conditions, voter)

  let explanation: string
  if (passed) {
    explanation = `Rule "${rule.name}" PASSED — ${rule.action}.`
  } else if (failedCondition) {
    explanation = `Rule "${rule.name}" FAILED — field "${failedCondition.field}" ${failedCondition.operator} "${failedCondition.expected}" but was "${failedCondition.actual}".`
  } else {
    explanation = `Rule "${rule.name}" FAILED.`
  }

  return {
    passed,
    ruleId: rule.id,
    ruleName: rule.name,
    category: rule.category,
    action: rule.action,
    failedCondition: failedCondition || undefined,
    explanation,
  }
}

// Evaluate all rules for a voter (sorted by priority, highest first).
// Returns the first DENY/REJECT that fails, or ALLOW if all pass.
export function evaluateAllRules(rules: Rule[], voter: VoterContext): {
  allowed: boolean
  results: EvaluationResult[]
  blockingRule?: EvaluationResult
} {
  const sorted = [...rules].sort((a, b) => b.priority - a.priority)
  const results: EvaluationResult[] = []

  for (const rule of sorted) {
    const result = evaluateRule(rule, voter)
    results.push(result)

    // If a DENY/REJECT rule's conditions are MET (passed=true), it blocks the voter.
    if (result.passed && (rule.action === 'DENY' || rule.action === 'REJECT')) {
      return { allowed: false, results, blockingRule: result }
    }

    // If an ALLOW rule's conditions are NOT MET (passed=false), it blocks.
    if (!result.passed && rule.action === 'ALLOW') {
      return { allowed: false, results, blockingRule: result }
    }
  }

  return { allowed: true, results }
}

// Validate a rule set for conflicts and issues.
export function validateRuleSet(rules: Rule[]): { valid: boolean; issues: string[] } {
  const issues: string[] = []

  // Check for conflicting ALLOW/DENY on same category
  const byCategory: Record<string, Rule[]> = {}
  for (const r of rules) {
    if (!r.enabled) continue
    if (!byCategory[r.category]) byCategory[r.category] = []
    byCategory[r.category].push(r)
  }

  for (const [cat, catRules] of Object.entries(byCategory)) {
    const allows = catRules.filter((r) => r.action === 'ALLOW')
    const denies = catRules.filter((r) => r.action === 'DENY')

    if (allows.length > 1) {
      issues.push(`Category "${cat}" has ${allows.length} ALLOW rules — this may cause conflicts.`)
    }
    if (allows.length > 0 && denies.length > 0) {
      issues.push(`Category "${cat}" has both ALLOW and DENY rules — check priorities.`)
    }
  }

  // Check for rules with no conditions
  for (const r of rules) {
    if (!r.conditions || (typeof r.conditions === 'string' && r.conditions === '{}')) {
      issues.push(`Rule "${r.name}" has no conditions defined.`)
    }
  }

  return { valid: issues.length === 0, issues }
}

// Built-in policy templates
export const BUILTIN_POLICIES = [
  {
    name: 'University Student Union Election',
    category: 'UNIVERSITY',
    description: 'Standard SUG election with faculty-level eligibility and OTVP voting.',
    policy: JSON.stringify([
      { name: 'Active Students Only', category: 'ELIGIBILITY', conditions: { logic: 'AND', groups: [{ field: 'status', operator: 'equals', value: 'ACTIVE' }] }, action: 'ALLOW', priority: 100 },
      { name: 'Require OTVP', category: 'AUTHENTICATION', conditions: { logic: 'AND', groups: [{ field: 'accredited', operator: 'equals', value: true }] }, action: 'REQUIRE', priority: 90 },
      { name: 'One Vote Per Person', category: 'VOTING', conditions: { logic: 'AND', groups: [{ field: 'hasVoted', operator: 'equals', value: false }] }, action: 'ALLOW', priority: 100 },
      { name: 'Block Suspended', category: 'SECURITY', conditions: { logic: 'AND', groups: [{ field: 'status', operator: 'equals', value: 'SUSPENDED' }] }, action: 'DENY', priority: 200 },
    ]),
  },
  {
    name: 'Corporate Board Election',
    category: 'COMPANY',
    description: 'Board election with employee verification and 2FA.',
    policy: JSON.stringify([
      { name: 'Active Employees Only', category: 'ELIGIBILITY', conditions: { logic: 'AND', groups: [{ field: 'status', operator: 'equals', value: 'ACTIVE' }] }, action: 'ALLOW', priority: 100 },
      { name: 'Require 2FA', category: 'AUTHENTICATION', conditions: { logic: 'AND', groups: [{ field: 'verificationStatus', operator: 'equals', value: 'VERIFIED' }] }, action: 'REQUIRE', priority: 90 },
      { name: 'One Vote Per Person', category: 'VOTING', conditions: { logic: 'AND', groups: [{ field: 'hasVoted', operator: 'equals', value: false }] }, action: 'ALLOW', priority: 100 },
    ]),
  },
  {
    name: 'Church Council Election',
    category: 'CHURCH',
    description: 'Church council election with membership verification.',
    policy: JSON.stringify([
      { name: 'Active Members Only', category: 'ELIGIBILITY', conditions: { logic: 'AND', groups: [{ field: 'status', operator: 'equals', value: 'ACTIVE' }] }, action: 'ALLOW', priority: 100 },
      { name: 'Require OTVP', category: 'AUTHENTICATION', conditions: { logic: 'AND', groups: [{ field: 'accredited', operator: 'equals', value: true }] }, action: 'REQUIRE', priority: 90 },
    ]),
  },
  {
    name: 'Association Executive Election',
    category: 'ASSOCIATION',
    description: 'Association executive election with dues verification.',
    policy: JSON.stringify([
      { name: 'Dues Paid Members Only', category: 'ELIGIBILITY', conditions: { logic: 'AND', groups: [{ field: 'duesPaid', operator: 'equals', value: 'Yes' }] }, action: 'ALLOW', priority: 100 },
      { name: 'Require OTVP', category: 'AUTHENTICATION', conditions: { logic: 'AND', groups: [{ field: 'accredited', operator: 'equals', value: true }] }, action: 'REQUIRE', priority: 90 },
    ]),
  },
  {
    name: 'Government Committee Election',
    category: 'GOVERNMENT',
    description: 'Government committee election with strict security.',
    policy: JSON.stringify([
      { name: 'Active Staff Only', category: 'ELIGIBILITY', conditions: { logic: 'AND', groups: [{ field: 'status', operator: 'equals', value: 'ACTIVE' }] }, action: 'ALLOW', priority: 100 },
      { name: 'Require 2FA + OTVP', category: 'AUTHENTICATION', conditions: { logic: 'AND', groups: [{ field: 'verificationStatus', operator: 'equals', value: 'VERIFIED' }] }, action: 'REQUIRE', priority: 90 },
      { name: 'Block Suspended', category: 'SECURITY', conditions: { logic: 'AND', groups: [{ field: 'status', operator: 'equals', value: 'SUSPENDED' }] }, action: 'DENY', priority: 200 },
    ]),
  },
]
