'use client'

import { Suspense, use } from 'react'
import { useSearchParams } from 'next/navigation'
import { UnitDashboard } from '@/components/votewise/unit-dashboard'
import { NavBar, Footer } from '@/components/votewise/shared'

function UnitPageContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const searchParams = useSearchParams()
  const org = searchParams.get('org') || undefined
  return (
    <div className="flex min-h-screen flex-col">
      <NavBar />
      <main className="flex-1">
        <UnitDashboard unitId={id} subdomain={org} />
      </main>
      <Footer />
    </div>
  )
}

export default function UnitPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>}>
      <UnitPageContent params={params} />
    </Suspense>
  )
}
