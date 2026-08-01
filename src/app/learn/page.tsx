'use client'
import { Suspense } from 'react'
import { VoterEducationPortal } from '@/components/votewise/voter-education-portal'
import { NavBar, Footer } from '@/components/votewise/shared'
import { Loader2 } from 'lucide-react'

export default function Page() {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center"><Loader2 className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>}>
      <div className="flex min-h-screen flex-col">
        <NavBar />
        <main className="flex-1">
          <VoterEducationPortal />
        </main>
        <Footer />
      </div>
    </Suspense>
  )
}
