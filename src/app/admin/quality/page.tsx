'use client'

import { Suspense } from 'react'
import { NavBar, Footer } from '@/components/votewise/shared'
import { QaConsole } from '@/components/votewise/qa-console'
import { Loader2 } from 'lucide-react'

export default function QualityPage() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center">
          <Loader2 className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      }
    >
      <div className="flex min-h-screen flex-col bg-secondary/20">
        <NavBar />
        <main className="flex-1">
          <QaConsole />
        </main>
        <Footer />
      </div>
    </Suspense>
  )
}
