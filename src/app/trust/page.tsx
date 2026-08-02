import { Suspense } from 'react'
import { NavBar } from '@/components/votewise/shared'
import { Footer } from '@/components/votewise/shared'
import { TrustSecurityPage } from '@/components/votewise/trust-security-page'

export const dynamic = 'force-dynamic'

// /trust — Public Trust & Security page.
// Spec: "Every screen should reassure users they're participating in a
// secure, official election."
export default function TrustPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <NavBar />
      <main className="flex-1">
        <Suspense fallback={<div className="grid min-h-[60vh] place-items-center"><div className="animate-pulse text-muted-foreground">Loading…</div></div>}>
          <TrustSecurityPage />
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
