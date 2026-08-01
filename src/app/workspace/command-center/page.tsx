'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { CommandCenter } from '@/components/votewise/command-center'
import { NavBar, Footer } from '@/components/votewise/shared'

function CommandCenterPageContent() {
  const params = useSearchParams()
  const org = params.get('org') || undefined
  return (
    <div className="flex min-h-screen flex-col">
      <NavBar />
      <main className="flex-1">
        <CommandCenter subdomain={org} />
      </main>
      <Footer />
    </div>
  )
}

export default function CommandCenterPage() {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>}>
      <CommandCenterPageContent />
    </Suspense>
  )
}
