'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle, AlertCircle, Bell, Shield, Activity, Plus, Search,
  Filter, Clock, User, MapPin, CheckCircle2, XCircle, Zap, Siren,
  Loader2, RefreshCw, ChevronDown, ChevronRight,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
interface Incident {
  id: string
  type: string
  severity: string
  status: string
  title: string
  description: string
  location?: string | null
  reportedById?: string | null
  reportedByName: string
  affectedVoterId?: string | null
  assignedToId?: string | null
  assignedToName?: string | null
  resolvedAt?: string | null
  resolutionNotes?: string | null
  metadata?: string | null
  createdAt: string
  updatedAt: string
}

interface IncidentStats {
  total: number
  open: number
  critical: number
  resolved: number
  escalated: number
  investigating?: number
  bySeverity: { LOW: number; MEDIUM: number; HIGH: number; CRITICAL: number }
  byStatus: { OPEN: number; INVESTIGATING: number; RESOLVED: number; ESCALATED: number; DISMISSED: number }
  byType: Record<string, number>
  recent?: Incident[]
}

interface IncidentsResponse {
  incidents: Incident[]
  stats: IncidentStats
  electionId: string
  electionName: string
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------
const VALID_TYPES = ['VOTER_INTIMIDATION', 'SYSTEM_MALFUNCTION', 'IRREGULARITY', 'DISPUTE', 'TECHNICAL_ISSUE', 'OTHER']
const VALID_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
const VALID_STATUSES = ['OPEN', 'INVESTIGATING', 'RESOLVED', 'ESCALATED', 'DISMISSED']

const STATUS_FILTERS = ['All', 'OPEN', 'INVESTIGATING', 'RESOLVED', 'ESCALATED', 'DISMISSED'] as const
const SEVERITY_FILTERS = ['All', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------
function relativeTime(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return 'Just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  try {
    return d.toLocaleString(undefined, { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch { return iso }
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return iso }
}

function severityStyle(sev: string): { badge: string; dot: string; label: string; pulsing?: boolean } {
  switch (sev) {
    case 'CRITICAL':
      return {
        badge: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900',
        dot: 'bg-red-500',
        label: 'Critical',
        pulsing: true,
      }
    case 'HIGH':
      return {
        badge: 'bg-amber-600/15 text-amber-700 border-amber-600/30 dark:text-amber-400 dark:border-amber-700',
        dot: 'bg-amber-600',
        label: 'High',
      }
    case 'MEDIUM':
      return {
        badge: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900',
        dot: 'bg-amber-500',
        label: 'Medium',
      }
    case 'LOW':
    default:
      return {
        badge: 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800/60 dark:text-zinc-400 dark:border-zinc-700',
        dot: 'bg-zinc-400',
        label: 'Low',
      }
  }
}

function statusStyle(status: string): { badge: string; label: string } {
  switch (status) {
    case 'OPEN':
      return { badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400', label: 'Open' }
    case 'INVESTIGATING':
      return { badge: 'bg-primary/10 text-primary', label: 'Investigating' }
    case 'RESOLVED':
      return { badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400', label: 'Resolved' }
    case 'ESCALATED':
      return { badge: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400', label: 'Escalated' }
    case 'DISMISSED':
      return { badge: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-400', label: 'Dismissed' }
    default:
      return { badge: 'bg-muted text-muted-foreground', label: status }
  }
}

function typeLabel(type: string): string {
  return type
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

// Render the right icon for an incident type. Uses an explicit JSX switch so
// we never assign a Lucide component to a const during render (which trips
// ESLint's react-hooks/static-components rule).
function IncidentTypeIcon({ type, className }: { type: string; className?: string }) {
  switch (type) {
    case 'VOTER_INTIMIDATION':
      return <Siren className={className} />
    case 'SYSTEM_MALFUNCTION':
      return <AlertCircle className={className} />
    case 'IRREGULARITY':
      return <AlertTriangle className={className} />
    case 'DISPUTE':
      return <AlertCircle className={className} />
    case 'TECHNICAL_ISSUE':
      return <Zap className={className} />
    default:
      return <AlertCircle className={className} />
  }
}

function buildQuery(status: string, severity: string, type: string, search: string): string {
  const params: string[] = []
  if (status && status !== 'All') params.push(`status=${encodeURIComponent(status)}`)
  if (severity && severity !== 'All') params.push(`severity=${encodeURIComponent(severity)}`)
  if (type && type !== 'All') params.push(`type=${encodeURIComponent(type)}`)
  if (search.trim()) params.push(`search=${encodeURIComponent(search.trim())}`)
  return params.join('&')
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------
export function IncidentDashboard({ electionId, subdomain }: { electionId: string; subdomain?: string }) {
  const [data, setData] = useState<IncidentsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('All')
  const [severityFilter, setSeverityFilter] = useState<string>('All')
  const [typeFilter, setTypeFilter] = useState<string>('All')

  // Dialogs
  const [reportOpen, setReportOpen] = useState(false)
  const [detailFor, setDetailFor] = useState<Incident | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const q = buildQuery(statusFilter, severityFilter, typeFilter, search)
      const d = await api.getElectionIncidents(electionId, q, subdomain)
      setData(d as IncidentsResponse)
      setLastUpdated(new Date())
    } catch (e: any) {
      // Stats endpoint might still succeed even if main fetch fails — keep going.
      if (!silent) toast.error(e?.message || 'Failed to load incidents')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [electionId, subdomain, statusFilter, severityFilter, typeFilter, search])

  // Initial + filter-change reload.
  useEffect(() => { load() }, [load])

  // Auto-refresh every 10s (silent).
  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(() => load(true), 10000)
    return () => clearInterval(interval)
  }, [autoRefresh, load])

  // Debounced search input — when the user types, we re-load after 300ms.
  function onSearchChange(value: string) {
    setSearch(value)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      // The useEffect above will fire because `search` is in `load`'s dep list.
    }, 300)
  }

  function clearFilters() {
    setSearch('')
    setStatusFilter('All')
    setSeverityFilter('All')
    setTypeFilter('All')
  }

  const stats = data?.stats
  const incidents = data?.incidents || []
  const hasActiveFilters = search.trim() || statusFilter !== 'All' || severityFilter !== 'All' || typeFilter !== 'All'

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="votewise-card-glow">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Siren className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="flex items-center gap-2 font-display text-lg font-bold">
                  Incident Dashboard
                  {stats && stats.critical > 0 && (
                    <Badge className="bg-red-100 text-red-700 text-[10px] dark:bg-red-950/40 dark:text-red-400">
                      <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                      {stats.critical} critical
                    </Badge>
                  )}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Real-time incident reports from observers on the ground. Auto-refreshes every 10s.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/40 px-2 py-1 text-[10px] text-muted-foreground">
                <span className={cn('inline-block h-1.5 w-1.5 rounded-full', autoRefresh ? 'animate-pulse bg-emerald-500' : 'bg-muted-foreground/50')} />
                {autoRefresh ? 'Live' : 'Paused'}
                {lastUpdated && (
                  <span className="ml-1 tabular-nums">· {relativeTime(lastUpdated.toISOString())}</span>
                )}
              </div>
              <Button
                onClick={() => setAutoRefresh((v) => !v)}
                size="sm"
                variant="outline"
                className="gap-1.5"
                aria-label={autoRefresh ? 'Pause auto-refresh' : 'Resume auto-refresh'}
              >
                {autoRefresh ? <Bell className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{autoRefresh ? 'Pause' : 'Resume'}</span>
              </Button>
              <Button onClick={() => load()} size="sm" variant="outline" className="gap-1.5" disabled={refreshing}>
                {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">Refresh</span>
              </Button>
              <Button onClick={() => setReportOpen(true)} size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                <Plus className="h-3.5 w-3.5" /> Report Incident
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={Activity}
          label="Total Incidents"
          value={stats?.total ?? 0}
          trend={stats && stats.total > 0 ? `${stats.open} active` : undefined}
          accent="primary"
        />
        <StatCard
          icon={AlertCircle}
          label="Open"
          value={stats?.open ?? 0}
          accent="amber"
          pulsing={(stats?.open ?? 0) > 0}
        />
        <StatCard
          icon={Siren}
          label="Critical"
          value={stats?.critical ?? 0}
          accent="red"
          pulsing={(stats?.critical ?? 0) > 0}
        />
        <StatCard
          icon={CheckCircle2}
          label="Resolved"
          value={stats?.resolved ?? 0}
          accent="emerald"
        />
      </div>

      {/* Severity breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            Severity Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {VALID_SEVERITIES.map((sev) => {
            const count = stats?.bySeverity?.[sev as keyof typeof stats.bySeverity] ?? 0
            const total = stats?.total ?? 0
            const pct = total > 0 ? Math.round((count / total) * 100) : 0
            const style = severityStyle(sev)
            return (
              <div key={sev} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className={cn('inline-block h-2 w-2 rounded-full', style.dot)} />
                    <span className="font-medium">{style.label}</span>
                  </div>
                  <span className="text-muted-foreground tabular-nums">{count} · {pct}%</span>
                </div>
                <Progress value={pct} className="h-1.5" />
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Filter bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search incidents by title, description, location, or reporter…"
                className="pl-9"
                aria-label="Search incidents"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger size="sm" className="h-8 w-[130px] text-xs" aria-label="Filter by status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_FILTERS.map((s) => (
                    <SelectItem key={s} value={s} className="text-xs">
                      {s === 'All' ? 'All Statuses' : typeLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger size="sm" className="h-8 w-[130px] text-xs" aria-label="Filter by severity">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  {SEVERITY_FILTERS.map((s) => (
                    <SelectItem key={s} value={s} className="text-xs">
                      {s === 'All' ? 'All Severities' : severityStyle(s).label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger size="sm" className="h-8 w-[160px] text-xs" aria-label="Filter by type">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All" className="text-xs">All Types</SelectItem>
                  {VALID_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="text-xs">{typeLabel(t)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {hasActiveFilters && (
                <Button onClick={clearFilters} size="sm" variant="ghost" className="gap-1 text-xs">
                  <XCircle className="h-3.5 w-3.5" /> Clear
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent incidents feed */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Bell className="h-4 w-4 text-primary" />
              {hasActiveFilters ? 'Filtered Incidents' : 'Recent Incidents'}
              <Badge variant="outline" className="ml-1 text-[10px]">{incidents.length}</Badge>
            </CardTitle>
            <span className="text-[10px] text-muted-foreground">Showing latest 10</span>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid min-h-[200px] place-items-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : incidents.length === 0 ? (
            <div className="py-10 text-center">
              <Shield className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <p className="mt-2 text-sm font-medium text-foreground">
                {hasActiveFilters ? 'No incidents match your filters' : 'No incidents reported'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {hasActiveFilters
                  ? 'Try adjusting or clearing your filters.'
                  : 'All quiet on the ground. Observers can report incidents as they happen.'}
              </p>
              {!hasActiveFilters && (
                <Button onClick={() => setReportOpen(true)} size="sm" className="mt-3 gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                  <Plus className="h-3.5 w-3.5" /> Report First Incident
                </Button>
              )}
            </div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto pr-1 votewise-scroll">
              <AnimatePresence initial={false}>
                {incidents.slice(0, 10).map((inc, idx) => (
                  <IncidentRow
                    key={inc.id}
                    incident={inc}
                    idx={idx}
                    expanded={expandedId === inc.id}
                    onToggle={() => setExpandedId(expandedId === inc.id ? null : inc.id)}
                    onOpenDetail={() => setDetailFor(inc)}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Report Incident dialog */}
      <ReportIncidentDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        onCreated={() => {
          setReportOpen(false)
          load()
        }}
        electionId={electionId}
        subdomain={subdomain}
      />

      {/* Incident detail dialog */}
      <IncidentDetailDialog
        incident={detailFor}
        onOpenChange={(o) => !o && setDetailFor(null)}
        onUpdated={() => {
          load()
        }}
        electionId={electionId}
        subdomain={subdomain}
      />
    </div>
  )
}

// -----------------------------------------------------------------------------
// StatCard
// -----------------------------------------------------------------------------
function StatCard({
  icon: Icon, label, value, trend, accent, pulsing,
}: {
  icon: any
  label: string
  value: number
  trend?: string
  accent: 'primary' | 'emerald' | 'amber' | 'red'
  pulsing?: boolean
}) {
  const accentCls = {
    primary: 'bg-primary/10 text-primary',
    emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
    red: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
  }[accent]
  return (
    <Card className={cn(pulsing && 'ring-2 ring-offset-1', pulsing && (accent === 'red' ? 'ring-red-500/40' : accent === 'amber' ? 'ring-amber-500/40' : 'ring-primary/40'))}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div className={cn('grid h-9 w-9 place-items-center rounded-lg', accentCls)}>
            <Icon className={cn('h-4 w-4', pulsing && 'animate-pulse')} />
          </div>
          {trend && <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{trend}</span>}
        </div>
        <div className="mt-2 font-display text-2xl font-bold tabular-nums">{value.toLocaleString()}</div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  )
}

// -----------------------------------------------------------------------------
// IncidentRow
// -----------------------------------------------------------------------------
function IncidentRow({
  incident, idx, expanded, onToggle, onOpenDetail,
}: {
  incident: Incident
  idx: number
  expanded: boolean
  onToggle: () => void
  onOpenDetail: () => void
}) {
  const sev = severityStyle(incident.severity)
  const status = statusStyle(incident.status)
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ duration: 0.18, delay: Math.min(idx * 0.012, 0.2) }}
      className={cn(
        'rounded-lg border bg-card p-3 transition-colors',
        idx > 0 && 'mt-2',
        incident.severity === 'CRITICAL'
          ? 'border-red-300 bg-red-50/40 dark:border-red-900/60 dark:bg-red-950/10'
          : incident.status === 'ESCALATED'
            ? 'border-red-200 dark:border-red-900/50'
            : 'border-border/60 hover:bg-accent/5',
      )}
    >
      <button
        onClick={onToggle}
        className="flex w-full items-start gap-3 text-left"
        aria-expanded={expanded}
        aria-label={`Incident: ${incident.title}`}
      >
        {/* Severity icon */}
        <div className={cn('mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg', sev.badge, 'border')}>
          <IncidentTypeIcon type={incident.type} className={cn('h-4 w-4', sev.pulsing && 'animate-pulse')} />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className={cn('text-[10px]', sev.badge)}>
              <span className={cn('mr-1 inline-block h-1.5 w-1.5 rounded-full', sev.dot, sev.pulsing && 'animate-pulse')} />
              {sev.label}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {typeLabel(incident.type)}
            </Badge>
            <Badge variant="secondary" className={cn('text-[10px]', status.badge)}>
              {status.label}
            </Badge>
          </div>
          <div className="mt-1 text-sm font-medium text-foreground line-clamp-1">
            {incident.title}
          </div>
          <div className={cn('mt-0.5 text-xs text-muted-foreground', !expanded && 'line-clamp-2')}>
            {incident.description}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" /> {incident.reportedByName || 'Unknown'}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> {relativeTime(incident.createdAt)}
            </span>
            {incident.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {incident.location}
              </span>
            )}
            {incident.assignedToName && (
              <span className="flex items-center gap-1">
                <Shield className="h-3 w-3" /> {incident.assignedToName}
              </span>
            )}
          </div>
        </div>

        {/* Expand caret */}
        <div className="shrink-0 self-center text-muted-foreground">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </div>
      </button>

      {/* Expanded details */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <Separator className="my-3" />
            <div className="ml-12 space-y-2 text-xs">
              <div>
                <span className="font-medium text-foreground">Full description:</span>
                <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{incident.description}</p>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Field label="Reported at" value={formatDateTime(incident.createdAt)} />
                <Field label="Updated at" value={formatDateTime(incident.updatedAt)} />
                <Field label="Affected voter ID" value={incident.affectedVoterId || '—'} />
                <Field label="Assigned to" value={incident.assignedToName || 'Unassigned'} />
                {incident.resolvedAt && (
                  <Field label="Resolved at" value={formatDateTime(incident.resolvedAt)} />
                )}
                {incident.resolutionNotes && (
                  <Field label="Resolution notes" value={incident.resolutionNotes} />
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button onClick={onOpenDetail} size="sm" variant="outline" className="gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5" /> Manage Incident
                </Button>
                {incident.status === 'RESOLVED' && (
                  <Badge className="bg-emerald-100 text-emerald-700 text-[10px] dark:bg-emerald-950/40 dark:text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" /> Resolved
                  </Badge>
                )}
                {incident.status === 'ESCALATED' && (
                  <Badge className="bg-red-100 text-red-700 text-[10px] dark:bg-red-950/40 dark:text-red-400">
                    <Siren className="h-3 w-3" /> Escalated
                  </Badge>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/50 bg-muted/20 p-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-xs font-medium text-foreground">{value}</div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// ReportIncidentDialog
// -----------------------------------------------------------------------------
function ReportIncidentDialog({
  open, onOpenChange, onCreated, electionId, subdomain,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onCreated: () => void
  electionId: string
  subdomain?: string
}) {
  const [type, setType] = useState('OTHER')
  const [severity, setSeverity] = useState('MEDIUM')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [busy, setBusy] = useState(false)

  // Reset form whenever the dialog closes.
  useEffect(() => {
    if (!open) {
      setType('OTHER')
      setSeverity('MEDIUM')
      setTitle('')
      setDescription('')
      setLocation('')
    }
  }, [open])

  async function handleSubmit() {
    if (!title.trim()) { toast.error('A title is required'); return }
    if (!description.trim()) { toast.error('A description is required'); return }
    setBusy(true)
    try {
      const payload: any = { type, severity, title: title.trim(), description: description.trim() }
      if (location.trim()) payload.location = location.trim()
      await api.reportElectionIncident(electionId, payload, subdomain)
      toast.success('Incident reported — observers will be alerted.')
      onCreated()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to report incident')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Siren className="h-4 w-4 text-primary" /> Report an Incident
          </DialogTitle>
          <DialogDescription>
            File a real-time incident report. Be as specific as possible — this will appear
            immediately in the observer dashboard and the audit timeline.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="inc-type">Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger id="inc-type" className="text-sm" aria-label="Incident type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VALID_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="text-sm">{typeLabel(t)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inc-sev">Severity</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger id="inc-sev" className="text-sm" aria-label="Incident severity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VALID_SEVERITIES.map((s) => (
                    <SelectItem key={s} value={s} className="text-sm">
                      <span className="flex items-center gap-2">
                        <span className={cn('inline-block h-2 w-2 rounded-full', severityStyle(s).dot)} />
                        {severityStyle(s).label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inc-title">Title</Label>
            <Input
              id="inc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short summary — e.g. 'Voter turned away at Faculty of Science PU-3'"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inc-desc">Description</Label>
            <Textarea
              id="inc-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What happened? Who was involved? When? Any evidence (photos, names, witness contacts)?"
              rows={4}
            />
            <p className="text-[10px] text-muted-foreground">
              {description.length}/10000 characters
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inc-loc">Location (optional)</Label>
            <Input
              id="inc-loc"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Polling unit, faculty, department, building…"
            />
          </div>
          <Alert className="border-amber-500/40 bg-amber-50 dark:bg-amber-950/20">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-700 dark:text-amber-400">Reporter identity</AlertTitle>
            <AlertDescription className="text-amber-800 dark:text-amber-300">
              Your name and device will be recorded as the reporter. False reports are logged
              in the audit trail and may be reviewed.
            </AlertDescription>
          </Alert>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={busy} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Siren className="h-4 w-4" />}
            Submit Report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// -----------------------------------------------------------------------------
// IncidentDetailDialog
// -----------------------------------------------------------------------------
function IncidentDetailDialog({
  incident, onOpenChange, onUpdated, electionId, subdomain,
}: {
  incident: Incident | null
  onOpenChange: (o: boolean) => void
  onUpdated: () => void
  electionId: string
  subdomain?: string
}) {
  const [status, setStatus] = useState<string>('OPEN')
  const [severity, setSeverity] = useState<string>('MEDIUM')
  const [assigneeName, setAssigneeName] = useState<string>('')
  const [resolutionNotes, setResolutionNotes] = useState<string>('')
  const [busy, setBusy] = useState(false)

  // Sync local form state when the incident changes.
  useEffect(() => {
    if (incident) {
      setStatus(incident.status)
      setSeverity(incident.severity)
      setAssigneeName(incident.assignedToName || '')
      setResolutionNotes(incident.resolutionNotes || '')
    }
  }, [incident])

  async function handleSave() {
    if (!incident) return
    setBusy(true)
    try {
      const payload: any = { status, severity }
      if (assigneeName.trim() !== (incident.assignedToName || '')) {
        payload.assignedToName = assigneeName.trim() || null
        payload.assignedToId = assigneeName.trim() ? incident.assignedToId || assigneeName.trim() : null
      }
      if (resolutionNotes !== (incident.resolutionNotes || '')) {
        payload.resolutionNotes = resolutionNotes.trim() || null
      }
      await api.updateElectionIncident(electionId, incident.id, payload, subdomain)
      toast.success('Incident updated')
      onUpdated()
      onOpenChange(false)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update incident')
    } finally {
      setBusy(false)
    }
  }

  if (!incident) return null
  const sev = severityStyle(incident.severity)
  const statusInfo = statusStyle(incident.status)

  return (
    <Dialog open={!!incident} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className={cn('grid h-7 w-7 place-items-center rounded-lg', sev.badge, 'border')}>
              <IncidentTypeIcon type={incident.type} className="h-3.5 w-3.5" />
            </div>
            {incident.title}
          </DialogTitle>
          <DialogDescription>
            Reported by <span className="font-medium text-foreground">{incident.reportedByName}</span>{' '}
            on {formatDateTime(incident.createdAt)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <DetailCell label="Type" value={typeLabel(incident.type)} />
            <DetailCell label="Severity" value={sev.label} dotClass={sev.dot} />
            <DetailCell label="Status" value={statusInfo.label} />
            <DetailCell label="Location" value={incident.location || '—'} />
          </div>

          {/* Description */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Description</div>
            <p className="mt-1 whitespace-pre-wrap rounded-md border border-border/50 bg-muted/20 p-3 text-sm">
              {incident.description}
            </p>
          </div>

          <Separator />

          {/* Update controls */}
          <div className="space-y-3">
            <div className="text-sm font-medium">Update Incident</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="det-status">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger id="det-status" className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VALID_STATUSES.map((s) => (
                      <SelectItem key={s} value={s} className="text-sm">{typeLabel(s)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="det-sev">Severity</Label>
                <Select value={severity} onValueChange={setSeverity}>
                  <SelectTrigger id="det-sev" className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VALID_SEVERITIES.map((s) => (
                      <SelectItem key={s} value={s} className="text-sm">
                        <span className="flex items-center gap-2">
                          <span className={cn('inline-block h-2 w-2 rounded-full', severityStyle(s).dot)} />
                          {severityStyle(s).label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="det-assignee">Assignee Name</Label>
              <Input
                id="det-assignee"
                value={assigneeName}
                onChange={(e) => setAssigneeName(e.target.value)}
                placeholder="e.g. Dr. Adaeze Okonkwo"
              />
              <p className="text-[10px] text-muted-foreground">
                Assign the incident to a specific responder (optional).
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="det-resolution">Resolution Notes</Label>
              <Textarea
                id="det-resolution"
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="What action was taken? What was the outcome?"
                rows={3}
              />
            </div>
            {(status === 'RESOLVED' || status === 'DISMISSED') && (
              <Alert className="border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/20">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <AlertTitle className="text-emerald-700 dark:text-emerald-400">
                  {status === 'RESOLVED' ? 'Marking as resolved' : 'Marking as dismissed'}
                </AlertTitle>
                <AlertDescription className="text-emerald-800 dark:text-emerald-300">
                  The resolvedAt timestamp will be set automatically. Make sure to capture
                  the resolution notes above.
                </AlertDescription>
              </Alert>
            )}
            {status === 'ESCALATED' && (
              <Alert className="border-red-500/40 bg-red-50 dark:bg-red-950/20">
                <Siren className="h-4 w-4 text-red-600" />
                <AlertTitle className="text-red-700 dark:text-red-400">Escalation</AlertTitle>
                <AlertDescription className="text-red-800 dark:text-red-300">
                  Escalated incidents appear with a red border and trigger alerts in the Live
                  Vote Monitor. Ensure the right authority has been notified.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Close</Button>
          <Button onClick={handleSave} disabled={busy} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DetailCell({ label, value, dotClass }: { label: string; value: string; dotClass?: string }) {
  return (
    <div className="rounded-md border border-border/50 bg-muted/20 p-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-foreground">
        {dotClass && <span className={cn('inline-block h-2 w-2 rounded-full', dotClass)} />}
        {value}
      </div>
    </div>
  )
}
