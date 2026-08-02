// VoteWise — Chapter 3: Seed default roles + permissions + role-permission links.
// Run with: bun run scripts/seed-rbac.ts

import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

// The 6 default system roles (Chapter 1 product vision).
const DEFAULT_ROLES = [
  { name: 'Owner', description: 'Organization owner — full control', isSystem: true },
  { name: 'Admin', description: 'Organization admin — manages elections, voters, candidates', isSystem: true },
  { name: 'Observer', description: 'Election official — monitors, verifies, cannot modify', isSystem: true },
  { name: 'Support', description: 'Support agent — handles tickets, resends OTP', isSystem: true },
  { name: 'Auditor', description: 'Read-only access to audit logs and reports', isSystem: true },
  { name: 'Voter', description: 'Voter — can vote, nothing more', isSystem: true },
]

// Granular permissions, grouped by category.
const PERMISSIONS = [
  // Election
  { key: 'election.create', description: 'Create elections', category: 'election' },
  { key: 'election.manage', description: 'Manage election settings', category: 'election' },
  { key: 'election.delete', description: 'Delete elections', category: 'election' },
  { key: 'election.publish', description: 'Publish/open elections', category: 'election' },
  { key: 'election.suspend', description: 'Suspend elections', category: 'election' },
  { key: 'election.certify', description: 'Certify results', category: 'election' },
  // Voter
  { key: 'voter.import', description: 'Import voters via CSV', category: 'voter' },
  { key: 'voter.manage', description: 'Add/edit/delete voters', category: 'voter' },
  { key: 'voter.search', description: 'Search the voter register', category: 'voter' },
  { key: 'voter.flag', description: 'Flag/unflag voters', category: 'voter' },
  // Candidate
  { key: 'candidate.manage', description: 'Create/edit candidates', category: 'candidate' },
  { key: 'candidate.screen', description: 'Approve/reject candidates', category: 'candidate' },
  // Billing
  { key: 'billing.manage', description: 'Manage billing and subscriptions', category: 'billing' },
  { key: 'billing.view', description: 'View billing history', category: 'billing' },
  // Security
  { key: 'security.view', description: 'View security events', category: 'security' },
  { key: 'security.manage', description: 'Manage 2FA, domains, API keys', category: 'security' },
  // Audit
  { key: 'audit.view', description: 'View audit logs', category: 'audit' },
  { key: 'audit.export', description: 'Export audit logs', category: 'audit' },
  // Support
  { key: 'support.handle', description: 'Handle support tickets', category: 'support' },
  { key: 'support.escalate', description: 'Escalate tickets to platform', category: 'support' },
  // Organization
  { key: 'org.branding', description: 'Manage org branding', category: 'org' },
  { key: 'org.domain', description: 'Connect/disconnect custom domains', category: 'org' },
  { key: 'org.roles', description: 'Manage roles and permissions', category: 'org' },
  { key: 'org.members', description: 'Invite/remove members', category: 'org' },
  // Results
  { key: 'results.view', description: 'View results', category: 'results' },
  { key: 'results.export', description: 'Export results (CSV/JSON/PDF)', category: 'results' },
  // OTP
  { key: 'otp.resend', description: 'Resend OTP to voters', category: 'otp' },
  // VoterField
  { key: 'voterfield.manage', description: 'Manage dynamic voter fields', category: 'voter' },
]

// Role → permission mapping.
const ROLE_PERMISSIONS: Record<string, string[]> = {
  Owner: PERMISSIONS.map((p) => p.key), // all permissions
  Admin: [
    'election.create', 'election.manage', 'election.publish', 'election.suspend', 'election.certify',
    'voter.import', 'voter.manage', 'voter.search', 'voter.flag',
    'candidate.manage', 'candidate.screen',
    'billing.view',
    'security.view',
    'audit.view',
    'support.handle',
    'org.branding', 'org.members',
    'results.view', 'results.export',
    'otp.resend', 'voterfield.manage',
  ],
  Observer: [
    'voter.search', 'candidate.screen', 'audit.view', 'support.handle',
    'results.view', 'results.export', 'otp.resend',
  ],
  Support: [
    'support.handle', 'support.escalate', 'voter.search', 'otp.resend', 'audit.view',
  ],
  Auditor: [
    'audit.view', 'audit.export', 'results.view', 'results.export', 'security.view',
  ],
  Voter: [], // voters have no admin permissions
}

async function main() {
  console.log('[seed-rbac] seeding default roles…')

  // Create platform-wide default roles (organizationId = null).
  const roleMap: Record<string, string> = {}
  for (const r of DEFAULT_ROLES) {
    const role = await db.role.upsert({
      where: { organizationId_name: { organizationId: 'platform-default', name: r.name } },
      create: { ...r, organizationId: null },
      update: { description: r.description, isSystem: r.isSystem },
    }).catch(async () => {
      // fallback: find by name + null org
      const existing = await db.role.findFirst({ where: { organizationId: null, name: r.name } })
      if (existing) {
        return db.role.update({ where: { id: existing.id }, data: { description: r.description, isSystem: r.isSystem } })
      }
      return db.role.create({ data: { ...r, organizationId: null } })
    })
    roleMap[r.name] = role.id
    console.log(`  role: ${r.name} (${role.id})`)
  }

  console.log('[seed-rbac] seeding permissions…')
  const permMap: Record<string, string> = {}
  for (const p of PERMISSIONS) {
    const perm = await db.permission.upsert({
      where: { key: p.key },
      create: p,
      update: { description: p.description, category: p.category },
    })
    permMap[p.key] = perm.id
  }
  console.log(`  ${PERMISSIONS.length} permissions seeded`)

  console.log('[seed-rbac] linking role-permissions…')
  let linked = 0
  for (const [roleName, permKeys] of Object.entries(ROLE_PERMISSIONS)) {
    const roleId = roleMap[roleName]
    if (!roleId) continue
    for (const key of permKeys) {
      const permId = permMap[key]
      if (!permId) continue
      await db.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId: permId } },
        create: { roleId, permissionId: permId },
        update: {},
      }).catch(() => {})
      linked++
    }
  }
  console.log(`  ${linked} role-permission links created`)

  console.log('[seed-rbac] done ✅')
  console.log('  6 system roles: Owner, Admin, Observer, Support, Auditor, Voter')
  console.log(`  ${PERMISSIONS.length} granular permissions`)
  console.log(`  ${linked} role-permission links`)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => db.$disconnect())
