import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { readAccessToken, verifyAccessToken } from '@/lib/auth'
import { json, errorJson, writeAudit, getClientIp, recordSecurityEvent } from '@/lib/election'
import { castApprovalVote } from '@/lib/approval'
import { normalizeRole } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

// POST /api/auth/2fa/disable/approve
// Body: { approvalId: string, decision: 'APPROVE' | 'REJECT' }
//
// The second half of the Chapter 3 approval gate in
// src/app/api/auth/2fa/disable/route.ts. castApprovalVote() already
// enforces that the requester can't approve their own request and that no
// approver votes twice; this route adds the piece that's specific to this
// action: only PLATFORM_SUPER_ADMIN or ORG_OWNER may cast the vote at all,
// and once the vote resolves the request to APPROVED, this is where the
// actual MFA disable happens — approval alone doesn't touch the account;
// this endpoint does, in the same request that resolves it.
const ELIGIBLE_APPROVER_ROLES = ['PLATFORM_SUPER_ADMIN', 'ORG_OWNER']

export async function POST(req: NextRequest) {
  const payload = await verifyAccessToken(readAccessToken(req))
  if (!payload) return errorJson('Unauthorized', 401)

  const approverRole = normalizeRole(payload.role)
  if (!ELIGIBLE_APPROVER_ROLES.includes(approverRole)) {
    return errorJson('Your role is not eligible to approve this type of request.', 403)
  }

  const body = await req.json().catch(() => ({}))
  const { approvalId, decision } = body
  if (!approvalId || (decision !== 'APPROVE' && decision !== 'REJECT')) {
    return errorJson('approvalId and a decision of APPROVE or REJECT are required.', 400)
  }

  const request = await db.privilegedActionApproval.findUnique({ where: { id: approvalId } })
  if (!request || request.actionType !== 'MFA_DISABLE') {
    return errorJson('Approval request not found.', 404)
  }

  let vote
  try {
    vote = await castApprovalVote({ requestId: approvalId, approverId: payload.sub, decision })
  } catch (e: any) {
    const message: Record<string, string> = {
      APPROVAL_REQUEST_NOT_FOUND: 'Approval request not found.',
      APPROVAL_REQUEST_NOT_PENDING: 'This request has already been resolved.',
      APPROVAL_REQUEST_EXPIRED: 'This request has expired.',
      REQUESTER_CANNOT_APPROVE_OWN_REQUEST: 'You cannot approve your own request.',
      APPROVER_ALREADY_VOTED: 'You have already voted on this request.',
    }
    return errorJson(message[e.message] ?? 'Could not process this approval.', 409)
  }

  await recordSecurityEvent({
    severity: 'HIGH', category: 'AUTH_FAILURE',
    actorId: payload.sub, actorEmail: payload.email, ipAddress: getClientIp(req),
    message: `MFA-disable request ${approvalId} for ${request.resourceId}: ${decision} by ${payload.email} (status now ${vote.status})`,
  })
  await writeAudit({
    actorId: payload.sub, actorRole: payload.role, actorName: payload.name,
    action: decision === 'APPROVE' ? 'MFA_DISABLE_APPROVED' : 'MFA_DISABLE_REJECTED', ip: getClientIp(req),
  })

  if (vote.status === 'APPROVED') {
    await db.electionOfficial.update({
      where: { id: request.resourceId },
      data: { totpEnabled: false, totpSecret: null, backupCodes: null },
    })
    await writeAudit({
      actorId: request.resourceId, actorRole: 'SYSTEM', actorName: 'Approval-gated action',
      action: '2FA_DISABLED', ip: getClientIp(req),
    })
  }

  return json({ status: vote.status, approvalsSoFar: vote.approvalsSoFar, approvalsNeeded: vote.approvalsNeeded })
}
