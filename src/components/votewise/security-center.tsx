'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Shield, ShieldAlert, ShieldCheck, Activity, AlertTriangle, AlertCircle,
  CheckCircle2, XCircle, Clock, Lock, LockOpen, Siren, TrendingUp, Eye, Zap,
  Flame, Loader2, RefreshCw, ChevronRight, Fingerprint, Server, Ban,
} from 'lucide-react'
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { IncidentDetail } from '@/components/votewise/incident-detail'

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

type ThreatLevel = 'LOW' | 'MODERATE' | 'ELEVATED' | 'HIGH' | 'CRITICAL'

interface DashboardData {
  activeElections: number
  threatLevel: ThreatLevel
  activeIncidents: number
  blockedAttempts: number
  integrityScore: number
  platformHealth: 'HEALTHY' | 'DEGRADED' | 'CRITICAL'
  incidentsBySeverity: Record<string, number>
  incidentsByCategory: Record<string, number>
  eventsByCategory: Record<string, number>
  recentIncidents: Array<{
    id: string
    incidentNumber: string
    title: string
    severity: string
    status: string
    riskScore: number
    detectedAt: string
  }>
  recentEvents: Array<{
    id: string
    eventType: string
    category: string
    severity: string
    description: string
    actorName?: string
    detected: boolean
    createdAt: string
  }>
  eventsPerHour: number
  incidentsToday: number
  resolvedToday: number
}

interface ElectionSummary {
  id: string
  name: string
  status: string
  startTime: string
  endTime: string
  workspace?: { name?: string } | null
}

// ----------------------------------------------------------------------------
// Helpers — colour & label maps (emerald / gold / amber / zinc / red — NO indigo/blue)
// ----------------------------------------------------------------------------

const THREAT_LEVEL_STYLE: Record<ThreatLevel, { badge: string; dot: string; label: string; pulse?: boolean }> = {
  LOW: {
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    dot: 'bg-emerald-500',
    label: 'Low',
  },
  MODERATE: {
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    dot: 'bg-amber-500',
    label: 'Moderate',
  },
  ELEVATED: {
    badge: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
    dot: 'bg-orange-500',
    label: 'Elevated',
  },
  HIGH: {
    badge: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
    dot: 'bg-red-500',
    label: 'High',
  },
  CRITICAL: {
    badge: 'bg-red-600 text-white dark:bg-red-500 dark:text-white animate-pulse',
    dot: 'bg-red-600',
    label: 'Critical',
    pulse: true,
  },
}

const SEVERITY_STYLE: Record<string, { badge: string; bar: string; ring: string; label: string }> = {
  LOW: {
    badge: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-300',
    bar: 'bg-zinc-400',
    ring: 'border-zinc-200 dark:border-zinc-700',
    label: 'Low',
  },
  MEDIUM: {
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    bar: 'bg-amber-500',
    ring: 'border-amber-200 dark:border-amber-800',
    label: 'Medium',
  },
  HIGH: {
    badge: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
    bar: 'bg-amber-600',
    ring: 'border-amber-300 dark:border-amber-700',
    label: 'High',
  },
  CRITICAL: {
    badge: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
    bar: 'bg-red-600',
    ring: 'border-red-300 dark:border-red-800',
    label: 'Critical',
  },
  INFO: {
    badge: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-500/15 dark:text-zinc-400',
    bar: 'bg-zinc-300',
    ring: 'border-zinc-200 dark:border-zinc-700',
    label: 'Info',
  },
}

const STATUS_STYLE: Record<string, string> = {
  DETECTED: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300',
  OPEN: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  ASSIGNED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  INVESTIGATING: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
  CONTAINMENT: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  RESOLVED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-600/20 dark:text-emerald-200',
  CLOSED: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-300',
  ARCHIVED: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-500/15 dark:text-zinc-400',
}

