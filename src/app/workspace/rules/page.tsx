'use client'
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { RuleBuilder } from '@/components/votewise/rule-builder'
import { NavBar, Footer } from '@/components/votewise/shared'

function Page() {
  const p = useSearchParams(); const org = p.get('org') || undefined
  return <div className="flex min-h-screen flex-col"><NavBar /><main className="flex-1"><RuleBuilder subdomain={org} /></main><Footer /></div>
}
export default function RulesPage() {
  return <Suspense fallback={<div className="grid min-h-screen place-items-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>}><Page /></Suspense>
}
