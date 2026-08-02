'use client'

// =============================================================================
// VoteWise — Election Operations Console (Chapter 16A — frontend)
// =============================================================================
// The org admin's "command center" on election day. A single live screen
// with 8 widgets in a responsive grid (no tabs — everything visible at once
// on desktop, stacked on mobile).
//
//   Widget 1 — Live Voter Activity Feed     (spans 2 cols on desktop)
//   Widget 2 — OTVP Delivery Queue
//   Widget 3 — Active Support Chats
//   Widget 4 — Current Turnout              (circular progress ring)
//   Widget 5 — System Health
//   Widget 6 — Fraud Alerts
//   Widget 7 — Announcement Broadcaster
//   Widget 8 — Quick Actions
//
// Palette: emerald / gold / amber / zinc / red ONLY — NO indigo, NO blue.
// Default theme is DARK — every badge has explicit dark: variants.
// Auth gate: requires a logged-in official. Falls back to a login card.
//
// Route: /workspace/election-ops?org=<subdomain>&election=<id>
// =============================================================================

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import {
  Activity, AlertCircle, AlertTriangle, ArrowLeft, BadgeCheck,
  BellRing, Building2, CheckCircle2, Clock, Database,
  Globe, Headphones, KeyRound, Loader2, Lock, LockKeyhole,
  Mail, Megaphone, MessageSquare, RefreshCw, Send, Server,
  ShieldAlert, ShieldCheck, Siren, Smartphone, Timer,
  Unlock, Vote, XCircle, Zap, type LucideIcon,
} from 'lucide-react'
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ---------------------------------------------------------------------------
// Palette + style maps (emerald / gold / amber / zinc / red only — NO indigo/blue)
// ---------------------------------------------------------------------------

const PLATFORM_STATUS_STYLE: Record<string, { badge: string; dot: string; label: string }> = {
  OPERATIONAL: {
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    dot: 'bg-emerald-500',
    label: 'Operational',
  },
  DEGRADED: {
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    dot: 'bg-amber-500',
    label: 'Degraded',
  },
  PARTIAL_OUTAGE: {
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 ring-1 ring-amber-300/40 dark:ring-amber-700/40',
    dot: 'bg-amber-500',
    label: 'Partial Outage',
  },
  MAJOR_OUTAGE: {
    badge: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300 ring-1 ring-red-400/40 dark:ring-red-700/40',
    dot: 'bg-red-500',
    label: 'Major Outage',
  },
  UNKNOWN: {
    badge: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-300',
    dot: 'bg-zinc-400',
    label: 'Unknown',
  },
}

const SERVICE_HEALTH_DOT: Record<string, string> = {
  HEALTHY: 'bg-emerald-500',
  DEGRADED: 'bg-amber-500',
  UNHEALTHY: 'bg-red-500',
  UNKNOWN: 'bg-zinc-400',
}

const CONVERSATION_STATUS_STYLE: Record<string, string> = {
  NEW: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300',
  ASSIGNED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  WAITING_VOTER: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300',
  WAITING_STAFF: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  ESCALATED: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300 ring-1 ring-red-300/40 dark:ring-red-700/40',
  RESOLVED: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-300',
  CLOSED: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-300',
}

const PRIORITY_STYLE: Record<string, string> = {
  URGENT: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  HIGH: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  NORMAL: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300',
  LOW: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-300',
}

const SEVERITY_STYLE: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300 ring-1 ring-red-400/40 dark:ring-red-700/40',
  HIGH: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  MEDIUM: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  LOW: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300',
  INFO: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-300',
}

