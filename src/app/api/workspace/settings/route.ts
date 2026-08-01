import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson, writeAudit, getClientIp } from '@/lib/election'
import { requireOrganization } from '@/lib/org-context'
import { getCurrentOfficial } from '@/lib/guards'

export const dynamic = 'force-dynamic'

// GET /api/workspace/settings — return the org's workspace settings + branding.
export async function GET(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  const [settings, terminology, subscription] = await Promise.all([
    db.organizationWorkspaceSetting.findUnique({ where: { organizationId: org.id } }),
    db.organizationTerminology.findUnique({ where: { organizationId: org.id } }),
    db.organizationSubscription.findUnique({ where: { organizationId: org.id } }),
  ])

  return json({
    organization: {
      id: org.id, name: org.name, slug: org.slug, subdomain: org.subdomain,
      logoUrl: org.logoUrl, darkModeLogoUrl: null,
      primaryColour: org.primaryColour, accentColour: org.accentColour,
      country: org.country, state: org.state, timezone: org.timezone,
      category: org.category, description: org.description,
      status: org.status, plan: org.plan,
    },
    settings: settings || {
      defaultOtpChannel: 'EMAIL', defaultOtpTtlSeconds: 600, defaultMaxOtpAttempts: 5,
      notifyEmail: true, notifySms: false, notifyWhatsapp: false,
      defaultRequireAccreditation: true, defaultBallotRandomization: true,
      defaultNotaEnabled: true, defaultPublicLiveResults: true,
      require2faForAdmins: true, singleDeviceEnforcement: false,
    },
    terminology: terminology || {
      organizationLabel: 'Organization', workspaceLabel: 'Workspace',
      voterGroupLabel: 'Voter Group', voterLabel: 'Voter', candidateLabel: 'Candidate',
    },
    subscription: subscription || { plan: org.plan, status: org.status, voterQuota: org.voterQuota, votersUsed: 0 },
  })
}

