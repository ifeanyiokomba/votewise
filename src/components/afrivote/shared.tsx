'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  Vote, Shield, BarChart3, LogIn, LogOut, Menu, X, CheckCircle2, Clock,
  Users, Eye, ChevronRight, Sparkles, Lock, KeyRound, BadgeCheck, ScrollText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ThemeToggle } from '@/components/afrivote/theme-toggle'
import { VoterNotifications } from '@/components/afrivote/voter-notifications'
import { cn } from '@/lib/utils'
import { useApp, View } from '@/lib/store'
import { api } from '@/lib/api'

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="relative grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <Vote className="h-5 w-5" />
        <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-accent text-[9px] font-bold text-accent-foreground ring-2 ring-background">
          ✓
        </span>
      </div>
      <div className="leading-tight">
        <div className="font-display text-lg font-bold tracking-tight">AfriVote<span className="text-accent"> SUG</span></div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Federal University Elections</div>
      </div>
    </div>
  )
}

const NAV_ITEMS: { label: string; target: string; view?: View }[] = [
  { label: 'Live Results', target: 'results' },
  { label: 'Candidates', target: 'candidates' },
  { label: 'Timetable', target: 'timetable' },
  { label: 'How It Works', target: 'how' },
  { label: 'FAQ', target: 'faq' },
  { label: 'Verify Receipt', target: 'receipt' },
]

export function NavBar() {
  const { view, setView, official, voterProfile } = useApp()
  const [open, setOpen] = useState(false)

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

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((n) => (
            <Button key={n.label} variant="ghost" size="sm" onClick={() => scrollTo(n.target)} className="text-sm">
              {n.label}
            </Button>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {!voterProfile && (
            <Button onClick={() => setView('verify')} size="sm" className="gap-1.5">
              <Shield className="h-4 w-4" /> Cast Your Vote
            </Button>
          )}
          {voterProfile && (
            <Button onClick={() => setView('voter-dashboard')} size="sm" className="gap-1.5">
              <BadgeCheck className="h-4 w-4" /> My Dashboard
            </Button>
          )}
          {!official && (
            <Button variant="outline" size="sm" onClick={() => setView('official-login')} className="gap-1.5">
              <Lock className="h-4 w-4" /> Official Portal
            </Button>
          )}
          {!official && (
            <Button size="sm" onClick={() => setView('signup')} className="gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90">
              <Sparkles className="h-4 w-4" /> Sign Up
            </Button>
          )}
          {official && (
            <Button variant="outline" size="sm" onClick={() => setView('official')} className="gap-1.5">
              <BarChart3 className="h-4 w-4" /> {official.role.split('_').map((w: string) => w[0] + w.slice(1).toLowerCase()).join(' ')} Dashboard
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
            {!voterProfile && (
              <Button onClick={() => { setView('verify'); setOpen(false) }} size="sm" className="gap-1.5">
                <Shield className="h-4 w-4" /> Cast Your Vote
              </Button>
            )}
            {voterProfile && (
              <Button onClick={() => { setView('vote'); setOpen(false) }} size="sm" className="gap-1.5">
                <BadgeCheck className="h-4 w-4" /> Continue Voting
              </Button>
            )}
            {!official && (
              <Button variant="outline" size="sm" onClick={() => { setView('official-login'); setOpen(false) }} className="gap-1.5">
                <Lock className="h-4 w-4" /> Official Portal
              </Button>
            )}
            {!official && (
              <Button size="sm" onClick={() => { setView('signup'); setOpen(false) }} className="gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90">
                <Sparkles className="h-4 w-4" /> Sign Up Your Organization
              </Button>
            )}
            {official && (
              <Button variant="outline" size="sm" onClick={() => { setView('official'); setOpen(false) }} className="gap-1.5">
                <BarChart3 className="h-4 w-4" /> Dashboard
              </Button>
            )}
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-muted-foreground">Theme</span>
              <ThemeToggle />
            </div>
          </div>
        </div>
      )}
    </header>
  )
}

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border/60 bg-secondary/40">
      {/* Trust bar */}
      <div className="border-b border-border/60 bg-primary/5">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-4 py-6 sm:grid-cols-4 sm:px-6">
          {[
            { icon: Shield, label: 'Matric + OTP', sub: 'Verified' },
            { icon: Lock, label: 'AES-256-GCM', sub: 'Encrypted' },
            { icon: BadgeCheck, label: 'Receipt', sub: 'Anchored' },
            { icon: ScrollText, label: 'Hash-Chained', sub: 'Audit Log' },
          ].map((t) => (
            <div key={t.label} className="flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <t.icon className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs font-semibold">{t.label}</div>
                <div className="text-[10px] text-muted-foreground">{t.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">
            A secure, transparent, and high-capacity electronic voting platform built for the
            Students&apos; Union Government (SUG) elections of a Nigerian Federal University.
            Every vote is verifiable. Every action is audited.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="secondary" className="gap-1"><Shield className="h-3 w-3" /> Matric + OTP Verified</Badge>
            <Badge variant="secondary" className="gap-1"><Lock className="h-3 w-3" /> Ballot Secrecy</Badge>
            <Badge variant="secondary" className="gap-1"><BadgeCheck className="h-3 w-3" /> Receipt-Anchored</Badge>
          </div>
        </div>
        <div>
          <h4 className="font-display text-sm font-semibold">Election</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>Live Results</li>
            <li>Candidates</li>
            <li>Timetable</li>
            <li>How It Works</li>
            <li>Verify Your Vote</li>
          </ul>
        </div>
        <div>
          <h4 className="font-display text-sm font-semibold">Electoral Committee</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>Admin Portal</li>
            <li>Observer Desk</li>
            <li>Audit Logs</li>
            <li>Support &amp; Help</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/60">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <p>© {new Date().getFullYear()} AfriVote SUG. Built for transparent student democracy.</p>
          <p className="flex items-center gap-1.5">
            <span className="afrivote-live-dot inline-block h-2 w-2 rounded-full bg-emerald-500" />
            Results stream live via secure WebSocket
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
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const target = now < startD.getTime() ? startD : endD
  const diff = Math.max(0, target.getTime() - now)
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  const s = Math.floor((diff % 60_000) / 1000)
  const label = now < startD.getTime() ? 'Voting opens in' : now < endD.getTime() ? 'Voting closes in' : 'Voting has ended'

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
          className="text-primary afrivote-bar-anim"
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
