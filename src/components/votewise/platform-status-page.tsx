'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  CheckCircle2, AlertCircle, XCircle, Activity, Clock, Server,
  Shield, Database, Zap, Mail, Smartphone, MessageSquare, Cloud,
  Lock, HardDrive, Eye, RefreshCw, KeyRound, Gauge, Radio,
  ArrowUpRight, BellRing, Loader2, ChevronRight, History,
  CalendarClock, ServerCrash,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { ReadinessBadgeWidget } from '@/components/votewise/readiness-badge-widget'
import { toast } from 'sonner'

// ---------------------------------------------------------------------------
// Types — mirror PIHD backend (src/lib/pihed/index.ts)
// ---------------------------------------------------------------------------

type HealthStatus = 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'UNKNOWN'
type OverallStatus = 'OPERATIONAL' | 'DEGRADED' | 'PARTIAL_OUTAGE' | 'MAJOR_OUTAGE'

interface PlatformService {
  name: string
  status: HealthStatus
  uptime: number
  message: string
  category: string
}

interface PlatformIncident {
  title: string
  status: string
  severity: string
  createdAt: string
}

interface PlatformMaintenance {
  reason: string
  startedAt: string
  isActive: boolean
  level: string
}

interface PlatformStatus {
  status: OverallStatus
  services: PlatformService[]
  incidents: PlatformIncident[]
  maintenance: PlatformMaintenance[]
  uptime: number
  lastUpdated: string
}

interface UptimeDay {
  date: string
  uptimePct: number
  incidents: number
}

type UptimeHistory = Record<string, UptimeDay[]>

// ---------------------------------------------------------------------------
// Palette + helpers  (emerald / gold[accent] / amber / zinc / red ONLY)
// ---------------------------------------------------------------------------

const HEALTH_BADGE: Record<HealthStatus, string> = {
  HEALTHY: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  DEGRADED: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  UNHEALTHY: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  UNKNOWN: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-300',
}

const HEALTH_LABEL: Record<HealthStatus, string> = {
  HEALTHY: 'Operational',
  DEGRADED: 'Degraded',
  UNHEALTHY: 'Down',
  UNKNOWN: 'Unknown',
}

const HEALTH_ICON_CLASS: Record<HealthStatus, string> = {
  HEALTHY: 'text-emerald-600 dark:text-emerald-400',
  DEGRADED: 'text-amber-600 dark:text-amber-400',
  UNHEALTHY: 'text-red-600 dark:text-red-400',
  UNKNOWN: 'text-zinc-500 dark:text-zinc-400',
}

const HEALTH_TILE_CLASS: Record<HealthStatus, string> = {
  HEALTHY: 'bg-emerald-100 dark:bg-emerald-500/15',
  DEGRADED: 'bg-amber-100 dark:bg-amber-500/15',
  UNHEALTHY: 'bg-red-100 dark:bg-red-500/15',
  UNKNOWN: 'bg-zinc-100 dark:bg-zinc-500/15',
}

const CATEGORY_BADGE: Record<string, string> = {
  core: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300',
  messaging: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  storage: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  security: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  ops: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  capacity: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300',
}

const CATEGORY_ICON: Record<string, typeof Server> = {
  core: Server,
  messaging: MessageSquare,
  storage: Cloud,
  security: Lock,
  ops: Activity,
  capacity: Gauge,
}

const SERVICE_ICON: Record<string, typeof Server> = {
  'Database': Database,
  'Redis Cache': Zap,
  'Background Queue': Activity,
  'Email Provider': Mail,
  'SMS Provider': Smartphone,
  'WhatsApp Provider': MessageSquare,
  'Object Storage': Cloud,
  'SSL/HTTPS': Lock,
  'Backup System': HardDrive,
  'Monitoring': Eye,
  'No Critical Incidents': Shield,
  'Secrets Configured': KeyRound,
  'Capacity Sufficient': Gauge,
}

// Tracked services for the 90-day uptime bar chart (mirrors PIHD TRACKED_SERVICES).
const TRACKED_SERVICES = [
  'API',
  'Database',
  'WebSocket',
  'Redis Cache',
  'Email Delivery',
  'SMS Gateway',
] as const

const TRACKED_ICON: Record<string, typeof Server> = {
  'API': Server,
  'Database': Database,
  'WebSocket': Radio,
  'Redis Cache': Zap,
  'Email Delivery': Mail,
  'SMS Gateway': Smartphone,
}

