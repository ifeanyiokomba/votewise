import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { readAccessToken, verifyAccessToken } from '@/lib/auth'
import { verifyReauth } from '@/lib/reauth'
import { json, errorJson, writeAudit, getClientIp, recordSecurityEvent } from '@/lib/election'
import { requiresApprovalToDisableMfa } from '@/lib/rbac'
import { createApprovalRequest } from '@/lib/approval'

export const dynamic = 'force-dynamic'

// Chapter 3: disabling 2FA is a critical action per the directive's
// "reauthentication before dangerous operations" requirement. A valid
// access token alone used to be sufficient — meaning a stolen token, with
// no knowledge of the account's password or current TOTP code, could
// strip MFA protection from a privileged account. See src/lib/reauth.ts
// for the actual check and its tests.
//
// On top of reauthentication: for PLATFORM_SUPER_ADMIN / ORG_OWNER /
// SUPPORT_AGENT specifically — the same roles requires2FA() mandates MFA
// for — disabling it also requires a second approver via the Chapter 3
// approval mechanism (src/lib/approval.ts). Reauthentication proves the
// requester is still who they say they are; it doesn't address a
// legitimately-authenticated but compromised or coerced account acting
// alone against non-negotiable principle #6.
export async function POST(req: NextRequest) {
  const payload = await verifyAccessToken(readAccessToken(req))
  if (!payload) return errorJson('Unauthorized', 401)

  const body = await req.json().catch(() => ({}))
  const ip = getClientIp(req)

  const official = await db.electionOfficial.findUnique({ where: { id: payload.sub } })
  if (!official) return errorJson('Unauthorized', 401)

  const reauth = verifyReauth(official, { password: body.password, totp: body.totp })
  if (!reauth.ok) {
    await recordSecurityEvent({
      severity: 'HIGH', category: 'AUTH_FAILURE',
      actorId: official.id, actorEmail: official.email, ipAddress: ip,
      message: `Reauthentication failed on 2FA-disable attempt (${reauth.reason})`,
    })
    const message = reauth.reason === 'MISSING_TOTP' || reauth.reason === 'WRONG_TOTP'
      ? 'Your current 2FA code is required to disable two-factor authentication.'
      : 'Current password is required to disable two-factor authentication.'
    return errorJson(message, 401)
  }

  if (requiresApprovalToDisableMfa(official.role)) {
    const existing = await db.privilegedActionApproval.findFirst({
      where: { resourceId: official.id, actionType: 'MFA_DISABLE', status: 'PENDING' },
    })
    if (existing) {
      return json({
        pendingApproval: true,
        approvalId: existing.id,
        message: 'A request to disable MFA on this account is already awaiting a second approver.',
      }, 202)
    }

    const orgMember = await db.organizationMember.findFirst({
      where: { email: official.email },
      select: { organizationId: true },
    }).catch(() => null)

    const request = await createApprovalRequest({
      organizationId: orgMember?.organizationId ?? null,
      actionType: 'MFA_DISABLE',
      resourceId: official.id,
      requestedById: official.id,
      requiredApprovals: 1,
      reason: 'Self-service MFA disable request',
      ttlMinutes: 60,
    })

    await recordSecurityEvent({
      severity: 'HIGH', category: 'AUTH_FAILURE',
      actorId: official.id, actorEmail: official.email, ipAddress: ip,
      message: `MFA-disable requested for ${official.email}, awaiting a second approver (request ${request.id})`,
    })
    await writeAudit({
      actorId: official.id, actorRole: official.role, actorName: official.name,
      action: 'MFA_DISABLE_REQUESTED', ip,
    })

    return json({
      pendingApproval: true,
      approvalId: request.id,
      message: 'Reauthentication confirmed. Disabling MFA on this role requires a second approver — request sent.',
    }, 202)
  }

  await db.electionOfficial.update({
    where: { id: payload.sub },
    data: { totpEnabled: false, totpSecret: null, backupCodes: null },
  })
  await writeAudit({ actorId: payload.sub, actorRole: payload.role, actorName: payload.name, action: '2FA_DISABLED', ip })
  return json({ ok: true })
}
