'use client'

import { useEffect, useState } from 'react'
import { useApp } from '@/lib/store'
import { getResultsSocket } from '@/lib/socket'
import { NavBar, Footer } from '@/components/votewise/shared'
import { LogoLoader } from '@/components/votewise/logo-loader'
import { HomeView } from '@/components/votewise/home'
import { VerifyView } from '@/components/votewise/verify'
import { VoteView, SuccessView, ReceiptVerifyView } from '@/components/votewise/vote'
import { VoterDashboard } from '@/components/votewise/voter-dashboard'
import { CompareCandidatesView } from '@/components/votewise/compare'
import { CertificateView } from '@/components/votewise/certificate'
import { GuideView } from '@/components/votewise/guide'
import { AboutView } from '@/components/votewise/about'
import { SignupView } from '@/components/votewise/signup'
import { OfficialLoginView, OfficialDashboard } from '@/components/votewise/official'
import { ObserverAnalyticsView } from '@/components/votewise/observer-analytics'
import { OrganizationsView } from '@/components/votewise/organizations'
import { WorkspaceView } from '@/components/votewise/workspace'
import { OnboardingWizard } from '@/components/votewise/onboarding-wizard'
import { VoterPortal } from '@/components/votewise/voter-portal'
import { ChatbotWidget } from '@/components/votewise/chatbot'
import { api } from '@/lib/api'

export default function Home() {
  const { view, hydrate, voterToken, official, setVoterProfile, setOfficial, setLive } = useApp()
  // Show the transformative logo loader on first load only.
  const [loading, setLoading] = useState(true)

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
    <>
      {loading && <LogoLoader onDone={() => setLoading(false)} />}
      <div className="flex min-h-screen flex-col">
        <a href="#main-content" className="skip-link">Skip to content</a>
        <NavBar />
        <main id="main-content" className="flex-1">
          {v === 'home' && <HomeView />}
          {v === 'verify' && <VerifyView />}
          {v === 'vote' && <VoteView />}
          {v === 'success' && <SuccessView />}
          {v === 'verify-receipt' && <ReceiptVerifyView />}
          {v === 'voter-dashboard' && <VoterDashboard />}
          {v === 'compare' && <CompareCandidatesView />}
          {v === 'certificate' && <CertificateView />}
          {v === 'guide' && <GuideView />}
          {v === 'about' && <AboutView />}
          {v === 'signup' && <SignupView />}
          {v === 'organizations' && <OrganizationsView />}
          {v === 'workspace' && <WorkspaceView />}
          {v === 'onboarding' && <OnboardingWizard onDone={() => useApp.getState().setView('workspace')} />}
          {v === 'voter-portal' && <VoterPortal />}
          {v === 'official-login' && <OfficialLoginView />}
          {v === 'official' && (official?.role === 'OBSERVER' ? <ObserverAnalyticsView /> : <OfficialDashboard />)}
        </main>
        <Footer />
        <ChatbotWidget />
      </div>
    </>
  )
}
