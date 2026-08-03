import { Suspense } from 'react'
import { OrgAdminPortal } from '@/components/votewise/org-admin-portal'

export const dynamic = 'force-dynamic'

// /o/[subdomain]/admin — Organization Admin Management Interface
// Spec: "Organization Authentication — unilag.votewise.com.ng/admin"
// Requirements: Role-based access, Activity logging, MFA optional/required
//
// This is the admin section within an organization's portal. It's separate
// from the public-facing portal pages (/o/[subdomain]/) and requires
// authentication with an org-level role (ORG_OWNER, ORG_ADMIN, etc.).
export default function OrgAdminPage({ params }: { params: Promise<{ subdomain: string }> }) {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center"><div className="animate-pulse text-muted-foreground">Loading admin portal…</div></div>}>
      <OrgAdminPortalWrapper params={params} />
    </Suspense>
  )
}

async function OrgAdminPortalWrapper({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = await params
  return <OrgAdminPortal subdomain={subdomain} />
}
