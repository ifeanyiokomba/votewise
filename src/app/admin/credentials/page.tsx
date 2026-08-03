import { Suspense } from 'react'
import { NavBar } from '@/components/votewise/shared'
import { Footer } from '@/components/votewise/shared'
import { CredentialManager } from '@/components/votewise/credential-manager'

export const dynamic = 'force-dynamic'

export default function CredentialsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <NavBar />
      <main className="flex-1">
        <Suspense fallback={<div className="grid min-h-[60vh] place-items-center"><div className="animate-pulse text-muted-foreground">Loading credential manager…</div></div>}>
          <CredentialManager />
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
