'use client'

// =============================================================================
// VoteWise — Platform Operations Center & Digital Command Center (War Room)
// Chapter 15 — PAOEM (Platform Administration & Operations Management) UI
// =============================================================================
// 6 tabs: Dashboard · Organizations · Feature Flags · Maintenance · Broadcasts
//         · Command Center (War Room)
// Palette: emerald / gold / amber / zinc / red ONLY — NO indigo, NO blue.
// Default theme is DARK; this component is fully theme-aware.
// Auth gate: requires SUPER_ADMIN or PLATFORM_SUPER_ADMIN. Falls back to a
// login card if the session is invalid.
// =============================================================================

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence, useMotionValue, animate } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import {
  Building2, Users, Vote, Activity, Shield, Server, DollarSign, Headphones,
  Zap, Flag, Megaphone, Wrench, Search, CheckCircle2, AlertCircle, XCircle,
  Eye, Lock, Radio, Cpu, TrendingUp, Clock, Loader2, RefreshCw, Plus, X,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ShieldAlert,
  AlertTriangle, ArrowLeft, Cog, Sparkles, Siren, Ban, PlayCircle, StopCircle,
  ExternalLink, Globe, KeyRound, Gauge, LayoutDashboard, ListChecks, Send,
  Hash, Tag, Info,
} from 'lucide-react'
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ---------------------------------------------------------------------------
// Palette / type-style maps (emerald / gold / amber / zinc / red only)
// ---------------------------------------------------------------------------

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  TRIAL: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  SUSPENDED: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  INACTIVE: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-300',
}

const PLAN_STYLE: Record<string, string> = {
  FREE: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-300',
  PAYG: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  PROFESSIONAL: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  ENTERPRISE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 ring-1 ring-emerald-300/40 dark:ring-emerald-700/40',
}

const MAINTENANCE_LEVEL_STYLE: Record<string, { badge: string; dot: string; label: string }> = {
  PLATFORM: {
    badge: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300 ring-1 ring-red-300/30 dark:ring-red-700/30',
    dot: 'bg-red-500',
    label: 'Platform-wide',
  },
  ORGANIZATION: {
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 ring-1 ring-amber-300/30 dark:ring-amber-700/30',
    dot: 'bg-amber-500',
    label: 'Organization',
  },
  MODULE: {
    badge: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300 ring-1 ring-zinc-300/30 dark:ring-zinc-700/30',
    dot: 'bg-zinc-500',
    label: 'Module',
  },
}

