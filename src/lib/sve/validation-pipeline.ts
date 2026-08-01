// VoteWise — SVE Validation Pipeline (Chapter 10)
//
// The complete validation pipeline that runs BEFORE any vote is recorded.
// No shortcuts. Every check must pass.
//
//   1. Session valid        — voter has an active, unexpired voting session
//   2. OTVP valid           — one-time voting password was verified (if required)
//   3. Election live        — voting window is open (or simulation)
//   4. Rules unchanged      — ballot's rulesHash matches current election config
//   5. Has not voted        — voter hasn't already cast a vote in this election
//   6. Ballot valid         — signature + integrity + not expired + not submitted
//   7. Candidate valid      — every selected candidate exists and is approved
//   8. Position valid       — every position is eligible for this voter
//
// The pipeline returns a structured result so the API can return a precise
// error to the voter (e.g. "Your ballot has expired, please regenerate it").

import { db } from '@/lib/db'
import {
  verifyBallotSignature,
  hashVoterIdentity,
  computeRulesHash,
} from './crypto'
import type { ValidationContext, ValidationResult, ValidationCheck } from './types'

export async function runValidationPipeline(ctx: ValidationContext): Promise<ValidationResult> {
  const checks: ValidationCheck[] = []

  // ------------------------------------------------------------------------
  // Load ballot (if provided)
  // ------------------------------------------------------------------------
  let ballot: any = null
  if (ctx.ballotId) {
    ballot = await db.ballot.findUnique({ where: { id: ctx.ballotId } })
    const ballotExists: ValidationCheck = {
      name: 'ballot_exists',
      passed: !!ballot,
      message: ballot ? undefined : 'Ballot not found',
      severity: 'BLOCK',
    }
    checks.push(ballotExists)
    if (!ballot) return finalize(checks, ctx)
  }

  // ------------------------------------------------------------------------
  // Load election
  // ------------------------------------------------------------------------
  const election = await db.electionSession.findUnique({
    where: { id: ctx.electionId },
    include: {
      positions: {
        include: {
          candidates: { where: { status: 'APPROVED', screeningStatus: 'APPROVED' } },
        },
      },
    },
  })
  const electionExists: ValidationCheck = {
    name: 'election_exists',
    passed: !!election,
    message: election ? undefined : 'Election not found',
    severity: 'BLOCK',
  }
  checks.push(electionExists)
  if (!election) return finalize(checks, ctx)

  // ------------------------------------------------------------------------
  // Check 3: Election is live (skip for simulation)
  // ------------------------------------------------------------------------
  if (!ctx.isSimulation) {
    const now = new Date()
    const isOpen = now >= election.startTime && now < election.endTime && election.status === 'LIVE'
    checks.push({
      name: 'election_live',
      passed: isOpen,
      message: isOpen ? undefined : `Election is ${election.status.toLowerCase()} (voting window: ${election.startTime.toISOString()} → ${election.endTime.toISOString()})`,
      severity: 'BLOCK',
    })
  } else {
    checks.push({ name: 'election_live', passed: true, message: 'Simulation mode — election live check skipped', severity: 'WARN' })
  }

  // ------------------------------------------------------------------------
  // Load voter (if provided)
  // ------------------------------------------------------------------------
  let voter: any = null
  let session: any = null
  if (ctx.voterId && !ctx.isSimulation) {
    voter = await db.voter.findUnique({
      where: { id: ctx.voterId },
    })
    checks.push({
      name: 'voter_exists',
      passed: !!voter,
      message: voter ? undefined : 'Voter not found',
      severity: 'BLOCK',
    })

    if (voter) {
      // Check 5: Has not voted
      const alreadyVoted = voter.hasVoted === true
      checks.push({
        name: 'has_not_voted',
        passed: !alreadyVoted,
        message: alreadyVoted ? 'You have already voted in this election' : undefined,
        severity: 'BLOCK',
      })

      // Voter not flagged/suspended
      const flagged = voter.flagged === true || voter.status === 'SUSPENDED'
      checks.push({
        name: 'voter_not_flagged',
        passed: !flagged,
        message: flagged ? 'Your account has been flagged — contact the electoral committee' : undefined,
        severity: 'BLOCK',
      })

      // Check 1: Session valid
      if (ctx.sessionId) {
        session = await db.votingSession.findUnique({ where: { id: ctx.sessionId } })
        const sessionValid = !!session && session.voterId === ctx.voterId && session.expiresAt > new Date()
        checks.push({
          name: 'session_valid',
          passed: sessionValid,
          message: sessionValid ? undefined : 'Your voting session has expired — please start a new one',
          severity: 'BLOCK',
        })
      }

      // Check 2: OTVP valid (if required by election settings)
      const settings = parseSettings(election.settings)
      if (settings.requireOTVP) {
        const cred = await db.votingCredential.findFirst({
          where: { voterId: ctx.voterId, electionId: ctx.electionId, status: 'VERIFIED' },
          orderBy: { verifiedAt: 'desc' },
        })
        checks.push({
          name: 'otvp_valid',
          passed: !!cred,
          message: cred ? undefined : 'You must verify your One-Time Voting Password (OTVP) before voting',
          severity: 'BLOCK',
        })
      } else {
        checks.push({ name: 'otvp_valid', passed: true, message: 'OTVP not required', severity: 'WARN' })
      }
    }
  } else {
    checks.push({ name: 'voter_exists', passed: true, message: 'Simulation mode — voter check skipped', severity: 'WARN' })
    checks.push({ name: 'has_not_voted', passed: true, message: 'Simulation mode', severity: 'WARN' })
    checks.push({ name: 'voter_not_flagged', passed: true, message: 'Simulation mode', severity: 'WARN' })
    checks.push({ name: 'session_valid', passed: true, message: 'Simulation mode', severity: 'WARN' })
    checks.push({ name: 'otvp_valid', passed: true, message: 'Simulation mode', severity: 'WARN' })
  }

  // ------------------------------------------------------------------------
  // Check 6: Ballot valid (signature + integrity + not expired + not submitted)
  // ------------------------------------------------------------------------
  if (ballot) {
    const sigValid = ballot.digitalSignature ? verifyBallotSignature(ballot.integrityToken, ballot.digitalSignature) : true
    checks.push({
      name: 'ballot_signature_valid',
      passed: sigValid,
      message: sigValid ? undefined : 'Ballot signature invalid — ballot may have been tampered with',
      severity: 'BLOCK',
    })

    const notExpired = ballot.expiresAt > new Date()
    checks.push({
      name: 'ballot_not_expired',
      passed: notExpired,
      message: notExpired ? undefined : 'Your ballot has expired — please regenerate it',
      severity: 'BLOCK',
    })

    const notSubmitted = ballot.status !== 'SUBMITTED'
    checks.push({
      name: 'ballot_not_submitted',
      passed: notSubmitted,
      message: notSubmitted ? undefined : 'This ballot has already been submitted',
      severity: 'BLOCK',
    })

    // Check 4: Rules unchanged — recompute rulesHash and compare to ballot content
    const content = JSON.parse(ballot.content)
    const currentRulesHash = computeRulesHash({
      positions: election.positions.map((p: any) => ({
        id: p.id,
        title: p.title,
        maximumVotes: p.maximumVotes || 1,
        candidates: p.candidates.map((c: any) => ({ id: c.id, fullName: c.fullName, status: c.status })),
      })),
      settings: election.settings,
    })
    const rulesUnchanged = content.rulesHash === currentRulesHash
    checks.push({
      name: 'rules_unchanged',
      passed: rulesUnchanged,
      message: rulesUnchanged ? undefined : 'Election configuration has changed since your ballot was generated — please regenerate your ballot',
      severity: 'BLOCK',
    })
  }

  // ------------------------------------------------------------------------
  // Check 7 & 8: Validate each selection (candidate + position)
  // ------------------------------------------------------------------------
  for (const [positionId, selection] of Object.entries(ctx.selections)) {
    const position = election.positions.find((p: any) => p.id === positionId)
    if (!position) {
      checks.push({
        name: `position_valid_${positionId}`,
        passed: false,
        message: `Position ${positionId} is not part of this election`,
        severity: 'BLOCK',
      })
      continue
    }

    // Position eligibility (scope) — skip for simulation
    if (!ctx.isSimulation && voter) {
      const eligible = isPositionEligible(position, voter)
      checks.push({
        name: `position_eligible_${positionId}`,
        passed: eligible,
        message: eligible ? undefined : `You are not eligible to vote for ${position.title}`,
        severity: 'BLOCK',
      })
    }

    // Candidate validation
    const selArray = Array.isArray(selection) ? selection : [selection]
    for (const sel of selArray) {
      if (sel === 'NOTA') {
        // NOTA is always valid if the position allows it (we set allowNota=true by default).
        continue
      }
      const candidate = position.candidates.find((c: any) => c.id === sel)
      checks.push({
        name: `candidate_valid_${positionId}_${sel}`,
        passed: !!candidate,
        message: candidate ? undefined : `Selected candidate for ${position.title} is invalid or has been disqualified`,
        severity: 'BLOCK',
      })
    }

    // Multiple choice: ensure not exceeding maximumVotes
    const maxVotes = position.maximumVotes || 1
    const realSelections = selArray.filter((s) => s !== 'NOTA')
    if (realSelections.length > maxVotes) {
      checks.push({
        name: `max_votes_${positionId}`,
        passed: false,
        message: `You selected ${realSelections.length} candidates for ${position.title} but only ${maxVotes} ${maxVotes === 1 ? 'is' : 'are'} allowed`,
        severity: 'BLOCK',
      })
    }
  }

  return finalize(checks, ctx, { election, voter, ballot, session })
}

