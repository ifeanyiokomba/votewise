'use client'

// =============================================================================
// VoteWise — Admin Infrastructure Console
// Chapter 17 — PIHED (Production Infrastructure, Hosting & Deployment) UI
// =============================================================================
// 6 tabs:
//   1. Pre-Flight Checklist (Election Readiness Checker — the hero feature)
//   2. Live Services (real-time platform status)
//   3. System Metrics (memory / heap / queue / db / rps / error rate sparklines)
//   4. Backups (manual trigger + history)
//   5. Deployments (active deployment, canary promote, rollback, history)
//   6. Custom Domains (multi-tenant domain routing + DNS/SSL verification)
//
// Palette: emerald / gold / amber / zinc / red ONLY — NO indigo, NO blue.
// Default theme is DARK — every badge has explicit dark: variants.
// Auth gate: requires SUPER_ADMIN or PLATFORM_SUPER_ADMIN. Falls back to a
// login card if the session is invalid.
// =============================================================================

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  Server, Mail, Cloud, Shield, Activity, Gauge, Loader2, RefreshCw, Plus,
  CheckCircle2, AlertCircle, XCircle, AlertTriangle, Lock, Zap,
  Clock, Cpu, Database, HardDrive, ListChecks, Rocket, ArrowLeft,
  Copy, Trash2, Globe, ShieldCheck, KeyRound, Siren, Wrench, Sparkles, TrendingUp,
  Hash, ArrowUpRight, ArrowRightLeft, History, Building2,
} from 'lucide-react'
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Checkbox } from '@/components/ui/checkbox'
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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ---------------------------------------------------------------------------
// Palette + type maps (emerald / gold / amber / zinc / red only)
// ---------------------------------------------------------------------------

const HEALTH_BADGE: Record<string, string> = {
  HEALTHY: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  DEGRADED: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  UNHEALTHY: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  UNKNOWN: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-300',
}

const PLATFORM_STATUS_STYLE: Record<string, { badge: string; ring: string; label: string }> = {
  OPERATIONAL: {
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    ring: 'ring-emerald-300/40 dark:ring-emerald-700/40',
    label: 'All Systems Operational',
  },
  DEGRADED: {
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    ring: 'ring-amber-300/40 dark:ring-amber-700/40',
    label: 'Degraded Performance',
  },
  PARTIAL_OUTAGE: {
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 ring-1 ring-amber-300/40 dark:ring-amber-700/40',
    ring: 'ring-amber-400/50 dark:ring-amber-700/50',
    label: 'Partial Outage',
  },
  MAJOR_OUTAGE: {
    badge: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
    ring: 'ring-red-400/50 dark:ring-red-800/50',
    label: 'Major Outage',
  },
}

const CATEGORY_STYLE: Record<string, string> = {
  core: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  messaging: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  storage: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300',
  security: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  ops: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300',
  capacity: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 ring-1 ring-emerald-300/40 dark:ring-emerald-700/40',
}

const CATEGORY_ICON: Record<string, any> = {
  core: Server,
  messaging: Mail,
  storage: Cloud,
  security: Shield,
  ops: Activity,
  capacity: Gauge,
}

const BACKUP_TYPE_BADGE: Record<string, string> = {
  hourly: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300',
  daily: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  weekly: 'bg-accent text-accent-foreground',
  monthly: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  manual: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 ring-1 ring-emerald-300/40 dark:ring-emerald-700/40',
}

const BACKUP_STATUS_BADGE: Record<string, string> = {
  COMPLETED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  RUNNING: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  FAILED: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  PENDING: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-300',
}

const ENV_BADGE: Record<string, string> = {
  production: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  staging: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  development: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300',
}

const STRATEGY_BADGE: Record<string, string> = {
  'blue-green': 'bg-accent text-accent-foreground',
  canary: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  rolling: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300',
}

const DEPLOY_STATUS_BADGE: Record<string, string> = {
  LIVE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 ring-1 ring-emerald-300/40 dark:ring-emerald-700/40',
  DEPLOYING: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  ROLLED_BACK: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-300',
  FAILED: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
}

const DOMAIN_STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  VERIFYING: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  FAILED: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  EXPIRED: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-300',
}

const SSL_STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  ISSUING: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  FAILED: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
}

const DOMAIN_TYPE_BADGE: Record<string, string> = {
  subdomain: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  apex: 'bg-accent text-accent-foreground',
  wildcard: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
    const sec = Math.floor(diff / 1000)
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

function formatUptime(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '—'
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return `${d}d ${h}h ${m}m`
}

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '0'
  return n.toLocaleString('en-NG')
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 MB'
  const mb = bytes / 1024 / 1024
  if (mb < 1024) return `${mb.toFixed(1)} MB`
  return `${(mb / 1024).toFixed(2)} GB`
}

function formatDuration(ms: number | null | undefined): string {
  if (!ms) return '—'
  if (ms < 1000) return `${ms}ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)}s`
  const m = Math.floor(s / 60)
  const rs = Math.floor(s % 60)
  return `${m}m ${rs}s`
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
    } else {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    return true
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Types — mirror PIHED backend
// ---------------------------------------------------------------------------

type HealthStatus = 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'UNKNOWN'

interface HealthCheck {
  name: string
  category: 'core' | 'messaging' | 'storage' | 'security' | 'ops' | 'capacity'
  status: HealthStatus
  message: string
  latencyMs?: number
  critical: boolean
  detail?: string
}

interface CapacityResult {
  expectedVoters: number
  safeConcurrency: number
  estimatedThroughputPerMin: number
  sufficient: boolean
  recommendation: string
  replicas?: number
  votingWindowHours?: number
}

interface ReadinessResult {
  ready: boolean
  checks: HealthCheck[]
  criticalFailures: number
  warnings: number
  capacity: CapacityResult
  timestamp: string
  runId?: string
}

interface ReadinessRun {
  id: string
  organizationId: string | null
  electionId: string | null
  expectedVoters: number
  ready: boolean
  criticalFailures: number
  warnings: number
  triggeredByName: string | null
  notes: string | null
  createdAt: string
}

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
  status: 'OPERATIONAL' | 'DEGRADED' | 'PARTIAL_OUTAGE' | 'MAJOR_OUTAGE' | 'UNKNOWN'
  services: PlatformService[]
  incidents: PlatformIncident[]
  maintenance: PlatformMaintenance[]
  uptime: number
  lastUpdated: string
  error?: string
}

interface LiveMetrics {
  memoryMb: number
  heapUsedMb: number
  heapTotalMb: number
  dbSizeMb: number
  queueDepth: number
  rps: number
  errorRate: number
  avgLatencyMs: number
  uptimeSec: number
}

interface MetricPoint { value: number; createdAt: string }

interface MetricsResponse {
  live: LiveMetrics
  series: Record<string, MetricPoint[]>
  capturedAt: string
}

interface BackupRecord {
  id: string
  type: string
  status: string
  sizeBytes: number | null
  location: string | null
  checksum: string | null
  encrypted: boolean
  durationMs: number | null
  error: string | null
  triggeredBy: string | null
  createdAt: string
  completedAt: string | null
}

interface BackupStats {
  total: number
  completed: number
  failed: number
  lastSuccessAt: string | null
  totalSizeBytes: number
}

interface DeploymentRecord {
  id: string
  version: string
  environment: string
  strategy: string
  status: string
  canaryPct: number
  commitMessage: string | null
  deployedBy: string | null
  healthCheckPassed: boolean
  rollbackOf: string | null
  notes: string | null
  startedAt: string
  completedAt: string | null
}

