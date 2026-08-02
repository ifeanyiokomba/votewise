'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { DeveloperPortal } from '@/components/votewise/developer-portal'
import { NavBar, Footer } from '@/components/votewise/shared'
import { ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

function DeveloperPageContent() {
  const params = useSearchParams()
  const org = params.get('org') || undefined
  return (
    <div className="flex min-h-screen flex-col bg-secondary/20">
      <NavBar />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6">
          <Button variant="ghost" size="sm" asChild className="mb-2 gap-1.5">
            <Link href={org ? `/workspace?org=${encodeURIComponent(org)}` : '/workspace'}>
              <ArrowLeft className="h-4 w-4" /> Back to Dashboard
            </Link>
          </Button>
        </div>
        <DeveloperPortal subdomain={org} />
      </main>
      <Footer />
    </div>
  )
}

export default function DeveloperPage() {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center"><Loader2 className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>}>
      <DeveloperPageContent />
    </Suspense>
  )
}