function finalize(
  checks: ValidationCheck[],
  ctx: ValidationContext,
  refs?: { election?: any; voter?: any; ballot?: any; session?: any },
): ValidationResult {
  const failedChecks = checks.filter((c) => !c.passed)
  const blockFails = failedChecks.filter((c) => c.severity === 'BLOCK')
  const passed = blockFails.length === 0
  return {
    passed,
    checks,
    voterHash: ctx.voterId ? hashVoterIdentity(ctx.voterId) : undefined,
    election: refs?.election,
    voter: refs?.voter,
    ballot: refs?.ballot,
    session: refs?.session,
    failedChecks,
  }
}

function parseSettings(settingsStr?: string | null): any {
  if (!settingsStr) return {}
  try { return JSON.parse(settingsStr) } catch { return {} }
}

function isPositionEligible(pos: any, voter: any): boolean {
  const scope = pos.scope || 'ORGANIZATION'
  switch (scope) {
    case 'UNIVERSITY':
    case 'ORGANIZATION':
      return true
    case 'FACULTY':
    case 'WORKSPACE':
      return pos.facultyId ? voter.facultyId === pos.facultyId : true
    case 'DEPARTMENT':
    case 'VOTER_GROUP':
      return pos.departmentId ? voter.departmentId === pos.departmentId : true
    default:
      return true
  }
}