const BROADCAST_TYPE_STYLE: Record<string, { badge: string; icon: any }> = {
  INFO: { badge: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300', icon: Info },
  SUCCESS: { badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', icon: CheckCircle2 },
  WARNING: { badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300', icon: AlertTriangle },
  CRITICAL: { badge: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300', icon: Siren },
  ANNOUNCEMENT: { badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', icon: Megaphone },
}

const CATEGORY_STYLE: Record<string, string> = {
  SECURITY: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  VOTING: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  ANALYTICS: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  COMMUNICATION: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  BILLING: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  INTEGRATION: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300',
  EXPERIMENT: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatNaira(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '₦0'
  return '₦' + n.toLocaleString('en-NG')
}

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '0'
  return n.toLocaleString('en-NG')
}

function timeRemaining(endTime: string): { label: string; ms: number; expired: boolean } {
  const end = new Date(endTime).getTime()
  const now = Date.now()
  const ms = end - now
  if (ms <= 0) return { label: 'Ended', ms: 0, expired: true }
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  const s = Math.floor((ms % 60_000) / 1000)
  if (h >= 1) return { label: `${h}h ${m}m`, ms, expired: false }
  if (m >= 1) return { label: `${m}m ${s}s`, ms, expired: false }
  return { label: `${s}s`, ms, expired: false }
}

function scoreColour(score: number): string {
  if (score >= 80) return 'text-emerald-600 dark:text-emerald-400'
  if (score >= 60) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

function scoreBarColour(score: number): string {
  if (score >= 80) return 'bg-emerald-500'
  if (score >= 60) return 'bg-amber-500'
  return 'bg-red-500'
}

// ---------------------------------------------------------------------------
// Animated count-up number (Framer Motion) — used in the War Room
// ---------------------------------------------------------------------------

function AnimatedNumber({ value, duration = 1.0 }: { value: number; duration?: number }) {
  const mv = useMotionValue(0)
  const [display, setDisplay] = useState(0)
  const ref = useRef<number>(0)

  useEffect(() => {
    const controls = animate(mv, value, {
      duration,
      ease: 'easeOut',
      onUpdate: (v) => {
        ref.current = v
        setDisplay(v)
      },
    })
    return () => controls.stop()
  }, [value, duration, mv])

  // Choose formatting based on magnitude
  const formatted = useMemo(() => {
    if (value >= 1000) return formatNumber(Math.round(display))
    if (Number.isInteger(value)) return formatNumber(Math.round(display))
    return display.toFixed(1)
  }, [display, value])

  return <span className="tabular-nums">{formatted}</span>
}

// ===========================================================================
// MAIN COMPONENT
// ===========================================================================

export function PlatformOperationsCenter() {
  return (
    <Suspense fallback={<BootLoader />}>
      <PlatformOperationsCenterInner />
    </Suspense>
  )
}

function BootLoader() {
  return (
    <div className="grid min-h-screen place-items-center bg-secondary/20">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )
}

function PlatformOperationsCenterInner() {
  const [authed, setAuthed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [official, setOfficial] = useState<any>(null)
  const [tab, setTab] = useState<string>('dashboard')

  useEffect(() => {
    api
      .me()
      .then((d) => {
        if (d.valid && (d.official.role === 'SUPER_ADMIN' || d.official.role === 'PLATFORM_SUPER_ADMIN')) {
          setOfficial(d.official)
          setAuthed(true)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-secondary/20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!authed) {
    return <PlatformLogin onSuccess={(o) => { setOfficial(o); setAuthed(true) }} />
  }

  return (
    <div className="min-h-screen bg-secondary/20">
      <PlatformHeader
        official={official}
        onLogout={() => {
          api.logout().catch(() => {})
          setAuthed(false)
          setOfficial(null)
        }}
      />
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <Tabs value={tab} onValueChange={setTab}>
          <div className="votewise-scroll mb-6 overflow-x-auto">
            <TabsList className="flex w-max gap-1">
              <TabsTrigger value="dashboard" className="gap-1.5">
                <LayoutDashboard className="h-4 w-4" /> Dashboard
              </TabsTrigger>
              <TabsTrigger value="organizations" className="gap-1.5">
                <Building2 className="h-4 w-4" /> Organizations
              </TabsTrigger>
              <TabsTrigger value="flags" className="gap-1.5">
                <Flag className="h-4 w-4" /> Feature Flags
              </TabsTrigger>
              <TabsTrigger value="maintenance" className="gap-1.5">
                <Wrench className="h-4 w-4" /> Maintenance
              </TabsTrigger>
              <TabsTrigger value="broadcasts" className="gap-1.5">
                <Megaphone className="h-4 w-4" /> Broadcasts
              </TabsTrigger>
              <TabsTrigger value="warroom" className="gap-1.5">
                <Radio className="h-4 w-4" /> Command Center
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="dashboard" className="mt-0">
            <DashboardTab />
          </TabsContent>
          <TabsContent value="organizations" className="mt-0">
            <OrganizationsTab />
          </TabsContent>
          <TabsContent value="flags" className="mt-0">
            <FeatureFlagsTab />
          </TabsContent>
          <TabsContent value="maintenance" className="mt-0">
            <MaintenanceTab />
          </TabsContent>
          <TabsContent value="broadcasts" className="mt-0">
            <BroadcastsTab />
          </TabsContent>
          <TabsContent value="warroom" className="mt-0">
            <CommandCenterTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function PlatformHeader({ official, onLogout }: { official: any; onLogout: () => void }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/admin/operations" className="flex items-center gap-3">
          <Image src="/logo-votewise.png" alt="VoteWise" width={32} height={32} className="h-8 w-8 rounded-lg" />
          <div className="leading-tight">
            <h1 className="font-display text-base font-bold sm:text-lg">VoteWise Operations</h1>
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Platform Operations Center
            </p>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="hidden gap-1 sm:flex">
            <Shield className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
            {official?.name || 'Platform Admin'}
          </Badge>
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link href="/admin">
              <ArrowLeft className="h-4 w-4" /> Admin
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link href="/">
              <ExternalLink className="h-4 w-4" /> Site
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={onLogout} className="gap-1.5">
            <Lock className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </div>
    </header>
  )
}

// ---------------------------------------------------------------------------
// Login gate (same look as /admin login)
// ---------------------------------------------------------------------------

function PlatformLogin({ onSuccess }: { onSuccess: (o: any) => void }) {
  const [form, setForm] = useState({ email: 'admin@votewise.com.ng', password: 'admin123' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit() {
    setErr(null)
    setBusy(true)
    try {
      const d = await api.login(form.email, form.password)
      const role = d.official?.role
      if (role !== 'SUPER_ADMIN' && role !== 'PLATFORM_SUPER_ADMIN') {
        setErr('This portal is for VoteWise platform administrators only.')
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
          <CardTitle className="mt-3 font-display">Platform Operations Center</CardTitle>
          <p className="text-sm text-muted-foreground">
            Centralized control room for all VoteWise organizations
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
          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">Demo credentials</p>
            <p className="mt-1 font-mono">admin@votewise.com.ng / admin123</p>
          </div>
          <div className="text-center">
            <Button asChild variant="ghost" size="sm" className="text-xs">
              <Link href="/">← Back to VoteWise</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ===========================================================================
// TAB 1 — Dashboard
// ===========================================================================

interface DashboardData {
  organizations: number
  activeElections: number
  totalVoters: number
  votesToday: number
  supportTickets: number
  revenue: number
  platformHealth: number
  securityStatus: string
  incidents: number
  liveElections: Array<{
    id: string
    name: string
    orgName: string
    votes: number
    eligible: number
    turnout: number
    incidents: number
    startTime: string
    endTime: string
  }>
}

function DashboardTab() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const firstLoadRef = useRef(true)
  const load = useCallback(async () => {
    try {
      setRefreshing(true)
      const d: any = await api.paoemGetDashboard()
      setData(d as DashboardData)
      setLastUpdated(new Date())
    } catch (e: any) {
      // Only toast the first load failure — silent on subsequent auto-refresh
      // failures to avoid spamming the user every 15s.
      if (firstLoadRef.current) {
        toast.error(e?.message || 'Failed to load dashboard')
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
      firstLoadRef.current = false
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 15000)
    return () => clearInterval(id)
  }, [load])

  if (loading && !data) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-destructive/50" />
        <h2 className="mt-4 font-display text-xl font-bold">Dashboard Unavailable</h2>
        <p className="mt-2 text-sm text-muted-foreground">Could not load the platform dashboard.</p>
        <Button onClick={load} className="mt-4 gap-2">
          <RefreshCw className="h-4 w-4" /> Retry
        </Button>
      </div>
    )
  }

  const stats = [
    { icon: Building2, label: 'Organizations', value: formatNumber(data.organizations), accent: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
    { icon: Vote, label: 'Live Elections', value: formatNumber(data.activeElections), accent: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
    { icon: Users, label: 'Total Voters', value: formatNumber(data.totalVoters), accent: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
    { icon: TrendingUp, label: 'Votes Today', value: formatNumber(data.votesToday), accent: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
    { icon: Headphones, label: 'Support Tickets', value: formatNumber(data.supportTickets), accent: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
    { icon: DollarSign, label: 'Revenue', value: formatNaira(data.revenue), accent: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
    { icon: Server, label: 'Platform Health', value: `${data.platformHealth.toFixed(2)}%`, accent: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
    {
      icon: Shield,
      label: 'Security Status',
      value: data.securityStatus,
      accent:
        data.securityStatus === 'HEALTHY'
          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
          : data.securityStatus === 'ELEVATED'
          ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
          : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header card */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <Card className="votewise-card-glow">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
                <Gauge className="h-6 w-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-2xl font-bold sm:text-3xl">Platform Dashboard</h1>
                  <Badge variant="outline" className="gap-1 text-[10px] uppercase tracking-wider">
                    <Cpu className="h-3 w-3" /> PAOEM Engine
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Live snapshot of every organization, election, and payment across VoteWise.
                </p>
              </div>
            </div>
            <div className="flex flex-col items-start gap-2 sm:items-end">
              <div className="flex items-center gap-2">
                <Button onClick={load} variant="outline" size="sm" className="gap-1.5" disabled={refreshing}>
                  {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  Refresh
                </Button>
                <Badge variant="secondary" className="gap-1.5 text-xs text-muted-foreground">
                  <span className="votewise-live-dot inline-block h-2 w-2 rounded-full bg-emerald-500" />
                  Auto · 15s
                </Badge>
              </div>
              {lastUpdated && (
                <span className="text-[10px] text-muted-foreground">
                  Updated {lastUpdated.toLocaleTimeString()}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Stat cards (8) */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.04 }}
          >
            <Card className="h-full">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className={cn('grid h-9 w-9 place-items-center rounded-lg', s.accent)}>
                    <s.icon className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="font-display text-xl font-bold leading-tight sm:text-2xl">{s.value}</div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Live Elections table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 font-display text-base">
              <span className="votewise-live-dot inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
              Live Elections
              <Badge variant="outline" className="text-[10px]">{data.liveElections.length}</Badge>
            </CardTitle>
            <p className="text-xs text-muted-foreground">Auto-refreshing every 15 seconds</p>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <LiveElectionsTable elections={data.liveElections} compact />
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Live Elections table (shared by Dashboard + Command Center)
// ---------------------------------------------------------------------------

function LiveElectionsTable({
  elections,
  compact = false,
  showTickets = false,
}: {
  elections: DashboardData['liveElections'] | any[]
  compact?: boolean
  showTickets?: boolean
}) {
  const [, force] = useState(0)
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])

  if (!elections || elections.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <Vote className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm font-medium">No live elections right now</p>
        <p className="text-xs text-muted-foreground">When an election goes live it will appear here automatically.</p>
      </div>
    )
  }

  return (
    <div className="votewise-scroll max-h-[60vh] overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
          <tr className="text-left">
            <th className="p-3 font-semibold">Election</th>
            <th className="p-3 font-semibold">Organization</th>
            <th className="hidden p-3 font-semibold sm:table-cell">Votes</th>
            <th className="p-3 font-semibold">Turnout</th>
            <th className="hidden p-3 font-semibold md:table-cell">Incidents</th>
            {showTickets && <th className="hidden p-3 font-semibold md:table-cell">Tickets</th>}
            <th className="p-3 font-semibold">Time Left</th>
          </tr>
        </thead>
        <tbody>
          {elections.map((e: any) => {
            const tr = timeRemaining(e.endTime)
            return (
              <tr key={e.id} className="border-t border-border hover:bg-muted/30">
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      <Vote className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-medium">{e.name}</div>
                      {!compact && (
                        <div className="text-[10px] text-muted-foreground">Started {new Date(e.startTime).toLocaleString()}</div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Building2 className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate text-xs">{e.orgName}</span>
                  </div>
                </td>
                <td className="hidden p-3 font-mono sm:table-cell">
                  {formatNumber(e.votes)}
                  <span className="text-[10px] text-muted-foreground"> / {formatNumber(e.eligible)}</span>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-12 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn('h-full rounded-full', e.turnout >= 50 ? 'bg-emerald-500' : 'bg-amber-500')}
                        style={{ width: `${Math.min(100, e.turnout)}%` }}
                      />
                    </div>
                    <span className={cn('font-mono text-xs font-semibold', e.turnout >= 50 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400')}>
                      {e.turnout.toFixed(1)}%
                    </span>
                  </div>
                </td>
                <td className="hidden p-3 md:table-cell">
                  {e.incidents > 0 ? (
                    <Badge className="bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300">
                      <Siren className="mr-1 h-3 w-3" /> {e.incidents}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-zinc-500">
                      <CheckCircle2 className="mr-1 h-3 w-3" /> 0
                    </Badge>
                  )}
                </td>
                {showTickets && (
                  <td className="hidden p-3 md:table-cell">
                    {e.tickets > 0 ? (
                      <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                        <Headphones className="mr-1 h-3 w-3" /> {e.tickets}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-zinc-500">0</Badge>
                    )}
                  </td>
                )}
                <td className="p-3">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 font-mono text-xs',
                      tr.expired ? 'text-zinc-500' : tr.ms < 3_600_000 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                    )}
                  >
                    <Clock className="h-3 w-3" /> {tr.label}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ===========================================================================
// TAB 2 — Organizations
// ===========================================================================

interface OrgRow {
  id: string
  name: string
  subdomain: string
  status: string
  plan: string
  ownerEmail: string
  ownerName: string | null
  category: string | null
  createdAt: string
  paidUntil: string | null
  voterQuota: number
  _count: { electionSessions: number; voters: number }
}

interface OrgHealth {
  organizationId: string
  organizationName: string
  configuration: number
  security: number
  support: number
  compliance: number
  overall: number
  details: { elections: number; voters: number; incidents: number; tickets: number; subscription: string }
}

function OrganizationsTab() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('ALL')
  const [plan, setPlan] = useState('ALL')
  const [page, setPage] = useState(0)
  const pageSize = 20

  const [orgs, setOrgs] = useState<OrgRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<{ org: OrgRow; health: OrgHealth | null; loading: boolean } | null>(null)

  const params = useMemo(() => {
    const p = new URLSearchParams()
    p.set('limit', String(pageSize))
    p.set('offset', String(page * pageSize))
    if (search.trim()) p.set('search', search.trim())
    if (status !== 'ALL') p.set('status', status)
    if (plan !== 'ALL') p.set('plan', plan)
    return p.toString()
  }, [search, status, plan, page])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d: any = await api.paoemGetOrganizations(params)
      setOrgs(d.organizations || [])
      setTotal(d.total || 0)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load organizations')
      setOrgs([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [params])

  useEffect(() => {
    load()
  }, [load])

  // Reset page when filters change
  useEffect(() => {
    setPage(0)
  }, [search, status, plan])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  async function openDetail(org: OrgRow) {
    setDetail({ org, health: null, loading: true })
    try {
      const h: any = await api.paoemGetOrgHealth(org.id)
      setDetail({ org, health: h as OrgHealth, loading: false })
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load org health')
      setDetail({ org, health: null, loading: false })
    }
  }

  async function toggleOrgStatus(org: OrgRow, action: 'suspend' | 'activate', reason?: string) {
    try {
      await api.paoemUpdateOrganization(org.id, { action, reason })
      toast.success(`Organization ${action === 'suspend' ? 'suspended' : 'activated'} successfully`)
      setDetail(null)
      load()
    } catch (e: any) {
      toast.error(e?.message || `Failed to ${action} organization`)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <Card className="votewise-card-glow">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-bold sm:text-3xl">Organization Management</h1>
                <p className="text-sm text-muted-foreground">
                  Search, filter, suspend or activate any organization on VoteWise.
                </p>
              </div>
            </div>
            <Badge variant="outline" className="self-start gap-1 sm:self-end">
              <ListChecks className="h-3 w-3" /> {formatNumber(total)} total
            </Badge>
          </CardContent>
        </Card>
      </motion.div>

      {/* Filters */}
      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5 lg:col-span-2">
            <Label className="text-xs">Search</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, subdomain or owner email…"
                className="pl-9"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full"><SelectValue placeholder="All statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="TRIAL">Trial</SelectItem>
                <SelectItem value="SUSPENDED">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Plan</Label>
            <Select value={plan} onValueChange={setPlan}>
              <SelectTrigger className="w-full"><SelectValue placeholder="All plans" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All plans</SelectItem>
                <SelectItem value="FREE">Free</SelectItem>
                <SelectItem value="PAYG">Pay-as-you-go</SelectItem>
                <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="votewise-scroll max-h-[60vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
                <tr className="text-left">
                  <th className="p-3 font-semibold">Organization</th>
                  <th className="hidden p-3 font-semibold sm:table-cell">Subdomain</th>
                  <th className="p-3 font-semibold">Status</th>
                  <th className="hidden p-3 font-semibold md:table-cell">Plan</th>
                  <th className="hidden p-3 font-semibold md:table-cell">Elections</th>
                  <th className="hidden p-3 font-semibold lg:table-cell">Voters</th>
                  <th className="hidden p-3 font-semibold lg:table-cell">Created</th>
                  <th className="p-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                    </td>
                  </tr>
                )}
                {!loading && orgs.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground">
                      No organizations match these filters.
                    </td>
                  </tr>
                )}
                {orgs.map((o) => (
                  <tr key={o.id} className="border-t border-border hover:bg-muted/30">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                          <Building2 className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-medium">{o.name}</div>
                          <div className="truncate text-[10px] text-muted-foreground">{o.ownerEmail}</div>
                        </div>
                      </div>
                    </td>
                    <td className="hidden p-3 sm:table-cell">
                      <span className="font-mono text-xs text-muted-foreground">{o.subdomain}.votewise.com.ng</span>
                    </td>
                    <td className="p-3">
                      <Badge className={cn('text-[10px]', STATUS_STYLE[o.status] || STATUS_STYLE.INACTIVE)}>{o.status}</Badge>
                    </td>
                    <td className="hidden p-3 md:table-cell">
                      <Badge variant="outline" className={cn('text-[10px]', PLAN_STYLE[o.plan] || '')}>{o.plan}</Badge>
                    </td>
                    <td className="hidden p-3 font-mono md:table-cell">{o._count?.electionSessions ?? 0}</td>
                    <td className="hidden p-3 font-mono lg:table-cell">{formatNumber(o._count?.voters ?? 0)}</td>
                    <td className="hidden p-3 text-xs text-muted-foreground lg:table-cell">
                      {new Date(o.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-3 text-right">
                      <Button size="sm" variant="ghost" onClick={() => openDetail(o)} className="gap-1 text-xs">
                        <Eye className="h-3.5 w-3.5" /> View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {formatNumber(total)}
        </p>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(0)} className="h-8 w-8 p-0">
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} className="h-8 w-8 p-0">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-3 text-xs text-muted-foreground">
            Page {page + 1} / {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)} className="h-8 w-8 p-0">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)} className="h-8 w-8 p-0">
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Org detail dialog with health score */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3 font-display">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <span>{detail.org.name}</span>
                  <Badge className={cn('text-[10px]', STATUS_STYLE[detail.org.status] || STATUS_STYLE.INACTIVE)}>
                    {detail.org.status}
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  {detail.org.subdomain}.votewise.com.ng · {detail.org.ownerEmail}
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <DetailStat label="Plan" value={detail.org.plan} />
                <DetailStat label="Elections" value={String(detail.org._count?.electionSessions ?? 0)} />
                <DetailStat label="Voters" value={formatNumber(detail.org._count?.voters ?? 0)} />
                <DetailStat label="Quota" value={formatNumber(detail.org.voterQuota)} />
              </div>

              <Separator />

              {/* Health score */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Health Score</h4>
                  {detail.loading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : detail.health ? (
                    <div className={cn('font-display text-2xl font-bold', scoreColour(detail.health.overall))}>
                      {detail.health.overall}%
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">Unavailable</span>
                  )}
                </div>

                {detail.health && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <HealthBar label="Configuration" score={detail.health.configuration} icon={Cog} />
                    <HealthBar label="Security" score={detail.health.security} icon={Shield} />
                    <HealthBar label="Support" score={detail.health.support} icon={Headphones} />
                    <HealthBar label="Compliance" score={detail.health.compliance} icon={ShieldAlert} />
                  </div>
                )}

                {detail.health && (
                  <div className="grid grid-cols-2 gap-2 rounded-lg border border-border/60 p-3 text-xs sm:grid-cols-4">
                    <div><span className="text-muted-foreground">Elections:</span> <span className="font-mono">{detail.health.details.elections}</span></div>
                    <div><span className="text-muted-foreground">Voters:</span> <span className="font-mono">{formatNumber(detail.health.details.voters)}</span></div>
                    <div><span className="text-muted-foreground">Incidents:</span> <span className="font-mono">{detail.health.details.incidents}</span></div>
                    <div><span className="text-muted-foreground">Subscription:</span> <span className="font-mono">{detail.health.details.subscription}</span></div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Actions */}
              <div className="flex flex-wrap items-center justify-end gap-2">
                {detail.org.status === 'SUSPENDED' ? (
                  <Button onClick={() => toggleOrgStatus(detail.org, 'activate')} className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700">
                    <CheckCircle2 className="h-4 w-4" /> Activate Organization
                  </Button>
                ) : (
                  <SuspendDialog
                    org={detail.org}
                    onConfirm={(reason) => toggleOrgStatus(detail.org, 'suspend', reason)}
                  />
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-medium">{value}</div>
    </div>
  )
}

function HealthBar({ label, score, icon: Icon }: { label: string; score: number; icon: any }) {
  return (
    <div className="rounded-lg border border-border/60 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Icon className="h-3.5 w-3.5" /> {label}
        </div>
        <span className={cn('font-mono text-sm font-bold', scoreColour(score))}>{score}%</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full transition-all', scoreBarColour(score))} style={{ width: `${score}%` }} />
      </div>
    </div>
  )
}

function SuspendDialog({ org, onConfirm }: { org: OrgRow; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState('')
  const [open, setOpen] = useState(false)

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="gap-1.5 border-red-300 text-red-700 hover:bg-red-50 dark:border-red-900/40 dark:text-red-400 dark:hover:bg-red-950/30">
          <Ban className="h-4 w-4" /> Suspend Organization
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" /> Suspend {org.name}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This will immediately block all logins and voting for this organization. The action is reversible.
            Please provide a reason for the audit log.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="reason">Reason</Label>
          <Textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Non-payment, abuse investigation, compliance review…"
            rows={3}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="gap-1.5 bg-red-600 text-white hover:bg-red-700"
            disabled={!reason.trim()}
            onClick={() => {
              onConfirm(reason.trim())
              setOpen(false)
            }}
          >
            <Ban className="h-4 w-4" /> Confirm Suspension
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ===========================================================================
// TAB 3 — Feature Flags
// ===========================================================================

interface FeatureFlag {
  id: string
  key: string
  name: string
  description: string | null
  enabled: boolean
  category: string
  rolloutPercent: number
  whitelistedOrgs: string | null
  createdByName: string | null
  createdAt: string
}

function FeatureFlagsTab() {
  const [flags, setFlags] = useState<FeatureFlag[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const d: any = await api.paoemGetFeatureFlags()
      setFlags((d.flags || []) as FeatureFlag[])
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load feature flags')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function toggleFlag(flag: FeatureFlag, enabled: boolean) {
    setBusyKey(flag.key)
    try {
      await api.paoemSetFeatureFlag(flag.key, enabled)
      setFlags((arr) => arr.map((f) => (f.key === flag.key ? { ...f, enabled } : f)))
      toast.success(`Feature flag "${flag.name}" ${enabled ? 'enabled' : 'disabled'}`)
    } catch (e: any) {
      toast.error(e?.message || `Failed to toggle ${flag.name}`)
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <div className="space-y-4">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <Card className="votewise-card-glow">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
                <Flag className="h-6 w-6" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-bold sm:text-3xl">Feature Flags</h1>
                <p className="text-sm text-muted-foreground">
                  Toggle platform features on or off for the entire fleet, with category &amp; rollout controls.
                </p>
              </div>
            </div>
            <Button onClick={() => setCreating(true)} className="gap-1.5 self-start sm:self-end">
              <Plus className="h-4 w-4" /> Create Feature Flag
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 font-display text-base">
              <ListChecks className="h-4 w-4 text-primary" /> All Flags
              <Badge variant="outline" className="text-[10px]">{flags.length}</Badge>
            </CardTitle>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> ON</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-zinc-400" /> OFF</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="grid place-items-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : flags.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <Flag className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium">No feature flags yet</p>
              <p className="text-xs text-muted-foreground">Create one to control platform features from this screen.</p>
            </div>
          ) : (
            <div className="votewise-scroll max-h-[60vh] divide-y divide-border overflow-y-auto">
              {flags.map((f) => {
                const catCls = CATEGORY_STYLE[f.category] || CATEGORY_STYLE.EXPERIMENT
                return (
                  <div key={f.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <div
                        className={cn(
                          'mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg',
                          f.enabled
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                            : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-500/15 dark:text-zinc-400'
                        )}
                      >
                        {f.enabled ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{f.name}</span>
                          <Badge variant="outline" className={cn('text-[10px]', catCls)}>{f.category}</Badge>
                          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{f.key}</code>
                        </div>
                        {f.description && (
                          <p className="mt-1 text-xs text-muted-foreground">{f.description}</p>
                        )}
                        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Tag className="h-3 w-3" /> Rollout: {f.rolloutPercent ?? 100}%
                          </span>
                          {f.createdByName && (
                            <span className="inline-flex items-center gap-1">
                              <KeyRound className="h-3 w-3" /> by {f.createdByName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-start sm:self-center">
                      <span className={cn('text-xs font-medium', f.enabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-500')}>
                        {f.enabled ? 'ON' : 'OFF'}
                      </span>
                      <Switch
                        checked={f.enabled}
                        disabled={busyKey === f.key}
                        onCheckedChange={(v) => toggleFlag(f, v)}
                        aria-label={`Toggle ${f.name}`}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <CreateFlagDialog open={creating} onOpenChange={setCreating} onCreated={load} />
    </div>
  )
}

function CreateFlagDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onCreated: () => void
}) {
  const [form, setForm] = useState({ key: '', name: '', description: '', category: 'EXPERIMENT' })
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!form.key.trim() || !form.name.trim()) {
      toast.error('Key and name are required')
      return
    }
    setBusy(true)
    try {
      await api.paoemCreateFeatureFlag({
        key: form.key.trim().toUpperCase().replace(/\s+/g, '_'),
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        category: form.category,
        enabled: false,
      })
      toast.success('Feature flag created')
      setForm({ key: '', name: '', description: '', category: 'EXPERIMENT' })
      onOpenChange(false)
      onCreated()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to create feature flag')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Plus className="h-5 w-5 text-primary" /> Create Feature Flag
          </DialogTitle>
          <DialogDescription>
            New flags are created in the OFF state. Toggle them on after creation.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Key</Label>
            <Input
              value={form.key}
              onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
              placeholder="e.g. ENABLE_AI_INSIGHTS"
              className="font-mono text-xs"
            />
            <p className="text-[10px] text-muted-foreground">Uppercase with underscores. Will be auto-normalised.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. AI Insights"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="What does this flag control?"
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="SECURITY">Security</SelectItem>
                <SelectItem value="VOTING">Voting</SelectItem>
                <SelectItem value="ANALYTICS">Analytics</SelectItem>
                <SelectItem value="COMMUNICATION">Communication</SelectItem>
                <SelectItem value="BILLING">Billing</SelectItem>
                <SelectItem value="INTEGRATION">Integration</SelectItem>
                <SelectItem value="EXPERIMENT">Experiment</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy} className="gap-1.5">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create Flag
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ===========================================================================
// TAB 4 — Maintenance
// ===========================================================================

interface Maintenance {
  id: string
  level: string
  organizationId: string | null
  module: string | null
  reason: string
  startedById: string
  startedByName: string | null
  startedAt: string
  isActive: boolean
}

function MaintenanceTab() {
  const [items, setItems] = useState<Maintenance[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [endingId, setEndingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const d: any = await api.paoemGetMaintenance()
      setItems((d.maintenance || []) as Maintenance[])
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load maintenance')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 20000)
    return () => clearInterval(id)
  }, [load])

  async function endMaintenance(id: string) {
    setEndingId(id)
    try {
      await api.paoemEndMaintenance(id)
      toast.success('Maintenance ended')
      load()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to end maintenance')
    } finally {
      setEndingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <Card className="votewise-card-glow">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
                <Wrench className="h-6 w-6" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-bold sm:text-3xl">Maintenance Mode</h1>
                <p className="text-sm text-muted-foreground">
                  Schedule platform-wide, organization, or module-level maintenance windows.
                </p>
              </div>
            </div>
            <Button onClick={() => setCreating(true)} className="gap-1.5 self-start sm:self-end">
              <Plus className="h-4 w-4" /> Start Maintenance
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* Active maintenance list */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-display text-base">
            <Siren className="h-4 w-4 text-amber-500" /> Active Maintenance Windows
            <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="grid place-items-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500/50" />
              <p className="text-sm font-medium">No active maintenance</p>
              <p className="text-xs text-muted-foreground">All systems operational.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {items.map((m) => {
                const style = MAINTENANCE_LEVEL_STYLE[m.level] || MAINTENANCE_LEVEL_STYLE.MODULE
                return (
                  <div key={m.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <span className={cn('mt-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full', style.dot)} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={cn('text-[10px]', style.badge)}>{m.level}</Badge>
                          <span className="text-xs text-muted-foreground">{style.label}</span>
                          {m.module && (
                            <Badge variant="outline" className="text-[10px]">
                              <Hash className="mr-1 h-3 w-3" /> {m.module}
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1.5 text-sm font-medium">{m.reason}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" /> Started {new Date(m.startedAt).toLocaleString()}
                          </span>
                          {m.startedByName && (
                            <span className="inline-flex items-center gap-1">
                              <KeyRound className="h-3 w-3" /> by {m.startedByName}
                            </span>
                          )}
                          {m.organizationId && (
                            <span className="inline-flex items-center gap-1">
                              <Building2 className="h-3 w-3" /> Org: {m.organizationId.slice(0, 8)}…
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={endingId === m.id}
                      onClick={() => endMaintenance(m.id)}
                      className="gap-1.5 self-start sm:self-center"
                    >
                      {endingId === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <StopCircle className="h-4 w-4" />}
                      End
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <StartMaintenanceDialog open={creating} onOpenChange={setCreating} onStarted={load} />
    </div>
  )
}

function StartMaintenanceDialog({
  open,
  onOpenChange,
  onStarted,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onStarted: () => void
}) {
  const [level, setLevel] = useState('PLATFORM')
  const [orgId, setOrgId] = useState('')
  const [module, setModule] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  // Fetch org list for the ORGANIZATION-level selector
  const [orgs, setOrgs] = useState<OrgRow[]>([])
  useEffect(() => {
    if (open && level === 'ORGANIZATION' && orgs.length === 0) {
      api.paoemGetOrganizations('limit=200&offset=0')
        .then((d: any) => setOrgs(d.organizations || []))
        .catch(() => {})
    }
  }, [open, level, orgs.length])

  async function submit() {
    if (!reason.trim()) {
      toast.error('Reason is required')
      return
    }
    if (level === 'ORGANIZATION' && !orgId.trim()) {
      toast.error('Select an organization')
      return
    }
    if (level === 'MODULE' && !module.trim()) {
      toast.error('Module name is required')
      return
    }
    setBusy(true)
    try {
      await api.paoemStartMaintenance({
        level,
        organizationId: level === 'ORGANIZATION' ? orgId : undefined,
        module: level === 'MODULE' ? module.trim() : undefined,
        reason: reason.trim(),
      })
      toast.success('Maintenance started')
      setLevel('PLATFORM')
      setOrgId('')
      setModule('')
      setReason('')
      onOpenChange(false)
      onStarted()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to start maintenance')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Wrench className="h-5 w-5 text-amber-500" /> Start Maintenance
          </DialogTitle>
          <DialogDescription>
            Choose a scope. Platform-wide maintenance affects every organization.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Level</Label>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PLATFORM">Platform (all organizations)</SelectItem>
                <SelectItem value="ORGANIZATION">Single Organization</SelectItem>
                <SelectItem value="MODULE">Specific Module</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {level === 'ORGANIZATION' && (
            <div className="space-y-1.5">
              <Label>Organization</Label>
              <Select value={orgId} onValueChange={setOrgId}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select an organization" /></SelectTrigger>
                <SelectContent>
                  {orgs.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.name} ({o.subdomain})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {level === 'MODULE' && (
            <div className="space-y-1.5">
              <Label>Module</Label>
              <Input
                value={module}
                onChange={(e) => setModule(e.target.value)}
                placeholder="e.g. voting, billing, notifications"
                className="font-mono text-xs"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Database migration, security patch, emergency failover…"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy} className="gap-1.5">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />} Start Maintenance
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ===========================================================================
// TAB 5 — Broadcasts
// ===========================================================================

interface Broadcast {
  id: string
  title: string
  message: string
  type: string
  target: string
  isPublished: boolean
  publishedAt: string | null
  expiresAt: string | null
  createdByName: string | null
}

function BroadcastsTab() {
  const [items, setItems] = useState<Broadcast[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    try {
      const d: any = await api.paoemGetBroadcasts()
      setItems((d.broadcasts || []) as Broadcast[])
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load broadcasts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 30000)
    return () => clearInterval(id)
  }, [load])

  return (
    <div className="space-y-4">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <Card className="votewise-card-glow">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
                <Megaphone className="h-6 w-6" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-bold sm:text-3xl">Platform Broadcasts</h1>
                <p className="text-sm text-muted-foreground">
                  Push announcements to every organization dashboard on VoteWise.
                </p>
              </div>
            </div>
            <Button onClick={() => setCreating(true)} className="gap-1.5 self-start sm:self-end">
              <Plus className="h-4 w-4" /> Create Broadcast
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-display text-base">
            <Radio className="h-4 w-4 text-primary" /> Published Broadcasts
            <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="grid place-items-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <Megaphone className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium">No broadcasts yet</p>
              <p className="text-xs text-muted-foreground">Create your first platform announcement.</p>
            </div>
          ) : (
            <div className="votewise-scroll max-h-[60vh] divide-y divide-border overflow-y-auto">
              {items.map((b) => {
                const typeStyle = BROADCAST_TYPE_STYLE[b.type] || BROADCAST_TYPE_STYLE.INFO
                const TypeIcon = typeStyle.icon
                return (
                  <div key={b.id} className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-lg', typeStyle.badge)}>
                          <TypeIcon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{b.title}</span>
                            <Badge className={cn('text-[10px]', typeStyle.badge)}>{b.type}</Badge>
                            {b.target && (
                              <Badge variant="outline" className="text-[10px]">
                                <Globe className="mr-1 h-3 w-3" /> {b.target}
                              </Badge>
                            )}
                          </div>
                          <p className="mt-1.5 text-sm text-muted-foreground">{b.message}</p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
                            {b.publishedAt && (
                              <span className="inline-flex items-center gap-1">
                                <Clock className="h-3 w-3" /> {new Date(b.publishedAt).toLocaleString()}
                              </span>
                            )}
                            {b.createdByName && (
                              <span className="inline-flex items-center gap-1">
                                <KeyRound className="h-3 w-3" /> by {b.createdByName}
                              </span>
                            )}
                            {b.expiresAt && (
                              <span className="inline-flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" /> Expires {new Date(b.expiresAt).toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <CreateBroadcastDialog open={creating} onOpenChange={setCreating} onCreated={load} />
    </div>
  )
}

function CreateBroadcastDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onCreated: () => void
}) {
  const [form, setForm] = useState({ title: '', message: '', type: 'INFO', target: 'ALL' })
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!form.title.trim() || !form.message.trim()) {
      toast.error('Title and message are required')
      return
    }
    setBusy(true)
    try {
      await api.paoemCreateBroadcast({
        title: form.title.trim(),
        message: form.message.trim(),
        type: form.type,
        target: form.target,
      })
      toast.success('Broadcast published')
      setForm({ title: '', message: '', type: 'INFO', target: 'ALL' })
      onOpenChange(false)
      onCreated()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to publish broadcast')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Megaphone className="h-5 w-5 text-primary" /> Create Broadcast
          </DialogTitle>
          <DialogDescription>
            This message will be visible to all targeted organizations immediately.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Scheduled maintenance window"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Message</Label>
            <Textarea
              value={form.message}
              onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
              placeholder="The body of the announcement…"
              rows={4}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="INFO">Info</SelectItem>
                  <SelectItem value="SUCCESS">Success</SelectItem>
                  <SelectItem value="WARNING">Warning</SelectItem>
                  <SelectItem value="CRITICAL">Critical</SelectItem>
                  <SelectItem value="ANNOUNCEMENT">Announcement</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Target</Label>
              <Select value={form.target} onValueChange={(v) => setForm((f) => ({ ...f, target: v }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All organizations</SelectItem>
                  <SelectItem value="ACTIVE">Active only</SelectItem>
                  <SelectItem value="TRIAL">Trial only</SelectItem>
                  <SelectItem value="ENTERPRISE">Enterprise only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy} className="gap-1.5">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Publish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ===========================================================================
// TAB 6 — Command Center (War Room)
// ===========================================================================

interface WarRoomData {
  summary: {
    liveElections: number
    activeVoters: number
    votesCast: number
    turnout: number
    integrityScore: number
    openTickets: number
    securityIncidents: number
    infrastructureHealth: string
  }
  elections: Array<{
    id: string
    name: string
    orgName: string
    votes: number
    eligible: number
    turnout: number
    incidents: number
    tickets: number
    startTime: string
    endTime: string
    timeRemaining: number
  }>
  maintenance: Maintenance[]
  broadcasts: Broadcast[]
  featureFlags: number
}

function CommandCenterTab() {
  const [data, setData] = useState<WarRoomData | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [tick, setTick] = useState(0) // forces re-render every second for countdown

  const firstLoadRef = useRef(true)
  const load = useCallback(async () => {
    try {
      setRefreshing(true)
      const d: any = await api.paoemGetCommandCenter()
      setData(d as WarRoomData)
      setLastUpdated(new Date())
    } catch (e: any) {
      // Only toast the first load failure — silent on subsequent auto-refresh
      // failures to avoid spamming the user every 10s.
      if (firstLoadRef.current) toast.error(e?.message || 'Failed to load command center')
    } finally {
      setLoading(false)
      setRefreshing(false)
      firstLoadRef.current = false
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 10000)
    return () => clearInterval(id)
  }, [load])

  // 1-second tick to refresh countdowns
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  void tick

  if (loading && !data) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Booting War Room…</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-destructive/50" />
        <h2 className="mt-4 font-display text-xl font-bold">Command Center Unavailable</h2>
        <p className="mt-2 text-sm text-muted-foreground">Could not load real-time operations data.</p>
        <Button onClick={load} className="mt-4 gap-2">
          <RefreshCw className="h-4 w-4" /> Retry
        </Button>
      </div>
    )
  }

  const s = data.summary
  const turnoutPct = Math.round(s.turnout * 10) / 10
  const integrityPct = Math.round(s.integrityScore * 10) / 10

  // Big stat cards (7) — showpiece for wall display
  const cards: Array<{
    icon: any
    label: string
    value: number | string
    suffix?: string
    dot: string
    accent: string
    progress?: number
    isAnimatedNumber?: boolean
    danger?: boolean
  }> = [
    {
      icon: Vote,
      label: 'Live Elections',
      value: s.liveElections,
      dot: 'bg-emerald-500',
      accent: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
      isAnimatedNumber: true,
    },
    {
      icon: Users,
      label: 'Active Voters',
      value: s.activeVoters,
      dot: 'bg-emerald-500',
      accent: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
      isAnimatedNumber: true,
    },
    {
      icon: TrendingUp,
      label: 'Turnout',
      value: turnoutPct,
      suffix: '%',
      dot: 'bg-emerald-500',
      accent: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
      progress: turnoutPct,
      isAnimatedNumber: true,
    },
    {
      icon: Shield,
      label: 'Integrity Score',
      value: integrityPct,
      suffix: '%',
      dot: 'bg-emerald-500',
      accent: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
      progress: integrityPct,
      isAnimatedNumber: true,
    },
    {
      icon: Headphones,
      label: 'Open Tickets',
      value: s.openTickets,
      dot: 'bg-amber-500',
      accent: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
      isAnimatedNumber: true,
    },
    {
      icon: Siren,
      label: 'Security Incidents',
      value: s.securityIncidents,
      dot: s.securityIncidents > 0 ? 'bg-red-500' : 'bg-emerald-500',
      accent:
        s.securityIncidents > 0
          ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300'
          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
      isAnimatedNumber: true,
      danger: s.securityIncidents > 0,
    },
    {
      icon: Server,
      label: 'Infrastructure',
      value: s.infrastructureHealth,
      dot: 'bg-emerald-500',
      accent: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header — large, wall-display friendly */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="votewise-card-glow overflow-hidden">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div className="flex items-center gap-4">
              <div className="relative grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-foreground sm:h-16 sm:w-16">
                <Radio className="h-7 w-7 sm:h-8 sm:w-8" />
                <span className="absolute -right-1 -top-1 flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
                </span>
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-3xl font-bold sm:text-4xl">Digital Command Center</h1>
                  <Badge variant="outline" className="gap-1 text-xs uppercase tracking-wider">
                    <Cpu className="h-3 w-3" /> War Room
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                  Real-time operations · live elections · security · infrastructure.
                </p>
              </div>
            </div>
            <div className="flex flex-col items-start gap-2 sm:items-end">
              <div className="flex items-center gap-2">
                <Button onClick={load} variant="outline" size="sm" className="gap-1.5" disabled={refreshing}>
                  {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  Refresh
                </Button>
                <Badge variant="secondary" className="gap-1.5 text-xs text-muted-foreground">
                  <span className="votewise-live-dot inline-block h-2 w-2 rounded-full bg-emerald-500" />
                  Auto · 10s
                </Badge>
              </div>
              {lastUpdated && (
                <span className="text-[11px] text-muted-foreground">
                  Updated {lastUpdated.toLocaleTimeString()}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Active maintenance alert banner */}
      <AnimatePresence>
        {data.maintenance && data.maintenance.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card className="border-red-300 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30">
              <CardContent className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300">
                      <Siren className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-base font-bold text-red-700 dark:text-red-300">
                          Active Maintenance
                        </h3>
                        <Badge className="bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300">
                          {data.maintenance.length} active
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-red-700/80 dark:text-red-300/80">
                        {data.maintenance[0].reason}
                        {data.maintenance.length > 1 && ` (+${data.maintenance.length - 1} more)`}
                      </p>
                    </div>
                  </div>
                  <Button asChild variant="outline" size="sm" className="gap-1.5 border-red-300 text-red-700 hover:bg-red-100 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/40">
                    <Link href="#maintenance-detail">View details</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 7 Big stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {cards.map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.05 }}
            className={cn(
              c.label === 'Infrastructure' && 'sm:col-span-2 lg:col-span-1',
              c.danger && 'ring-2 ring-red-400/40 dark:ring-red-700/40'
            )}
          >
            <Card className={cn('h-full votewise-card-glow', c.danger && 'border-red-300 dark:border-red-900/50')}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-2">
                  <div className={cn('grid h-12 w-12 place-items-center rounded-xl', c.accent)}>
                    <c.icon className="h-6 w-6" />
                  </div>
                  <span className={cn('inline-block h-3 w-3 rounded-full', c.dot)}>
                    {c.danger && (
                      <span className="block h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                    )}
                  </span>
                </div>
                <div className="mt-4">
                  <div className="font-display text-3xl font-bold leading-tight sm:text-4xl">
                    {c.isAnimatedNumber ? (
                      <AnimatedNumber value={typeof c.value === 'number' ? c.value : 0} />
                    ) : (
                      c.value
                    )}
                    {c.suffix}
                  </div>
                  <div className="mt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground sm:text-sm">
                    {c.label}
                  </div>
                </div>
                {typeof c.progress === 'number' && (
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                    <motion.div
                      className={cn(
                        'h-full rounded-full',
                        c.progress >= 80 ? 'bg-emerald-500' : c.progress >= 50 ? 'bg-amber-500' : 'bg-red-500'
                      )}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, c.progress)}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}

        {/* Summary mini-card (4th column on xl) — counts of supporting entities */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35 }}
          className="sm:col-span-2 lg:col-span-1"
        >
          <Card className="h-full">
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Platform Pulse
                </h3>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <PulseItem icon={Vote} label="Votes Cast" value={formatNumber(s.votesCast)} />
                <PulseItem icon={Flag} label="Flags ON" value={String(data.featureFlags || 0)} />
                <PulseItem icon={Megaphone} label="Broadcasts" value={String(data.broadcasts?.length || 0)} />
                <PulseItem icon={Wrench} label="Maintenance" value={String(data.maintenance?.length || 0)} />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Live Elections table (with tickets column) */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 font-display text-lg">
              <span className="votewise-live-dot inline-block h-3 w-3 rounded-full bg-emerald-500" />
              Live Election Operations
              <Badge variant="outline" className="text-xs">{data.elections.length}</Badge>
            </CardTitle>
            <p className="text-xs text-muted-foreground">Updates every 10 seconds</p>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <LiveElectionsTable elections={data.elections} showTickets />
        </CardContent>
      </Card>

      {/* Bottom row: maintenance detail + broadcasts */}
      <div id="maintenance-detail" className="grid gap-4 lg:grid-cols-2">
        {/* Maintenance detail */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 font-display text-base">
              <Wrench className="h-4 w-4 text-amber-500" /> Active Maintenance
              <Badge variant="outline" className="text-[10px]">{data.maintenance?.length || 0}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(!data.maintenance || data.maintenance.length === 0) ? (
              <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" /> No active maintenance — all systems operational.
              </div>
            ) : (
              <div className="votewise-scroll max-h-64 space-y-2 overflow-y-auto">
                {data.maintenance.map((m) => {
                  const style = MAINTENANCE_LEVEL_STYLE[m.level] || MAINTENANCE_LEVEL_STYLE.MODULE
                  return (
                    <div key={m.id} className="rounded-lg border border-border/60 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={cn('text-[10px]', style.badge)}>{m.level}</Badge>
                        {m.module && <Badge variant="outline" className="text-[10px]">{m.module}</Badge>}
                      </div>
                      <p className="mt-1.5 text-sm font-medium">{m.reason}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        Started {new Date(m.startedAt).toLocaleString()} · by {m.startedByName || 'admin'}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Broadcasts */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 font-display text-base">
              <Megaphone className="h-4 w-4 text-primary" /> Active Broadcasts
              <Badge variant="outline" className="text-[10px]">{data.broadcasts?.length || 0}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(!data.broadcasts || data.broadcasts.length === 0) ? (
              <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                <Info className="h-5 w-5 text-zinc-400" /> No active broadcasts.
              </div>
            ) : (
              <div className="votewise-scroll max-h-64 space-y-2 overflow-y-auto">
                {data.broadcasts.map((b) => {
                  const typeStyle = BROADCAST_TYPE_STYLE[b.type] || BROADCAST_TYPE_STYLE.INFO
                  const TypeIcon = typeStyle.icon
                  return (
                    <div key={b.id} className="rounded-lg border border-border/60 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <TypeIcon className={cn('h-4 w-4', typeStyle.badge.includes('emerald') ? 'text-emerald-600 dark:text-emerald-400' : typeStyle.badge.includes('amber') ? 'text-amber-600 dark:text-amber-400' : typeStyle.badge.includes('red') ? 'text-red-600 dark:text-red-400' : 'text-zinc-500')} />
                        <span className="font-medium">{b.title}</span>
                        <Badge className={cn('text-[10px]', typeStyle.badge)}>{b.type}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{b.message}</p>
                      {b.publishedAt && (
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {new Date(b.publishedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Footer status strip */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> All systems operational
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5" /> PAOEM Engine v1
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" /> Integrity {integrityPct}%
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground">
            VoteWise · Digital Command Center · {new Date().toLocaleString()}
          </span>
        </CardContent>
      </Card>
    </div>
  )
}

function PulseItem({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="mt-1 font-display text-lg font-bold">{value}</div>
    </div>
  )
}
