'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import {
  Vote, Shield, BarChart3, LogIn, LogOut, Menu, X, CheckCircle2, Clock,
  Users, Eye, ChevronRight, Sparkles, Lock, KeyRound, BadgeCheck, ScrollText,
  ArrowRight, Building2, Globe, FileCheck2, ShieldCheck, Award, Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ThemeToggle } from '@/components/votewise/theme-toggle'
import { VoterNotifications } from '@/components/votewise/voter-notifications'
import { cn } from '@/lib/utils'
import { useApp, View } from '@/lib/store'
import { useTranslation } from '@/lib/i18n'
import { api } from '@/lib/api'

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div className="relative">
        <Image
          src="/logo-votewise.png"
          alt="VoteWise"
          width={compact ? 32 : 36}
          height={compact ? 32 : 36}
          className="rounded-[10px] object-cover ring-1 ring-border/60"
          priority
        />
      </div>
      {!compact && (
        <div className="leading-tight">
          <div className="font-display text-[1.05rem] font-medium tracking-tight">VoteWise</div>
          <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Election Platform</div>
        </div>
      )}
    </div>
  )
}

export function NavBar() {
  const { view, setView, official, setOfficial, voterProfile } = useApp()
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  // Check auth on mount — runs on every page that uses NavBar
  useEffect(() => {
    if (!official) {
      api.me().then((d) => { if (d.valid) setOfficial(d.official) }).catch(() => {})
    }
  }, [])

  // Subtle shadow on scroll
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Helper: navigate to a view (works on both SPA and standalone pages)
  function goToView(v: string) {
    if (window.location.pathname === '/') {
      setView(v as any)
    } else {
      window.location.href = `/?view=${v}`
    }
  }

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
    <header
      className={cn(
        'sticky top-0 z-40 w-full border-b transition-all duration-300',
        scrolled
          ? 'border-border/60 bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/75'
          : 'border-transparent bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/50'
      )}
    >
      <div className="mx-auto flex h-14 max-w-[1152px] items-center justify-between gap-2 px-4 sm:h-16 sm:px-6">
        <button onClick={() => setView('home')} className="shrink-0" aria-label="VoteWise home">
          <Logo />
        </button>

        {/* Desktop: auth buttons + theme toggle */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {voterProfile && (
            <Button onClick={() => setView('voter-dashboard')} size="sm" className="gap-1.5">
              <BadgeCheck className="h-4 w-4" /> <span className="hidden sm:inline">{t('auth.myDashboard')}</span>
            </Button>
          )}
          {!official && (
            <Button variant="ghost" size="sm" onClick={() => goToView('official-login')} className="gap-1.5">
              <Lock className="h-4 w-4" /> <span className="hidden sm:inline">{t('auth.orgLogin')}</span><span className="sm:hidden">Login</span>
            </Button>
          )}
          {!official && (
            <Button size="sm" onClick={() => goToView('signup')} className="gap-1.5">
              <Sparkles className="h-4 w-4" /> <span className="hidden sm:inline">{t('auth.registerOrg')}</span><span className="sm:hidden">Register</span>
            </Button>
          )}
          {official && (
            <Button variant="ghost" size="sm" onClick={() => goToView('official')} className="gap-1.5">
              <BarChart3 className="h-4 w-4" /> <span className="hidden sm:inline">{t('auth.dashboard')}</span>
            </Button>
          )}
          {voterProfile && <VoterNotifications />}
          <ThemeToggle />
          {/* Mobile menu toggle */}
          <button className="sm:hidden grid h-9 w-9 place-items-center rounded-lg hover:bg-muted" onClick={() => setOpen((o) => !o)} aria-label="Toggle menu">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border/60 bg-background sm:hidden">
          <div className="mx-auto flex max-w-[1152px] flex-col gap-1 px-4 py-3">
            <Button variant="ghost" size="sm" onClick={() => { window.location.href = '/trust'; setOpen(false) }} className="justify-start text-sm">
              Trust &amp; Security
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { window.location.href = '/compliance'; setOpen(false) }} className="justify-start text-sm">
              Compliance
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { window.location.href = '/success-stories'; setOpen(false) }} className="justify-start text-sm">
              Success Stories
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { window.location.href = '/demo'; setOpen(false) }} className="justify-start text-sm">
              Demo Portal
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { window.location.href = '/status'; setOpen(false) }} className="justify-start text-sm">
              System Status
            </Button>
          </div>
        </div>
      )}
    </header>
  )
}

