'use client'
import { Suspense, use, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { BallotView } from '@/components/votewise/ballot-view'
import { NavBar, Footer } from '@/components/votewise/shared'
import { VoterPicker } from '@/components/votewise/voter-picker'
import { Loader2 } from 'lucide-react'

function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const sp = useSearchParams()
  const org = sp.get('org') || undefined
  const preselectVoterId = sp.get('voterId') || undefined
  const [voterId, setVoterId] = useState<string | undefined>(preselectVoterId)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Defer the state update to avoid synchronous setState in effect.
    const t = setTimeout(() => setReady(true), 0)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="flex min-h-screen flex-col">
      <NavBar />
      <main className="flex-1">
        {!ready ? (
          <div className="grid min-h-[60vh] place-items-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : voterId ? (
          <BallotView electionId={id} subdomain={org} voterId={voterId} />
        ) : (
          <VoterPicker electionId={id} subdomain={org} onSelected={(vid) => setVoterId(vid)} />
        )}
      </main>
      <Footer />
    </div>
  )
}

export default function VotePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center"><Loader2 className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>}>
      <Page params={params} />
    </Suspense>
  )
}
