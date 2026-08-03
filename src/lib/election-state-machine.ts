// VoteWise — Election State Machine (Enterprise Audit Part 4)
//
// Spec: "Do not manage election states with random booleans. Use a state
// machine. This prevents impossible situations — e.g. a closed election
// accidentally receiving votes."
//
// State transitions are explicit and validated. Any attempt to transition
// to an invalid state throws an error. This is the single source of truth
// for election lifecycle management.

export type ElectionState =
  | 'DRAFT'
  | 'CONFIGURATION'
  | 'NOMINATION'
  | 'SCREENING'
  | 'CAMPAIGN'
  | 'READY'
  | 'LIVE'
  | 'PAUSED'
  | 'COUNTING'
  | 'RESULT_PENDING'
  | 'CERTIFIED'
  | 'ARCHIVED'

export interface StateTransition {
  from: ElectionState
  to: ElectionState
  action: string
  requiredCapability?: string
  preconditions?: string[] // human-readable checks that must pass
}

// ---------------------------------------------------------------------------
// Valid transitions — the state machine definition
// ---------------------------------------------------------------------------

export const VALID_TRANSITIONS: StateTransition[] = [
  // DRAFT → CONFIGURATION (initial setup complete)
  { from: 'DRAFT', to: 'CONFIGURATION', action: 'CONFIGURE', preconditions: ['Organization configured', 'Basic election details set'] },

  // CONFIGURATION → NOMINATION (positions defined, nomination opens)
  { from: 'CONFIGURATION', to: 'NOMINATION', action: 'OPEN_NOMINATION', preconditions: ['At least 1 position defined'] },

  // NOMINATION → SCREENING (nomination closes, screening begins)
  { from: 'NOMINATION', to: 'SCREENING', action: 'CLOSE_NOMINATION', preconditions: ['Nomination period ended'] },

  // SCREENING → CAMPAIGN (candidates approved, campaign begins)
  { from: 'SCREENING', to: 'CAMPAIGN', action: 'APPROVE_CANDIDATES', preconditions: ['At least 1 approved candidate per position'] },

  // CAMPAIGN → READY (campaign ends, election is ready to go live)
  { from: 'CAMPAIGN', to: 'READY', action: 'FINALIZE', preconditions: ['Campaign period ended', 'Readiness check passed'] },

  // READY → LIVE (election goes live — voters can cast ballots)
  { from: 'READY', to: 'LIVE', action: 'GO_LIVE', preconditions: ['Readiness check passed (all critical checks)', 'Go-live checklist verified'] },

  // LIVE → PAUSED (election temporarily paused — emergency or admin action)
  { from: 'LIVE', to: 'PAUSED', action: 'PAUSE', preconditions: ['Admin action or ElectionLock'] },

  // PAUSED → LIVE (election resumed after pause)
  { from: 'PAUSED', to: 'LIVE', action: 'RESUME', preconditions: ['Lock released or admin resume'] },

  // LIVE → COUNTING (voting ends, counting begins)
  { from: 'LIVE', to: 'COUNTING', action: 'END_VOTING', preconditions: ['End time reached or admin end'] },

  // LIVE → PAUSED → LIVE (already covered above)

  // COUNTING → RESULT_PENDING (counting complete, results pending release)
  { from: 'COUNTING', to: 'RESULT_PENDING', action: 'COMPLETE_COUNTING', preconditions: ['All votes tallied', 'Tally + VoteRecord reconciled'] },

  // RESULT_PENDING → CERTIFIED (results certified by electoral committee)
  { from: 'RESULT_PENDING', to: 'CERTIFIED', action: 'CERTIFY', preconditions: ['Observer reports submitted', 'No unresolved critical incidents', 'Integrity certificate generated'] },

  // CERTIFIED → ARCHIVED (election archived for historical reference)
  { from: 'CERTIFIED', to: 'ARCHIVED', action: 'ARCHIVE', preconditions: ['Certification seal issued'] },

  // Backwards transitions (correction/admin override)
  { from: 'CONFIGURATION', to: 'DRAFT', action: 'RESET' },
  { from: 'NOMINATION', to: 'CONFIGURATION', action: 'RESET' },
  { from: 'SCREENING', to: 'NOMINATION', action: 'REOPEN_NOMINATION' },
  { from: 'CAMPAIGN', to: 'SCREENING', action: 'RESCREEN' },
  { from: 'READY', to: 'CAMPAIGN', action: 'RESUME_CAMPAIGN' },
  { from: 'PAUSED', to: 'COUNTING', action: 'END_VOTING', preconditions: ['Admin override: end voting while paused'] },
  { from: 'RESULT_PENDING', to: 'COUNTING', action: 'RECOUNT', preconditions: ['Recount requested'] },
]