const CATEGORY_LABELS: Record<string, string> = {
  IDENTITY: 'Identity',
  AUTHENTICATION: 'Authentication',
  VOTING: 'Voting',
  ADMIN: 'Admin',
  OBSERVER: 'Observer',
  INFRASTRUCTURE: 'Infrastructure',
  NETWORK: 'Network',
  AUTOMATION: 'Automation',
  IDENTITY_FRAUD: 'Identity Fraud',
  LOGIN_ABUSE: 'Login Abuse',
  OTVP_ABUSE: 'OTVP Abuse',
  SESSION_ABUSE: 'Session Abuse',
  SHARED_DEVICE: 'Shared Device',
  NETWORK_ANOMALY: 'Network Anomaly',
  VOTE_TIMING: 'Vote Timing',
  TURNOUT_ANOMALY: 'Turnout Anomaly',
  ADMIN_ABUSE: 'Admin Abuse',
  OBSERVER_ABUSE: 'Observer Abuse',
  AUTOMATION_OTHER: 'Automation',
  OTHER: 'Other',
}

function relTime(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  try {
    return d.toLocaleDateString(undefined, { month: 'short', day: '2-digit' })
  } catch {
    return iso
  }
}

function severityStyle(sev: string) {
  return SEVERITY_STYLE[sev] || SEVERITY_STYLE.INFO
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function SecurityCenter({ subdomain }: { subdomain?: string }) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [autoRefresh, setAutoRefresh] = useState(true)

  // Live elections for the lockdown selector
  const [liveElections, setLiveElections] = useState<ElectionSummary[]>([])

  // Incident detail dialog
  const [openIncidentId, setOpenIncidentId] = useState<string | null>(null)

  const loadDashboard = useCallback(async () => {
    try {
      const d = await api.getEifdirsDashboard(subdomain)
      setData(d as DashboardData)
      setError(null)
      setLastRefresh(new Date())
    } catch (e: any) {
      setError(e?.message || 'Failed to load security dashboard')
    } finally {
      setLoading(false)
    }
  }, [subdomain])

  const loadLiveElections = useCallback(async () => {
    try {
      const res: any = await api.electionCenter(subdomain)
      const running: ElectionSummary[] = (res?.running || []).map((e: any) => ({
        id: e.id,
        name: e.name,
        status: e.status,
        startTime: e.startTime,
        endTime: e.endTime,
        workspace: e.workspace,
      }))
      setLiveElections(running)
    } catch {
      setLiveElections([])
    }
  }, [subdomain])

  useEffect(() => {
    loadDashboard()
    loadLiveElections()
  }, [loadDashboard, loadLiveElections])

  // Auto-refresh every 15s
  useEffect(() => {
    if (!autoRefresh) return
    const t = setInterval(() => {
      loadDashboard()
      loadLiveElections()
    }, 15000)
    return () => clearInterval(t)
  }, [autoRefresh, loadDashboard, loadLiveElections])

  if (loading) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading Election Security Center…</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-destructive/50" />
        <h2 className="mt-4 font-display text-xl font-bold">Security Center Unavailable</h2>
        <p className="mt-2 text-sm text-muted-foreground">{error || 'Could not load the security dashboard.'}</p>
        <Button onClick={loadDashboard} className="mt-4 gap-2">
          <RefreshCw className="h-4 w-4" /> Retry
        </Button>
      </div>
    )
  }

  const threat = THREAT_LEVEL_STYLE[data.threatLevel] || THREAT_LEVEL_STYLE.LOW
  const integrityColor =
    data.integrityScore > 95
      ? 'text-emerald-600 dark:text-emerald-400'
      : data.integrityScore > 85
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-red-600 dark:text-red-400'
  const integrityBg =
    data.integrityScore > 95
      ? 'from-emerald-500/15 to-emerald-500/5'
      : data.integrityScore > 85
        ? 'from-amber-500/15 to-amber-500/5'
        : 'from-red-500/15 to-red-500/5'

  const healthStyle =
    data.platformHealth === 'HEALTHY'
      ? { badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', icon: ShieldCheck }
      : data.platformHealth === 'DEGRADED'
        ? { badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300', icon: AlertTriangle }
        : { badge: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300', icon: AlertCircle }
  const HealthIcon = healthStyle.icon

  const sevCounts = {
    LOW: data.incidentsBySeverity?.LOW || 0,
    MEDIUM: data.incidentsBySeverity?.MEDIUM || 0,
    HIGH: data.incidentsBySeverity?.HIGH || 0,
    CRITICAL: data.incidentsBySeverity?.CRITICAL || 0,
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
      {/* ---------------------------------------------------------------- */}
      {/* Header card — votewise-card-glow                                  */}
      {/* ---------------------------------------------------------------- */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <Card className="votewise-card-glow border-primary/20 overflow-hidden">
          <CardContent className="p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Shield className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="font-display text-2xl font-bold tracking-tight">Election Security Center</h1>
                    <Badge className={cn('gap-1.5 font-semibold', threat.badge)}>
                      <span className={cn('h-1.5 w-1.5 rounded-full', threat.dot, threat.pulse && 'animate-pulse')} />
                      {threat.label} Threat
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    EIFDIRS · Election Integrity, Fraud Detection &amp; Incident Response System
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    loadDashboard()
                    loadLiveElections()
                  }}
                  className="gap-1.5"
                  aria-label="Refresh security dashboard"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Refresh
                </Button>
                <Button
                  variant={autoRefresh ? 'outline' : 'ghost'}
                  size="sm"
                  onClick={() => setAutoRefresh((v) => !v)}
                  className="gap-1.5"
                  aria-label={autoRefresh ? 'Pause auto-refresh' : 'Resume auto-refresh'}
                >
                  {autoRefresh ? (
                    <>
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                      </span>
                      Auto · 15s
                    </>
                  ) : (
                    <>
                      <span className="h-2 w-2 rounded-full bg-zinc-400" />
                      Paused
                    </>
                  )}
                </Button>
              </div>
            </div>

            <Separator className="my-4" />

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Last updated {relTime(lastRefresh.toISOString())}
              </span>
              <span className="flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5" />
                {data.eventsPerHour} events/hr
              </span>
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                {data.incidentsToday} incidents today
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                {data.resolvedToday} resolved today
              </span>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ---------------------------------------------------------------- */}
      {/* Overview stats — 6 cards                                         */}
      {/* ---------------------------------------------------------------- */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          icon={Activity}
          label="Active Elections"
          value={data.activeElections}
          accent="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
          delay={0.05}
        />
        <StatCard
          icon={ShieldAlert}
          label="Threat Level"
          value={threat.label}
          accent={threat.badge}
          delay={0.1}
        />
        <StatCard
          icon={Siren}
          label="Active Incidents"
          value={data.activeIncidents}
          accent={
            data.activeIncidents > 0
              ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300 animate-pulse'
              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
          }
          delay={0.15}
        />
        <StatCard
          icon={Ban}
          label="Blocked Attempts"
          value={data.blockedAttempts}
          accent="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
          delay={0.2}
        />
        <StatCard
          icon={ShieldCheck}
          label="Integrity Score"
          value={data.integrityScore.toFixed(1)}
          accent="bg-primary/10 text-primary"
          delay={0.25}
          valueClassName={integrityColor}
        />
        <StatCard
          icon={HealthIcon}
          label="Platform Health"
          value={data.platformHealth === 'HEALTHY' ? 'Healthy' : data.platformHealth === 'DEGRADED' ? 'Degraded' : 'Critical'}
          accent={healthStyle.badge}
          delay={0.3}
        />
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Incidents by severity — 4 mini cards                              */}
      {/* ---------------------------------------------------------------- */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map((sev, i) => {
          const st = severityStyle(sev)
          const count = sevCounts[sev]
          return (
            <motion.div
              key={sev}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 + i * 0.05 }}
            >
              <Card className={cn('border-l-4', st.ring)}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {st.label} Severity
                      </div>
                      <div className="font-display text-2xl font-bold tabular-nums">{count}</div>
                    </div>
                    <div
                      className={cn(
                        'grid h-10 w-10 place-items-center rounded-lg',
                        sev === 'LOW' && 'bg-zinc-100 text-zinc-500 dark:bg-zinc-500/15 dark:text-zinc-300',
                        sev === 'MEDIUM' && 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
                        sev === 'HIGH' && 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
                        sev === 'CRITICAL' && 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
                      )}
                    >
                      {sev === 'LOW' && <CheckCircle2 className="h-5 w-5" />}
                      {sev === 'MEDIUM' && <AlertTriangle className="h-5 w-5" />}
                      {sev === 'HIGH' && <AlertCircle className="h-5 w-5" />}
                      {sev === 'CRITICAL' && <Flame className="h-5 w-5" />}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Incidents by category + Events by category                       */}
      {/* ---------------------------------------------------------------- */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <CategoryBreakdownCard
          title="Incidents by Category"
          icon={Siren}
          counts={data.incidentsByCategory}
          emptyLabel="No incidents recorded"
        />
        <CategoryBreakdownCard
          title="Events by Category"
          icon={Activity}
          counts={data.eventsByCategory}
          emptyLabel="No events recorded"
        />
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Recent incidents + recent events (scrollable)                    */}
      {/* ---------------------------------------------------------------- */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {/* Recent incidents */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="font-display text-base flex items-center gap-2">
                <Siren className="h-4 w-4 text-primary" />
                Recent Incidents
              </CardTitle>
              <Badge variant="outline" className="text-[10px]">
                {data.recentIncidents.length} of {data.incidentsToday}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="votewise-scroll max-h-80 overflow-y-auto px-4 pb-4">
              {data.recentIncidents.length === 0 ? (
                <EmptyState
                  icon={ShieldCheck}
                  title="No incidents detected"
                  subtitle="The system is operating normally."
                />
              ) : (
                <div className="space-y-1">
                  {data.recentIncidents.map((inc, idx) => {
                    const st = severityStyle(inc.severity)
                    return (
                      <motion.button
                        key={inc.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.25, delay: idx * 0.03 }}
                        onClick={() => setOpenIncidentId(inc.id)}
                        className="flex w-full items-center gap-3 rounded-lg border border-transparent p-2.5 text-left transition-colors hover:border-border hover:bg-muted/40"
                      >
                        <div
                          className={cn(
                            'grid h-9 w-9 shrink-0 place-items-center rounded-lg',
                            st.badge,
                          )}
                        >
                          {inc.severity === 'CRITICAL' ? (
                            <Flame className="h-4 w-4" />
                          ) : inc.severity === 'HIGH' ? (
                            <AlertCircle className="h-4 w-4" />
                          ) : (
                            <AlertTriangle className="h-4 w-4" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] font-semibold text-muted-foreground">
                              {inc.incidentNumber}
                            </span>
                            <Badge className={cn('text-[9px] px-1.5 py-0', st.badge)}>{st.label}</Badge>
                            <Badge variant="outline" className={cn('text-[9px] px-1.5 py-0', STATUS_STYLE[inc.status] || '')}>
                              {inc.status}
                            </Badge>
                          </div>
                          <div className="truncate text-sm font-medium">{inc.title}</div>
                          <div className="text-[10px] text-muted-foreground">
                            detected {relTime(inc.detectedAt)} · risk {inc.riskScore}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </motion.button>
                    )
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent events */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="font-display text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Recent Integrity Events
              </CardTitle>
              <Badge variant="outline" className="text-[10px]">
                {data.eventsPerHour}/hr
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="votewise-scroll max-h-80 overflow-y-auto px-4 pb-4">
              {data.recentEvents.length === 0 ? (
                <EmptyState
                  icon={Eye}
                  title="No events recorded"
                  subtitle="Activity will appear here as it happens."
                />
              ) : (
                <div className="space-y-1">
                  {data.recentEvents.map((ev, idx) => {
                    const st = severityStyle(ev.severity)
                    return (
                      <motion.div
                        key={ev.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.25, delay: idx * 0.03 }}
                        className={cn(
                          'flex items-start gap-3 rounded-lg border border-transparent p-2.5',
                          ev.detected && 'border-red-200 bg-red-50/50 dark:border-red-900/40 dark:bg-red-950/20',
                        )}
                      >
                        <div className="relative shrink-0">
                          <div
                            className={cn(
                              'grid h-9 w-9 place-items-center rounded-lg',
                              ev.detected
                                ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300'
                                : st.badge,
                            )}
                          >
                            {ev.detected ? <Zap className="h-4 w-4" /> : <Activity className="h-4 w-4" />}
                          </div>
                          {ev.detected && (
                            <span
                              className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-background bg-red-500 animate-pulse"
                              aria-label="Detected event"
                            />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[10px] font-semibold text-muted-foreground">
                              {ev.eventType.replace(/_/g, ' ')}
                            </span>
                            <Badge className={cn('text-[9px] px-1.5 py-0', st.badge)}>{st.label}</Badge>
                            <span className="text-[10px] text-muted-foreground">
                              · {CATEGORY_LABELS[ev.category] || ev.category}
                            </span>
                          </div>
                          <div className="line-clamp-2 text-xs">{ev.description}</div>
                          <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                            {ev.actorName && (
                              <span className="flex items-center gap-1">
                                <Fingerprint className="h-3 w-3" /> {ev.actorName}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" /> {relTime(ev.createdAt)}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Emergency lockdown                                               */}
      {/* ---------------------------------------------------------------- */}
      {liveElections.length > 0 && (
        <EmergencyLockdownCard
          liveElections={liveElections}
          subdomain={subdomain}
          onChanged={loadDashboard}
        />
      )}

      {/* Incident detail dialog */}
      {openIncidentId && (
        <IncidentDetail
          incidentId={openIncidentId}
          subdomain={subdomain}
          open={!!openIncidentId}
          onClose={() => setOpenIncidentId(null)}
        />
      )}
    </div>
  )
}

// ----------------------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------------------

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
  delay = 0,
  valueClassName,
}: {
  icon: any
  label: string
  value: number | string
  accent: string
  delay?: number
  valueClassName?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
    >
      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <div className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl', accent)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
            <div className={cn('font-display text-xl font-bold tabular-nums truncate', valueClassName)}>
              {typeof value === 'number' ? value.toLocaleString() : value}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function CategoryBreakdownCard({
  title,
  icon: Icon,
  counts,
  emptyLabel,
}: {
  title: string
  icon: any
  counts: Record<string, number>
  emptyLabel: string
}) {
  const entries = Object.entries(counts || {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])
  const max = Math.max(1, ...entries.map(([, n]) => n))
  const total = entries.reduce((s, [, n]) => s + n, 0)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="font-display text-base flex items-center gap-2">
            <Icon className="h-4 w-4 text-primary" />
            {title}
          </CardTitle>
          <Badge variant="outline" className="text-[10px]">
            {total} total
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">{emptyLabel}</div>
        ) : (
          <div className="space-y-2.5">
            {entries.map(([cat, n], i) => {
              const pct = Math.round((n / max) * 100)
              const colorClass =
                i % 5 === 0
                  ? 'bg-emerald-500'
                  : i % 5 === 1
                    ? 'bg-amber-500'
                    : i % 5 === 2
                      ? 'bg-amber-600'
                      : i % 5 === 3
                        ? 'bg-red-500'
                        : 'bg-zinc-400'
              return (
                <div key={cat}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium">{CATEGORY_LABELS[cat] || cat.replace(/_/g, ' ')}</span>
                    <span className="font-mono tabular-nums text-muted-foreground">{n}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, delay: i * 0.05, ease: 'easeOut' }}
                      className={cn('h-full rounded-full', colorClass)}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function EmptyState({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle: string }) {
  return (
    <div className="py-10 text-center">
      <Icon className="mx-auto h-10 w-10 text-muted-foreground/40" />
      <p className="mt-2 text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
    </div>
  )
}

// ----------------------------------------------------------------------------
// Emergency lockdown card
// ----------------------------------------------------------------------------

function EmergencyLockdownCard({
  liveElections,
  subdomain,
  onChanged,
}: {
  liveElections: ElectionSummary[]
  subdomain?: string
  onChanged: () => void
}) {
  const [electionId, setElectionId] = useState<string>(liveElections[0]?.id || '')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  // Keep the selected election id valid if the live list changes
  useEffect(() => {
    if (!liveElections.find((e) => e.id === electionId)) {
      setElectionId(liveElections[0]?.id || '')
    }
  }, [liveElections, electionId])

  async function doLockdown() {
    if (!electionId || !reason.trim()) {
      toast.error('Election and reason are required')
      return
    }
    setSubmitting(true)
    try {
      await api.eifdirsLockdown(
        { electionId, action: 'initiate', reason: reason.trim() },
        subdomain,
      )
      toast.success('Emergency lockdown initiated. All voting frozen.')
      setReason('')
      setConfirmOpen(false)
      onChanged()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to initiate lockdown')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.2 }}
    >
      <Card className="border-red-200 dark:border-red-900/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="font-display text-base flex items-center gap-2 text-red-700 dark:text-red-400">
              <Lock className="h-4 w-4" />
              Emergency Lockdown
            </CardTitle>
            <Badge className="bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300">
              {liveElections.length} live election{liveElections.length === 1 ? '' : 's'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive" className="border-red-300 bg-red-50/60 dark:border-red-900/60 dark:bg-red-950/20">
            <Siren className="h-4 w-4" />
            <AlertTitle className="text-red-800 dark:text-red-300">Use only in a verified security incident</AlertTitle>
            <AlertDescription className="text-red-700 dark:text-red-400">
              Initiating a lockdown will freeze all voting immediately, preserve active sessions, lock configuration, and
              secure evidence. A CRITICAL incident will be opened automatically.
            </AlertDescription>
          </Alert>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="lockdown-election-select" className="text-xs">
                Target Election
              </Label>
              <Select value={electionId} onValueChange={setElectionId}>
                <SelectTrigger id="lockdown-election-select" className="w-full">
                  <SelectValue placeholder="Select a live election" />
                </SelectTrigger>
                <SelectContent>
                  {liveElections.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      <span className="truncate">{e.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lockdown-reason-input" className="text-xs">
                Reason (required)
              </Label>
              <Input
                id="lockdown-reason-input"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Suspected coordinated fraud from VPN cluster"
              />
            </div>
          </div>

          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              This action is logged in the audit trail and creates a CRITICAL incident for forensic review.
            </p>
            <Button
              variant="destructive"
              className="gap-2 bg-red-600 hover:bg-red-700"
              disabled={!electionId || !reason.trim() || submitting}
              onClick={() => setConfirmOpen(true)}
            >
              <Lock className="h-4 w-4" />
              Initiate Lockdown
            </Button>
          </div>

          <AlertDialog open={confirmOpen} onOpenChange={(o) => !submitting && setConfirmOpen(o)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
                  <Siren className="h-5 w-5" />
                  Confirm Emergency Lockdown
                </AlertDialogTitle>
                <AlertDialogDescription>
                  You are about to lock down{' '}
                  <span className="font-semibold text-foreground">
                    {liveElections.find((e) => e.id === electionId)?.name || 'this election'}
                  </span>
                  . All voting will be frozen immediately. This action cannot be undone without an explicit release.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                <p className="font-semibold">Reason:</p>
                <p className="mt-1">{reason || '—'}</p>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault()
                    doLockdown()
                  }}
                  disabled={submitting}
                  className="gap-1.5 bg-red-600 hover:bg-red-700 focus-visible:ring-red-600/30"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Lock className="h-4 w-4" />
                  )}
                  Lock Down Now
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </motion.div>
  )
}
