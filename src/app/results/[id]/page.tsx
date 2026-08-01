'use client'

import { Suspense, use } from 'react'
import { PublicResultsView } from '@/components/votewise/public-results'
import { NavBar, Footer } from '@/components/votewise/shared'
import { Loader2 } from 'lucide-react'

function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <div className="flex min-h-screen flex-col">
      <NavBar />
      <main className="flex-1">
        <PublicResultsView electionId={id} />
      </main>
      <Footer />
    </div>
  )
}

export default function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center">
          <Loader2 className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      }
    >
      <Page params={params} />
    </Suspense>
  )
}
