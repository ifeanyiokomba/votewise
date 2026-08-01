import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson, writeAudit, getClientIp } from '@/lib/election'
import { hashPassword, randomToken } from '@/lib/crypto'
import { requireOrganization } from '@/lib/org-context'
import { getCurrentOfficial } from '@/lib/guards'
import { validatePassword } from '@/lib/password-policy'

export const dynamic = 'force-dynamic'

// GET /api/workspace/invitations — list pending invitations for the org.
export async function GET(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  const official = await getCurrentOfficial(req)
  if (!official) return errorJson('Unauthorized', 401)

  // Pending members = OrganizationMember with accountStatus = 'PENDING'
  const pending = await db.organizationMember.findMany({
    where: { organizationId: org.id, accountStatus: 'PENDING' },
    select: { id: true, email: true, name: true, role: true, createdAt: true, passwordResetToken: true },
    orderBy: { createdAt: 'desc' },
  }).catch(() => [])

  return json({ invitations: pending })
}

// POST /api/workspace/invitations — invite a user to the org.
// Body: { email, name, role, phone? }
// Creates an OrganizationMember with PENDING status + a secure invite token.
// The invitee receives a link like /accept-invite?token=<token> to set password.
export async function POST(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  const official = await getCurrentOfficial(req)
  if (!official) return errorJson('Unauthorized', 401)
  if (official.role !== 'SUPER_ADMIN' && official.role !== 'PLATFORM_SUPER_ADMIN' && official.role !== 'ORG_OWNER' && official.role !== 'ELECTORAL_COMMITTEE') {
    return errorJson('Only organization owners can invite users.', 403)
  }

  const body = await req.json().catch(() => ({}))
  const { email, name, role, phone } = body
  if (!email || !name || !role)
    return errorJson('email, name, and role are required', 400)

  const emailLower = String(email).toLowerCase().trim()
  const validRoles = ['ORG_OWNER', 'ORG_ADMIN', 'OBSERVER', 'SUPPORT', 'AUDITOR', 'VOTER']
  if (!validRoles.includes(role))
    return errorJson(`Invalid role. Must be one of: ${validRoles.join(', ')}`, 400)

  // Check if already a member of this org.
  const existing = await db.organizationMember.findUnique({
    where: { organizationId_email: { organizationId: org.id, email: emailLower } },
  }).catch(() => null)

  if (existing && existing.accountStatus === 'ACTIVE') {
    return errorJson('This user is already an active member of your organization.', 409)
  }

  // Generate a secure invite token.
  const inviteToken = randomToken(32)
  const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

  // Create or update the member with PENDING status.
  const member = await db.organizationMember.upsert({
    where: { organizationId_email: { organizationId: org.id, email: emailLower } },
    create: {
      organizationId: org.id,
      email: emailLower,
      name: String(name).trim(),
      role,
      phone: phone || null,
      passwordHash: '__PENDING__', // no password until accepted
      accountStatus: 'PENDING',
      passwordResetToken: inviteToken,
      passwordResetExpiresAt: inviteExpiresAt,
    },
    update: {
      name: String(name).trim(),
      role,
      phone: phone || null,
      accountStatus: 'PENDING',
      passwordResetToken: inviteToken,
      passwordResetExpiresAt: inviteExpiresAt,
    },
  }).catch(() => null)

  if (!member) return errorJson('Failed to create invitation.', 500)

  await writeAudit({
    actorId: official.id, actorRole: official.role, actorName: official.name,
    action: 'USER_INVITED',
    details: { organizationId: org.id, inviteeEmail: emailLower, role, inviteToken },
    ip: getClientIp(req),
  }).catch(() => {})

  return json({
    ok: true,
    invitation: {
      id: member.id,
      email: emailLower,
      name: member.name,
      role,
      token: inviteToken,
      expiresAt: inviteExpiresAt,
      // In production, this link would be emailed. For dev, we return it.
      inviteLink: `/accept-invite?token=${inviteToken}`,
    },
  })
}

// DELETE /api/workspace/invitations — revoke a pending invitation.
// Body: { id }
export async function DELETE(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  const official = await getCurrentOfficial(req)
  if (!official) return errorJson('Unauthorized', 401)

  const body = await req.json().catch(() => ({}))
  const { id } = body
  if (!id) return errorJson('Invitation id is required', 400)

  const member = await db.organizationMember.findUnique({ where: { id } })
  if (!member || member.organizationId !== org.id || member.accountStatus !== 'PENDING') {
    return errorJson('Invitation not found', 404)
  }

  await db.organizationMember.delete({ where: { id } })
  return json({ ok: true })
}
