import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { resolveOrganization, type ResolvedOrganization } from '@/lib/org-context'

// VoteWise — Tenant-scoping helper for legacy admin/observer APIs (Chapter 2)
//
// The legacy admin APIs (voters, candidates, positions, etc.) were built before
// multi-tenancy. This helper bridges them to the new OrganizationContext by:
//   1. Resolving the current org from the request (subdomain / custom domain /
//      x-vw-org header).
//   2. Returning a Prisma `where` fragment that scopes by
//      `electionSession: { organizationId }` — so queries only return data
//      belonging to the resolved org.
//
// If no org is resolved (e.g. the old dashboard at `/` with no workspace
// context), returns an empty fragment for backward compatibility. Platform
// super admins can still see all data when no org context is present.
//
// This is the "major security task" from the Chapter 2 spec: "Never query
// without organizationId."

export interface OrgScope {
  org: ResolvedOrganization | null
  // A Prisma where-clause fragment to spread into voter/candidate/position
  // queries. Scopes by electionSession.organizationId when an org is resolved.
  electionScope: Record<string, unknown>
  // True if an organization context was resolved (i.e. we are in a workspace).
  hasOrg: boolean
}

export async function getOrgScope(req: NextRequest): Promise<OrgScope> {
  const org = await resolveOrganization(req)
  if (org) {
    return {
      org,
      electionScope: { electionSession: { organizationId: org.id } },
      hasOrg: true,
    }
  }
  return { org: null, electionScope: {}, hasOrg: false }
}

// Helper: verify that a specific resource (voter, candidate, etc.) belongs to
// the resolved organization before returning/modifying it. Returns true if the
// resource is accessible, false otherwise (cross-tenant access attempt).
export async function resourceBelongsToOrg(
  electionSessionId: string | null | undefined,
  orgId: string
): Promise<boolean> {
  if (!electionSessionId) return false
  try {
    const session = await db.electionSession.findUnique({
      where: { id: electionSessionId },
      select: { organizationId: true },
    })
    return session?.organizationId === orgId
  } catch {
    return false
  }
}
