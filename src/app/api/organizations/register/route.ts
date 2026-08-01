import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson, writeAudit, getClientIp } from '@/lib/election'
import { hashPassword } from '@/lib/crypto'
import { signAccessToken, newRefreshToken, setAuthCookies } from '@/lib/auth'
import { validatePassword } from '@/lib/password-policy'
import { getTemplate } from '@/lib/workspace-templates'

export const dynamic = 'force-dynamic'

// POST /api/organizations/register
// Generic organization onboarding (Chapter 1). Any organization can register.
// Body: {
//   name: string,                  // "University of Lagos" / "MTN Nigeria"
//   category?: string,             // UNIVERSITY | COMPANY | CHURCH | NGO | ... (optional)
//   description?: string,
//   primaryColour?, accentColour?, logoUrl?,
//   ownerName: string, ownerEmail: string, ownerPassword: string,
//   terminology?: {                // optional per-org term overrides (Principle 4)
//     organizationLabel?, workspaceLabel?, voterGroupLabel?, voterLabel?, ...
//   }
// }
// Creates: Organization + OrganizationMember (ORG_OWNER) + OrganizationTerminology
//          + a bridging ElectionOfficial (so existing cookie-based auth works)
// Principle 5: Simple onboarding — under 5 minutes.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { name, category, description, primaryColour, accentColour, secondaryColour, logoUrl,
    ownerName, ownerEmail, ownerPassword, ownerPhone,
    country, state, timezone, language, subdomain: requestedSubdomain,
    terminology, template: templateId } = body

  if (!name || typeof name !== 'string' || name.trim().length < 2)
    return errorJson('Organization name is required', 400)
  if (!ownerName || !ownerEmail || !ownerPassword)
    return errorJson('Owner name, email, and password are required', 400)
  // Chapter 4: enforce enterprise password policy (12+ chars, upper, lower, number, special)
  const pwCheck = validatePassword(ownerPassword)
  if (!pwCheck.valid)
    return errorJson('Password does not meet security requirements', 400, { errors: pwCheck.errors })

  // Validate requested subdomain if provided (Step 4 of registration flow).
  let subdomain: string
  if (requestedSubdomain) {
    const sub = String(requestedSubdomain).toLowerCase().trim()
    if (!/^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(sub)) {
      return errorJson('Subdomain must be 3-30 chars, lowercase letters, numbers, hyphens only', 400)
    }
    const taken = await db.organization.findUnique({ where: { subdomain: sub } })
    if (taken) return errorJson('This subdomain is already taken. Try another.', 409)
    subdomain = sub
  } else {
    // Auto-generate from org name.
    const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    subdomain = baseSlug.slice(0, 30)
    const existing = await db.organization.findFirst({ where: { OR: [{ slug: baseSlug }, { subdomain }] } })
    if (existing) subdomain = `${baseSlug.slice(0, 26)}-${Math.random().toString(36).slice(2, 6)}`
  }

  const emailLower = ownerEmail.toLowerCase()

  // Check email uniqueness (across both OrganizationMember and legacy ElectionOfficial)
  // Chapter 4: email is no longer globally unique (multi-org membership).
  // Check if this email is already used by ANY org member.
  const existingMember = await db.organizationMember.findFirst({ where: { email: emailLower } })
  if (existingMember) return errorJson('An account with this email already exists', 409)
  const existingOfficial = await db.electionOfficial.findUnique({ where: { email: emailLower } })
  if (existingOfficial) return errorJson('An account with this email already exists', 409)

  // Generate slug from org name (subdomain already validated above).
  const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  let finalSlug = baseSlug
  const existingSlug = await db.organization.findUnique({ where: { slug: finalSlug } })
  if (existingSlug) finalSlug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`

  const pwHash = hashPassword(ownerPassword)

  // Create organization + member + terminology + workspace settings +
  // subscription + bridging official (transaction). This is the full
  // "Workspace Created" step (Step 5 of the registration flow).
  const result = await db.$transaction(async (tx) => {
    const newOrg = await tx.organization.create({
      data: {
        name: name.trim(),
        slug: finalSlug,
        subdomain,
        logoUrl: logoUrl || null,
        primaryColour: primaryColour || '#15803d',
        secondaryColour: secondaryColour || null,
        accentColour: accentColour || '#b45309',
        ownerEmail: emailLower,
        ownerName: ownerName.trim(),
        ownerPhone: ownerPhone || null,
        country: country || null,
        state: state || null,
        timezone: timezone || 'Africa/Lagos',
        language: language || 'en',
        status: 'TRIAL', // new orgs start on trial; pay to go live
        plan: 'PAYG',
        category: category || 'OTHER',
        description: description || null,
      },
    })
    const member = await tx.organizationMember.create({
      data: {
        organizationId: newOrg.id,
        email: emailLower,
        name: ownerName.trim(),
        role: 'ORG_OWNER',
        passwordHash: pwHash,
        accountStatus: 'ACTIVE', // Chapter 4: explicit account status
        emailVerified: true, // auto-verify for onboarding simplicity (Principle 5)
        phone: ownerPhone || null,
      },
    })
    // Chapter 6: apply workspace template if selected.
    const template = templateId ? getTemplate(templateId) : null
    const mergedTerm = { ...terminology, ...(template?.terminology || {}) }

    await tx.organizationTerminology.create({
      data: {
        organizationId: newOrg.id,
        organizationLabel: mergedTerm.organizationLabel || 'Organization',
        workspaceLabel: mergedTerm.workspaceLabel || 'Workspace',
        voterGroupLabel: mergedTerm.voterGroupLabel || 'Voter Group',
        voterLabel: mergedTerm.voterLabel || 'Voter',
        candidateLabel: mergedTerm.candidateLabel || 'Candidate',
        electionLabel: mergedTerm.electionLabel || 'Election',
        positionLabel: mergedTerm.positionLabel || 'Position',
        officialLabel: mergedTerm.officialLabel || 'Electoral Officer',
        observerLabel: mergedTerm.observerLabel || 'Observer',
      },
    })
    // Create default workspace settings (OTP prefs, notification channels, election defaults).
    await tx.organizationWorkspaceSetting.create({
      data: { organizationId: newOrg.id },
    })
    // Create subscription record (TRIAL status).
    await tx.organizationSubscription.create({
      data: { organizationId: newOrg.id, plan: 'PAYG', status: 'TRIAL' },
    })
    // Chapter 6: precreate voter fields from template.
    if (template?.voterFields) {
      for (const vf of template.voterFields) {
        await tx.voterField.create({
          data: {
            organizationId: newOrg.id,
            label: vf.label,
            key: vf.key,
            fieldType: vf.fieldType,
            required: vf.required,
            displayOrder: template.voterFields.indexOf(vf) + 1,
          },
        })
      }
    }
    // Chapter 6: precreate organization units from template.
    if (template?.sampleUnits) {
      for (const u of template.sampleUnits) {
        const slug = u.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        await tx.workspace.create({
          data: {
            organizationId: newOrg.id,
            name: u.name,
            slug,
            unitType: u.unitType,
            code: u.code || null,
            createdBy: member.id,
          },
        })
      }
    }
    // Bridging ElectionOfficial so the existing cookie-based auth + org portal
    // work immediately. Role mapped ORG_OWNER → SUPER_ADMIN (legacy equivalent).
    // The OrganizationMember remains the source of truth for the new hierarchy.
    const official = await tx.electionOfficial.create({
      data: {
        email: emailLower,
        name: ownerName.trim(),
        role: 'SUPER_ADMIN',
        organization: newOrg.name,
        passwordHash: pwHash,
        emailVerified: true,
      },
    })
    return { newOrg, member, official }
  })

  // Issue auth tokens via the legacy official (so /api/auth/me works)
  const access = await signAccessToken({
    sub: result.official.id, role: result.official.role,
    name: result.official.name, email: result.official.email,
  })
  const refresh = newRefreshToken()
  await db.refreshToken.create({
    data: {
      officialId: result.official.id,
      tokenHash: refresh.tokenHash,
      family: refresh.family,
      ipAddress: getClientIp(req),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  })
  await setAuthCookies(access, refresh.token)
  await writeAudit({
    actorId: result.official.id, actorRole: 'SUPER_ADMIN', actorName: result.official.name,
    action: 'ORGANIZATION_CREATED',
    details: {
      organizationId: result.newOrg.id, name: result.newOrg.name,
      slug: result.newOrg.slug, subdomain: result.newOrg.subdomain,
      category: result.newOrg.category, ownerId: result.member.id,
    },
    ip: getClientIp(req),
  })

  return json({
    ok: true,
    organization: {
      id: result.newOrg.id, name: result.newOrg.name, slug: result.newOrg.slug,
      subdomain: result.newOrg.subdomain, category: result.newOrg.category,
      primaryColour: result.newOrg.primaryColour, accentColour: result.newOrg.accentColour,
      logoUrl: result.newOrg.logoUrl, status: result.newOrg.status, plan: result.newOrg.plan,
    },
    member: {
      id: result.member.id, name: result.member.name, email: result.member.email, role: result.member.role,
    },
    official: {
      id: result.official.id, name: result.official.name, email: result.official.email, role: result.official.role,
    },
  })
}