// ---------------------------------------------------------------------------
// State machine engine
// ---------------------------------------------------------------------------

export class ElectionStateMachine {
  /**
   * Check if a transition is valid.
   */
  static canTransition(from: ElectionState, to: ElectionState): boolean {
    return VALID_TRANSITIONS.some((t) => t.from === from && t.to === to)
  }

  /**
   * Get the transition definition for a from→to pair.
   */
  static getTransition(from: ElectionState, to: ElectionState): StateTransition | undefined {
    return VALID_TRANSITIONS.find((t) => t.from === from && t.to === to)
  }

  /**
   * Validate a transition. Throws if invalid.
   */
  static validateTransition(from: ElectionState, to: ElectionState): void {
    if (from === to) {
      throw new ElectionStateError(
        `Election is already in state "${from}"`,
        'INVALID_TRANSITION',
        { from, to },
      )
    }
    if (!this.canTransition(from, to)) {
      throw new ElectionStateError(
        `Invalid state transition: "${from}" → "${to}". This transition is not allowed.`,
        'INVALID_TRANSITION',
        { from, to, validNextStates: this.getNextStates(from) },
      )
    }
  }

  /**
   * Get all valid next states from the current state.
   */
  static getNextStates(from: ElectionState): ElectionState[] {
    return VALID_TRANSITIONS
      .filter((t) => t.from === from)
      .map((t) => t.to)
  }

  /**
   * Check if the election is in a voting-eligible state (can accept votes).
   */
  static canAcceptVotes(state: ElectionState): boolean {
    return state === 'LIVE'
  }

  /**
   * Check if the election is in a mutable state (can be edited).
   */
  static isMutable(state: ElectionState): boolean {
    return ['DRAFT', 'CONFIGURATION', 'NOMINATION', 'SCREENING', 'CAMPAIGN', 'READY'].includes(state)
  }

  /**
   * Check if the election is locked (immutable).
   */
  static isLocked(state: ElectionState): boolean {
    return ['LIVE', 'PAUSED', 'COUNTING', 'RESULT_PENDING', 'CERTIFIED', 'ARCHIVED'].includes(state)
  }

  /**
   * Check if results can be viewed for this state.
   */
  static canViewResults(state: ElectionState): boolean {
    return ['COUNTING', 'RESULT_PENDING', 'CERTIFIED', 'ARCHIVED'].includes(state)
  }

  /**
   * Get the human-readable label for a state.
   */
  static getLabel(state: ElectionState): string {
    const labels: Record<ElectionState, string> = {
      DRAFT: 'Draft',
      CONFIGURATION: 'Configuration',
      NOMINATION: 'Nomination Open',
      SCREENING: 'Candidate Screening',
      CAMPAIGN: 'Campaign Period',
      READY: 'Ready for Go-Live',
      LIVE: 'Voting Live',
      PAUSED: 'Paused',
      COUNTING: 'Counting Votes',
      RESULT_PENDING: 'Results Pending',
      CERTIFIED: 'Certified',
      ARCHIVED: 'Archived',
    }
    return labels[state] || state
  }

  /**
   * Get the color for a state (for UI badges).
   */
  static getColor(state: ElectionState): string {
    const colors: Record<ElectionState, string> = {
      DRAFT: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300',
      CONFIGURATION: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300',
      NOMINATION: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
      SCREENING: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
      CAMPAIGN: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
      READY: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
      LIVE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
      PAUSED: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
      COUNTING: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
      RESULT_PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
      CERTIFIED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
      ARCHIVED: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300',
    }
    return colors[state] || colors.DRAFT
  }
}

// ---------------------------------------------------------------------------
// Custom error for invalid transitions
// ---------------------------------------------------------------------------

export class ElectionStateError extends Error {
  code: string
  details: any

  constructor(message: string, code: string, details?: any) {
    super(message)
    this.name = 'ElectionStateError'
    this.code = code
    this.details = details
  }
}
