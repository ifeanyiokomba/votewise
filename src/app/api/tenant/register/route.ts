import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson, writeAudit, getClientIp } from '@/lib/election'
import { hashPassword } from '@/lib/crypto'
import { signAccessToken, newRefreshToken, setAuthCookies } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// POST /api/tenant/register
// Body: {
//   type: 'UNIVERSITY' | 'FACULTY' | 'DEPARTMENT',
//   universityName, facultyName?, departmentName?,
//   displayName?, slug?, primaryColour?, accentColour?,
//   logoUrl?, universityLogoUrl?,
//   adminName, adminEmail, adminPassword
// }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { type, institutionType, universityName, facultyName, departmentName, displayName, slug,
    primaryColour, accentColour, logoUrl, universityLogoUrl,
    adminName, adminEmail, adminPassword } = body

  // Validation
  if (!type || !['UNIVERSITY', 'FACULTY', 'DEPARTMENT'].includes(type))
    return errorJson('Organization type is required (UNIVERSITY, FACULTY, or DEPARTMENT)', 400)
  if (!universityName) return errorJson('University name is required', 400)
  if (type === 'FACULTY' && !facultyName) return errorJson('Faculty name is required for faculty-level elections', 400)
  if (type === 'DEPARTMENT' && !facultyName) return errorJson('Faculty name is required for department-level elections', 400)
  if (type === 'DEPARTMENT' && !departmentName) return errorJson('Department name is required for department-level elections', 400)
  if (!adminName || !adminEmail || !adminPassword)
    return errorJson('Admin name, email, and password are required', 400)
  if (adminPassword.length < 8)
    return errorJson('Password must be at least 8 characters', 400)

  // Check email uniqueness
  const existingOfficial = await db.electionOfficial.findUnique({ where: { email: adminEmail.toLowerCase() } })
  if (existingOfficial) return errorJson('An account with this email already exists', 409)

  // Generate slug, display name, and subdomain
  const baseSlug = (slug || displayName || universityName).toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const finalSlug = baseSlug + '-' + Math.random().toString(36).slice(2, 6)
  // Auto-assign subdomain: e.g. unilag.votewise.ng, eng-unilag.votewise.ng
  const subdomainBase = type === 'UNIVERSITY' ? universityName : (type === 'FACULTY' ? `${facultyName}-${universityName}` : `${departmentName}-${facultyName}`)
  const subdomain = subdomainBase.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) + '-' + Math.random().toString(36).slice(2, 4)

  const finalDisplayName = displayName || (
    type === 'UNIVERSITY' ? `${universityName} SUG` :
    type === 'FACULTY' ? `${facultyName} — ${universityName}` :
    `${departmentName} — ${facultyName}, ${universityName}`
  )

  // Create tenant
  const tenant = await db.tenant.create({
    data: {
      type,
      institutionType: institutionType || null,
      universityName,
      facultyName: facultyName || null,
      departmentName: departmentName || null,
      displayName: finalDisplayName,
      slug: finalSlug,
      subdomain,
      logoUrl: logoUrl || null,
      universityLogoUrl: universityLogoUrl || null,
      primaryColour: primaryColour || '#15803d',
      accentColour: accentColour || '#b45309',
      adminEmail: adminEmail.toLowerCase(),
      status: 'ACTIVE',
    },
  })

  // Create admin official for this tenant
  const official = await db.electionOfficial.create({
    data: {
      tenantId: tenant.id,
      email: adminEmail.toLowerCase(),
      name: adminName,
      role: 'SUPER_ADMIN',
      passwordHash: hashPassword(adminPassword),
      emailVerified: true,
    },
  })

  // Create default election settings for this tenant
  await db.electionSetting.create({
    data: {
      id: `tenant-${tenant.id}`,
      tenantId: tenant.id,
      publicLiveResults: true,
      showTurnout: true,
      requireOtp: true,
      requireAccreditation: true,
      ballotRandomization: true,
      notaEnabled: true,
    },
  })

  // Issue auth tokens
  const access = await signAccessToken({
    sub: official.id, role: official.role, name: official.name, email: official.email,
  })
  const refresh = newRefreshToken()
  await db.refreshToken.create({
    data: {
      officialId: official.id,
      tokenHash: refresh.tokenHash,
      family: refresh.family,
      ipAddress: getClientIp(req),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  })
  await setAuthCookies(access, refresh.token)
  await writeAudit({
    actorId: official.id, actorRole: 'SUPER_ADMIN', actorName: official.name,
    action: 'TENANT_CREATED', details: { tenantId: tenant.id, type, displayName: finalDisplayName }, ip: getClientIp(req),
  })

  return json({
    ok: true,
    tenant: {
      id: tenant.id,
      type: tenant.type,
      institutionType: tenant.institutionType,
      displayName: tenant.displayName,
      slug: tenant.slug,
      subdomain: tenant.subdomain,
      universityName: tenant.universityName,
      facultyName: tenant.facultyName,
      departmentName: tenant.departmentName,
      primaryColour: tenant.primaryColour,
      accentColour: tenant.accentColour,
      logoUrl: tenant.logoUrl,
    },
    official: {
      id: official.id, name: official.name, email: official.email, role: official.role,
    },
  })
}
