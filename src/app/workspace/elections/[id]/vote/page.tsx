'use client'
import { Suspense, use } from 'react'
import { useSearchParams } from 'next/navigation'
import { BallotView } from '@/components/votewise/ballot-view'
import { NavBar, Footer } from '@/components/votewise/shared'

function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const sp = useSearchParams(); const org = sp.get('org') || undefined
  return <div className="flex min-h-screen flex-col"><NavBar /><main className="flex-1"><BallotView electionId={id} subdomain={org} /></main><Footer /></div>
}
export default function VotePage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<div className="grid min-h-screen place-items-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>}><Page params={params} /></Suspense>
}
