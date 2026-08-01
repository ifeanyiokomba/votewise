'use client'

import { Suspense, use } from 'react'
import { VerificationPortal } from '@/components/votewise/verification-portal'
import { NavBar, Footer } from '@/components/votewise/shared'
import { Loader2 } from 'lucide-react'

function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <div className="flex min-h-screen flex-col">
      <NavBar />
      <main className="flex-1">
        <VerificationPortal electionId={id} />
      </main>
      <Footer />
    </div>
  )
}

export default function VerifyPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center"><Loader2 className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>}><Page params={params} /></Suspense>
  )
}