// PATCH /api/workspace/settings — update org branding / settings / terminology.
// Body: { organization?, settings?, terminology? }
export async function PATCH(req: NextRequest) {
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  const official = await getCurrentOfficial(req)
  if (!official) return errorJson('Unauthorized', 401)

  const body = await req.json().catch(() => ({}))
  const { organization: orgUpdates, settings: settingUpdates, terminology: termUpdates } = body

  // Update organization fields (branding, location, description).
  if (orgUpdates) {
    await db.organization.update({
      where: { id: org.id },
      data: {
        ...(orgUpdates.name && { name: orgUpdates.name }),
        ...(orgUpdates.description !== undefined && { description: orgUpdates.description }),
        ...(orgUpdates.primaryColour && { primaryColour: orgUpdates.primaryColour }),
        ...(orgUpdates.accentColour && { accentColour: orgUpdates.accentColour }),
        ...(orgUpdates.logoUrl !== undefined && { logoUrl: orgUpdates.logoUrl }),
        ...(orgUpdates.country !== undefined && { country: orgUpdates.country }),
        ...(orgUpdates.state !== undefined && { state: orgUpdates.state }),
        ...(orgUpdates.timezone && { timezone: orgUpdates.timezone }),
        ...(orgUpdates.language && { language: orgUpdates.language }),
      },
    })
  }

  // Upsert workspace settings.
  if (settingUpdates) {
    await db.organizationWorkspaceSetting.upsert({
      where: { organizationId: org.id },
      create: {
        organizationId: org.id,
        defaultOtpChannel: settingUpdates.defaultOtpChannel || 'EMAIL',
        defaultOtpTtlSeconds: settingUpdates.defaultOtpTtlSeconds || 600,
        defaultMaxOtpAttempts: settingUpdates.defaultMaxOtpAttempts || 5,
        notifyEmail: settingUpdates.notifyEmail ?? true,
        notifySms: settingUpdates.notifySms ?? false,
        notifyWhatsapp: settingUpdates.notifyWhatsapp ?? false,
        defaultRequireAccreditation: settingUpdates.defaultRequireAccreditation ?? true,
        defaultBallotRandomization: settingUpdates.defaultBallotRandomization ?? true,
        defaultNotaEnabled: settingUpdates.defaultNotaEnabled ?? true,
        defaultPublicLiveResults: settingUpdates.defaultPublicLiveResults ?? true,
        require2faForAdmins: settingUpdates.require2faForAdmins ?? true,
        singleDeviceEnforcement: settingUpdates.singleDeviceEnforcement ?? false,
      },
      update: {
        ...(settingUpdates.defaultOtpChannel && { defaultOtpChannel: settingUpdates.defaultOtpChannel }),
        ...(settingUpdates.defaultOtpTtlSeconds && { defaultOtpTtlSeconds: settingUpdates.defaultOtpTtlSeconds }),
        ...(settingUpdates.defaultMaxOtpAttempts && { defaultMaxOtpAttempts: settingUpdates.defaultMaxOtpAttempts }),
        ...(settingUpdates.notifyEmail !== undefined && { notifyEmail: settingUpdates.notifyEmail }),
        ...(settingUpdates.notifySms !== undefined && { notifySms: settingUpdates.notifySms }),
        ...(settingUpdates.notifyWhatsapp !== undefined && { notifyWhatsapp: settingUpdates.notifyWhatsapp }),
        ...(settingUpdates.defaultRequireAccreditation !== undefined && { defaultRequireAccreditation: settingUpdates.defaultRequireAccreditation }),
        ...(settingUpdates.defaultBallotRandomization !== undefined && { defaultBallotRandomization: settingUpdates.defaultBallotRandomization }),
        ...(settingUpdates.defaultNotaEnabled !== undefined && { defaultNotaEnabled: settingUpdates.defaultNotaEnabled }),
        ...(settingUpdates.defaultPublicLiveResults !== undefined && { defaultPublicLiveResults: settingUpdates.defaultPublicLiveResults }),
        ...(settingUpdates.require2faForAdmins !== undefined && { require2faForAdmins: settingUpdates.require2faForAdmins }),
        ...(settingUpdates.singleDeviceEnforcement !== undefined && { singleDeviceEnforcement: settingUpdates.singleDeviceEnforcement }),
      },
    })
  }

  // Upsert terminology (Principle 4).
  if (termUpdates) {
    await db.organizationTerminology.upsert({
      where: { organizationId: org.id },
      create: {
        organizationId: org.id,
        organizationLabel: termUpdates.organizationLabel || 'Organization',
        workspaceLabel: termUpdates.workspaceLabel || 'Workspace',
        voterGroupLabel: termUpdates.voterGroupLabel || 'Voter Group',
        voterLabel: termUpdates.voterLabel || 'Voter',
        candidateLabel: termUpdates.candidateLabel || 'Candidate',
        electionLabel: termUpdates.electionLabel || 'Election',
        positionLabel: termUpdates.positionLabel || 'Position',
        officialLabel: termUpdates.officialLabel || 'Electoral Officer',
        observerLabel: termUpdates.observerLabel || 'Observer',
      },
      update: {
        ...(termUpdates.organizationLabel && { organizationLabel: termUpdates.organizationLabel }),
        ...(termUpdates.workspaceLabel && { workspaceLabel: termUpdates.workspaceLabel }),
        ...(termUpdates.voterGroupLabel && { voterGroupLabel: termUpdates.voterGroupLabel }),
        ...(termUpdates.voterLabel && { voterLabel: termUpdates.voterLabel }),
        ...(termUpdates.candidateLabel && { candidateLabel: termUpdates.candidateLabel }),
        ...(termUpdates.electionLabel && { electionLabel: termUpdates.electionLabel }),
        ...(termUpdates.positionLabel && { positionLabel: termUpdates.positionLabel }),
        ...(termUpdates.officialLabel && { officialLabel: termUpdates.officialLabel }),
        ...(termUpdates.observerLabel && { observerLabel: termUpdates.observerLabel }),
      },
    })
  }

  await writeAudit({
    actorId: official.id, actorRole: official.role, actorName: official.name,
    action: 'WORKSPACE_SETTINGS_UPDATED',
    details: { organizationId: org.id, updated: Object.keys(body) },
    ip: getClientIp(req),
  }).catch(() => {})

  return json({ ok: true })
}