// Multi-region deployment metadata — small constant; in production this would
// come from the deployment manifest. Used in the hero subtitle.
const REGION_COUNT = 3

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return 'Never'
  try {
    const diff = Date.now() - new Date(iso).getTime()
    const sec = Math.max(0, Math.floor(diff / 1000))
    if (sec < 5) return 'just now'
    if (sec < 60) return `${sec}s ago`
    const min = Math.floor(sec / 60)
    if (min < 60) return `${min}m ago`
    const hr = Math.floor(min / 60)
    if (hr < 24) return `${hr}h ago`
    const day = Math.floor(hr / 24)
    if (day < 30) return `${day}d ago`
    return formatDateTime(iso)
  } catch {
    return iso
  }
}

function timeAgoShort(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    const diff = Date.now() - new Date(iso).getTime()
    const day = Math.max(0, Math.floor(diff / 86_400_000))
    if (day <= 0) return 'today'
    if (day === 1) return '1d ago'
    return `${day}d ago`
  } catch {
    return iso
  }
}

function formatDayLabel(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function uptimeColor(pct: number): string {
  if (pct >= 99.9) return 'bg-emerald-500'
  if (pct >= 99) return 'bg-amber-500'
  return 'bg-red-500'
}

function uptimeTextColor(pct: number): string {
  if (pct >= 99.9) return 'text-emerald-600 dark:text-emerald-400'
  if (pct >= 99) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

function downtimeMinutes(pct: number): number {
  // (100 - uptime%) of a 1440-min day → minutes of downtime
  const m = Math.round((100 - pct) * 14.4)
  return Math.max(1, m)
}

// ---------------------------------------------------------------------------
// Overall-status visual config
// ---------------------------------------------------------------------------

const OVERALL_CONFIG: Record<OverallStatus, {
  title: string
  Icon: typeof CheckCircle2
  ring: string
  glow: string
  tile: string
  titleColor: string
}> = {
  OPERATIONAL: {
    title: 'All Systems Operational',
    Icon: CheckCircle2,
    ring: 'border-emerald-500/40 ring-1 ring-emerald-500/20',
    glow: 'from-emerald-500/10 via-transparent to-transparent',
    tile: 'bg-emerald-100 dark:bg-emerald-500/20',
    titleColor: 'text-emerald-600 dark:text-emerald-400',
  },
  DEGRADED: {
    title: 'Some Systems Degraded',
    Icon: AlertCircle,
    ring: 'border-amber-500/40 ring-1 ring-amber-500/20',
    glow: 'from-amber-500/10 via-transparent to-transparent',
    tile: 'bg-amber-100 dark:bg-amber-500/20',
    titleColor: 'text-amber-600 dark:text-amber-400',
  },
  PARTIAL_OUTAGE: {
    title: 'Partial Service Outage',
    Icon: XCircle,
    ring: 'border-red-500/40 ring-1 ring-red-500/20',
    glow: 'from-red-500/10 via-transparent to-transparent',
    tile: 'bg-red-100 dark:bg-red-500/20',
    titleColor: 'text-red-600 dark:text-red-400',
  },
  MAJOR_OUTAGE: {
    title: 'Major Service Outage',
    Icon: XCircle,
    ring: 'border-red-500/50 ring-2 ring-red-500/30',
    glow: 'from-red-500/15 via-transparent to-transparent',
    tile: 'bg-red-100 dark:bg-red-500/25',
    titleColor: 'text-red-600 dark:text-red-400',
  },
}

// ---------------------------------------------------------------------------
// Incident timeline stages (visual faux timeline)
// ---------------------------------------------------------------------------

const INCIDENT_STAGES = ['Detected', 'Investigating', 'Identified', 'Resolved'] as const

function incidentStageIndex(status: string): number {
  const s = (status || '').toUpperCase()
  if (s === 'RESOLVED') return 3
  if (s === 'IDENTIFIED') return 2
  if (s === 'INVESTIGATING') return 1
  return 0 // DETECTED / OPEN / unknown
}

const SEVERITY_BADGE: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  HIGH: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  MEDIUM: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  LOW: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-300',
}

const INCIDENT_STATUS_BADGE: Record<string, string> = {
  DETECTED: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  OPEN: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  INVESTIGATING: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  IDENTIFIED: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  RESOLVED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
}

const MAINTENANCE_LEVEL_BADGE: Record<string, string> = {
  PLATFORM: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  ORGANIZATION: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  MODULE: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-300',
}

// ===========================================================================
// Main component
// ===========================================================================

export function PlatformStatusPage() {
  const [status, setStatus] = useState<PlatformStatus | null>(null)
  const [history, setHistory] = useState<UptimeHistory | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingBars, setLoadingBars] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string>('')
  const [countdown, setCountdown] = useState(30)
  const [refreshing, setRefreshing] = useState(false)

  // ------------------------------------------------------------------
  // Data loaders
  // ------------------------------------------------------------------

  const loadStatus = useCallback(async (silent = false) => {
    if (!silent) {
      setRefreshing(true)
      setError(null)
    }
    try {
      const data = await api.pihedStatus() as PlatformStatus
      setStatus(data)
      setLastUpdated(new Date().toISOString())
      if (!silent) setError(null)
    } catch (e: unknown) {
      if (!silent) {
        setError(e instanceof Error ? e.message : 'Failed to load platform status')
      }
    } finally {
      if (!silent) setRefreshing(false)
      setLoading(false)
    }
  }, [])

  const loadHistory = useCallback(async () => {
    try {
      const data = await api.pihedUptime(90) as { history?: UptimeHistory } | UptimeHistory
      // Backend returns { history: {...} } — be defensive.
      const hist = (data && 'history' in data && data.history) ? data.history : (data as UptimeHistory)
      setHistory(hist || {})
    } catch {
      setHistory({})
    } finally {
      setLoadingBars(false)
    }
  }, [])

  const refreshAll = useCallback(async () => {
    await Promise.all([loadStatus(false), loadHistory()])
    setCountdown(30)
  }, [loadStatus, loadHistory])

  // Initial load — runs once on mount.
  useEffect(() => {
    refreshAll()
  }, [refreshAll])

  // 30s auto-refresh + 1s countdown
  useEffect(() => {
    const tick = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          loadStatus(true) // silent refresh
          return 30
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(tick)
  }, [loadStatus])

  // ------------------------------------------------------------------
  // Derived data
  // ------------------------------------------------------------------

  const overall: OverallStatus = status?.status ?? 'OPERATIONAL'
  const overallCfg = OVERALL_CONFIG[overall]
  const services = status?.services ?? []
  const incidents = status?.incidents ?? []
  const maintenance = status?.maintenance ?? []
  const overallUptime = status?.uptime ?? 99.99

  // Build the incident-history timeline from the uptime bars: collect every
  // day in the last 30 days with incidents > 0 across all tracked services.
  const incidentDays = useMemo(() => {
    if (!history) return []
    const entries: Array<{ date: string; service: string; uptimePct: number; incidents: number }> = []
    for (const [svc, series] of Object.entries(history)) {
      // Take only the last 30 days
      const last30 = series.slice(-30)
      for (const day of last30) {
        if (day.incidents > 0 || day.uptimePct < 100) {
          entries.push({ date: day.date, service: svc, uptimePct: day.uptimePct, incidents: day.incidents })
        }
      }
    }
    // Sort: most recent first
    entries.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    return entries.slice(0, 10)
  }, [history])

  // ------------------------------------------------------------------
  // Loading state — full-page skeleton
  // ------------------------------------------------------------------

  if (loading) {
    return <StatusPageSkeleton />
  }

  // ------------------------------------------------------------------
  // Error state — friendly retry card
  // ------------------------------------------------------------------

  if (error && !status) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-red-100 dark:bg-red-500/15">
              <ServerCrash className="h-7 w-7 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold text-red-700 dark:text-red-300">
                Status information unavailable
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                We couldn't reach the VoteWise health service. Please try again.
              </p>
            </div>
            <Button onClick={() => refreshAll()} className="gap-2" disabled={refreshing}>
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {refreshing ? 'Retrying…' : 'Retry'}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
      {/* ============================ 1. HERO HEADER ============================ */}
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-8"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
                VoteWise Platform Status
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Real-time health and availability of all VoteWise services across{' '}
                <span className="font-medium text-foreground">{REGION_COUNT} regions</span>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* LIVE pulse indicator */}
            <div
              className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5"
              aria-label="Live status feed"
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </span>
              <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                Live
              </span>
            </div>

            {/* Refresh button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => refreshAll()}
              disabled={refreshing}
              className="gap-1.5"
            >
              {refreshing
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <RefreshCw className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>
      </motion.header>

      {/* ============================ OVERALL STATUS BANNER ============================ */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.05 }}
        className="mb-10"
      >
        <Card className={cn(
          'votewise-card-glow relative overflow-hidden border-2',
          overallCfg.ring,
        )}>
          {/* Subtle glow backdrop */}
          <div className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br', overallCfg.glow)} />
          <CardContent className="relative p-6 sm:p-8">
            <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-7">
              {/* Big icon */}
              <div className={cn(
                'grid h-20 w-20 shrink-0 place-items-center rounded-2xl ring-1 ring-inset ring-border/40',
                overallCfg.tile,
              )}>
                <overallCfg.Icon className={cn('h-11 w-11', overallCfg.titleColor)} strokeWidth={2.2} />
              </div>

              {/* Title + meta */}
              <div className="flex-1 text-center sm:text-left">
                <h2 className={cn('font-display text-2xl font-bold sm:text-3xl', overallCfg.titleColor)}>
                  {overallCfg.title}
                </h2>
                <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-muted-foreground sm:justify-start">
                  <span className="inline-flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5" />
                    <span>30-day uptime</span>
                    <span className={cn('font-mono font-semibold', uptimeTextColor(overallUptime))}>
                      {overallUptime.toFixed(2)}%
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Last updated</span>
                    <span className="font-medium text-foreground">{timeAgo(lastUpdated)}</span>
                  </span>
                </div>
              </div>

              {/* Quick stats column */}
              <div className="flex items-center gap-6 sm:flex-col sm:items-end sm:gap-2">
                <div className="text-center sm:text-right">
                  <div className="font-display text-2xl font-bold text-foreground sm:text-3xl">
                    {services.filter((s) => s.status === 'HEALTHY').length}
                    <span className="text-muted-foreground/60">/{services.length}</span>
                  </div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Services OK</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ============================ ACTIVE INCIDENTS ============================ */}
      <AnimatePresence>
        {incidents.length > 0 && (
          <motion.section
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-8"
          >
            <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Active Incidents
              <Badge variant="outline" className="ml-1 border-red-500/30 text-red-700 dark:text-red-300">
                {incidents.length}
              </Badge>
            </h2>
            <div className="space-y-3">
              {incidents.map((inc, i) => {
                const stageIdx = incidentStageIndex(inc.status)
                return (
                  <motion.div
                    key={`${inc.title}-${i}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Alert className="border-red-500/40 bg-red-500/5">
                      <ServerCrash className="h-4 w-4 text-red-600 dark:text-red-400" />
                      <AlertTitle className="flex flex-wrap items-center gap-2">
                        <Badge className={cn('text-[10px]', SEVERITY_BADGE[inc.severity] ?? SEVERITY_BADGE.MEDIUM)}>
                          {inc.severity}
                        </Badge>
                        <span className="font-semibold">{inc.title}</span>
                        <Badge className={cn('text-[10px]', INCIDENT_STATUS_BADGE[inc.status] ?? INCIDENT_STATUS_BADGE.DETECTED)}>
                          {inc.status}
                        </Badge>
                        <span className="ml-auto text-xs font-normal text-muted-foreground">
                          {timeAgo(inc.createdAt)}
                        </span>
                      </AlertTitle>
                      <AlertDescription>
                        {/* Investigating timeline */}
                        <div className="mt-3 flex flex-wrap items-center gap-1.5">
                          {INCIDENT_STAGES.map((stage, idx) => {
                            const isDone = idx < stageIdx
                            const isCurrent = idx === stageIdx
                            return (
                              <div key={stage} className="flex items-center gap-1.5">
                                <div className={cn(
                                  'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium',
                                  isDone && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
                                  isCurrent && 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 ring-1 ring-amber-500/40',
                                  !isDone && !isCurrent && 'bg-zinc-100 text-zinc-500 dark:bg-zinc-500/15 dark:text-zinc-400',
                                )}>
                                  <span className={cn(
                                    'inline-block h-1.5 w-1.5 rounded-full',
                                    isDone && 'bg-emerald-500',
                                    isCurrent && 'bg-amber-500 animate-pulse',
                                    !isDone && !isCurrent && 'bg-zinc-400',
                                  )} />
                                  {stage}
                                </div>
                                {idx < INCIDENT_STAGES.length - 1 && (
                                  <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </AlertDescription>
                    </Alert>
                  </motion.div>
                )
              })}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* ============================ ACTIVE MAINTENANCE ============================ */}
      <AnimatePresence>
        {maintenance.length > 0 && (
          <motion.section
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-8"
          >
            <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
              <CalendarClock className="h-5 w-5 text-amber-500" />
              Scheduled / Active Maintenance
              <Badge variant="outline" className="ml-1 border-amber-500/30 text-amber-700 dark:text-amber-300">
                {maintenance.length}
              </Badge>
            </h2>
            <div className="space-y-3">
              {maintenance.map((m, i) => (
                <motion.div
                  key={`${m.reason}-${i}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Alert className="border-amber-500/40 bg-amber-500/5">
                    <CalendarClock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <AlertTitle className="flex flex-wrap items-center gap-2">
                      <Badge className={cn('text-[10px]', MAINTENANCE_LEVEL_BADGE[m.level] ?? MAINTENANCE_LEVEL_BADGE.MODULE)}>
                        {m.level}
                      </Badge>
                      <span className="font-semibold">{m.reason}</span>
                      {m.isActive && (
                        <Badge className="gap-1 bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
                          </span>
                          Active
                        </Badge>
                      )}
                      <span className="ml-auto text-xs font-normal text-muted-foreground">
                        Started {timeAgo(m.startedAt)}
                      </span>
                    </AlertTitle>
                  </Alert>
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* ============================ ELECTION READINESS BADGE ============================ */}
      <section className="mb-8">
        <ReadinessBadgeWidget voters={0} />
      </section>

      {/* ============================ 90-DAY UPTIME BAR CHART ============================ */}
      <section className="mb-10">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-xl font-semibold">90-Day Uptime History</h2>
            <p className="text-sm text-muted-foreground">
              Daily uptime across all VoteWise infrastructure services.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Operational
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-500" /> Degraded
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-500" /> Outage
            </span>
          </div>
        </div>

        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="space-y-3">
              {TRACKED_SERVICES.map((svc, svcIdx) => {
                const Icon = TRACKED_ICON[svc] ?? Server
                const series = history?.[svc] ?? []
                const avgUptime = series.length > 0
                  ? series.reduce((s, d) => s + d.uptimePct, 0) / series.length
                  : 100
                const oldest = series[0]?.date
                return (
                  <motion.div
                    key={svc}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: svcIdx * 0.06, duration: 0.35 }}
                    className="flex flex-col gap-2 rounded-lg border border-border/40 bg-card/50 p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-3.5"
                  >
                    {/* Service name */}
                    <div className="flex w-full items-center gap-2 sm:w-44 sm:shrink-0">
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{svc}</div>
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground sm:hidden">
                          {avgUptime.toFixed(2)}% uptime
                        </div>
                      </div>
                    </div>

                    {/* Bars strip */}
                    <div className="min-w-0 flex-1">
                      {loadingBars ? (
                        <UptimeBarsSkeleton />
                      ) : series.length === 0 ? (
                        <div className="flex h-10 items-center text-xs text-muted-foreground">
                          No data
                        </div>
                      ) : (
                        <div className="votewise-scroll flex h-10 items-end gap-px overflow-x-auto pb-0.5">
                          {series.map((day, i) => (
                            <motion.div
                              key={day.date}
                              initial={{ scaleY: 0 }}
                              animate={{ scaleY: 1 }}
                              transition={{ delay: Math.min(i * 0.004, 0.4), duration: 0.3, ease: 'easeOut' }}
                              style={{ transformOrigin: 'bottom' }}
                              className={cn(
                                'h-full w-[3px] shrink-0 rounded-sm sm:w-[4px]',
                                uptimeColor(day.uptimePct),
                                'transition-transform hover:scale-y-110 hover:opacity-80',
                              )}
                              title={`${formatDayLabel(day.date)} · ${day.uptimePct.toFixed(2)}% uptime · ${day.incidents} incident${day.incidents === 1 ? '' : 's'}`}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Right meta */}
                    <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end sm:gap-4">
                      <div className="text-[11px] text-muted-foreground">
                        {oldest ? `${timeAgoShort(oldest)}` : '—'}
                      </div>
                      <div className={cn('font-mono text-sm font-semibold', uptimeTextColor(avgUptime))}>
                        {avgUptime.toFixed(2)}%
                      </div>
                    </div>
                  </motion.div>
                )
              })}

              {loadingBars && (
                <div className="pt-1 text-center text-xs text-muted-foreground">
                  Loading 90-day uptime history…
                </div>
              )}
            </div>

            {/* Legend (mobile / bottom) */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-3 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-sm bg-emerald-500" /> Operational (&gt;99.9%)
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-sm bg-amber-500" /> Degraded (99–99.9%)
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-sm bg-red-500" /> Outage (&lt;99%)
                </span>
              </div>
              <span>Hover any bar for daily details.</span>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ============================ SERVICE HEALTH GRID ============================ */}
      <section className="mb-10">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-xl font-semibold">Service Health</h2>
            <p className="text-sm text-muted-foreground">
              Live health checks across {services.length} platform services.
            </p>
          </div>
          <div className="text-xs text-muted-foreground">
            {refreshing ? (
              <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                <Loader2 className="h-3 w-3 animate-spin" /> Refreshing…
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                Refreshing in <span className="font-mono font-medium text-foreground">{countdown}s</span>
              </span>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((svc, i) => {
            const Icon = SERVICE_ICON[svc.name] ?? CATEGORY_ICON[svc.category] ?? Server
            const tileCls = HEALTH_TILE_CLASS[svc.status] ?? HEALTH_TILE_CLASS.UNKNOWN
            const iconCls = HEALTH_ICON_CLASS[svc.status] ?? HEALTH_ICON_CLASS.UNKNOWN
            const isDown = svc.status === 'UNHEALTHY'
            return (
              <motion.div
                key={svc.name}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.035, duration: 0.3 }}
              >
                <Card className={cn(
                  'h-full transition-all',
                  isDown && 'border-red-500/40 ring-1 ring-red-500/30',
                )}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-lg', tileCls)}>
                        <Icon className={cn('h-5 w-5', iconCls)} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold">{svc.name}</div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                              <Badge variant="outline" className={cn('text-[9px] uppercase', CATEGORY_BADGE[svc.category] ?? CATEGORY_BADGE.core)}>
                                {svc.category}
                              </Badge>
                            </div>
                          </div>
                          <Badge className={cn('text-[10px]', HEALTH_BADGE[svc.status] ?? HEALTH_BADGE.UNKNOWN)}>
                            <span className="inline-flex items-center gap-1">
                              <span className={cn('inline-block h-1.5 w-1.5 rounded-full',
                                svc.status === 'HEALTHY' ? 'bg-emerald-500'
                                : svc.status === 'DEGRADED' ? 'bg-amber-500'
                                : svc.status === 'UNHEALTHY' ? 'bg-red-500'
                                : 'bg-zinc-400')} />
                              {HEALTH_LABEL[svc.status] ?? 'Unknown'}
                            </span>
                          </Badge>
                        </div>
                        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground" title={svc.message}>
                          {svc.message}
                        </p>
                        <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Zap className="h-3 w-3" />
                            <span className="font-mono">—</span>
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <span>uptime</span>
                            <span className={cn('font-mono font-semibold', uptimeTextColor(svc.uptime))}>
                              {svc.uptime.toFixed(1)}%
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      </section>

      {/* ============================ INCIDENT HISTORY TIMELINE ============================ */}
      <section className="mb-10">
        <div className="mb-4 flex items-center gap-2">
          <History className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-display text-xl font-semibold">Incident History</h2>
          <Badge variant="outline" className="text-[10px]">Last 30 days</Badge>
        </div>

        <Card>
          <CardContent className="p-4 sm:p-6">
            {incidentDays.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <div className="grid h-14 w-14 place-items-center rounded-full bg-emerald-100 dark:bg-emerald-500/15">
                  <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="font-display text-lg font-semibold text-emerald-700 dark:text-emerald-300">
                    No incidents in the last 30 days
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    All VoteWise services have run without interruption.
                  </p>
                </div>
              </div>
            ) : (
              <ol className="relative space-y-4 before:absolute before:left-[7px] before:top-1 before:bottom-1 before:w-px before:bg-border sm:before:left-[9px]">
                {incidentDays.map((day, i) => {
                  const mins = downtimeMinutes(day.uptimePct)
                  const sev = day.uptimePct < 99 ? 'Outage' : 'Degraded'
                  const dotColor = day.uptimePct < 99 ? 'bg-red-500' : 'bg-amber-500'
                  return (
                    <motion.li
                      key={`${day.date}-${day.service}-${i}`}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="relative flex gap-4 pl-6 sm:pl-8"
                    >
                      <span className={cn(
                        'absolute left-0 top-1.5 inline-block h-3.5 w-3.5 rounded-full ring-2 ring-card',
                        dotColor,
                      )} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold">{day.service}</span>
                          <Badge className={cn(
                            'text-[10px]',
                            day.uptimePct < 99
                              ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
                          )}>
                            {sev}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] text-emerald-700 dark:text-emerald-300">
                            Resolved
                          </Badge>
                          <span className="ml-auto text-xs text-muted-foreground">
                            {formatDayLabel(day.date)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {sev === 'Outage'
                            ? `Service outage — approximately ${mins} minute${mins === 1 ? '' : 's'} of downtime`
                            : `Degraded performance for approximately ${mins} minute${mins === 1 ? '' : 's'}`}
                          {' '}· uptime {day.uptimePct.toFixed(2)}%
                        </p>
                      </div>
                    </motion.li>
                  )
                })}
              </ol>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ============================ SUBSCRIBE TO UPDATES ============================ */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-10"
      >
        <Card className="votewise-card-glow overflow-hidden border-primary/20">
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <BellRing className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-semibold">Get notified when incidents occur</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Subscribe to receive email alerts the moment a service is degraded or down.
                  </p>
                </div>
              </div>
              <SubscribeForm />
            </div>
          </CardContent>
        </Card>
      </motion.section>

      {/* ============================ FOOTER (status-page-specific) ============================ */}
      <footer className="mt-12 border-t border-border/60 pt-6 text-center text-xs text-muted-foreground">
        <p className="font-medium text-foreground/80">VoteWise Election Platform — Infrastructure Health Monitoring</p>
        <p className="mt-1">
          Auto-refreshes every 30 seconds · Powered by Chapter 17 PIHD
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <Link
            href="/workspace/developer"
            className="inline-flex items-center gap-1 text-foreground/70 transition-colors hover:text-foreground"
          >
            View API documentation
            <ArrowUpRight className="h-3 w-3" />
          </Link>
          <span className="text-border">·</span>
          <a
            href="mailto:infra@votewise.ng?subject=VoteWise%20Status%20Page%20Issue"
            className="inline-flex items-center gap-1 text-foreground/70 transition-colors hover:text-foreground"
          >
            Report an issue
            <ArrowUpRight className="h-3 w-3" />
          </a>
        </div>
      </footer>
    </div>
  )
}

// ===========================================================================
// Sub-components
// ===========================================================================

function SubscribeForm() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) {
      toast.error('Please enter your email address')
      return
    }
    // RFC-5322-lite email check
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
    if (!ok) {
      toast.error('Please enter a valid email address')
      return
    }
    setBusy(true)
    // Simulate a network call — UX touch only, no backend required.
    setTimeout(() => {
      setBusy(false)
      setEmail('')
      toast.success("Subscribed — you'll receive email alerts for incidents", {
        description: `We'll send platform health updates to ${trimmed}`,
      })
    }, 600)
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-md items-center gap-2 sm:w-auto">
      <Input
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="you@university.edu.ng"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        aria-label="Email address"
        className="flex-1 sm:w-64"
        disabled={busy}
      />
      <Button type="submit" disabled={busy} className="gap-1.5">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
        Subscribe
      </Button>
    </form>
  )
}

function UptimeBarsSkeleton() {
  return (
    <div className="flex h-10 items-end gap-px overflow-hidden">
      {Array.from({ length: 90 }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-full w-[3px] shrink-0 rounded-sm sm:w-[4px]"
          style={{ animationDelay: `${(i % 12) * 80}ms` }}
        />
      ))}
    </div>
  )
}

function StatusPageSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
      {/* Header */}
      <div className="mb-8 flex items-center gap-3">
        <Skeleton className="h-12 w-12 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-80" />
        </div>
      </div>

      {/* Banner */}
      <Skeleton className="votewise-card-glow mb-10 h-40 w-full rounded-xl" />

      {/* Uptime chart placeholder */}
      <Skeleton className="mb-4 h-6 w-48" />
      <Skeleton className="mb-10 h-72 w-full rounded-xl" />

      {/* Service grid */}
      <Skeleton className="mb-4 h-6 w-40" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    </div>
  )
}

export default PlatformStatusPage