const BROADCAST_TYPE_STYLE: Record<string, { badge: string; icon: LucideIcon }> = {
  INFO: { badge: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300', icon: BellRing },
  SUCCESS: { badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', icon: CheckCircle2 },
  WARNING: { badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300', icon: AlertTriangle },
  CRITICAL: { badge: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300', icon: Siren },
  ANNOUNCEMENT: { badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', icon: Megaphone },
}

// Voter-activity action color (for the live feed)
const ACTION_COLOR: Record<string, string> = {
  VOTE_RECORDED: 'text-emerald-600 dark:text-emerald-400',
  VOTE_CAST: 'text-emerald-600 dark:text-emerald-400',
  OTP_VERIFIED: 'text-emerald-600 dark:text-emerald-400',
  ACCREDIT: 'text-emerald-600 dark:text-emerald-400',
  OTP_FAILED: 'text-amber-600 dark:text-amber-400',
  SESSION_EXPIRED: 'text-amber-600 dark:text-amber-400',
  FLAG: 'text-red-600 dark:text-red-400',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    const diff = Date.now() - new Date(iso).getTime()
    const sec = Math.floor(diff / 1000)
    if (sec < 5) return 'just now'
    if (sec < 60) return `${sec}s ago`
    const min = Math.floor(sec / 60)
    if (min < 60) return `${min}m ago`
    const hr = Math.floor(min / 60)
    if (hr < 24) return `${hr}h ago`
    const day = Math.floor(hr / 24)
    if (day < 30) return `${day}d ago`
    return new Date(iso).toLocaleDateString()
  } catch {
    return iso
  }
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '0'
  return n.toLocaleString('en-NG')
}

function truncateId(id: string | null | undefined, len = 8): string {
  if (!id) return '—'
  if (id.length <= len) return id
  return `${id.slice(0, len)}…`
}

function deliveryRateColor(rate: number): string {
  if (rate >= 90) return 'text-emerald-600 dark:text-emerald-400'
  if (rate >= 70) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

function deliveryRateRingColor(rate: number): string {
  if (rate >= 90) return '#10b981' // emerald-500
  if (rate >= 70) return '#f59e0b' // amber-500
  return '#ef4444' // red-500
}

function turnoutRingColor(pct: number): string {
  if (pct >= 60) return '#10b981'
  if (pct >= 30) return '#f59e0b'
  return '#a1a1aa'
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function EmptyState({ icon: Icon, title, hint }: { icon: LucideIcon; title: string; hint: string }) {
  return (
    <div className="py-10 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-muted/60 text-muted-foreground">
        <Icon className="h-6 w-6" />
      </div>
      <p className="mt-3 text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="py-10 text-center">
      <AlertCircle className="mx-auto h-9 w-9 text-destructive/50" />
      <p className="mt-2 text-sm font-medium">Something went wrong</p>
      <p className="mt-1 text-xs text-muted-foreground">{message}</p>
      {onRetry && (
        <Button onClick={onRetry} size="sm" variant="outline" className="mt-3 gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </Button>
      )}
    </div>
  )
}

function LoadingRow({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-10">
      <Loader2 className="h-5 w-5 animate-spin text-primary" />
      <span className="ml-2 text-sm text-muted-foreground">{label}</span>
    </div>
  )
}

function MiniStat({ label, value, tone = 'zinc' }: { label: string; value: number | string; tone?: 'zinc' | 'emerald' | 'amber' | 'red' | 'gold' }) {
  const toneClass = {
    zinc: 'bg-zinc-50 dark:bg-zinc-500/10',
    emerald: 'bg-emerald-50 dark:bg-emerald-500/10',
    amber: 'bg-amber-50 dark:bg-amber-500/10',
    red: 'bg-red-50 dark:bg-red-500/10',
    gold: 'bg-amber-50 dark:bg-amber-500/10',
  }[tone]
  const valueClass = {
    zinc: 'text-zinc-800 dark:text-zinc-200',
    emerald: 'text-emerald-700 dark:text-emerald-300',
    amber: 'text-amber-700 dark:text-amber-300',
    red: 'text-red-700 dark:text-red-300',
    gold: 'text-amber-700 dark:text-amber-300',
  }[tone]
  return (
    <div className={cn('rounded-lg px-2.5 py-1.5', toneClass)}>
      <div className={cn('text-base font-bold tabular-nums leading-none sm:text-lg', valueClass)}>
        {typeof value === 'number' ? formatNumber(value) : value}
      </div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground leading-none">
        {label}
      </div>
    </div>
  )
}

function CountdownPill({ seconds, onRefresh }: { seconds: number; onRefresh: () => void }) {
  return (
    <button
      onClick={onRefresh}
      className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-card px-2 py-0.5 text-[10px] font-medium text-muted-foreground transition hover:bg-muted/60"
      title="Click to refresh now"
    >
      <Timer className="h-3 w-3" />
      Refreshing in {seconds}s
    </button>
  )
}

// ---------------------------------------------------------------------------
// Auto-refresh hook — calls `fn` on mount + every `intervalMs`, plus a 1s tick
// countdown the widget can show.
// ---------------------------------------------------------------------------

function useAutoRefresh(fn: () => void, intervalMs: number, deps: any[] = []) {
  const [countdown, setCountdown] = useState(Math.floor(intervalMs / 1000))
  const fnRef = useRef(fn)
  useEffect(() => { fnRef.current = fn })

  const refresh = useCallback(() => {
    fnRef.current()
    setCountdown(Math.floor(intervalMs / 1000))
  }, [intervalMs])

  // Initial load + re-load when deps change
  useEffect(() => {
    fnRef.current()
  }, deps)

  // 1s countdown tick
  useEffect(() => {
    const tick = setInterval(() => {
      setCountdown((c) => (c <= 1 ? Math.floor(intervalMs / 1000) : c - 1))
    }, 1000)
    return () => clearInterval(tick)
  }, [intervalMs])

  // Polling interval
  useEffect(() => {
    const poll = setInterval(() => {
      fnRef.current()
    }, intervalMs)
    return () => clearInterval(poll)
  }, [intervalMs])

  return { countdown, refresh }
}

// ---------------------------------------------------------------------------
// Circular progress ring (SVG) — used by turnout widget
// ---------------------------------------------------------------------------

function CircularProgress({
  value, size = 120, stroke = 10, color = '#10b981', label, sublabel,
}: {
  value: number
  size?: number
  stroke?: number
  color?: string
  label?: string
  sublabel?: string
}) {
  const radius = (size - stroke) / 2
  const circ = 2 * Math.PI * radius
  const pct = Math.max(0, Math.min(100, value))
  const offset = circ - (pct / 100) * circ
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke="currentColor" strokeWidth={stroke} fill="none"
          className="text-muted/40"
        />
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          {label && (
            <div className="text-2xl font-bold tabular-nums leading-none">{label}</div>
          )}
          {sublabel && (
            <div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground leading-none">
              {sublabel}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Widget card wrapper
// ---------------------------------------------------------------------------

function WidgetCard({
  title, icon: Icon, accent = 'emerald', span, children, action,
}: {
  title: string
  icon: LucideIcon
  accent?: 'emerald' | 'amber' | 'red' | 'zinc' | 'gold'
  span?: 'full' | 'half'
  children: React.ReactNode
  action?: React.ReactNode
}) {
  const accentText = {
    emerald: 'text-emerald-600 dark:text-emerald-400',
    amber: 'text-amber-600 dark:text-amber-400',
    red: 'text-red-600 dark:text-red-400',
    zinc: 'text-zinc-600 dark:text-zinc-300',
    gold: 'text-amber-600 dark:text-amber-400',
  }[accent]
  const spanClass = span === 'full' ? 'xl:col-span-2' : ''
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={spanClass}
    >
      <Card className="votewise-card-glow h-full">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Icon className={cn('h-4 w-4', accentText)} />
              {title}
            </CardTitle>
            {action}
          </div>
        </CardHeader>
        <CardContent className="pt-0">{children}</CardContent>
      </Card>
    </motion.div>
  )
}

// ===========================================================================
// MAIN COMPONENT
// ===========================================================================

export function ElectionOpsConsole() {
  return (
    <Suspense fallback={<BootLoader />}>
      <ElectionOpsConsoleInner />
    </Suspense>
  )
}

function BootLoader() {
  return (
    <div className="grid min-h-screen place-items-center bg-secondary/20">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading Election Operations Console…</p>
      </div>
    </div>
  )
}

function ElectionOpsConsoleInner() {
  const params = useSearchParams()
  const subdomain = params.get('org') || 'demo'
  const initialElection = params.get('election') || ''

  const [authed, setAuthed] = useState(false)
  const [official, setOfficial] = useState<any>(null)
  const [authLoading, setAuthLoading] = useState(true)

  // Org resolution — subdomain → organizationId (UUID) + elections list
  const [orgId, setOrgId] = useState<string | null>(null)
  const [orgName, setOrgName] = useState<string>(subdomain)
  const [elections, setElections] = useState<any[]>([])
  const [electionId, setElectionId] = useState<string>(initialElection)
  const [resolving, setResolving] = useState(true)

  // Auth check on mount
  useEffect(() => {
    let active = true
    api
      .me()
      .then((d) => {
        if (!active) return
        if (d.valid) {
          setOfficial(d.official)
          setAuthed(true)
        }
      })
      .catch(() => {})
      .finally(() => active && setAuthLoading(false))
    return () => { active = false }
  }, [])

  // Resolve subdomain → orgId via the public portal endpoint (no auth needed)
  useEffect(() => {
    let active = true
    fetch(`/api/portal/${encodeURIComponent(subdomain)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!active) return
        if (d?.organization?.id) {
          setOrgId(d.organization.id)
          setOrgName(d.organization.name || subdomain)
          const all = [
            ...(d.activeElections || []),
            ...(d.upcomingElections || []),
            ...(d.completedElections || []),
          ]
          setElections(all)
          // Auto-select first active election if none chosen
          if (!electionId && all.length > 0) {
            setElectionId(all[0].id)
          }
        }
      })
      .catch(() => {})
      .finally(() => active && setResolving(false))
    return () => { active = false }
  }, [subdomain])

  if (authLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-secondary/20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!authed) {
    return <LoginCard subdomain={subdomain} onSuccess={(o) => { setOfficial(o); setAuthed(true) }} />
  }

  return (
    <div className="min-h-screen bg-secondary/20">
      <ConsoleHeader
        subdomain={subdomain}
        orgName={orgName}
        official={official}
        elections={elections}
        electionId={electionId}
        onElectionChange={setElectionId}
      />
      <div className="mx-auto max-w-[1600px] px-3 py-5 sm:px-5 sm:py-6">
        {resolving ? (
          <div className="grid place-items-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">Resolving organization…</p>
          </div>
        ) : !orgId ? (
          <Card className="votewise-card-glow mx-auto max-w-lg">
            <CardContent className="py-10 text-center">
              <AlertCircle className="mx-auto h-10 w-10 text-amber-500" />
              <p className="mt-3 font-semibold">Organization not found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Could not resolve &quot;{subdomain}&quot;. Check the <code className="rounded bg-muted px-1">?org=</code> query param.
              </p>
              <Button asChild variant="outline" size="sm" className="mt-4 gap-1.5">
                <Link href="/workspace"><ArrowLeft className="h-4 w-4" /> Back to Workspace</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {/* Widget 1 — Live Voter Activity Feed (spans 2 cols on desktop) */}
            <Widget1LiveFeed orgId={orgId} electionId={electionId} />

            {/* Widget 2 — OTVP Delivery Queue */}
            <Widget2OtpQueue orgId={orgId} electionId={electionId} />

            {/* Widget 3 — Active Support Chats */}
            <Widget3SupportChats orgId={orgId} subdomain={subdomain} />

            {/* Widget 4 — Current Turnout */}
            <Widget4Turnout electionId={electionId} subdomain={subdomain} />

            {/* Widget 5 — System Health */}
            <Widget5SystemHealth />

            {/* Widget 6 — Fraud Alerts */}
            <Widget6FraudAlerts subdomain={subdomain} />

            {/* Widget 7 — Announcement Broadcaster */}
            <Widget7Broadcaster official={official} />

            {/* Widget 8 — Quick Actions */}
            <Widget8QuickActions
              subdomain={subdomain}
              electionId={electionId}
              orgId={orgId}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ===========================================================================
// Header
// ===========================================================================

function ConsoleHeader({
  subdomain, orgName, official, elections, electionId, onElectionChange,
}: {
  subdomain: string
  orgName: string
  official: any
  elections: any[]
  electionId: string
  onElectionChange: (id: string) => void
}) {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-3 py-3 sm:px-5 sm:py-3.5 lg:flex-row lg:items-center lg:justify-between">
        {/* Left: logo + title + LIVE pill */}
        <div className="flex items-center gap-3">
          <Link href={`/workspace?org=${encodeURIComponent(subdomain)}`} className="flex items-center gap-2.5">
            <Image src="/logo-votewise.png" alt="VoteWise" width={36} height={36} className="h-9 w-9 rounded-xl" />
            <div className="leading-tight">
              <h1 className="font-display text-base font-bold sm:text-lg">Election Operations Console</h1>
              <p className="flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <Building2 className="h-3 w-3" /> {orgName}
              </p>
            </div>
          </Link>
          <div className="hidden items-center gap-1.5 rounded-full border border-emerald-300/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:border-emerald-700/40 dark:text-emerald-300 sm:flex">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            LIVE
          </div>
        </div>

        {/* Right: clock + election selector + user */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="hidden items-center gap-2 rounded-lg border border-border/60 bg-card px-3 py-1.5 md:flex">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm font-medium tabular-nums">
              {now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: '2-digit' })}
            </span>
          </div>

          {elections.length > 0 && (
            <Select value={electionId} onValueChange={onElectionChange}>
              <SelectTrigger className="h-9 w-[200px] gap-2 text-sm sm:w-[260px]">
                <Vote className="h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue placeholder="Select election" />
              </SelectTrigger>
              <SelectContent>
                {elections.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    <span className="flex items-center gap-2">
                      <span className={cn('h-1.5 w-1.5 rounded-full', e.phase === 'live' ? 'bg-emerald-500' : e.phase === 'completed' ? 'bg-zinc-400' : 'bg-amber-500')} />
                      <span className="truncate">{e.name}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Badge variant="outline" className="hidden gap-1.5 sm:flex">
            <ShieldCheck className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
            {official?.name || official?.email || 'Admin'}
          </Badge>

          <Button
            asChild
            variant="outline"
            size="sm"
            className="gap-1.5"
          >
            <Link href={`/workspace?org=${encodeURIComponent(subdomain)}`}>
              <ArrowLeft className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Workspace</span>
            </Link>
          </Button>
        </div>
      </div>
    </header>
  )
}

// ===========================================================================
// Login Card (auth gate)
// ===========================================================================

function LoginCard({ subdomain, onSuccess }: { subdomain: string; onSuccess: (o: any) => void }) {
  const [form, setForm] = useState({ email: 'admin@votewise.com.ng', password: 'admin123' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit() {
    setErr(null)
    setBusy(true)
    try {
      const d = await api.login(form.email, form.password)
      if (!d.valid) {
        setErr('Login failed. Please check your credentials.')
        return
      }
      onSuccess(d.official)
    } catch (e: any) {
      setErr(e?.message || 'Login failed. Please check your credentials.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-secondary/30 p-4">
      <Card className="w-full max-w-md votewise-card-glow">
        <CardHeader className="text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <Lock className="h-7 w-7" />
          </div>
          <CardTitle className="mt-3 font-display">Election Operations Console</CardTitle>
          <p className="text-sm text-muted-foreground">
            Command center for <span className="font-medium text-foreground">{subdomain}</span>. Sign in to continue.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="admin@votewise.com.ng"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Password</Label>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && !busy && submit()}
            />
          </div>
          {err && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {err}
            </div>
          )}
          <Button onClick={submit} disabled={busy} className="w-full gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} Sign In
          </Button>
          <Button asChild variant="ghost" size="sm" className="w-full gap-1.5">
            <Link href={`/workspace?org=${encodeURIComponent(subdomain)}`}>
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Workspace
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

// ===========================================================================
// Widget 1 — Live Voter Activity Feed (spans 2 columns on desktop)
// ===========================================================================

function Widget1LiveFeed({ orgId, electionId }: { orgId: string; electionId: string }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    api
      .ch16aElectionMonitor(orgId, electionId || undefined)
      .then((d) => { setData(d); setError(null) })
      .catch((e) => setError(e?.message || 'Failed to load live activity'))
      .finally(() => setLoading(false))
  }, [orgId, electionId])

  const { countdown, refresh } = useAutoRefresh(load, 10000, [orgId, electionId])

  const last30 = data?.last30Min || {}

  return (
    <WidgetCard
      title="Live Voter Activity"
      icon={Activity}
      accent="emerald"
      span="full"
      action={<CountdownPill seconds={countdown} onRefresh={refresh} />}
    >
      {/* 8 mini-stat badges */}
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MiniStat label="Portal Visits" value={last30.portalVisits || 0} tone="zinc" />
        <MiniStat label="Logins" value={last30.logins || 0} tone="zinc" />
        <MiniStat label="OTVP Sent" value={last30.otpSent || 0} tone="gold" />
        <MiniStat label="OTVP Verified" value={last30.otpVerified || 0} tone="emerald" />
        <MiniStat label="OTVP Failed" value={last30.otpFailed || 0} tone="amber" />
        <MiniStat label="Voting Started" value={last30.votingStarted || 0} tone="emerald" />
        <MiniStat label="Votes Recorded" value={last30.votesRecorded || 0} tone="emerald" />
        <MiniStat label="Sessions Expired" value={last30.sessionExpired || 0} tone="amber" />
      </div>

      {/* Recent activity feed */}
      {loading ? (
        <LoadingRow label="Loading activity feed…" />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : !data?.recentActivity?.length ? (
        <EmptyState icon={Globe} title="No recent activity" hint="Voter events will appear here in real time." />
      ) : (
        <div className="max-h-80 overflow-y-auto votewise-scroll pr-1">
          <ul className="space-y-1.5">
            {data.recentActivity.map((a: any) => {
              const color = ACTION_COLOR[a.action] || 'text-zinc-600 dark:text-zinc-300'
              return (
                <li
                  key={a.id}
                  className="flex items-center gap-3 rounded-lg border border-border/40 bg-card/60 px-3 py-2 text-sm transition hover:bg-muted/40"
                >
                  <div className={cn('h-2 w-2 shrink-0 rounded-full', color.replace('text-', 'bg-'))} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={cn('truncate font-medium', color)}>{a.label || a.action}</span>
                      <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
                        {timeAgo(a.createdAt)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="font-mono">Voter: {truncateId(a.voterId, 10)}</span>
                      {a.ipAddress && (
                        <span className="rounded bg-muted/60 px-1.5 py-0.5 font-mono">{a.ipAddress}</span>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </WidgetCard>
  )
}

// ===========================================================================
// Widget 2 — OTVP Delivery Queue
// ===========================================================================

function Widget2OtpQueue({ orgId, electionId }: { orgId: string; electionId: string }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    api
      .ch16aOtpStats(orgId, electionId || undefined)
      .then((d) => { setData(d); setError(null) })
      .catch((e) => setError(e?.message || 'Failed to load OTVP stats'))
      .finally(() => setLoading(false))
  }, [orgId, electionId])

  const { countdown, refresh } = useAutoRefresh(load, 15000, [orgId, electionId])

  const stats = data?.stats || {}
  const rate = typeof stats.deliveryRate === 'number' ? stats.deliveryRate : 100
  const byChannel = stats.byChannel || {}
  const failures = stats.recentFailures || []

  const channelMeta = [
    { key: 'EMAIL', label: 'Email', icon: Mail },
    { key: 'SMS', label: 'SMS', icon: Smartphone },
    { key: 'WHATSAPP', label: 'WhatsApp', icon: MessageSquare },
  ]

  return (
    <WidgetCard
      title="OTVP Delivery"
      icon={KeyRound}
      accent="gold"
      action={<CountdownPill seconds={countdown} onRefresh={refresh} />}
    >
      {loading ? (
        <LoadingRow label="Loading OTVP queue…" />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : (
        <>
          {/* Big delivery rate */}
          <div className="mb-3 flex items-baseline gap-2">
            <span className={cn('text-3xl font-bold tabular-nums', deliveryRateColor(rate))}>
              {rate.toFixed(1)}%
            </span>
            <span className="text-xs text-muted-foreground">delivery rate</span>
          </div>

          {/* 4 mini-stats */}
          <div className="mb-3 grid grid-cols-2 gap-2">
            <MiniStat label="Total" value={stats.total || 0} tone="zinc" />
            <MiniStat label="Sent" value={stats.sent || 0} tone="emerald" />
            <MiniStat label="Failed" value={stats.failed || 0} tone="red" />
            <MiniStat label="Pending" value={stats.pending || 0} tone="amber" />
          </div>

          {/* Channel breakdown */}
          <div className="mb-3 space-y-1.5">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">By Channel</div>
            <div className="grid grid-cols-3 gap-1.5">
              {channelMeta.map((c) => (
                <div
                  key={c.key}
                  className="rounded-lg border border-border/50 bg-card/60 px-2 py-1.5 text-center"
                >
                  <c.icon className="mx-auto h-3.5 w-3.5 text-muted-foreground" />
                  <div className="mt-1 text-sm font-bold tabular-nums">{byChannel[c.key] || 0}</div>
                  <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{c.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent failures */}
          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              <XCircle className="h-3 w-3 text-red-500" /> Recent Failures
            </div>
            {failures.length === 0 ? (
              <p className="rounded-lg border border-emerald-300/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="mr-1 inline h-3 w-3" /> No recent failures
              </p>
            ) : (
              <ul className="max-h-32 overflow-y-auto votewise-scroll space-y-1.5 pr-1">
                {failures.slice(0, 3).map((f: any, i: number) => (
                  <li
                    key={i}
                    className="rounded-lg border border-red-300/30 bg-red-500/5 px-2.5 py-1.5 text-xs"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-medium">{f.voterName || 'Unknown'}</span>
                      <Badge variant="outline" className="shrink-0 text-[9px]">{f.channel}</Badge>
                    </div>
                    <div className="mt-0.5 truncate text-[10px] text-muted-foreground">{f.error || 'Unknown error'}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </WidgetCard>
  )
}

// ===========================================================================
// Widget 3 — Active Support Chats
// ===========================================================================

function Widget3SupportChats({ orgId, subdomain }: { orgId: string; subdomain: string }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    api
      .ch16aSupportChat(orgId)
      .then((d) => { setData(d); setError(null) })
      .catch((e) => setError(e?.message || 'Failed to load support chats'))
      .finally(() => setLoading(false))
  }, [orgId])

  const { countdown, refresh } = useAutoRefresh(load, 15000, [orgId])

  const stats = data?.stats || {}
  const conversations = data?.conversations || []

  return (
    <WidgetCard
      title="Support Chats"
      icon={Headphones}
      accent="amber"
      action={<CountdownPill seconds={countdown} onRefresh={refresh} />}
    >
      {loading ? (
        <LoadingRow label="Loading chats…" />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : (
        <>
          {/* 4 mini-stats */}
          <div className="mb-3 grid grid-cols-2 gap-2">
            <MiniStat label="Open" value={stats.open || 0} tone="emerald" />
            <MiniStat label="Unassigned" value={stats.unassigned || 0} tone="amber" />
            <MiniStat label="SLA Breached" value={stats.slaBreached || 0} tone="red" />
            <MiniStat label="Escalated" value={stats.escalated || 0} tone="red" />
          </div>

          {/* Conversation list */}
          {!conversations.length ? (
            <EmptyState icon={MessageSquare} title="No support conversations" hint="New chats from voters will appear here." />
          ) : (
            <div className="max-h-60 overflow-y-auto votewise-scroll space-y-1.5 pr-1">
              {conversations.slice(0, 12).map((c: any) => {
                const slaMs = c.slaDeadline ? new Date(c.slaDeadline).getTime() - Date.now() : null
                const breached = c.slaBreached || (slaMs !== null && slaMs < 0)
                const slaLabel = slaMs === null
                  ? null
                  : breached
                    ? 'Breached'
                    : `${Math.max(0, Math.floor(slaMs / 60000))}m left`
                return (
                  <Link
                    key={c.id}
                    href={`/workspace/elections/${c.electionId || ''}/support?org=${encodeURIComponent(subdomain)}`}
                    className="block rounded-lg border border-border/40 bg-card/60 px-2.5 py-2 transition hover:bg-muted/40"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">
                        {c.voterName || c.voterIdentifier || 'Anonymous'}
                      </span>
                      <Badge className={cn('shrink-0 text-[9px]', CONVERSATION_STATUS_STYLE[c.status] || CONVERSATION_STATUS_STYLE.NEW)}>
                        {c.status}
                      </Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      {c.priority && (
                        <Badge className={cn('text-[9px]', PRIORITY_STYLE[c.priority] || PRIORITY_STYLE.NORMAL)}>
                          {c.priority}
                        </Badge>
                      )}
                      {slaLabel && (
                        <span className={cn('tabular-nums', breached ? 'font-semibold text-red-600 dark:text-red-400' : '')}>
                          <Clock className="mr-0.5 inline h-2.5 w-2.5" />{slaLabel}
                        </span>
                      )}
                    </div>
                    {c.lastMessagePreview && (
                      <p className="mt-1 truncate text-[11px] text-muted-foreground">
                        {c.lastMessagePreview}
                      </p>
                    )}
                  </Link>
                )
              })}
            </div>
          )}
        </>
      )}
    </WidgetCard>
  )
}

// ===========================================================================
// Widget 4 — Current Turnout
// ===========================================================================

function Widget4Turnout({ electionId, subdomain }: { electionId: string; subdomain: string }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!electionId) {
      setLoading(false)
      setData(null)
      return
    }
    api
      .getElectionLive(electionId, subdomain)
      .then((d) => { setData(d); setError(null) })
      .catch(() => {
        // Fallback to /api/results
        api.getResults().then((d) => { setData(d); setError(null) }).catch((e) => setError(e?.message || 'No turnout data'))
      })
      .finally(() => setLoading(false))
  }, [electionId, subdomain])

  const { countdown, refresh } = useAutoRefresh(load, 30000, [electionId, subdomain])

  const pct = typeof data?.turnoutPct === 'number' ? data.turnoutPct : 0
  const cast = data?.votesCast || 0
  const eligible = data?.eligibleVoters || 0

  return (
    <WidgetCard
      title="Current Turnout"
      icon={Vote}
      accent="emerald"
      action={<CountdownPill seconds={countdown} onRefresh={refresh} />}
    >
      {loading ? (
        <LoadingRow label="Loading turnout…" />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : !electionId ? (
        <EmptyState icon={Vote} title="No election selected" hint="Pick an election from the header to view turnout." />
      ) : (
        <div className="flex flex-col items-center">
          <CircularProgress
            value={pct}
            size={140}
            stroke={11}
            color={turnoutRingColor(pct)}
            label={`${pct.toFixed(1)}%`}
            sublabel="Turnout"
          />
          <div className="mt-4 grid w-full grid-cols-2 gap-2">
            <div className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-center dark:bg-emerald-500/10">
              <div className="text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                {formatNumber(cast)}
              </div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Votes Cast</div>
            </div>
            <div className="rounded-lg bg-zinc-50 px-2.5 py-1.5 text-center dark:bg-zinc-500/10">
              <div className="text-lg font-bold tabular-nums text-zinc-700 dark:text-zinc-300">
                {formatNumber(eligible)}
              </div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Eligible Voters</div>
            </div>
          </div>
          {data?.electionName && (
            <p className="mt-3 truncate text-center text-[11px] text-muted-foreground">
              {data.electionName}
            </p>
          )}
        </div>
      )}
    </WidgetCard>
  )
}

// ===========================================================================
// Widget 5 — System Health
// ===========================================================================

function Widget5SystemHealth() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    api
      .pihedStatus()
      .then((d) => { setData(d); setError(null) })
      .catch((e) => setError(e?.message || 'Failed to load system health'))
      .finally(() => setLoading(false))
  }, [])

  const { countdown, refresh } = useAutoRefresh(load, 30000, [])

  const status = data?.status || 'UNKNOWN'
  const statusStyle = PLATFORM_STATUS_STYLE[status] || PLATFORM_STATUS_STYLE.UNKNOWN
  const services: any[] = data?.services || []
  // Find the 3 critical services (Database, Redis, API)
  const findSvc = (name: string) => services.find((s) =>
    s.name?.toLowerCase().includes(name.toLowerCase()) ||
    s.category?.toLowerCase().includes(name.toLowerCase()),
  )
  const criticalServices = [
    { label: 'Database', svc: findSvc('database') || findSvc('db') },
    { label: 'Redis', svc: findSvc('redis') || findSvc('cache') },
    { label: 'API', svc: findSvc('api') || findSvc('app') || services[0] },
  ]

  return (
    <WidgetCard
      title="System Health"
      icon={Server}
      accent="emerald"
      action={<CountdownPill seconds={countdown} onRefresh={refresh} />}
    >
      {loading ? (
        <LoadingRow label="Loading system health…" />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-card/60 px-3 py-2">
            <div className="flex items-center gap-2">
              <span className={cn('h-2.5 w-2.5 rounded-full', statusStyle.dot)} />
              <span className="text-sm font-semibold">{statusStyle.label}</span>
            </div>
            <Badge className={cn('text-[10px]', statusStyle.badge)}>{status}</Badge>
          </div>

          <div className="space-y-1.5">
            {criticalServices.map((c, i) => {
              const svcStatus = c.svc?.status || 'UNKNOWN'
              const dot = SERVICE_HEALTH_DOT[svcStatus] || SERVICE_HEALTH_DOT.UNKNOWN
              const icon = c.label === 'Database' ? Database : c.label === 'Redis' ? Server : Zap
              const Icon = icon
              return (
                <div
                  key={i}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border/40 bg-card/60 px-3 py-1.5"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-medium">{c.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {c.svc?.uptime != null ? `${c.svc.uptime}%` : ''}
                    </span>
                    <span className={cn('h-2 w-2 rounded-full', dot)} />
                  </div>
                </div>
              )
            })}
          </div>

          {data?.lastUpdated && (
            <p className="mt-3 text-[10px] text-muted-foreground">
              Updated {timeAgo(data.lastUpdated)}
            </p>
          )}
        </>
      )}
    </WidgetCard>
  )
}

// ===========================================================================
// Widget 6 — Fraud Alerts
// ===========================================================================

function Widget6FraudAlerts({ subdomain }: { subdomain: string }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    api
      .getEifdirsDashboard(subdomain)
      .then((d) => { setData(d); setError(null) })
      .catch((e) => setError(e?.message || 'Failed to load fraud alerts'))
      .finally(() => setLoading(false))
  }, [subdomain])

  const { countdown, refresh } = useAutoRefresh(load, 30000, [subdomain])

  const activeIncidents = data?.activeIncidents || 0
  const integrityScore = typeof data?.integrityScore === 'number' ? data.integrityScore : 100
  const incidents: any[] = data?.recentIncidents || []

  return (
    <WidgetCard
      title="Fraud Alerts"
      icon={ShieldAlert}
      accent="red"
      action={<CountdownPill seconds={countdown} onRefresh={refresh} />}
    >
      {loading ? (
        <LoadingRow label="Loading fraud alerts…" />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2">
            <div className={cn(
              'rounded-lg border px-3 py-2 text-center',
              activeIncidents > 0
                ? 'border-red-300/40 bg-red-500/10'
                : 'border-emerald-300/40 bg-emerald-500/10',
            )}>
              <div className={cn(
                'text-2xl font-bold tabular-nums',
                activeIncidents > 0 ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300',
              )}>
                {activeIncidents}
              </div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Active Incidents</div>
            </div>
            <div className="rounded-lg border border-border/50 bg-card/60 px-3 py-2 text-center">
              <div className={cn(
                'text-2xl font-bold tabular-nums',
                integrityScore >= 80 ? 'text-emerald-700 dark:text-emerald-300' :
                integrityScore >= 60 ? 'text-amber-700 dark:text-amber-300' :
                'text-red-700 dark:text-red-300',
              )}>
                {integrityScore.toFixed(0)}
              </div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Integrity Score</div>
            </div>
          </div>

          {!incidents.length ? (
            <div className="rounded-lg border border-emerald-300/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
              <ShieldCheck className="mr-1 inline h-3.5 w-3.5" />
              No incidents detected
            </div>
          ) : (
            <ul className="max-h-32 overflow-y-auto votewise-scroll space-y-1.5 pr-1">
              {incidents.slice(0, 3).map((inc: any, i: number) => (
                <li
                  key={inc.id || i}
                  className="rounded-lg border border-border/40 bg-card/60 px-2.5 py-1.5"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-xs font-medium">{inc.title || inc.incidentNumber}</span>
                    <Badge className={cn('shrink-0 text-[9px]', SEVERITY_STYLE[inc.severity] || SEVERITY_STYLE.LOW)}>
                      {inc.severity}
                    </Badge>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>Status: {inc.status}</span>
                    <span>{timeAgo(inc.detectedAt)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </WidgetCard>
  )
}

// ===========================================================================
// Widget 7 — Announcement Broadcaster
// ===========================================================================

function Widget7Broadcaster({ official }: { official: any }) {
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [type, setType] = useState('ANNOUNCEMENT')
  const [busy, setBusy] = useState(false)
  const [recent, setRecent] = useState<any[]>([])

  const loadRecent = useCallback(() => {
    api
      .paoemGetBroadcasts()
      .then((d) => setRecent(d?.broadcasts || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    loadRecent()
  }, [loadRecent])

  async function broadcast() {
    if (!title.trim() || !message.trim()) {
      toast.error('Title and message are required')
      return
    }
    setBusy(true)
    try {
      await api.paoemCreateBroadcast({ title: title.trim(), message: message.trim(), type })
      toast.success('Announcement broadcast to all organizations')
      setTitle('')
      setMessage('')
      loadRecent()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to broadcast announcement')
    } finally {
      setBusy(false)
    }
  }

  return (
    <WidgetCard
      title="Broadcaster"
      icon={Megaphone}
      accent="gold"
    >
      <div className="space-y-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Announcement title"
          className="h-9 text-sm"
        />
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Message to all organizations…"
          rows={3}
          className="text-sm"
        />
        <div className="flex items-center gap-2">
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="h-8 flex-1 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(BROADCAST_TYPE_STYLE).map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={broadcast} disabled={busy} size="sm" className="gap-1.5">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Broadcast
          </Button>
        </div>
      </div>

      {/* Recent announcements */}
      <div className="mt-3">
        <div className="mb-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">Recent</div>
        {!recent.length ? (
          <p className="rounded-lg border border-border/40 bg-card/40 px-3 py-2 text-xs text-muted-foreground">
            No announcements yet.
          </p>
        ) : (
          <ul className="max-h-32 overflow-y-auto votewise-scroll space-y-1.5 pr-1">
            {recent.slice(0, 3).map((b: any) => {
              const meta = BROADCAST_TYPE_STYLE[b.type] || BROADCAST_TYPE_STYLE.ANNOUNCEMENT
              const Icon = meta.icon
              return (
                <li key={b.id} className="rounded-lg border border-border/40 bg-card/60 px-2.5 py-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="flex items-center gap-1.5 truncate text-xs font-medium">
                      <Icon className="h-3 w-3 text-muted-foreground" />
                      {b.title}
                    </span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {timeAgo(b.publishedAt || b.createdAt)}
                    </span>
                  </div>
                  {b.message && (
                    <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{b.message}</p>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
      <p className="mt-2 text-[9px] text-muted-foreground">
        Signed in as {official?.email || 'admin'} — broadcasts are platform-wide.
      </p>
    </WidgetCard>
  )
}

// ===========================================================================
// Widget 8 — Quick Actions
// ===========================================================================

function Widget8QuickActions({
  subdomain, electionId, orgId,
}: {
  subdomain: string
  electionId: string
  orgId: string
}) {
  const [resendOpen, setResendOpen] = useState(false)
  const [lockOpen, setLockOpen] = useState(false)
  const [voterId, setVoterId] = useState('')
  const [sending, setSending] = useState(false)

  async function doResend() {
    if (!voterId.trim()) {
      toast.error('Voter ID is required')
      return
    }
    setSending(true)
    try {
      const d = await api.ch16aResendOtp({
        organizationId: orgId,
        electionId: electionId || undefined,
        voterId: voterId.trim(),
        voterName: voterId.trim(),
        channel: 'ALL',
        triggeredBy: 'admin',
        triggeredByName: 'admin',
      })
      toast.success(`OTVP resend dispatched (${d?.attempts?.length || 0} attempt(s))`)
      setResendOpen(false)
      setVoterId('')
    } catch (e: any) {
      toast.error(e?.message || 'Failed to resend OTVP')
    } finally {
      setSending(false)
    }
  }

  const actions = [
    {
      label: 'Resend OTVP',
      icon: KeyRound,
      tone: 'emerald' as const,
      onClick: () => setResendOpen(true),
    },
    {
      label: 'Unlock Session',
      icon: Unlock,
      tone: 'amber' as const,
      href: `/workspace/voters?org=${encodeURIComponent(subdomain)}`,
    },
    {
      label: 'View Timeline',
      icon: Activity,
      tone: 'zinc' as const,
      href: electionId
        ? `/workspace/elections/${electionId}?org=${encodeURIComponent(subdomain)}`
        : `/workspace/elections?org=${encodeURIComponent(subdomain)}`,
    },
    {
      label: 'Support Chat',
      icon: Headphones,
      tone: 'amber' as const,
      href: electionId
        ? `/workspace/elections/${electionId}/support?org=${encodeURIComponent(subdomain)}`
        : `/workspace/command-center?org=${encodeURIComponent(subdomain)}`,
    },
    {
      label: 'Election Lock',
      icon: LockKeyhole,
      tone: 'red' as const,
      onClick: () => setLockOpen(true),
    },
    {
      label: 'View Results',
      icon: BadgeCheck,
      tone: 'emerald' as const,
      href: electionId
        ? `/workspace/elections/${electionId}?org=${encodeURIComponent(subdomain)}`
        : `/workspace/analytics?org=${encodeURIComponent(subdomain)}`,
    },
  ]

  const toneClasses = {
    emerald: 'border-emerald-300/40 bg-emerald-500/5 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300',
    amber: 'border-amber-300/40 bg-amber-500/5 text-amber-700 hover:bg-amber-500/10 dark:text-amber-300',
    red: 'border-red-300/40 bg-red-500/5 text-red-700 hover:bg-red-500/10 dark:text-red-300',
    zinc: 'border-zinc-300/40 bg-zinc-500/5 text-zinc-700 hover:bg-zinc-500/10 dark:text-zinc-300',
    gold: 'border-amber-300/40 bg-amber-500/5 text-amber-700 hover:bg-amber-500/10 dark:text-amber-300',
  }

  return (
    <WidgetCard
      title="Quick Actions"
      icon={Zap}
      accent="gold"
    >
      <div className="grid grid-cols-2 gap-2">
        {actions.map((a) => {
          const Icon = a.icon
          const content = (
            <>
              <Icon className="h-4 w-4" />
              <span className="mt-1 text-[11px] font-medium leading-tight">{a.label}</span>
            </>
          )
          const cls = cn(
            'flex flex-col items-center justify-center rounded-lg border px-2 py-3 text-center transition',
            toneClasses[a.tone],
          )
          return a.href ? (
            <Link key={a.label} href={a.href} className={cls}>
              {content}
            </Link>
          ) : (
            <button key={a.label} onClick={a.onClick} className={cls}>
              {content}
            </button>
          )
        })}
      </div>

      {/* Resend OTVP dialog */}
      <Dialog open={resendOpen} onOpenChange={setResendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Resend OTVP
            </DialogTitle>
            <DialogDescription>
              Trigger an OTVP resend for a specific voter. The OTP value itself is never shown.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Voter ID</Label>
              <Input
                value={voterId}
                onChange={(e) => setVoterId(e.target.value)}
                placeholder="e.g. clr_abc123…"
                className="font-mono text-sm"
              />
              <p className="text-[10px] text-muted-foreground">
                Voter must have a verified email or phone on file.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResendOpen(false)}>Cancel</Button>
            <Button onClick={doResend} disabled={sending} className="gap-1.5">
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Send OTVP
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Election Lock confirm */}
      <AlertDialog open={lockOpen} onOpenChange={setLockOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <LockKeyhole className="h-4 w-4 text-red-600 dark:text-red-400" />
              Lock this election?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Locking the election prevents any further ballot submissions. This action
              is logged in the audit trail and may require observer co-signature to reverse.
              Continue to the election workspace to apply this action.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Link href={electionId
                ? `/workspace/elections/${electionId}?org=${encodeURIComponent(subdomain)}`
                : `/workspace/elections?org=${encodeURIComponent(subdomain)}`}>
                Go to Election
              </Link>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </WidgetCard>
  )
}
