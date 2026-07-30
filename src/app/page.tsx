'use client'

import { useEffect } from 'react'
import { useApp } from '@/lib/store'
import { getResultsSocket } from '@/lib/socket'
import { NavBar, Footer } from '@/components/afrivote/shared'
import { HomeView } from '@/components/afrivote/home'
import { VerifyView } from '@/components/afrivote/verify'
import { VoteView, SuccessView, ReceiptVerifyView } from '@/components/afrivote/vote'
import { OfficialLoginView, OfficialDashboard } from '@/components/afrivote/official'
import { ObserverAnalyticsView } from '@/components/afrivote/observer-analytics'
import { ChatbotWidget } from '@/components/afrivote/chatbot'
import { api } from '@/lib/api'

export default function Home() {
  const { view, hydrate, voterToken, official, setVoterProfile, setOfficial, setLive } = useApp()

  useEffect(() => { hydrate() }, [hydrate])
  useEffect(() => {
    getResultsSocket()
    api.getResults().then((d) => { if (!d.hidden) setLive(d) }).catch(() => {})
  }, [setLive])

  // Validate voter session if a token exists.
  useEffect(() => {
    if (!voterToken) return
    api.getVoterSession().then((d) => { if (d.valid) setVoterProfile(d.voter) }).catch(() => {})
  }, [voterToken, setVoterProfile])

  // Validate official session (cookie-based) on mount.
  useEffect(() => {
    api.me().then((d) => { if (d.valid) setOfficial(d.official) }).catch(() => {})
  }, [setOfficial])

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }) }, [view])

  const v = view === 'admin-login' || view === 'observer-login' ? 'official-login'
    : view === 'admin' || view === 'observer' ? 'official'
    : view

  return (
    <div className="flex min-h-screen flex-col">
      <NavBar />
      <main className="flex-1">
        {v === 'home' && <HomeView />}
        {v === 'verify' && <VerifyView />}
        {v === 'vote' && <VoteView />}
        {v === 'success' && <SuccessView />}
        {v === 'verify-receipt' && <ReceiptVerifyView />}
        {v === 'official-login' && <OfficialLoginView />}
        {v === 'official' && (official?.role === 'OBSERVER' ? <ObserverAnalyticsView /> : <OfficialDashboard />)}
      </main>
      <Footer />
      <ChatbotWidget />
    </div>
  )
}