interface CustomDomain {
  id: string
  organizationId: string
  domain: string
  type: string
  status: string
  verificationToken: string | null
  sslStatus: string
  sslExpiresAt: string | null
  dnsVerifiedAt: string | null
  lastCheckedAt: string | null
  primary: boolean
  createdAt: string
  organization?: { id: string; name: string; subdomain: string | null } | null
}

interface DomainStats {
  total: number
  active: number
  pending: number
  failed: number
  expiringSoon: number
}

interface Organization {
  id: string
  name: string
  slug: string
  subdomain: string | null
  category: string | null
}

// ===========================================================================
// MAIN COMPONENT
// ===========================================================================

export function InfrastructureConsole() {
  return (
    <Suspense fallback={<BootLoader />}>
      <InfrastructureConsoleInner />
    </Suspense>
  )
}

function BootLoader() {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )
}

function InfrastructureConsoleInner() {
  const [authed, setAuthed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [official, setOfficial] = useState<any>(null)
  const [tab, setTab] = useState<string>('readiness')

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
      <div className="grid min-h-[60vh] place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!authed) {
    return <InfrastructureLogin onSuccess={(o) => { setOfficial(o); setAuthed(true) }} />
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
      {/* ---- Header card ---- */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-6"
      >
        <Card className="votewise-card-glow overflow-hidden">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
                <Server className="h-6 w-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-2xl font-bold sm:text-3xl">Infrastructure Console</h1>
                  <Badge variant="outline" className="gap-1 text-[10px] uppercase tracking-wider">
                    <Cpu className="h-3 w-3" /> PIHED · Ch. 17
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Production infrastructure, hosting &amp; deployment control room for VoteWise platform admins.
                </p>
              </div>
            </div>
            <div className="flex flex-col items-start gap-2 sm:items-end">
              <div className="flex items-center gap-2">
                <Button asChild variant="outline" size="sm" className="gap-1.5">
                  <Link href="/admin/operations">
                    <ArrowLeft className="h-4 w-4" /> Operations
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="gap-1.5">
                  <Link href="/admin">
                    <ArrowLeft className="h-4 w-4" /> Admin
                  </Link>
                </Button>
              </div>
              <Badge variant="outline" className="gap-1.5">
                <Shield className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                {official?.name || 'Platform Admin'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ---- Tabs ---- */}
      <Tabs value={tab} onValueChange={setTab}>
        <div className="votewise-scroll mb-6 overflow-x-auto">
          <TabsList className="flex w-max gap-1">
            <TabsTrigger value="readiness" className="gap-1.5">
              <ListChecks className="h-4 w-4" /> Pre-Flight
            </TabsTrigger>
            <TabsTrigger value="services" className="gap-1.5">
              <Activity className="h-4 w-4" /> Live Services
            </TabsTrigger>
            <TabsTrigger value="metrics" className="gap-1.5">
              <Gauge className="h-4 w-4" /> Metrics
            </TabsTrigger>
            <TabsTrigger value="backups" className="gap-1.5">
              <Database className="h-4 w-4" /> Backups
            </TabsTrigger>
            <TabsTrigger value="deployments" className="gap-1.5">
              <Rocket className="h-4 w-4" /> Deployments
            </TabsTrigger>
            <TabsTrigger value="domains" className="gap-1.5">
              <Globe className="h-4 w-4" /> Domains
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="readiness" className="mt-0">
          <ReadinessTab />
        </TabsContent>
        <TabsContent value="services" className="mt-0">
          <LiveServicesTab />
        </TabsContent>
        <TabsContent value="metrics" className="mt-0">
          <SystemMetricsTab />
        </TabsContent>
        <TabsContent value="backups" className="mt-0">
          <BackupsTab />
        </TabsContent>
        <TabsContent value="deployments" className="mt-0">
          <DeploymentsTab />
        </TabsContent>
        <TabsContent value="domains" className="mt-0">
          <DomainsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Login gate
// ---------------------------------------------------------------------------

function InfrastructureLogin({ onSuccess }: { onSuccess: (o: any) => void }) {
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
        setErr('This console is for VoteWise platform administrators only.')
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
    <div className="grid min-h-[60vh] place-items-center p-4">
      <Card className="w-full max-w-md votewise-card-glow">
        <CardHeader className="text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <Lock className="h-7 w-7" />
          </div>
          <CardTitle className="mt-3 font-display">Infrastructure Console</CardTitle>
          <p className="text-sm text-muted-foreground">
            Platform admin access required to manage production infrastructure.
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

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function EmptyState({ icon: Icon, title, hint }: { icon: any; title: string; hint: string }) {
  return (
    <div className="py-12 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-muted/60 text-muted-foreground">
        <Icon className="h-7 w-7" />
      </div>
      <p className="mt-3 font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="py-10 text-center">
      <AlertCircle className="mx-auto h-10 w-10 text-destructive/50" />
      <p className="mt-3 font-medium">Something went wrong</p>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
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
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      <span className="ml-2 text-sm text-muted-foreground">{label}</span>
    </div>
  )
}

function CopyButton({ text, size = 'sm' }: { text: string; size?: 'sm' | 'default' }) {
  const [copied, setCopied] = useState(false)
  async function handleCopy() {
    const ok = await copyToClipboard(text)
    if (ok) {
      setCopied(true)
      toast.success('Copied to clipboard')
      setTimeout(() => setCopied(false), 1800)
    } else {
      toast.error('Copy failed — please copy manually')
    }
  }
  return (
    <Button size={size} variant="outline" onClick={handleCopy} className="shrink-0 gap-1.5">
      {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copied' : 'Copy'}
    </Button>
  )
}

// Inline SVG sparkline (normalised polyline) for metric cards.
function Sparkline({ data, colour }: { data: number[]; colour: string }) {
  const W = 120
  const H = 36
  if (!data || data.length < 2) {
    return (
      <svg width={W} height={H} className="opacity-40">
        <line x1="0" y1={H - 1} x2={W} y2={H - 1} stroke="currentColor" strokeWidth="1" />
      </svg>
    )
  }
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const stepX = W / (data.length - 1)
  const points = data
    .map((v, i) => {
      const x = i * stepX
      const y = H - 2 - ((v - min) / range) * (H - 4)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg width={W} height={H} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={colour}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={(data.length - 1) * stepX}
        cy={H - 2 - ((data[data.length - 1] - min) / range) * (H - 4)}
        r="2.5"
        fill={colour}
      />
    </svg>
  )
}

function HealthStatusIcon({ status }: { status: HealthStatus }) {
  if (status === 'HEALTHY') return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
  if (status === 'DEGRADED') return <AlertCircle className="h-4 w-4 text-amber-500" />
  if (status === 'UNHEALTHY') return <XCircle className="h-4 w-4 text-red-500" />
  return <AlertCircle className="h-4 w-4 text-zinc-400" />
}

// ===========================================================================
// TAB 1 — Pre-Flight Checklist (Election Readiness Checker)
// ===========================================================================

function ReadinessTab() {
  const [expectedVoters, setExpectedVoters] = useState<number>(0)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<ReadinessResult | null>(null)
  const [runs, setRuns] = useState<ReadinessRun[]>([])
  const [loadingRuns, setLoadingRuns] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadRuns = useCallback(async () => {
    try {
      const res = await api.pihedReadinessRuns(5) as { runs: ReadinessRun[] }
      setRuns(res.runs || [])
    } catch {
      /* silent */
    } finally {
      setLoadingRuns(false)
    }
  }, [])

  useEffect(() => {
    loadRuns()
  }, [loadRuns])

  async function runCheck() {
    setRunning(true)
    setError(null)
    try {
      const res = await api.pihedRunReadiness({ expectedVoters }) as ReadinessResult
      setResult(res)
      toast.success(
        res.ready
          ? 'Pre-flight check passed — election is ready for launch'
          : `Launch blocked — ${res.criticalFailures} critical failure(s)`,
      )
      await loadRuns()
    } catch (e: any) {
      setError(e?.message || 'Failed to run readiness check')
      toast.error(e?.message || 'Failed to run readiness check')
    } finally {
      setRunning(false)
    }
  }

  const peakDemand = result ? Math.ceil(result.capacity.expectedVoters * 0.35) : 0
  const peakPct = result && result.capacity.safeConcurrency > 0
    ? Math.min(100, (peakDemand / result.capacity.safeConcurrency) * 100)
    : 0

  return (
    <div className="space-y-6">
      {/* ---- Hero header card ---- */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <Card className="votewise-card-glow">
          <CardContent className="p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <ListChecks className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="font-display text-xl font-bold">Pre-Flight Checklist</h2>
                  <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                    Before any election goes live, run this 13-point infrastructure readiness assessment.
                    The system blocks <strong>Go Live</strong> if any critical check fails. Critical checks
                    are marked with a red badge and must all be <span className="text-emerald-600 dark:text-emerald-400">HEALTHY</span>.
                  </p>
                </div>
              </div>
              <Badge className="gap-1.5 bg-accent text-accent-foreground">
                <Sparkles className="h-3.5 w-3.5" /> Hero Feature
              </Badge>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ---- Runner card ---- */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-display text-base">
            <Rocket className="h-4 w-4 text-primary" /> Run Pre-Flight Check
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="expected-voters">Expected Voters</Label>
              <Input
                id="expected-voters"
                type="number"
                min={0}
                value={expectedVoters}
                onChange={(e) => setExpectedVoters(Math.max(0, Number(e.target.value) || 0))}
                placeholder="0"
              />
              <p className="text-[11px] text-muted-foreground">
                Used by the capacity check to verify peak concurrency headroom over an 8-hour voting window.
              </p>
            </div>
            <Button onClick={runCheck} disabled={running} size="lg" className="gap-2 sm:w-auto">
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              {running ? 'Running 13 checks…' : 'Run Pre-Flight Check'}
            </Button>
          </div>

          {error && (
            <Alert className="border-red-300 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Readiness check failed</AlertTitle>
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* ---- Result summary banner ---- */}
      {result && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          {result.ready ? (
            <Card className="border-emerald-300/50 bg-emerald-50 dark:border-emerald-800/60 dark:bg-emerald-950/30">
              <CardContent className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-display text-lg font-bold text-emerald-700 dark:text-emerald-300">
                      ✓ READY FOR LAUNCH
                    </p>
                    <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80">
                      All {result.checks.filter(c => c.critical).length} critical checks passed.
                      {result.warnings > 0 && ` ${result.warnings} non-critical warning(s).`}
                    </p>
                  </div>
                </div>
                <Button
                  size="lg"
                  className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600"
                  onClick={() => toast.success('Election cleared for launch', {
                    description: 'Pre-flight checks passed — you may now schedule Go Live.',
                  })}
                >
                  <Zap className="h-4 w-4" /> Go Live
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-red-300/60 bg-red-50 dark:border-red-900/60 dark:bg-red-950/30">
              <CardContent className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-full bg-red-500/15 text-red-600 dark:text-red-400">
                    <XCircle className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-display text-lg font-bold text-red-700 dark:text-red-300">
                      ✗ LAUNCH BLOCKED
                    </p>
                    <p className="text-xs text-red-700/80 dark:text-red-300/80">
                      {result.criticalFailures} critical failure(s) must be resolved before this election can go live.
                    </p>
                  </div>
                </div>
                <Button size="lg" disabled className="gap-2">
                  <Lock className="h-4 w-4" /> Go Live Locked
                </Button>
              </CardContent>
            </Card>
          )}
        </motion.div>
      )}

      {/* ---- Capacity card ---- */}
      {result && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }}>
          <Card className="votewise-card-glow">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 font-display text-base">
                <Gauge className="h-4 w-4 text-primary" /> Capacity Planning
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCell label="Expected Voters" value={formatNumber(result.capacity.expectedVoters)} icon={Hash} />
                <StatCell label="Safe Concurrency" value={formatNumber(result.capacity.safeConcurrency)} icon={Shield} />
                <StatCell label="Throughput / min" value={formatNumber(result.capacity.estimatedThroughputPerMin)} icon={TrendingUp} />
                <StatCell label="Replicas" value={String(result.capacity.replicas ?? '—')} icon={Server} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Peak demand vs safe ceiling (1 peak hour)</span>
                  <span className={cn(
                    'font-mono font-semibold',
                    result.capacity.sufficient ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
                  )}>
                    {formatNumber(peakDemand)} / {formatNumber(result.capacity.safeConcurrency)} /hr
                  </span>
                </div>
                <Progress
                  value={peakPct}
                  className={cn(
                    'h-2',
                    result.capacity.sufficient ? '[&>div]:bg-emerald-500' : '[&>div]:bg-red-500',
                  )}
                />
              </div>
              <div className={cn(
                'rounded-lg border p-3 text-xs',
                result.capacity.sufficient
                  ? 'border-emerald-300/40 bg-emerald-50 text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-200'
                  : 'border-red-300/50 bg-red-50 text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200',
              )}>
                <p className="flex items-center gap-1.5 font-semibold">
                  {result.capacity.sufficient
                    ? <CheckCircle2 className="h-3.5 w-3.5" />
                    : <AlertTriangle className="h-3.5 w-3.5" />}
                  Recommendation
                </p>
                <p className="mt-1">{result.capacity.recommendation}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ---- 13 checks grid ---- */}
      {result && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              13-Point Checklist
            </h3>
            <Badge variant="outline" className="text-[10px]">
              {result.checks.filter(c => c.status === 'HEALTHY').length}/{result.checks.length} healthy
            </Badge>
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {result.checks.map((c, i) => {
              const Icon = CATEGORY_ICON[c.category] || Activity
              return (
                <motion.div
                  key={c.name}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.03 }}
                >
                  <Card className={cn(
                    'h-full transition-colors',
                    c.status === 'UNHEALTHY' && 'border-red-300/60 dark:border-red-900/60',
                    c.status === 'DEGRADED' && 'border-amber-300/50 dark:border-amber-800/50',
                  )}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className={cn('grid h-9 w-9 place-items-center rounded-lg', CATEGORY_STYLE[c.category])}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-medium leading-tight">{c.name}</p>
                            <Badge variant="outline" className="mt-1 text-[9px] uppercase tracking-wider">
                              {c.category}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <HealthStatusIcon status={c.status} />
                          {c.critical && (
                            <Badge className="bg-red-100 text-red-700 text-[9px] dark:bg-red-500/15 dark:text-red-300">
                              CRITICAL
                            </Badge>
                          )}
                        </div>
                      </div>
                      <p className="mt-3 text-sm text-foreground">{c.message}</p>
                      {c.detail && (
                        <p className="mt-1 text-xs text-muted-foreground">{c.detail}</p>
                      )}
                      {typeof c.latencyMs === 'number' && (
                        <p className="mt-2 font-mono text-[10px] text-muted-foreground">
                          {c.latencyMs}ms latency
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </div>
        </div>
      )}

      {/* ---- Run history ---- */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 font-display text-base">
              <History className="h-4 w-4 text-primary" /> Recent Pre-Flight Runs
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={loadRuns} disabled={loadingRuns} className="gap-1.5">
              <RefreshCw className={cn('h-3.5 w-3.5', loadingRuns && 'animate-spin')} /> Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loadingRuns ? (
            <LoadingRow label="Loading run history…" />
          ) : runs.length === 0 ? (
            <EmptyState icon={History} title="No runs yet" hint="Run your first pre-flight check to see the audit trail here." />
          ) : (
            <div className="votewise-scroll max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
                  <tr className="text-left">
                    <th className="p-3 font-semibold">Timestamp</th>
                    <th className="p-3 font-semibold">Expected Voters</th>
                    <th className="p-3 font-semibold">Ready</th>
                    <th className="hidden p-3 font-semibold sm:table-cell">Critical Failures</th>
                    <th className="hidden p-3 font-semibold md:table-cell">Triggered By</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => (
                    <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                      <td className="p-3 text-xs text-muted-foreground">{timeAgo(r.createdAt)}</td>
                      <td className="p-3 font-mono">{formatNumber(r.expectedVoters)}</td>
                      <td className="p-3">
                        {r.ready ? (
                          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                            <CheckCircle2 className="mr-1 h-3 w-3" /> Ready
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300">
                            <XCircle className="mr-1 h-3 w-3" /> Blocked
                          </Badge>
                        )}
                      </td>
                      <td className="hidden p-3 font-mono sm:table-cell">
                        {r.criticalFailures > 0 ? (
                          <span className="text-red-600 dark:text-red-400">{r.criticalFailures}</span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400">0</span>
                        )}
                      </td>
                      <td className="hidden p-3 text-xs text-muted-foreground md:table-cell">
                        {r.triggeredByName || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatCell({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="mt-1 font-display text-lg font-bold tabular-nums">{value}</div>
    </div>
  )
}

// ===========================================================================
// TAB 2 — Live Services
// ===========================================================================

function LiveServicesTab() {
  const [status, setStatus] = useState<PlatformStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [, force] = useState(0)
  const firstLoadRef = useRef(true)

  const load = useCallback(async () => {
    try {
      setRefreshing(true)
      setError(null)
      const res = await api.pihedStatus() as PlatformStatus
      setStatus(res)
    } catch (e: any) {
      if (firstLoadRef.current) {
        setError(e?.message || 'Failed to load platform status')
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
      firstLoadRef.current = false
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 30000)
    return () => clearInterval(id)
  }, [load])

  // 1s tick for "Xs ago" countdown
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])

  if (loading) return <LoadingRow label="Loading platform status…" />
  if (error && !status) {
    return (
      <Card>
        <CardContent>
          <ErrorState message={error} onRetry={load} />
        </CardContent>
      </Card>
    )
  }
  if (!status) return null

  const ps = PLATFORM_STATUS_STYLE[status.status] || PLATFORM_STATUS_STYLE.OPERATIONAL
  const lastUpdatedSec = status.lastUpdated
    ? Math.max(0, Math.floor((Date.now() - new Date(status.lastUpdated).getTime()) / 1000))
    : 0

  return (
    <div className="space-y-6">
      {/* ---- Overall status banner ---- */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <Card className={cn('votewise-card-glow ring-1', ps.ring)}>
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className={cn(
                'grid h-14 w-14 place-items-center rounded-2xl',
                status.status === 'OPERATIONAL' && 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
                status.status === 'DEGRADED' && 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
                status.status === 'PARTIAL_OUTAGE' && 'bg-amber-500/20 text-amber-700 dark:text-amber-300',
                status.status === 'MAJOR_OUTAGE' && 'bg-red-500/15 text-red-600 dark:text-red-400',
              )}>
                {status.status === 'OPERATIONAL' ? <CheckCircle2 className="h-7 w-7" /> :
                 status.status === 'MAJOR_OUTAGE' ? <XCircle className="h-7 w-7" /> :
                 <AlertTriangle className="h-7 w-7" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-2xl font-bold">{ps.label}</h2>
                  <Badge className={ps.badge}>{status.status}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  90-day uptime: <span className="font-mono font-semibold text-foreground">{status.uptime.toFixed(2)}%</span>
                  {' · '}Last updated <span className="text-foreground">{lastUpdatedSec}s ago</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={load} variant="outline" size="sm" disabled={refreshing} className="gap-1.5">
                {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Refresh
              </Button>
              <Badge variant="secondary" className="gap-1.5 text-xs text-muted-foreground">
                <span className="votewise-live-dot inline-block h-2 w-2 rounded-full bg-emerald-500" />
                Auto · 30s
              </Badge>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ---- Active incidents + maintenance ---- */}
      {status.incidents && status.incidents.length > 0 && (
        <Alert className="border-red-300 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          <Siren className="h-4 w-4" />
          <AlertTitle>{status.incidents.length} active incident(s)</AlertTitle>
          <AlertDescription className="space-y-1 text-xs">
            {status.incidents.map((inc, i) => (
              <div key={i} className="flex items-center gap-2">
                <Badge className="bg-red-100 text-red-700 text-[9px] dark:bg-red-500/15 dark:text-red-300">{inc.severity}</Badge>
                <span className="font-medium">{inc.title}</span>
                <span className="text-red-700/70 dark:text-red-300/70">· {timeAgo(inc.createdAt)}</span>
              </div>
            ))}
          </AlertDescription>
        </Alert>
      )}
      {status.maintenance && status.maintenance.length > 0 && (
        <Alert className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          <Wrench className="h-4 w-4" />
          <AlertTitle>Active maintenance</AlertTitle>
          <AlertDescription className="space-y-1 text-xs">
            {status.maintenance.map((m, i) => (
              <div key={i} className="flex items-center gap-2">
                <Badge className="bg-amber-100 text-amber-700 text-[9px] dark:bg-amber-500/15 dark:text-amber-300">{m.level}</Badge>
                <span className="font-medium">{m.reason}</span>
                <span className="text-amber-700/70 dark:text-amber-300/70">· started {timeAgo(m.startedAt)}</span>
              </div>
            ))}
          </AlertDescription>
        </Alert>
      )}

      {/* ---- Service grid ---- */}
      <div>
        <h3 className="mb-3 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Service Map · {status.services.length} services
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {status.services.map((svc, i) => {
            const Icon = CATEGORY_ICON[svc.category] || Activity
            return (
              <motion.div
                key={svc.name}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.03 }}
              >
                <Card className={cn(
                  'h-full transition-colors',
                  svc.status === 'UNHEALTHY' && 'ring-1 ring-red-400/50 dark:ring-red-800/50',
                )}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className={cn('grid h-9 w-9 place-items-center rounded-lg', CATEGORY_STYLE[svc.category] || CATEGORY_STYLE.ops)}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-medium leading-tight">{svc.name}</p>
                          <Badge variant="outline" className="mt-1 text-[9px] uppercase tracking-wider">
                            {svc.category}
                          </Badge>
                        </div>
                      </div>
                      <HealthStatusIcon status={svc.status as HealthStatus} />
                    </div>
                    <p className="mt-3 text-sm text-foreground">{svc.message}</p>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                      <span className="font-mono">uptime {svc.uptime.toFixed(2)}%</span>
                      <Badge className={cn('text-[9px]', HEALTH_BADGE[svc.status] || HEALTH_BADGE.UNKNOWN)}>
                        {svc.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ===========================================================================
// TAB 3 — System Metrics
// ===========================================================================

function SystemMetricsTab() {
  const [data, setData] = useState<MetricsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [, force] = useState(0)
  const firstLoadRef = useRef(true)

  const SERIES_KEY = 'memory,heapUsed,queueDepth,dbSizeMb,rps,errorRate'

  const load = useCallback(async () => {
    try {
      setRefreshing(true)
      setError(null)
      const res = await api.pihedMetrics(SERIES_KEY, 30) as MetricsResponse
      setData(res)
    } catch (e: any) {
      if (firstLoadRef.current) {
        setError(e?.message || 'Failed to load system metrics')
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

  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])

  if (loading) return <LoadingRow label="Loading live metrics…" />
  if (error && !data) {
    return (
      <Card>
        <CardContent>
          <ErrorState message={error} onRetry={load} />
        </CardContent>
      </Card>
    )
  }
  if (!data) return null

  const { live, series, capturedAt } = data
  const capturedSec = capturedAt
    ? Math.max(0, Math.floor((Date.now() - new Date(capturedAt).getTime()) / 1000))
    : 0

  const errorRateColour = live.errorRate < 1 ? 'text-emerald-500'
    : live.errorRate < 5 ? 'text-amber-500' : 'text-red-500'

  const cards = [
    {
      label: 'Memory', value: live.memoryMb.toFixed(0), unit: 'MB', icon: Cpu,
      colour: 'text-emerald-500',
      data: (series.memory || []).map(p => p.value),
    },
    {
      label: 'Heap Used', value: live.heapUsedMb.toFixed(0), unit: 'MB', icon: HardDrive,
      colour: 'text-emerald-500',
      data: (series.heapUsed || []).map(p => p.value),
    },
    {
      label: 'Queue Depth', value: formatNumber(live.queueDepth), unit: 'jobs', icon: ListChecks,
      colour: live.queueDepth > 100 ? 'text-amber-500' : 'text-emerald-500',
      data: (series.queueDepth || []).map(p => p.value),
    },
    {
      label: 'DB Size', value: live.dbSizeMb.toFixed(2), unit: 'MB', icon: Database,
      colour: 'text-emerald-500',
      data: (series.dbSizeMb || []).map(p => p.value),
    },
    {
      label: 'Requests / sec', value: live.rps.toFixed(2), unit: 'req/s', icon: TrendingUp,
      colour: 'text-emerald-500',
      data: (series.rps || []).map(p => p.value),
    },
    {
      label: 'Error Rate', value: live.errorRate.toFixed(2), unit: '%', icon: AlertCircle,
      colour: errorRateColour,
      data: (series.errorRate || []).map(p => p.value),
    },
  ]

  return (
    <div className="space-y-6">
      {/* ---- Header ---- */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <Card className="votewise-card-glow">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
                <Gauge className="h-6 w-6" />
              </div>
              <div>
                <h2 className="font-display text-xl font-bold">Live System Metrics</h2>
                <p className="text-sm text-muted-foreground">
                  Real-time process + DB metrics. Sparklines show the last 30 samples.
                </p>
              </div>
            </div>
            <div className="flex flex-col items-start gap-1.5 sm:items-end">
              <div className="flex items-center gap-2">
                <Button onClick={load} variant="outline" size="sm" disabled={refreshing} className="gap-1.5">
                  {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  Refresh
                </Button>
                <Badge variant="secondary" className="gap-1.5 text-xs text-muted-foreground">
                  <span className="votewise-live-dot inline-block h-2 w-2 rounded-full bg-emerald-500" />
                  Live · 15s
                </Badge>
              </div>
              <span className="text-[10px] text-muted-foreground">Updated {capturedSec}s ago</span>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ---- 6 metric cards ---- */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.04 }}
          >
            <Card className="h-full">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-muted/60 text-muted-foreground">
                    <c.icon className="h-4 w-4" />
                  </div>
                  <span className={cn('h-1.5 w-1.5 rounded-full', c.colour.replace('text-', 'bg-'))} />
                </div>
                <div className="mt-3">
                  <div className={cn('font-display text-2xl font-bold tabular-nums', c.colour)}>
                    {c.value}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">{c.unit}</span>
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{c.label}</div>
                </div>
                <div className={cn('mt-2', c.colour)}>
                  <Sparkline data={c.data} colour="currentColor" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* ---- Process uptime card ---- */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              <Clock className="h-3 w-3" /> Process Uptime
            </div>
            <div className="mt-2 font-display text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {formatUptime(live.uptimeSec)}
            </div>
            <div className="mt-1 text-[10px] text-muted-foreground">since last restart</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              <Activity className="h-3 w-3" /> Avg API Latency
            </div>
            <div className="mt-2 font-display text-xl font-bold tabular-nums">
              {live.avgLatencyMs.toFixed(0)}<span className="ml-1 text-xs font-normal text-muted-foreground">ms</span>
            </div>
            <div className="mt-1 text-[10px] text-muted-foreground">over last 5 min</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              <HardDrive className="h-3 w-3" /> Heap Total
            </div>
            <div className="mt-2 font-display text-xl font-bold tabular-nums">
              {live.heapTotalMb.toFixed(0)}<span className="ml-1 text-xs font-normal text-muted-foreground">MB</span>
            </div>
            <div className="mt-1 text-[10px] text-muted-foreground">allocated V8 heap</div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ===========================================================================
// TAB 4 — Backups
// ===========================================================================

function BackupsTab() {
  const [backups, setBackups] = useState<BackupRecord[]>([])
  const [stats, setStats] = useState<BackupStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [triggering, setTriggering] = useState(false)

  const load = useCallback(async () => {
    try {
      setError(null)
      const res = await api.pihedBackups() as { backups: BackupRecord[]; stats: BackupStats }
      setBackups(res.backups || [])
      setStats(res.stats)
    } catch (e: any) {
      setError(e?.message || 'Failed to load backups')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function triggerBackup() {
    setTriggering(true)
    try {
      const res = await api.pihedTriggerBackup('manual') as { backup: BackupRecord; message: string }
      toast.success(`Backup completed (${(res.backup.sizeBytes! / 1024 / 1024).toFixed(1)} MB)`)
      await load()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to trigger backup')
    } finally {
      setTriggering(false)
    }
  }

  if (loading) return <LoadingRow label="Loading backups…" />
  if (error && !stats) {
    return (
      <Card>
        <CardContent>
          <ErrorState message={error} onRetry={load} />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* ---- Header + trigger ---- */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <Card className="votewise-card-glow">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
                <Database className="h-6 w-6" />
              </div>
              <div>
                <h2 className="font-display text-xl font-bold">Backup Management</h2>
                <p className="text-sm text-muted-foreground">
                  Encrypted SQLite snapshots. Schedule: hourly · daily · weekly · monthly.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={load} variant="outline" size="sm" className="gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </Button>
              <Button onClick={triggerBackup} disabled={triggering} className="gap-2">
                {triggering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {triggering ? 'Backing up…' : 'Trigger Manual Backup'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ---- Stat cards ---- */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total Backups" value={formatNumber(stats.total)} icon={Database} accent="bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300" />
          <StatCard label="Completed" value={formatNumber(stats.completed)} icon={CheckCircle2} accent="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" />
          <StatCard label="Failed" value={formatNumber(stats.failed)} icon={XCircle} accent={stats.failed > 0 ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300' : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300'} />
          <StatCard label="Total Size" value={formatBytes(stats.totalSizeBytes)} icon={HardDrive} accent="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" />
        </div>
      )}

      {stats?.lastSuccessAt && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          Last successful backup: <span className="font-medium text-foreground">{timeAgo(stats.lastSuccessAt)}</span>
        </div>
      )}

      {/* ---- Backups table ---- */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-display text-base">
            <History className="h-4 w-4 text-primary" /> Recent Backups
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {backups.length === 0 ? (
            <EmptyState icon={Database} title="No backups yet" hint="Trigger a manual backup above to seed the history." />
          ) : (
            <div className="votewise-scroll max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
                  <tr className="text-left">
                    <th className="p-3 font-semibold">Type</th>
                    <th className="p-3 font-semibold">Status</th>
                    <th className="p-3 font-semibold">Size</th>
                    <th className="hidden p-3 font-semibold md:table-cell">Location</th>
                    <th className="hidden p-3 font-semibold sm:table-cell">Duration</th>
                    <th className="p-3 font-semibold">When</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence initial={false}>
                    {backups.map((b) => (
                      <motion.tr
                        key={b.id}
                        layout
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        className="border-t border-border hover:bg-muted/30"
                      >
                        <td className="p-3">
                          <Badge className={cn('text-[10px]', BACKUP_TYPE_BADGE[b.type] || BACKUP_TYPE_BADGE.manual)}>
                            {b.type}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <span className="inline-flex items-center gap-1.5">
                            {b.status === 'RUNNING' && <Loader2 className="h-3 w-3 animate-spin text-amber-500" />}
                            {b.encrypted && b.status === 'COMPLETED' && <Lock className="h-3 w-3 text-emerald-500" />}
                            <Badge className={cn('text-[10px]', BACKUP_STATUS_BADGE[b.status] || BACKUP_STATUS_BADGE.PENDING)}>
                              {b.status}
                            </Badge>
                          </span>
                        </td>
                        <td className="p-3 font-mono text-xs">
                          {b.sizeBytes ? (b.sizeBytes / 1024 / 1024).toFixed(1) + ' MB' : '—'}
                        </td>
                        <td className="hidden max-w-[220px] truncate p-3 font-mono text-[10px] text-muted-foreground md:table-cell">
                          {b.location || '—'}
                        </td>
                        <td className="hidden p-3 font-mono text-xs sm:table-cell">
                          {formatDuration(b.durationMs)}
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">{timeAgo(b.createdAt)}</td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({ label, value, icon: Icon, accent }: { label: string; value: string; icon: any; accent: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className={cn('grid h-9 w-9 place-items-center rounded-lg', accent)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="mt-3 font-display text-xl font-bold tabular-nums">{value}</div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  )
}

// ===========================================================================
// TAB 5 — Deployments
// ===========================================================================

function DeploymentsTab() {
  const [deployments, setDeployments] = useState<DeploymentRecord[]>([])
  const [active, setActive] = useState<DeploymentRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [promotingId, setPromotingId] = useState<string | null>(null)
  const [rollbackTarget, setRollbackTarget] = useState<DeploymentRecord | null>(null)
  const [rollbackReason, setRollbackReason] = useState('')
  const [rollingBack, setRollingBack] = useState(false)

  const load = useCallback(async () => {
    try {
      setError(null)
      const res = await api.pihedDeployments() as { deployments: DeploymentRecord[]; active: DeploymentRecord | null }
      setDeployments(res.deployments || [])
      setActive(res.active || null)
    } catch (e: any) {
      setError(e?.message || 'Failed to load deployments')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Find the canary currently DEPLOYING (if any)
  const canaryDeploying = deployments.find(d => d.strategy === 'canary' && d.status === 'DEPLOYING') || null

  async function handlePromote(id: string) {
    setPromotingId(id)
    try {
      const res = await api.pihedPromoteCanary(id) as { deployment: DeploymentRecord; message: string }
      toast.success(res.message)
      await load()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to promote canary')
    } finally {
      setPromotingId(null)
    }
  }

  async function handleRollback() {
    if (!rollbackTarget) return
    setRollingBack(true)
    try {
      const res = await api.pihedRollbackDeployment(rollbackTarget.id, rollbackReason || undefined) as { message: string; rolledBack: string; restored: string | null }
      toast.success(res.message)
      setRollbackTarget(null)
      setRollbackReason('')
      await load()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to rollback deployment')
    } finally {
      setRollingBack(false)
    }
  }

  if (loading) return <LoadingRow label="Loading deployments…" />
  if (error && deployments.length === 0) {
    return (
      <Card>
        <CardContent>
          <ErrorState message={error} onRetry={load} />
        </CardContent>
      </Card>
    )
  }

  // Canary progress stages: 0 → 25 → 50 → 100
  const canaryStages = [0, 25, 50, 100]
  const currentStageIdx = canaryDeploying
    ? canaryStages.indexOf(canaryDeploying.canaryPct)
    : -1

  return (
    <div className="space-y-6">
      {/* ---- Header ---- */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <Card className="votewise-card-glow">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
                <Rocket className="h-6 w-6" />
              </div>
              <div>
                <h2 className="font-display text-xl font-bold">Deployment Pipeline</h2>
                <p className="text-sm text-muted-foreground">
                  Blue-green, canary &amp; rolling deployments with health-gated promotion.
                </p>
              </div>
            </div>
            <Button onClick={load} variant="outline" size="sm" className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* ---- Active deployment card ---- */}
      {active ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <Card className="votewise-card-glow border-emerald-300/40 dark:border-emerald-800/40">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 font-display text-base">
                  <span className="votewise-live-dot inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  Active Deployment
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={cn('text-[10px]', DEPLOY_STATUS_BADGE[active.status] || DEPLOY_STATUS_BADGE.LIVE)}>
                    {active.status}
                  </Badge>
                  <Badge className={cn('text-[10px]', ENV_BADGE[active.environment] || ENV_BADGE.production)}>
                    {active.environment}
                  </Badge>
                  <Badge className={cn('text-[10px]', STRATEGY_BADGE[active.strategy] || STRATEGY_BADGE.rolling)}>
                    {active.strategy}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCell label="Version" value={active.version} icon={Hash} />
                <StatCell label="Canary %" value={`${active.canaryPct}%`} icon={TrendingUp} />
                <StatCell label="Deployed By" value={active.deployedBy || '—'} icon={KeyRound} />
                <StatCell label="Started" value={timeAgo(active.startedAt)} icon={Clock} />
              </div>
              {active.commitMessage && (
                <div className="rounded-lg border border-border/60 bg-muted/40 p-3 text-xs">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Commit Message</p>
                  <p className="mt-1 font-mono text-foreground">{active.commitMessage}</p>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={() => setRollbackTarget(active)}
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-red-300 text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/40"
                >
                  <ArrowRightLeft className="h-3.5 w-3.5" /> Rollback
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <Card>
          <CardContent>
            <EmptyState icon={Rocket} title="No active deployment" hint="The deployment pipeline has not been seeded yet." />
          </CardContent>
        </Card>
      )}

      {/* ---- Canary promotion card ---- */}
      {canaryDeploying && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <Card className="border-amber-300/50 dark:border-amber-800/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 font-display text-base">
                <Sparkles className="h-4 w-4 text-amber-500" /> Canary Promotion
                <Badge className="bg-amber-100 text-amber-700 text-[10px] dark:bg-amber-500/15 dark:text-amber-300">
                  {canaryDeploying.version}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                {canaryStages.map((stage, i) => {
                  const reached = i <= currentStageIdx
                  const isCurrent = i === currentStageIdx
                  return (
                    <div key={stage} className="flex flex-1 items-center">
                      <div className="flex flex-col items-center">
                        <div className={cn(
                          'grid h-9 w-9 place-items-center rounded-full border-2 text-xs font-bold transition-colors',
                          reached
                            ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                            : 'border-border bg-muted text-muted-foreground',
                          isCurrent && 'ring-4 ring-emerald-500/20',
                        )}>
                          {reached ? <CheckCircle2 className="h-4 w-4" /> : stage}
                        </div>
                        <span className={cn(
                          'mt-1 font-mono text-[10px]',
                          reached ? 'text-foreground' : 'text-muted-foreground',
                        )}>
                          {stage}%
                        </span>
                      </div>
                      {i < canaryStages.length - 1 && (
                        <div className={cn(
                          'mx-1 h-0.5 flex-1 rounded-full',
                          i < currentStageIdx ? 'bg-emerald-500' : 'bg-border',
                        )} />
                      )}
                    </div>
                  )
                })}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  Currently at <span className="font-mono font-semibold text-foreground">{canaryDeploying.canaryPct}%</span> traffic.
                  Promote to advance to the next stage.
                </p>
                <Button
                  onClick={() => handlePromote(canaryDeploying.id)}
                  disabled={promotingId === canaryDeploying.id || canaryDeploying.canaryPct >= 100}
                  size="sm"
                  className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600"
                >
                  {promotingId === canaryDeploying.id
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <ArrowUpRight className="h-3.5 w-3.5" />}
                  Promote Canary → {canaryDeploying.canaryPct === 0 ? '25%' : canaryDeploying.canaryPct === 25 ? '50%' : '100%'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ---- Deployment history ---- */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-display text-base">
            <History className="h-4 w-4 text-primary" /> Deployment History
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {deployments.length === 0 ? (
            <EmptyState icon={Rocket} title="No deployments yet" hint="Deployments will appear here once CI/CD runs." />
          ) : (
            <div className="votewise-scroll max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
                  <tr className="text-left">
                    <th className="p-3 font-semibold">Version</th>
                    <th className="p-3 font-semibold">Env</th>
                    <th className="hidden p-3 font-semibold sm:table-cell">Strategy</th>
                    <th className="p-3 font-semibold">Status</th>
                    <th className="hidden p-3 font-semibold md:table-cell">Commit</th>
                    <th className="hidden p-3 font-semibold lg:table-cell">By</th>
                    <th className="p-3 font-semibold">When</th>
                  </tr>
                </thead>
                <tbody>
                  {deployments.map((d) => (
                    <tr key={d.id} className="border-t border-border hover:bg-muted/30">
                      <td className="p-3">
                        <div className="font-mono text-xs font-semibold">{d.version}</div>
                        {d.canaryPct < 100 && d.strategy === 'canary' && (
                          <div className="text-[10px] text-amber-600 dark:text-amber-400">{d.canaryPct}% canary</div>
                        )}
                      </td>
                      <td className="p-3">
                        <Badge className={cn('text-[10px]', ENV_BADGE[d.environment] || ENV_BADGE.production)}>
                          {d.environment}
                        </Badge>
                      </td>
                      <td className="hidden p-3 sm:table-cell">
                        <Badge className={cn('text-[10px]', STRATEGY_BADGE[d.strategy] || STRATEGY_BADGE.rolling)}>
                          {d.strategy}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1.5">
                          {d.status === 'LIVE' && <span className="votewise-live-dot inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                          {d.status === 'DEPLOYING' && <Loader2 className="h-3 w-3 animate-spin text-amber-500" />}
                          <Badge className={cn('text-[10px]', DEPLOY_STATUS_BADGE[d.status] || DEPLOY_STATUS_BADGE.ROLLED_BACK)}>
                            {d.status}
                          </Badge>
                        </span>
                      </td>
                      <td className="hidden max-w-[200px] truncate p-3 font-mono text-[10px] text-muted-foreground md:table-cell">
                        {d.commitMessage || '—'}
                      </td>
                      <td className="hidden p-3 text-xs text-muted-foreground lg:table-cell">{d.deployedBy || '—'}</td>
                      <td className="p-3 text-xs text-muted-foreground">{timeAgo(d.startedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---- Strategy legend ---- */}
      <Card>
        <CardContent className="p-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Strategy legend</p>
          <div className="flex flex-wrap gap-3 text-xs">
            <LegendItem badge={STRATEGY_BADGE['blue-green']} label="blue-green" hint="Instant switch with instant rollback" />
            <LegendItem badge={STRATEGY_BADGE['canary']} label="canary" hint="0 → 25 → 50 → 100% traffic ramp" />
            <LegendItem badge={STRATEGY_BADGE['rolling']} label="rolling" hint="Replace instances one batch at a time" />
          </div>
        </CardContent>
      </Card>

      {/* ---- Rollback dialog ---- */}
      <AlertDialog open={!!rollbackTarget} onOpenChange={(o) => { if (!o) { setRollbackTarget(null); setRollbackReason('') } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" /> Rollback deployment?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will mark <strong className="font-mono">{rollbackTarget?.version}</strong> as <code>ROLLED_BACK</code> and
              attempt to restore the previous LIVE deployment in the <strong>{rollbackTarget?.environment}</strong> environment.
              Provide a reason for the audit trail.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="rollback-reason">Reason (optional)</Label>
            <Textarea
              id="rollback-reason"
              value={rollbackReason}
              onChange={(e) => setRollbackReason(e.target.value)}
              placeholder="e.g. Spike in 5xx errors after canary reached 50%"
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rollingBack}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRollback}
              disabled={rollingBack}
              className="gap-1.5 bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
            >
              {rollingBack ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
              Rollback Deployment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function LegendItem({ badge, label, hint }: { badge: string; label: string; hint: string }) {
  return (
    <div className="flex items-center gap-2">
      <Badge className={cn('text-[10px]', badge)}>{label}</Badge>
      <span className="text-[11px] text-muted-foreground">{hint}</span>
    </div>
  )
}

// ===========================================================================
// TAB 6 — Custom Domains
// ===========================================================================

function DomainsTab() {
  const [domains, setDomains] = useState<CustomDomain[]>([])
  const [stats, setStats] = useState<DomainStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [verifyingId, setVerifyingId] = useState<string | null>(null)
  const [removeTarget, setRemoveTarget] = useState<CustomDomain | null>(null)
  const [removing, setRemoving] = useState(false)

  const [addOpen, setAddOpen] = useState(false)
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [form, setForm] = useState({ organizationId: '', domain: '', type: 'subdomain', primary: false })
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    try {
      setError(null)
      const res = await api.pihedDomains() as { domains: CustomDomain[]; stats: DomainStats }
      setDomains(res.domains || [])
      setStats(res.stats)
    } catch (e: any) {
      setError(e?.message || 'Failed to load custom domains')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function loadOrgs() {
    try {
      const res = await api.listOrganizations() as { organizations: Organization[] }
      setOrgs(res.organizations || [])
    } catch {
      /* silent */
    }
  }

  async function handleAdd() {
    if (!form.organizationId) { toast.error('Please select an organization'); return }
    if (!form.domain.trim()) { toast.error('Please enter a domain'); return }
    const domainRegex = /^(\*\.)?([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i
    if (!domainRegex.test(form.domain.trim())) { toast.error('Invalid domain format'); return }
    setCreating(true)
    try {
      await api.pihedAddDomain({
        organizationId: form.organizationId,
        domain: form.domain.trim().toLowerCase(),
        type: form.type,
        primary: form.primary,
      })
      toast.success('Domain registered — add the TXT record to verify')
      setAddOpen(false)
      setForm({ organizationId: '', domain: '', type: 'subdomain', primary: false })
      await load()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to add domain')
    } finally {
      setCreating(false)
    }
  }

  async function handleVerify(d: CustomDomain) {
    setVerifyingId(d.id)
    try {
      const res = await api.pihedVerifyDomain(d.id) as { domain: CustomDomain; message: string }
      const ok = res.domain.status === 'ACTIVE'
      if (ok) {
        toast.success('DNS verified & SSL certificate issued (90-day Let\'s Encrypt)')
      } else {
        toast.error('DNS verification failed — ensure the TXT record is published')
      }
      await load()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to verify domain')
    } finally {
      setVerifyingId(null)
    }
  }

  async function handleRemove() {
    if (!removeTarget) return
    setRemoving(true)
    try {
      await api.pihedRemoveDomain(removeTarget.id)
      toast.success('Domain removed')
      setRemoveTarget(null)
      await load()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to remove domain')
    } finally {
      setRemoving(false)
    }
  }

  if (loading) return <LoadingRow label="Loading custom domains…" />
  if (error && !stats) {
    return (
      <Card>
        <CardContent>
          <ErrorState message={error} onRetry={load} />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* ---- Header ---- */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <Card className="votewise-card-glow">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
                <Globe className="h-6 w-6" />
              </div>
              <div>
                <h2 className="font-display text-xl font-bold">Custom Domains</h2>
                <p className="text-sm text-muted-foreground">
                  Multi-tenant domain routing with automatic Let&apos;s Encrypt SSL.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={load} variant="outline" size="sm" className="gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </Button>
              <Button
                onClick={() => { setAddOpen(true); loadOrgs() }}
                size="sm"
                className="gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" /> Add Domain
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ---- Stat cards ---- */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total" value={formatNumber(stats.total)} icon={Globe} accent="bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300" />
          <StatCard label="Active" value={formatNumber(stats.active)} icon={CheckCircle2} accent="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" />
          <StatCard label="Pending" value={formatNumber(stats.pending)} icon={Clock} accent="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" />
          <StatCard label="Expiring Soon" value={formatNumber(stats.expiringSoon)} icon={AlertTriangle} accent={stats.expiringSoon > 0 ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300' : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300'} />
        </div>
      )}

      {/* ---- Domain list ---- */}
      {domains.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState icon={Globe} title="No custom domains" hint="Add a custom domain to enable white-label routing for an organization." />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          <AnimatePresence initial={false}>
            {domains.map((d, i) => {
              const isPending = d.status === 'PENDING'
              return (
                <motion.div
                  key={d.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.25, delay: i * 0.03 }}
                >
                  <Card className="h-full">
                    <CardContent className="p-4">
                      {/* Domain + status row */}
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <code className="font-mono text-base font-bold break-all">{d.domain}</code>
                            {d.primary && (
                              <Badge className="bg-accent text-accent-foreground text-[9px]">PRIMARY</Badge>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                            <Building2 className="h-3 w-3" />
                            <span className="truncate">{d.organization?.name || d.organizationId}</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge className={cn('text-[9px]', DOMAIN_TYPE_BADGE[d.type] || DOMAIN_TYPE_BADGE.subdomain)}>
                            {d.type}
                          </Badge>
                          <Badge className={cn('text-[9px]', DOMAIN_STATUS_BADGE[d.status] || DOMAIN_STATUS_BADGE.PENDING)}>
                            {d.status}
                          </Badge>
                        </div>
                      </div>

                      {/* SSL + verification row */}
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="inline-flex items-center gap-1">
                          {d.sslStatus === 'ACTIVE'
                            ? <Lock className="h-3 w-3 text-emerald-500" />
                            : d.sslStatus === 'FAILED'
                            ? <XCircle className="h-3 w-3 text-red-500" />
                            : <Clock className="h-3 w-3 text-amber-500" />}
                          <Badge className={cn('text-[9px]', SSL_STATUS_BADGE[d.sslStatus] || SSL_STATUS_BADGE.PENDING)}>
                            SSL {d.sslStatus}
                          </Badge>
                        </span>
                        {d.sslExpiresAt && (
                          <span className="text-muted-foreground">
                            expires {formatDateTime(d.sslExpiresAt)}
                          </span>
                        )}
                        <span className="text-muted-foreground">
                          · checked {timeAgo(d.lastCheckedAt)}
                        </span>
                      </div>

                      {/* Verification token */}
                      {d.verificationToken && (
                        <div className="mt-3 flex items-center gap-2 rounded-lg border border-border/60 bg-muted/40 p-2">
                          <KeyRound className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <code className="min-w-0 flex-1 truncate font-mono text-[10px]">{d.verificationToken}</code>
                          <CopyButton text={d.verificationToken} size="sm" />
                        </div>
                      )}

                      {/* DNS hint for pending domains */}
                      {isPending && d.verificationToken && (
                        <Alert className="mt-3 border-amber-300/60 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
                          <ShieldCheck className="h-4 w-4" />
                          <AlertTitle>Add this TXT record to your DNS</AlertTitle>
                          <AlertDescription className="space-y-2 text-xs">
                            <div className="flex items-center gap-2 rounded border border-amber-300/40 bg-amber-100/40 p-2 dark:border-amber-800/40 dark:bg-amber-900/20">
                              <code className="min-w-0 flex-1 break-all font-mono text-[10px]">
                                _votewise-verify.{d.domain} = {d.verificationToken}
                              </code>
                              <CopyButton text={`_votewise-verify.${d.domain} = ${d.verificationToken}`} size="sm" />
                            </div>
                            <p>Once the TXT record is published, click <strong>Verify DNS + Issue SSL</strong>.</p>
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* Actions */}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Button
                          onClick={() => handleVerify(d)}
                          disabled={verifyingId === d.id}
                          size="sm"
                          className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600"
                        >
                          {verifyingId === d.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <ShieldCheck className="h-3.5 w-3.5" />}
                          Verify DNS + Issue SSL
                        </Button>
                        <Button
                          onClick={() => setRemoveTarget(d)}
                          size="sm"
                          variant="outline"
                          className="gap-1.5 border-red-300 text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/40"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Remove
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      {/* ---- Add domain dialog ---- */}
      <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) setForm({ organizationId: '', domain: '', type: 'subdomain', primary: false }) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <Globe className="h-5 w-5 text-primary" /> Add Custom Domain
            </DialogTitle>
            <DialogDescription>
              Register a custom domain for an organization. DNS verification is required before SSL issuance.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Organization</Label>
              <Select
                value={form.organizationId}
                onValueChange={(v) => setForm((f) => ({ ...f, organizationId: v }))}
              >
                <SelectTrigger><SelectValue placeholder="Select organization" /></SelectTrigger>
                <SelectContent>
                  {orgs.length === 0 ? (
                    <SelectItem value="_none" disabled>Loading organizations…</SelectItem>
                  ) : (
                    orgs.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name} <span className="text-[10px] text-muted-foreground">({o.slug})</span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="domain-input">Domain</Label>
              <Input
                id="domain-input"
                placeholder="vote.myschool.edu.ng"
                value={form.domain}
                onChange={(e) => setForm((f) => ({ ...f, domain: e.target.value }))}
              />
              <p className="text-[10px] text-muted-foreground">
                For wildcard domains, use <code>*.example.com</code>.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="subdomain">subdomain</SelectItem>
                    <SelectItem value="apex">apex</SelectItem>
                    <SelectItem value="wildcard">wildcard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end pb-1.5">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.primary}
                    onCheckedChange={(c) => setForm((f) => ({ ...f, primary: c === true }))}
                  />
                  Primary domain
                </label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={creating} className="gap-1.5">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add Domain
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Remove confirm ---- */}
      <AlertDialog open={!!removeTarget} onOpenChange={(o) => { if (!o) setRemoveTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" /> Remove custom domain?
            </AlertDialogTitle>
            <AlertDialogDescription>
              <code className="font-mono">{removeTarget?.domain}</code> will be disconnected from{' '}
              <strong>{removeTarget?.organization?.name || 'its organization'}</strong>. The SSL certificate
              will be revoked and traffic will stop routing through this domain. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              disabled={removing}
              className="gap-1.5 bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
            >
              {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Remove Domain
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// (Icons used across tabs are hoisted at the top of this file.)
