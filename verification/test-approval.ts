import { createApprovalRequest, castApprovalVote, getApprovalStatus } from '../src/lib/approval'
import { requiresApprovalToDisableMfa } from '../src/lib/rbac'
import { resetApprovalFixtures } from './mock-db'

let failures = 0

function ok(label: string, cond: boolean, detail?: string) {
  if (cond) console.log(`PASS: ${label}`)
  else { console.error(`FAIL: ${label}${detail ? ' — ' + detail : ''}`); failures++ }
}

async function expectThrows(label: string, fn: () => Promise<any>, expectedMessage: string) {
  try {
    await fn()
    console.error(`FAIL: ${label} — expected it to throw "${expectedMessage}", but it did not throw.`)
    failures++
  } catch (e: any) {
    ok(label, e.message === expectedMessage, `expected "${expectedMessage}", got "${e.message}"`)
  }
}

async function main() {
  console.log('--- Chapter 3: multi-person approval verification (real approval.ts, mocked db) ---\n')

  ok('requiresApprovalToDisableMfa: PLATFORM_SUPER_ADMIN requires approval', requiresApprovalToDisableMfa('PLATFORM_SUPER_ADMIN') === true)
  ok('requiresApprovalToDisableMfa: ORG_OWNER requires approval', requiresApprovalToDisableMfa('ORG_OWNER') === true)
  ok('requiresApprovalToDisableMfa: SUPPORT_AGENT requires approval', requiresApprovalToDisableMfa('SUPPORT_AGENT') === true)
  ok('requiresApprovalToDisableMfa: ORG_ADMIN does not require approval', requiresApprovalToDisableMfa('ORG_ADMIN') === false)
  ok('requiresApprovalToDisableMfa: VOTER does not require approval', requiresApprovalToDisableMfa('VOTER') === false)
  ok('requiresApprovalToDisableMfa: legacy SUPER_ADMIN normalizes and requires approval', requiresApprovalToDisableMfa('SUPER_ADMIN') === true)

  // requiredApprovals must be at least 1 — a request needing zero approvals
  // defeats the purpose.
  await expectThrows(
    'createApprovalRequest rejects requiredApprovals: 0',
    () => createApprovalRequest({ organizationId: 'org-a', actionType: 'MFA_DISABLE', resourceId: 'official-1', requestedById: 'official-1', requiredApprovals: 0 }),
    'REQUIRED_APPROVALS_MUST_BE_AT_LEAST_ONE',
  )

  resetApprovalFixtures()

  // Core case: requester cannot approve their own request.
  const req1 = await createApprovalRequest({
    organizationId: 'org-a', actionType: 'MFA_DISABLE', resourceId: 'official-1',
    requestedById: 'official-1', requiredApprovals: 1,
  })
  await expectThrows(
    'castApprovalVote rejects the requester approving their own request',
    () => castApprovalVote({ requestId: req1.id, approverId: 'official-1', decision: 'APPROVE' }),
    'REQUESTER_CANNOT_APPROVE_OWN_REQUEST',
  )

  // A different, eligible approver CAN approve, and with requiredApprovals=1
  // this should resolve the request immediately.
  const vote1 = await castApprovalVote({ requestId: req1.id, approverId: 'official-2', decision: 'APPROVE' })
  ok('a distinct approver approving a 1-required request resolves it to APPROVED', vote1.status === 'APPROVED', JSON.stringify(vote1))

  // Same approver voting twice on the same request is rejected.
  await expectThrows(
    'castApprovalVote rejects a second vote from the same approver',
    () => castApprovalVote({ requestId: req1.id, approverId: 'official-2', decision: 'APPROVE' }),
    'APPROVAL_REQUEST_NOT_PENDING', // already resolved by the first vote above
  )

  resetApprovalFixtures()

  // requiredApprovals=2: one vote should NOT resolve it yet.
  const req2 = await createApprovalRequest({
    organizationId: 'org-a', actionType: 'MFA_DISABLE', resourceId: 'official-3',
    requestedById: 'official-3', requiredApprovals: 2,
  })
  const partial = await castApprovalVote({ requestId: req2.id, approverId: 'official-4', decision: 'APPROVE' })
  ok('one vote of two required leaves the request PENDING', partial.status === 'PENDING' && partial.approvalsSoFar === 1, JSON.stringify(partial))

  const secondVote = await castApprovalVote({ requestId: req2.id, approverId: 'official-5', decision: 'APPROVE' })
  ok('the second of two required votes resolves it to APPROVED', secondVote.status === 'APPROVED', JSON.stringify(secondVote))

  resetApprovalFixtures()

  // A single REJECT resolves the request to REJECTED, regardless of
  // requiredApprovals — one qualified "no" is enough to stop it.
  const req3 = await createApprovalRequest({
    organizationId: 'org-a', actionType: 'MFA_DISABLE', resourceId: 'official-6',
    requestedById: 'official-6', requiredApprovals: 2,
  })
  const rejectVote = await castApprovalVote({ requestId: req3.id, approverId: 'official-7', decision: 'REJECT' })
  ok('a single REJECT resolves the request to REJECTED', rejectVote.status === 'REJECTED', JSON.stringify(rejectVote))

  resetApprovalFixtures()

  // Expiry: a request past its expiresAt is rejected when voted on, and
  // getApprovalStatus lazily marks it EXPIRED.
  const req4 = await createApprovalRequest({
    organizationId: 'org-a', actionType: 'MFA_DISABLE', resourceId: 'official-8',
    requestedById: 'official-8', requiredApprovals: 1, ttlMinutes: -1, // already expired
  })
  await expectThrows(
    'castApprovalVote rejects a vote on an expired request',
    () => castApprovalVote({ requestId: req4.id, approverId: 'official-9', decision: 'APPROVE' }),
    'APPROVAL_REQUEST_EXPIRED',
  )
  const status = await getApprovalStatus(req4.id)
  ok('getApprovalStatus lazily marks an expired PENDING request as EXPIRED', status.status === 'EXPIRED', JSON.stringify(status))

  console.log(`\n--- ${failures === 0 ? 'ALL PASSED' : `${failures} FAILURE(S)`} ---`)
  process.exit(failures === 0 ? 0 : 1)
}

main()
