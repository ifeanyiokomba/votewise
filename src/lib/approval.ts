// VoteWise — Multi-person approval (Chapter 3)
//
// Implements non-negotiable principle #6: "Critical election actions must
// require multi-person authorization." Generic on purpose — actionType is a
// free-form string so future chapters (election state transitions, OTP/
// credential overrides) can adopt this without a schema change. First real
// consumer is disabling MFA on a high-privilege account; see
// src/app/api/auth/2fa/disable/route.ts.

import { db } from '@/lib/db'

export type ApprovalDecision = 'APPROVE' | 'REJECT'
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED'

export interface CreateApprovalRequestOptions {
  organizationId: string | null
  actionType: string
  resourceId: string
  requestedById: string
  requiredApprovals?: number
  reason?: string
  ttlMinutes?: number
}

export async function createApprovalRequest(opts: CreateApprovalRequestOptions) {
  const {
    organizationId,
    actionType,
    resourceId,
    requestedById,
    requiredApprovals = 1,
    reason,
    ttlMinutes = 60,
  } = opts

  if (requiredApprovals < 1) {
    // A request that needs zero approvals isn't an approval request —
    // it's the thing this module exists to prevent.
    throw new Error('REQUIRED_APPROVALS_MUST_BE_AT_LEAST_ONE')
  }

  return db.privilegedActionApproval.create({
    data: {
      organizationId,
      actionType,
      resourceId,
      requestedById,
      requiredApprovals,
      reason,
      status: 'PENDING',
      expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
    },
  })
}

export interface CastApprovalVoteOptions {
  requestId: string
  approverId: string
  decision: ApprovalDecision
}

export interface CastApprovalVoteResult {
  status: ApprovalStatus
  approvalsSoFar?: number
  approvalsNeeded?: number
}

export async function castApprovalVote(opts: CastApprovalVoteOptions): Promise<CastApprovalVoteResult> {
  const { requestId, approverId, decision } = opts

  const request = await db.privilegedActionApproval.findUnique({ where: { id: requestId } })
  if (!request) throw new Error('APPROVAL_REQUEST_NOT_FOUND')
  if (request.status !== 'PENDING') throw new Error('APPROVAL_REQUEST_NOT_PENDING')
  if (request.expiresAt < new Date()) {
    await db.privilegedActionApproval.update({
      where: { id: requestId },
      data: { status: 'EXPIRED', resolvedAt: new Date() },
    })
    throw new Error('APPROVAL_REQUEST_EXPIRED')
  }

  // The entire point of "multi-person" rather than "multi-click": the
  // person who requested the action cannot also approve it.
  if (approverId === request.requestedById) {
    throw new Error('REQUESTER_CANNOT_APPROVE_OWN_REQUEST')
  }

  const existingVote = await db.privilegedActionApprovalVote.findFirst({
    where: { requestId, approverId },
  })
  if (existingVote) throw new Error('APPROVER_ALREADY_VOTED')

  await db.privilegedActionApprovalVote.create({
    data: { requestId, approverId, decision },
  })

  if (decision === 'REJECT') {
    await db.privilegedActionApproval.update({
      where: { id: requestId },
      data: { status: 'REJECTED', resolvedAt: new Date() },
    })
    return { status: 'REJECTED' }
  }

  const approveCount = await db.privilegedActionApprovalVote.count({
    where: { requestId, decision: 'APPROVE' },
  })

  if (approveCount >= request.requiredApprovals) {
    await db.privilegedActionApproval.update({
      where: { id: requestId },
      data: { status: 'APPROVED', resolvedAt: new Date() },
    })
    return { status: 'APPROVED' }
  }

  return { status: 'PENDING', approvalsSoFar: approveCount, approvalsNeeded: request.requiredApprovals }
}

/**
 * Read-only status check. Lazily expires a stale PENDING request rather
 * than requiring a separate sweep job — the first thing to look at it
 * after expiry is what marks it expired.
 */
export async function getApprovalStatus(requestId: string) {
  const request = await db.privilegedActionApproval.findUnique({ where: { id: requestId } })
  if (!request) throw new Error('APPROVAL_REQUEST_NOT_FOUND')
  if (request.status === 'PENDING' && request.expiresAt < new Date()) {
    await db.privilegedActionApproval.update({
      where: { id: requestId },
      data: { status: 'EXPIRED', resolvedAt: new Date() },
    })
    return { ...request, status: 'EXPIRED' as const }
  }
  return request
}
