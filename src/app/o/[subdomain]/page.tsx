import { Suspense } from 'react'
import { OrgPortal } from '@/components/votewise/org-portal'

export const dynamic = 'force-dynamic'

// /o/[subdomain] — Dynamic organization election portal.
// Adapts to the election lifecycle: before/during/after voting.
export default function OrgPortalPage({ params }: { params: Promise<{ subdomain: string }> }) {
  return (
    <Suspense fallback={
      <div className="grid min-h-screen place-items-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading election portal…</div>
      </div>
    }>
      <OrgPortalWrapper params={params} />
    </Suspense>
  )
}

async function OrgPortalWrapper({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = await params
  return <OrgPortal subdomain={subdomain} />
}
