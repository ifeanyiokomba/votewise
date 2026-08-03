// VoteWise — Organization Service (Enterprise Audit Part 4)
//
// Spec: "Each module owns its logic."
// Owns: organization CRUD, branding, settings, security, billing profiles.

import { db } from '@/lib/db'

export async function getOrganization(id: string) {
  return db.organization.findUnique({
    where: { id },
    include: {
      brand: true,
      members: { take: 50, orderBy: { createdAt: 'asc' } },
    },
  })
}

export async function listOrganizations(status?: string) {
  const where = status ? { status } : {}
  return db.organization.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 })
}

export async function updateOrganization(id: string, data: any) {
  return db.organization.update({ where: { id }, data })
}

export async function getOrganizationStats(id: string) {
  const [elections, voters, officials, members] = await Promise.all([
    db.electionSession.count({ where: { organizationId: id } }),
    db.voter.count({ where: { organizationId: id } }).catch(() => 0),
    db.electionOfficial.count({ where: { organizationId: id } }).catch(() => 0),
    db.organizationMember.count({ where: { organizationId: id } }).catch(() => 0),
  ])
  return { elections, voters, officials, members }
}
