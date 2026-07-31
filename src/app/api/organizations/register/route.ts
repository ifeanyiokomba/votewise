import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson, writeAudit, getClientIp } from '@/lib/election'
import { hashPassword } from '@/lib/crypto'
import { signAccessToken, newRefreshToken, setAuthCookies } from '@/lib/auth'

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
  const { name, category, description, primaryColour, accentColour, logoUrl,
    ownerName, ownerEmail, ownerPassword, terminology } = body

  if (!name || typeof name !== 'string' || name.trim().length < 2)
    return errorJson('Organization name is required', 400)
  if (!ownerName || !ownerEmail || !ownerPassword)
    return errorJson('Owner name, email, and password are required', 400)
  if (ownerPassword.length < 8)
    return errorJson('Password must be at least 8 characters', 400)

  const emailLower = ownerEmail.toLowerCase()

  // Check email uniqueness (across both OrganizationMember and legacy ElectionOfficial)
  const existingMember = await db.organizationMember.findUnique({ where: { email: emailLower } })
  if (existingMember) return errorJson('An account with this email already exists', 409)
  const existingOfficial = await db.electionOfficial.findUnique({ where: { email: emailLower } })
  if (existingOfficial) return errorJson('An account with this email already exists', 409)

  // Generate slug + subdomain from org name
  const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  let finalSlug = baseSlug
  let subdomain = baseSlug.slice(0, 30)
  // Ensure uniqueness
  const existing = await db.organization.findFirst({ where: { OR: [{ slug: finalSlug }, { subdomain }] } })
  if (existing) {
    const suffix = Math.random().toString(36).slice(2, 6)
    finalSlug = `${baseSlug}-${suffix}`
    subdomain = `${baseSlug.slice(0, 26)}-${suffix}`
  }

  const pwHash = hashPassword(ownerPassword)

  // Create organization + member + terminology + bridging official (transaction)
  const result = await db.$transaction(async (tx) => {
    const newOrg = await tx.organization.create({
      data: {
        name: name.trim(),
        slug: finalSlug,
        subdomain,
        logoUrl: logoUrl || null,
        primaryColour: primaryColour || '#15803d',
        accentColour: accentColour || '#b45309',
        ownerEmail: emailLower,
        ownerName: ownerName.trim(),
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
        emailVerified: true, // auto-verify for onboarding simplicity (Principle 5)
      },
    })
    await tx.organizationTerminology.create({
      data: {
        organizationId: newOrg.id,
        organizationLabel: terminology?.organizationLabel || 'Organization',
        workspaceLabel: terminology?.workspaceLabel || 'Workspace',
        voterGroupLabel: terminology?.voterGroupLabel || 'Voter Group',
        voterLabel: terminology?.voterLabel || 'Voter',
        candidateLabel: terminology?.candidateLabel || 'Candidate',
        electionLabel: terminology?.electionLabel || 'Election',
        positionLabel: terminology?.positionLabel || 'Position',
        officialLabel: terminology?.officialLabel || 'Electoral Officer',
        observerLabel: terminology?.observerLabel || 'Observer',
      },
    })
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