export function Footer() {
  const { setView } = useApp()
  const { t } = useTranslation()
  const year = new Date().getFullYear()

  function goToView(v: string) {
    if (window.location.pathname === '/') {
      setView(v as any)
    } else {
      window.location.href = `/?view=${v}`
    }
  }

  return (
    <footer className="mt-auto border-t border-border bg-secondary/30">
      {/* Trust bar — refined, hairline-divided */}
      <div className="border-b border-border/60 bg-primary/[0.03]">
        <div className="mx-auto grid max-w-[1152px] grid-cols-2 gap-x-6 gap-y-5 px-4 py-7 sm:grid-cols-4 sm:px-6">
          {[
            { icon: Shield, label: 'Voter ID + OTP', sub: t('publicResults.verified') },
            { icon: Lock, label: 'AES-256-GCM', sub: t('home.encryptedVoting') },
            { icon: BadgeCheck, label: t('voting.receipt'), sub: t('home.receiptAnchored') },
            { icon: ScrollText, label: 'Hash-Chained', sub: t('workspace.audit') },
          ].map((trust, i) => (
            <div key={trust.label} className="flex items-center gap-2.5">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/8 text-primary ring-1 ring-primary/10">
                <trust.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium">{trust.label}</div>
                <div className="text-[10px] text-muted-foreground truncate">{trust.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main footer — 4 columns */}
      <div className="mx-auto grid max-w-[1152px] gap-10 px-4 py-12 sm:px-6 md:grid-cols-5">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
            {t('home.heroBadge')}. {t('home.orgsSubtitle')}
          </p>
          <div className="mt-5 flex flex-wrap gap-1.5">
            {[
              { icon: Shield, label: t('home.encryptedVoting') },
              { icon: Lock, label: t('voting.ballotSecrecyProtected') },
              { icon: BadgeCheck, label: t('home.receiptAnchoredLabel') },
              { icon: ScrollText, label: t('workspace.audit') },
            ].map((b) => (
              <span key={b.label} className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
                <b.icon className="h-3 w-3" /> {b.label}
              </span>
            ))}
          </div>
        </div>

        <div>
          <h4 className="font-display text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Platform</h4>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><button onClick={() => setView('home')} className="text-foreground/80 transition-colors hover:text-foreground">{t('home.heroBadge')}</button></li>
            <li><button onClick={() => goToView('official-login')} className="text-foreground/80 transition-colors hover:text-foreground">{t('auth.organizationPortal')}</button></li>
            <li><button onClick={() => goToView('signup')} className="text-foreground/80 transition-colors hover:text-foreground">{t('home.registerYourOrg')}</button></li>
            <li><Link href="/demo" className="text-foreground/80 transition-colors hover:text-foreground">Demo Portal</Link></li>
            <li><Link href="/status" className="text-foreground/80 transition-colors hover:text-foreground">System Status</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-display text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Trust</h4>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><Link href="/trust" className="text-foreground/80 transition-colors hover:text-foreground">Trust &amp; Security</Link></li>
            <li><Link href="/compliance" className="text-foreground/80 transition-colors hover:text-foreground">Compliance</Link></li>
            <li><Link href="/success-stories" className="text-foreground/80 transition-colors hover:text-foreground">Success Stories</Link></li>
            <li><button onClick={() => setView('guide')} className="text-foreground/80 transition-colors hover:text-foreground">Voter Guide</button></li>
            <li><button onClick={() => setView('about')} className="text-foreground/80 transition-colors hover:text-foreground">About</button></li>
          </ul>
        </div>

        <div>
          <h4 className="font-display text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Principles</h4>
          <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
            <li>{t('home.signupFeature1')}</li>
            <li>{t('home.orgsTitle')}</li>
            <li>{t('home.securityBadge')}</li>
            <li>{t('home.hierarchyBadge')}</li>
            <li>{t('home.signupBadge')}</li>
          </ul>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-border/60">
        <div className="mx-auto flex max-w-[1152px] flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <p>© {year} VoteWise. {t('home.heroSubtitle')}</p>
          <p className="flex items-center gap-1.5">
            <span className="votewise-live-dot inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {t('home.heroBadge')}
          </p>
        </div>
      </div>
    </footer>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const key = (status || 'setup').toLowerCase()
  const map: Record<string, { label: string; cls: string; icon: any }> = {
    draft: { label: 'Draft', cls: 'bg-muted text-muted-foreground', icon: Clock },
    setup: { label: 'Setup', cls: 'bg-muted text-muted-foreground', icon: Clock },
    published: { label: 'Published', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300', icon: Sparkles },
    accreditation: { label: 'Accreditation', cls: 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300', icon: KeyRound },
    voting: { label: 'Voting Open', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300', icon: CheckCircle2 },
    open: { label: 'Voting Open', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300', icon: CheckCircle2 },
    closed: { label: 'Voting Closed', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300', icon: Clock },
    certified: { label: 'Certified', cls: 'bg-accent/20 text-accent-foreground', icon: BadgeCheck },
  }
  const m = map[key] || map.setup
  const Icon = m.icon
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium', m.cls)}>
      <Icon className="h-3 w-3" /> {m.label}
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
      <div className="vw-eyebrow justify-center">{label}</div>
      <div className="mt-2.5 flex items-center justify-center gap-2 font-mono text-2xl font-medium tabular-nums sm:text-3xl">
        <TimeBox v={h} u="h" />
        <span className="text-muted-foreground/40">:</span>
        <TimeBox v={m} u="m" />
        <span className="text-muted-foreground/40">:</span>
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
        <span className="vw-stat text-3xl text-primary">{pct}%</span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Turnout</span>
      </div>
    </div>
  )
}
