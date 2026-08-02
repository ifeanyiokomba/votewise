'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import {
  Vote, Shield, BarChart3, LogIn, LogOut, Menu, X, CheckCircle2, Clock,
  Users, Eye, ChevronRight, Sparkles, Lock, KeyRound, BadgeCheck, ScrollText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ThemeToggle } from '@/components/votewise/theme-toggle'
import { VoterNotifications } from '@/components/votewise/voter-notifications'
import { cn } from '@/lib/utils'
import { useApp, View } from '@/lib/store'
import { useTranslation } from '@/lib/i18n'
import { api } from '@/lib/api'

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Image src="/logo-votewise.png" alt="VoteWise" width={36} height={36} className="h-9 w-9 rounded-xl" priority />
      <div className="leading-tight">
        <div className="font-display text-lg font-bold tracking-tight">VoteWise</div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Election Platform</div>
      </div>
    </div>
  )
}

export function NavBar() {
  const { view, setView, official, setOfficial, voterProfile } = useApp()
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  // Check auth on mount — runs on every page that uses NavBar
  useEffect(() => {
    if (!official) {
      api.me().then((d) => { if (d.valid) setOfficial(d.official) }).catch(() => {})
    }
  }, [])

  // Helper: navigate to a view (works on both SPA and standalone pages)
  function goToView(v: string) {
    if (window.location.pathname === '/') {
      setView(v as any)
    } else {
      window.location.href = `/?view=${v}`
    }
  }

  // Localized nav items — recomputed per render so they pick up the
  // current language from the store (e.g. when the user switches to French).
  const NAV_ITEMS: { label: string; target: string }[] = [
    { label: t('home.featuresBadge'), target: 'features' },
    { label: t('home.productsBadge'), target: 'products' },
    { label: t('home.pricingBadge'), target: 'pricing' },
    { label: t('home.testimonialsBadge'), target: 'testimonials' },
    { label: t('home.securityBadge'), target: 'security' },
    { label: t('home.docsBadge'), target: 'docs' },
    { label: t('home.contactBadge'), target: 'contact' },
  ]

  function scrollTo(id: string) {
    setOpen(false)
    if (view !== 'home') {
      setView('home')
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 80)
    } else {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <button onClick={() => setView('home')} className="shrink-0">
          <Logo />
        </button>

        <nav className="hidden items-center gap-1 lg:flex">
          {NAV_ITEMS.map((n) => (
            <Button key={n.label} variant="ghost" size="sm" onClick={() => scrollTo(n.target)} className="text-sm">
              {n.label}
            </Button>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {voterProfile && (
            <Button onClick={() => setView('voter-dashboard')} size="sm" className="gap-1.5">
              <BadgeCheck className="h-4 w-4" /> {t('auth.myDashboard')}
            </Button>
          )}
          {!official && (
            <Button variant="outline" size="sm" onClick={() => goToView('official-login')} className="gap-1.5">
              <Lock className="h-4 w-4" /> {t('auth.orgLogin')}
            </Button>
          )}
          {!official && (
            <Button size="sm" onClick={() => goToView('signup')} className="gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90">
              <Sparkles className="h-4 w-4" /> {t('auth.registerOrg')}
            </Button>
          )}
          {official && (
            <Button variant="outline" size="sm" onClick={() => goToView('official')} className="gap-1.5">
              <BarChart3 className="h-4 w-4" /> {t('auth.dashboard')}
            </Button>
          )}
          {voterProfile && <VoterNotifications />}
          <ThemeToggle />
        </div>

        <button className="md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Toggle menu">
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border/60 bg-background md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3">
            {NAV_ITEMS.map((n) => (
              <Button key={n.label} variant="ghost" size="sm" onClick={() => scrollTo(n.target)} className="justify-start">
                {n.label}
              </Button>
            ))}
            <div className="my-1 h-px bg-border" />
            {voterProfile && (
              <Button onClick={() => { setView('voter-dashboard'); setOpen(false) }} size="sm" className="gap-1.5">
                <BadgeCheck className="h-4 w-4" /> {t('auth.myDashboard')}
              </Button>
            )}
            {!official && (
              <Button variant="outline" size="sm" onClick={() => { goToView('official-login'); setOpen(false) }} className="gap-1.5">
                <Lock className="h-4 w-4" /> {t('auth.organizationPortal')}
              </Button>
            )}
            {!official && (
              <Button size="sm" onClick={() => { goToView('signup'); setOpen(false) }} className="gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90">
                <Sparkles className="h-4 w-4" /> {t('home.registerYourOrg')}
              </Button>
            )}
            {official && (
              <Button variant="outline" size="sm" onClick={() => { goToView('official'); setOpen(false) }} className="gap-1.5">
                <BarChart3 className="h-4 w-4" /> {t('auth.organizationPortal')}
              </Button>
            )}
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-muted-foreground">{t('common.theme')}</span>
              <ThemeToggle />
            </div>
          </div>
        </div>
      )}
    </header>
  )
}

export function Footer() {
  const { setView } = useApp()
  const { t } = useTranslation()
  return (
    <footer className="mt-auto border-t border-border/60 bg-secondary/40">
      {/* Trust bar */}
      <div className="border-b border-border/60 bg-primary/5">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-4 py-6 sm:grid-cols-4 sm:px-6">
          {[
            { icon: Shield, label: 'Voter ID + OTP', sub: t('publicResults.verified') },
            { icon: Lock, label: 'AES-256-GCM', sub: t('home.encryptedVoting') },
            { icon: BadgeCheck, label: t('voting.receipt'), sub: t('home.receiptAnchored') },
            { icon: ScrollText, label: 'Hash-Chained', sub: t('workspace.audit') },
          ].map((trust) => (
            <div key={trust.label} className="flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <trust.icon className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs font-semibold">{trust.label}</div>
                <div className="text-[10px] text-muted-foreground">{trust.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">
            {t('home.heroBadge')}. {t('home.orgsSubtitle')}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="secondary" className="gap-1"><Shield className="h-3 w-3" /> {t('home.encryptedVoting')}</Badge>
            <Badge variant="secondary" className="gap-1"><Lock className="h-3 w-3" /> {t('voting.ballotSecrecyProtected')}</Badge>
            <Badge variant="secondary" className="gap-1"><BadgeCheck className="h-3 w-3" /> {t('home.receiptAnchoredLabel')}</Badge>
            <Badge variant="secondary" className="gap-1"><ScrollText className="h-3 w-3" /> {t('workspace.audit')}</Badge>
          </div>
        </div>
        <div>
          <h4 className="font-display text-sm font-semibold">{t('home.productsBadge')}</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><button onClick={() => setView('home')} className="hover:text-foreground">{t('home.heroBadge')}</button></li>
            <li><button onClick={() => goToView('official-login')} className="hover:text-foreground">{t('auth.organizationPortal')}</button></li>
            <li><button onClick={() => goToView('signup')} className="hover:text-foreground">{t('home.registerYourOrg')}</button></li>
          </ul>
        </div>
        <div>
          <h4 className="font-display text-sm font-semibold">{t('home.principlesBadge')}</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>{t('home.signupFeature1')}</li>
            <li>{t('home.orgsTitle')}</li>
            <li>{t('home.securityBadge')}</li>
            <li>{t('home.hierarchyBadge')}</li>
            <li>{t('home.signupBadge')}</li>
            <li>{t('home.principlesSubtitle')}</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/60">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <p>© {new Date().getFullYear()} VoteWise. {t('home.heroSubtitle')}</p>
          <p className="flex items-center gap-1.5">
            <span className="votewise-live-dot inline-block h-2 w-2 rounded-full bg-emerald-500" />
            {t('home.heroBadge')}
          </p>
        </div>
      </div>
    </footer>
  )
}

export function StatusBadge({ status }: { status: string }) {
  // Normalise v2 uppercase statuses (DRAFT/PUBLISHED/VOTING/CLOSED/CERTIFIED)
  // and v1 lowercase (setup/published/open/closed/certified) to a common key.
  const key = (status || 'setup').toLowerCase()
  const map: Record<string, { label: string; cls: string; icon: any }> = {
    draft: { label: 'Draft', cls: 'bg-muted text-muted-foreground', icon: Clock },
    setup: { label: 'Setup', cls: 'bg-muted text-muted-foreground', icon: Clock },
    published: { label: 'Published', cls: 'bg-blue-100 text-blue-700', icon: Sparkles },
    accreditation: { label: 'Accreditation', cls: 'bg-purple-100 text-purple-700', icon: KeyRound },
    voting: { label: 'Voting Open', cls: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
    open: { label: 'Voting Open', cls: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
    closed: { label: 'Voting Closed', cls: 'bg-amber-100 text-amber-700', icon: Clock },
    certified: { label: 'Certified', cls: 'bg-accent text-accent-foreground', icon: BadgeCheck },
  }
  const m = map[key] || map.setup
  const Icon = m.icon
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold', m.cls)}>
      <Icon className="h-3.5 w-3.5" /> {m.label}
    </span>
  )
}

export function Countdown({ start, end, status }: { start: Date | string; end: Date | string; status: string }) {
  const startD = new Date(start)
  const endD = new Date(end)
  const [now, setNow] = useState(Date.now())
  const { t } = useTranslation()
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])
  const target = now < startD.getTime() ? startD : endD
  const diff = Math.max(0, target.getTime() - now)
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  const s = Math.floor((diff % 60_000) / 1000)
  const label = now < startD.getTime() ? t('election.votingOpensIn') : now < endD.getTime() ? t('election.votingClosesIn') : t('election.votingEnded')
  void status

  return (
    <div className="rounded-xl border border-border bg-card p-4 text-center">
      <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="mt-2 flex items-center justify-center gap-2 font-mono text-2xl font-bold tabular-nums sm:text-3xl">
        <TimeBox v={h} u="h" />
        <span className="text-muted-foreground">:</span>
        <TimeBox v={m} u="m" />
        <span className="text-muted-foreground">:</span>
        <TimeBox v={s} u="s" />
      </div>
    </div>
  )
}
function TimeBox({ v, u }: { v: number; u: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-primary">{String(v).padStart(2, '0')}</span>
      <span className="text-[10px] uppercase text-muted-foreground">{u}</span>
    </div>
  )
}

export function TurnoutRing({ voted, total, pct }: { voted: number; total: number; pct: number }) {
  const r = 52
  const c = 2 * Math.PI * r
  const offset = c - (pct / 100) * c
  return (
    <div className="relative grid place-items-center">
      <svg width="140" height="140" viewBox="0 0 140 140" className="-rotate-90">
        <circle cx="70" cy="70" r={r} fill="none" stroke="currentColor" strokeWidth="10" className="text-muted/40" />
        <circle
          cx="70" cy="70" r={r} fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round"
          className="text-primary votewise-bar-anim"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-display text-2xl font-bold text-primary">{pct}%</span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Turnout</span>
      </div>
    </div>
  )
}
