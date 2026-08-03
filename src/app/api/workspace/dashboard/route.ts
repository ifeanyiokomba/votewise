import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { json, errorJson } from '@/lib/election'
import { resolveOrganization, requireOrganization } from '@/lib/org-context'
import { getCurrentOfficial } from '@/lib/guards'
import { verifyAccessToken, readAccessToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/workspace/dashboard
// Returns the "alive" workspace dashboard data for the current organization:
// upcoming elections, recent activity, support tickets, system health,
// subscription, voter counts, observer count, notifications.
//
// Tenant isolation: the organization is resolved from the request (subdomain /
// custom domain). Only data belonging to that org is returned.
export async function GET(req: NextRequest) {
  // Auth check — closes the endpoint authentication gap (audit finding)
  const token = readAccessToken(req)
  const auth = await verifyAccessToken(token)
  if (!auth) return errorJson('Unauthorized', 401)
  const orgResult = await requireOrganization(req)
  if ('error' in orgResult) return orgResult.error
  const org = orgResult

  // Parallel queries — all scoped by organizationId.
  const [elections, members, voterGroups, workspaces, tickets, auditLogs, notifications, domains, settings] = await Promise.all([
    db.electionSession.findMany({
      where: { organizationId: org.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true, name: true, status: true, startTime: true, endTime: true,
        academicSession: true, _count: { select: { voters: true, candidates: true, positions: true } },
      },
    }),
    db.organizationMember.findMany({
      where: { organizationId: org.id },
      select: { id: true, name: true, email: true, role: true, lastLoginAt: true },
    }),
    db.voterGroup.findMany({
      where: { organizationId: org.id },
      select: { id: true, name: true, voterCount: true },
    }),
    db.workspace.findMany({
      where: { organizationId: org.id },
      select: { id: true, name: true, code: true },
    }),
    db.supportTicket.findMany({
      where: { voter: { tenantId: org.id } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, issueType: true, status: true, createdAt: true, voterName: true },
    }).catch(() => []),
    db.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { id: true, action: true, actorName: true, createdAt: true },
    }).catch(() => []),
    db.notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, title: true, message: true, type: true, createdAt: true },
    }).catch(() => []),
    db.organizationDomain.findMany({
      where: { organizationId: org.id },
      select: { id: true, domain: true, status: true, isPrimary: true, dnsVerifiedAt: true },
    }),
    db.organizationWorkspaceSetting.findUnique({
      where: { organizationId: org.id },
    }),
  ])

  const admins = members.filter((m) => m.role === 'ORG_OWNER' || m.role === 'ORG_ADMIN' || m.role === 'SUPER_ADMIN')
  const observers = members.filter((m) => m.role === 'OBSERVER')
  const totalVoters = elections.reduce((a, e) => a + (e._count.voters || 0), 0)
  const upcomingElections = elections.filter((e) => e.status === 'DRAFT' || e.status === 'PUBLISHED' || e.status === 'ACCREDITATION' || e.status === 'VOTING')

  return json({
    organization: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      subdomain: org.subdomain,
      status: org.status,
      plan: org.plan,
      category: org.category,
      description: org.description,
      logoUrl: org.logoUrl,
      primaryColour: org.primaryColour,
      accentColour: org.accentColour,
      isLive: org.isLive,
      paidUntil: org.paidUntil,
      voterQuota: org.voterQuota,
      country: org.country,
      state: org.state,
      timezone: org.timezone,
    },
    stats: {
      totalElections: elections.length,
      upcomingElections: upcomingElections.length,
      totalVoters,
      totalMembers: members.length,
      adminCount: admins.length,
      observerCount: observers.length,
      voterGroupCount: voterGroups.length,
      workspaceCount: workspaces.length,
    },
    elections: elections.map((e) => ({
      id: e.id,
      name: e.name,
      status: e.status,
      startTime: e.startTime,
      endTime: e.endTime,
      period: e.academicSession,
      voterCount: e._count.voters,
      candidateCount: e._count.candidates,
      positionCount: e._count.positions,
    })),
    members: members.map((m) => ({
      id: m.id, name: m.name, email: m.email, role: m.role,
      lastLoginAt: m.lastLoginAt,
    })),
    admins: admins.map((m) => ({ id: m.id, name: m.name, email: m.email, role: m.role })),
    observers: observers.map((m) => ({ id: m.id, name: m.name, email: m.email })),
    voterGroups,
    workspaces,
    tickets,
    recentActivity: auditLogs,
    notifications,
    domains,
    settings,
  })
}
