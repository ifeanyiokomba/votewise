'use client'
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { ElectionCenter } from '@/components/votewise/election-center'
import { NavBar, Footer } from '@/components/votewise/shared'

function Page() {
  const p = useSearchParams(); const org = p.get('org') || undefined
  return <div className="flex min-h-screen flex-col"><NavBar /><main className="flex-1"><ElectionCenter subdomain={org} /></main><Footer /></div>
}
export default function ElectionsPage() {
  return <Suspense fallback={<div className="grid min-h-screen place-items-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>}><Page /></Suspense>
}
