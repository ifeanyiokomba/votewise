'use client'

import { useEffect } from 'react'
import { useApp } from '@/lib/store'
import { getResultsSocket } from '@/lib/socket'
import { NavBar, Footer } from '@/components/afrivote/shared'
import { HomeView } from '@/components/afrivote/home'
import { VerifyView } from '@/components/afrivote/verify'
import { VoteView, SuccessView, ReceiptVerifyView } from '@/components/afrivote/vote'
import { AdminLoginView, AdminDashboard } from '@/components/afrivote/admin'
import { ObserverLoginView, ObserverDashboard } from '@/components/afrivote/observer'
import { ChatbotWidget } from '@/components/afrivote/chatbot'

export default function Home() {
  const { view, hydrate, voterToken, adminToken, observerToken, setVoterProfile, setAdmin, setObserver, election, settings } = useApp()

  // Hydrate tokens from localStorage on mount.
  useEffect(() => { hydrate() }, [hydrate])

  // Connect to the live-results WebSocket once + REST fallback so the UI always
  // has data even if the socket takes a moment to (re)connect.
  useEffect(() => {
    getResultsSocket()
    import('@/lib/api').then(({ api }) => {
      api.getResults().then((d) => { if (!d.hidden) useApp.getState().setLive(d) }).catch(() => {})
    })
  }, [])

  // If we have a voter token, validate the session & load profile.
  useEffect(() => {
    if (!voterToken) return
    import('@/lib/api').then(({ api }) => {
      api.getVoterSession().then((d) => { if (d.valid) setVoterProfile(d.voter) }).catch(() => {})
    })
  }, [voterToken, setVoterProfile])

  // Validate admin token.
  useEffect(() => {
    if (!adminToken) return
    import('@/lib/api').then(({ api }) => {
      api.adminSession().then((d) => { if (d.valid) setAdmin(d.admin) }).catch(() => {})
    })
  }, [adminToken, setAdmin])

  // Validate observer token.
  useEffect(() => {
    if (!observerToken) return
    import('@/lib/api').then(({ api }) => {
      api.observerSession().then((d) => { if (d.valid) setObserver(d.observer) }).catch(() => {})
    })
  }, [observerToken, setObserver])

  // Scroll to top on view change.
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }) }, [view])

  return (
    <div className="flex min-h-screen flex-col">
      <NavBar />
      <main className="flex-1">
        {view === 'home' && <HomeView />}
        {view === 'verify' && <VerifyView />}
        {view === 'vote' && <VoteView />}
        {view === 'success' && <SuccessView />}
        {view === 'verify-receipt' && <ReceiptVerifyView />}
        {view === 'admin-login' && <AdminLoginView />}
        {view === 'admin' && <AdminDashboard />}
        {view === 'observer-login' && <ObserverLoginView />}
        {view === 'observer' && <ObserverDashboard />}
      </main>
      <Footer />
      <ChatbotWidget />
    </div>
  )
}
