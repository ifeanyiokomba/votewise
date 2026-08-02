'use client'

import { Suspense } from 'react'
import { PlatformOperationsCenter } from '@/components/votewise/platform-operations-center'
import { Loader2 } from 'lucide-react'

export default function OperationsPage() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center">
          <Loader2 className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      }
    >
      <PlatformOperationsCenter />
    </Suspense>
  )
}
