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

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  Server, Mail, Cloud, Shield, Activity, Gauge, Loader2, RefreshCw, Plus,
  CheckCircle2, AlertCircle, XCircle, AlertTriangle, Lock, Zap,
  Clock, Cpu, Database, HardDrive, ListChecks, Rocket, ArrowLeft,
  Copy, Trash2, Globe, ShieldCheck, KeyRound, Siren, Wrench, Sparkles, TrendingUp,
  Hash, ArrowUpRight, ArrowRightLeft, History, Building2,
  // New icons for the 4 additional tabs (Logs / Alerts / Costs / Load Test + DR)
  ScrollText, BellRing, DollarSign, Terminal, Play, Search, Filter, Eraser,
  MessageSquare, Smartphone, Megaphone, Timer, MemoryStick, Boxes, Calculator,
  Inbox, FileText, Power, Target,
  // New icons for the 2 additional tabs (Postmortems + Scheduled Maintenance)
  Lightbulb, CalendarClock, Ban,
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
import { Switch } from '@/components/ui/switch'
import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
} from '@/components/ui/accordion'
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip as RechartsTooltip,
} from 'recharts'
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

// --- New palette maps (Logs / Alerts / Costs / Load Test + DR) -------------

const LOG_LEVEL_BADGE: Record<string, string> = {
  debug: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300',
  info: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  warn: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  error: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  fatal: 'bg-red-600 text-white font-bold dark:bg-red-700 dark:text-red-50',
}

const LOG_LEVEL_DOT: Record<string, string> = {
  debug: 'bg-zinc-400',
  info: 'bg-emerald-500',
  warn: 'bg-amber-500',
  error: 'bg-red-500',
  fatal: 'bg-red-600',
}

const LOG_CATEGORY_BADGE: Record<string, string> = {
  application: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  audit: 'bg-accent text-accent-foreground',
  security: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  infrastructure: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  api: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 ring-1 ring-emerald-300/40 dark:ring-emerald-700/40',
  deployment: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300',
}

const LOG_SERVICE_BADGE: Record<string, string> = {
  app: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  worker: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  scheduler: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300',
  notification: 'bg-accent text-accent-foreground',
  'fraud-engine': 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  'analytics-engine': 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 ring-1 ring-amber-300/40 dark:ring-amber-700/40',
  'results-service': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 ring-1 ring-emerald-300/40 dark:ring-emerald-700/40',
}

const ALERT_SEVERITY_BADGE: Record<string, string> = {
  info: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  critical: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300 ring-1 ring-red-400/40 dark:ring-red-700/40',
}

const ALERT_SEVERITY_DOT: Record<string, string> = {
  info: 'bg-zinc-400',
  warning: 'bg-amber-500',
  critical: 'bg-red-500',
}

const ALERT_SEVERITY_RING: Record<string, string> = {
  info: 'border-zinc-300/50 dark:border-zinc-700/50',
  warning: 'border-amber-300/60 dark:border-amber-800/60',
  critical: 'border-red-300/60 dark:border-red-900/60',
}

// Map channel name → { icon, label, badge }
const ALERT_CHANNEL_META: Record<string, { icon: any; label: string; badge: string }> = {
  email: {
    icon: Mail,
    label: 'Email',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  },
  sms: {
    icon: Smartphone,
    label: 'SMS',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  },
  whatsapp: {
    icon: MessageSquare,
    label: 'WhatsApp',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  },
  slack: {
    icon: Hash,
    label: 'Slack',
    badge: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300',
  },
  teams: {
    icon: Megaphone,
    label: 'Teams',
    badge: 'bg-accent text-accent-foreground',
  },
}

const COST_CATEGORY_COLOR: Record<string, string> = {
  infrastructure: '#10b981', // emerald-500
  compute: '#34d399',         // emerald-400
  database: '#f59e0b',        // amber-500
  storage: '#a1a1aa',         // zinc-400
  sms: '#d4a02a',             // warm gold
  email: '#059669',           // emerald-600
  whatsapp: '#6ee7b7',        // emerald-300
  cdn: '#fbbf24',             // amber-400
  other: '#71717a',           // zinc-500
}

const COST_CATEGORY_BADGE: Record<string, string> = {
  infrastructure: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  compute: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 ring-1 ring-emerald-300/40 dark:ring-emerald-700/40',
  database: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  storage: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300',
  sms: 'bg-accent text-accent-foreground',
  email: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  whatsapp: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  cdn: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  other: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300',
}

const LOAD_TEST_VERDICT_BADGE: Record<string, string> = {
  PASS: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 ring-1 ring-emerald-300/40 dark:ring-emerald-700/40',
  DEGRADED: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 ring-1 ring-amber-300/40 dark:ring-amber-700/40',
  FAIL: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300 ring-1 ring-red-400/40 dark:ring-red-700/40',
}

const LOAD_TEST_PRESET_BADGE: Record<string, string> = {
  '10k': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  '50k': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 ring-1 ring-emerald-300/40 dark:ring-emerald-700/40',
  '100k': 'bg-accent text-accent-foreground',
  '500k': 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  '1m': 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300 ring-1 ring-red-400/40 dark:ring-red-700/40',
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

// --- New types (Logs / Alerts / Costs / Load Test) -------------------------

interface LogEntry {
  id: string
  category: string
  level: string
  service: string
  message: string
  metadata: string | null
  requestId: string | null
  organizationId: string | null
  ipAddress: string | null
  createdAt: string
}

interface LogStats {
  total24h: number
  errors24h: number
  warnings24h: number
  byCategory: Record<string, number>
  byService: Record<string, number>
}

interface AlertEvent {
  id: string
  ruleId: string | null
  ruleName: string
  metric: string
  severity: string
  message: string
  value: number
  threshold: number
  channels: string          // JSON array
  delivered: string         // JSON array of { channel, status, at }
  acknowledged: boolean
  acknowledgedBy: string | null
  acknowledgedAt: string | null
  resolvedAt: string | null
  createdAt: string
}

interface AlertRule {
  id: string
  name: string
  description: string | null
  metric: string
  condition: string
  threshold: number
  windowMinutes: number
  severity: string
  channels: string          // JSON array
  enabled: boolean
  cooldownMin: number
  lastFiredAt: string | null
  createdAt: string
  updatedAt: string
}

interface AlertStats {
  total24h: number
  critical24h: number
  unacknowledged: number
  bySeverity: Record<string, number>
}

interface CostSummary {
  totalUsd: number
  totalNgn: number
  byCategory: Record<string, number>
  byService: Record<string, number>
}

interface CostTrendPoint {
  date: string
  costs: Record<string, number>
  total: number
}

interface LoadTestConfig {
  concurrentVoters: number
  durationMinutes: number
  rampUpSeconds: number
  targetEndpoint: string
}

interface LoadTestPreset extends LoadTestConfig {
  key: string
  label: string
}

interface LoadTestResult {
  config: LoadTestConfig
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  errorRatePct: number
  avgLatencyMs: number
  p50LatencyMs: number
  p95LatencyMs: number
  p99LatencyMs: number
  maxLatencyMs: number
  requestsPerSecond: number
  resourceUsage: {
    peakMemoryMb: number
    avgCpuPct: number
    peakConnections: number
  }
  verdict: 'PASS' | 'DEGRADED' | 'FAIL'
  notes: string
  startedAt: string
  completedAt: string
}

interface LoadTestHistoryItem extends LoadTestResult {
  id: string
  preset: string
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
            <TabsTrigger value="logs" className="gap-1.5">
              <ScrollText className="h-4 w-4" /> Logs
            </TabsTrigger>
            <TabsTrigger value="alerts" className="gap-1.5">
              <BellRing className="h-4 w-4" /> Alerts
            </TabsTrigger>
            <TabsTrigger value="costs" className="gap-1.5">
              <DollarSign className="h-4 w-4" /> Costs
            </TabsTrigger>
            <TabsTrigger value="loadtest" className="gap-1.5">
              <Gauge className="h-4 w-4" /> Load Test
            </TabsTrigger>
            <TabsTrigger value="postmortems" className="gap-1.5">
              <FileText className="h-4 w-4" /> Postmortems
            </TabsTrigger>
            <TabsTrigger value="maintenance" className="gap-1.5">
              <Wrench className="h-4 w-4" /> Maintenance
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
        <TabsContent value="logs" className="mt-0">
          <LogsTab />
        </TabsContent>
        <TabsContent value="alerts" className="mt-0">
          <AlertsTab />
        </TabsContent>
        <TabsContent value="costs" className="mt-0">
          <CostsTab />
        </TabsContent>
        <TabsContent value="loadtest" className="mt-0">
          <LoadTestingTab />
        </TabsContent>
        <TabsContent value="postmortems" className="mt-0">
          <PostmortemsTab />
        </TabsContent>
        <TabsContent value="maintenance" className="mt-0">
          <MaintenanceTab />
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

      {/* ---- SLO Status card ---- */}
      <SloStatusCard />
    </div>
  )
}

// ---------------------------------------------------------------------------
// SLO Status Card (Service Level Objectives)
// ---------------------------------------------------------------------------
function SloStatusCard() {
  const [data, setData] = useState<{ statuses: any[]; summary: any } | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setRefreshing(true)
      setError(null)
      const res = await api.pihedSlos() as any
      setData(res)
    } catch (e: any) {
      if (loading) setError(e?.message || 'Failed to load SLO data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [loading])

  useEffect(() => {
    load()
    const id = setInterval(load, 60_000)
    return () => clearInterval(id)
  }, [load])

  if (loading && !data) return <LoadingRow label="Loading SLO data…" />
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

  const s = data.summary || {}
  const statuses = data.statuses || []
  const allHealthy = s.allHealthy
  const avgBudget = s.avgBudgetRemaining || 0

  const SLO_STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
    healthy: { color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/15', label: 'Healthy' },
    warning: { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/15', label: 'Warning' },
    critical: { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/15', label: 'Critical' },
    breached: { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/20', label: 'Breached' },
  }

  function budgetColor(pct: number) {
    if (pct > 50) return 'bg-emerald-500'
    if (pct > 25) return 'bg-amber-500'
    return 'bg-red-500'
  }

  function miniSparkline(trend: any[]) {
    if (!trend || trend.length < 2) return null
    const vals = trend.map((t) => t.sliValue)
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    const range = max - min || 1
    const w = 60
    const h = 20
    const points = vals.map((v, i) => {
      const x = (i / (vals.length - 1)) * w
      const y = h - ((v - min) / range) * h
      return `${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ')
    return (
      <svg width={w} height={h} className="opacity-70">
        <polyline points={points} fill="none" stroke="currentColor" strokeWidth={1.5} className="text-emerald-500" />
      </svg>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <Card className="votewise-card-glow">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 font-display text-base">
              <Target className="h-4 w-4 text-primary" />
              Service Level Objectives
              <Badge variant="outline" className="text-[9px]">SLO</Badge>
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge className={cn(
                'gap-1.5 text-xs',
                allHealthy
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                  : s.critical > 0 || s.breached > 0
                    ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
              )}>
                <span className={cn(
                  'inline-block h-2 w-2 rounded-full',
                  allHealthy ? 'bg-emerald-500 votewise-live-dot' : s.critical > 0 || s.breached > 0 ? 'bg-red-500' : 'bg-amber-500',
                )} />
                {allHealthy ? 'All SLOs healthy' : s.breached > 0 ? `${s.breached} breached` : s.critical > 0 ? `${s.critical} critical` : `${s.warning} warning`}
              </Badge>
              <Button onClick={load} variant="ghost" size="sm" disabled={refreshing} className="h-7 gap-1 text-xs">
                {refreshing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="rounded-lg border border-border/60 p-3 text-center">
              <div className="font-display text-xl font-bold">{s.total || 0}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total SLOs</div>
            </div>
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-center">
              <div className="font-display text-xl font-bold text-emerald-600 dark:text-emerald-400">{s.healthy || 0}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Healthy</div>
            </div>
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-center">
              <div className="font-display text-xl font-bold text-amber-600 dark:text-amber-400">{s.warning || 0}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Warning</div>
            </div>
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-center">
              <div className="font-display text-xl font-bold text-red-600 dark:text-red-400">{(s.critical || 0) + (s.breached || 0)}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Critical+</div>
            </div>
            <div className="rounded-lg border border-border/60 p-3 text-center">
              <div className={cn('font-display text-xl font-bold', budgetColor(avgBudget).replace('bg-', 'text-'))}>
                {avgBudget.toFixed(1)}%
              </div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Avg Budget</div>
            </div>
          </div>

          {/* SLO rows */}
          <div className="space-y-2">
            {statuses.map((slo: any, i: number) => {
              const style = SLO_STATUS_STYLE[slo.status] || SLO_STATUS_STYLE.healthy
              const budget = slo.budgetRemaining || 0
              const targetLabel = slo.targetUnit === 'percent'
                ? `${slo.target}% ${slo.metric === 'uptime' ? 'uptime' : slo.metric}`
                : `${slo.target}${slo.targetUnit} ${slo.metric}`
              return (
                <motion.div
                  key={slo.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: i * 0.05 }}
                  className="flex flex-col gap-2 rounded-lg border border-border/60 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn('grid h-8 w-8 place-items-center rounded-lg', style.bg)}>
                      <Gauge className={cn('h-4 w-4', style.color)} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{slo.name}</span>
                        <Badge variant="outline" className="text-[9px]">{slo.service}</Badge>
                      </div>
                      <div className="text-[11px] text-muted-foreground">Target: {targetLabel} · {slo.window}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {miniSparkline(slo.trend)}
                    <div className="text-right">
                      <div className={cn('font-mono text-sm font-bold', style.color)}>
                        {slo.targetUnit === 'percent' ? `${slo.currentSli.toFixed(2)}%` : `${slo.currentSli.toFixed(0)}${slo.targetUnit}`}
                      </div>
                      <div className="text-[10px] text-muted-foreground">current SLI</div>
                    </div>
                    <div className="w-24">
                      <div className="mb-1 flex items-center justify-between text-[9px] text-muted-foreground">
                        <span>Error budget</span>
                        <span className={cn('font-mono font-semibold', budget > 50 ? 'text-emerald-600 dark:text-emerald-400' : budget > 25 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400')}>
                          {budget.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className={cn('h-full transition-all', budgetColor(budget))} style={{ width: `${Math.max(0, Math.min(100, budget))}%` }} />
                      </div>
                    </div>
                    <Badge className={cn('text-[9px]', style.bg, style.color)}>
                      {slo.status === 'healthy' && <CheckCircle2 className="mr-1 h-3 w-3" />}
                      {slo.status === 'breached' && <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-red-500 votewise-live-dot" />}
                      {style.label}
                    </Badge>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
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

// ===========================================================================
// TAB 7 — Logs (Centralized Logging)
// ===========================================================================

const LOG_CATEGORIES: Array<{ value: string; label: string }> = [
  { value: 'application', label: 'Application' },
  { value: 'audit', label: 'Audit' },
  { value: 'security', label: 'Security' },
  { value: 'infrastructure', label: 'Infrastructure' },
  { value: 'api', label: 'API' },
  { value: 'deployment', label: 'Deployment' },
]

const LOG_LEVELS: Array<{ value: string; label: string }> = [
  { value: 'debug', label: 'Debug' },
  { value: 'info', label: 'Info' },
  { value: 'warn', label: 'Warn' },
  { value: 'error', label: 'Error' },
  { value: 'fatal', label: 'Fatal' },
]

const LOG_SERVICES: Array<{ value: string; label: string }> = [
  { value: 'app', label: 'app' },
  { value: 'worker', label: 'worker' },
  { value: 'scheduler', label: 'scheduler' },
  { value: 'notification', label: 'notification' },
  { value: 'fraud-engine', label: 'fraud-engine' },
  { value: 'analytics-engine', label: 'analytics-engine' },
  { value: 'results-service', label: 'results-service' },
]

function LogsTab() {
  // Filters held in local state, applied on Apply click
  const [filters, setFilters] = useState({
    category: '',
    level: '',
    service: '',
    search: '',
    since: '',
  })
  const [applied, setApplied] = useState(filters)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [stats, setStats] = useState<LogStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null)
  const firstLoadRef = useRef(true)

  const buildQuery = useCallback((f: typeof filters) => {
    const params = new URLSearchParams()
    if (f.category) params.set('category', f.category)
    if (f.level) params.set('level', f.level)
    if (f.service) params.set('service', f.service)
    if (f.search.trim()) params.set('search', f.search.trim())
    if (f.since) {
      // datetime-local → ISO
      const d = new Date(f.since)
      if (!isNaN(d.getTime())) params.set('since', d.toISOString())
    }
    params.set('limit', '200')
    return params.toString()
  }, [])

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true)
    try {
      setError(null)
      const res = await api.pihedLogs(buildQuery(applied)) as { logs: LogEntry[]; stats: LogStats }
      setLogs(res.logs || [])
      setStats(res.stats)
    } catch (e: any) {
      if (firstLoadRef.current) {
        setError(e?.message || 'Failed to load logs')
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
      firstLoadRef.current = false
    }
  }, [applied, buildQuery])

  useEffect(() => {
    load()
  }, [load])

  // Auto-refresh every 15s when enabled
  useEffect(() => {
    if (!autoRefresh) return
    const id = setInterval(() => load(true), 15000)
    return () => clearInterval(id)
  }, [autoRefresh, load])

  function applyFilters() {
    setApplied(filters)
    toast.success('Filters applied', { description: 'Showing matching log entries.' })
  }

  function clearFilters() {
    const cleared = { category: '', level: '', service: '', search: '', since: '' }
    setFilters(cleared)
    setApplied(cleared)
    toast.info('Filters cleared')
  }

  if (loading) return <LoadingRow label="Loading logs…" />
  if (error && !stats) {
    return (
      <Card>
        <CardContent>
          <ErrorState message={error} onRetry={() => load()} />
        </CardContent>
      </Card>
    )
  }

  // Category breakdown chips
  const categoryChips = LOG_CATEGORIES
    .map((c) => ({ ...c, count: stats?.byCategory?.[c.value] || 0 }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count)

  return (
    <div className="space-y-6">
      {/* ---- Header ---- */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <Card className="votewise-card-glow">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
                <ScrollText className="h-6 w-6" />
              </div>
              <div>
                <h2 className="font-display text-xl font-bold">Centralized Logging</h2>
                <p className="max-w-2xl text-sm text-muted-foreground">
                  Aggregate logs from every service. Categories: Application, Audit, Security, Infrastructure, API, Deployment.
                </p>
              </div>
            </div>
            <div className="flex flex-col items-start gap-1.5 sm:items-end">
              <div className="flex items-center gap-2">
                <Button onClick={() => load()} variant="outline" size="sm" disabled={refreshing} className="gap-1.5">
                  {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  Refresh
                </Button>
                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border/60 bg-card px-2.5 py-1.5 text-xs">
                  <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
                  <span className="text-muted-foreground">Auto · 15s</span>
                </label>
              </div>
              <Badge variant="secondary" className="gap-1.5 text-xs text-muted-foreground">
                <Inbox className="h-3 w-3" /> {logs.length} shown
              </Badge>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ---- Filters ---- */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-display text-base">
            <Filter className="h-4 w-4 text-primary" /> Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Category</Label>
              <Select value={filters.category} onValueChange={(v) => setFilters((f) => ({ ...f, category: v === '__all' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="All categories" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">All categories</SelectItem>
                  {LOG_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Level</Label>
              <Select value={filters.level} onValueChange={(v) => setFilters((f) => ({ ...f, level: v === '__all' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="All levels" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">All levels</SelectItem>
                  {LOG_LEVELS.map((l) => (
                    <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Service</Label>
              <Select value={filters.service} onValueChange={(v) => setFilters((f) => ({ ...f, service: v === '__all' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="All services" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">All services</SelectItem>
                  {LOG_SERVICES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Search message</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="e.g. vote recorded"
                  value={filters.search}
                  onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') applyFilters() }}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Since</Label>
              <Input
                type="datetime-local"
                value={filters.since}
                onChange={(e) => setFilters((f) => ({ ...f, since: e.target.value }))}
              />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={applyFilters} size="sm" className="gap-1.5">
                <Filter className="h-3.5 w-3.5" /> Apply Filters
              </Button>
              <Button onClick={clearFilters} size="sm" variant="outline" className="gap-1.5">
                <Eraser className="h-3.5 w-3.5" /> Clear
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ---- Stats row ---- */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <StatCard label="Total (24h)" value={formatNumber(stats.total24h)} icon={ScrollText} accent="bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300" />
          <StatCard label="Errors (24h)" value={formatNumber(stats.errors24h)} icon={XCircle} accent={stats.errors24h > 0 ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300' : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300'} />
          <StatCard label="Warnings (24h)" value={formatNumber(stats.warnings24h)} icon={AlertTriangle} accent={stats.warnings24h > 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300'} />
          <Card className="votewise-card-glow">
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                <Boxes className="h-3 w-3" /> By Category
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {categoryChips.length === 0 ? (
                  <span className="text-xs text-muted-foreground">No data yet</span>
                ) : (
                  categoryChips.map((c) => (
                    <Badge key={c.value} className={cn('text-[9px]', LOG_CATEGORY_BADGE[c.value] || LOG_CATEGORY_BADGE.application)}>
                      {c.label}: {formatNumber(c.count)}
                    </Badge>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ---- Log table + details panel ---- */}
      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 font-display text-base">
              <History className="h-4 w-4 text-primary" /> Log Entries
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {logs.length === 0 ? (
              <EmptyState icon={ScrollText} title="No logs match these filters" hint="Adjust the filters above or clear them to see all entries." />
            ) : (
              <div className="votewise-scroll max-h-[600px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
                    <tr className="text-left">
                      <th className="p-3 font-semibold">Time</th>
                      <th className="p-3 font-semibold">Level</th>
                      <th className="hidden p-3 font-semibold md:table-cell">Category</th>
                      <th className="hidden p-3 font-semibold sm:table-cell">Service</th>
                      <th className="p-3 font-semibold">Message</th>
                      <th className="hidden p-3 font-semibold lg:table-cell">Request ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => {
                      const isSelected = selectedLog?.id === log.id
                      return (
                        <tr
                          key={log.id}
                          onClick={() => setSelectedLog(isSelected ? null : log)}
                          className={cn(
                            'cursor-pointer border-t border-border transition-colors',
                            isSelected ? 'bg-primary/5' : 'hover:bg-muted/30',
                          )}
                        >
                          <td className="whitespace-nowrap p-3 font-mono text-[10px] text-muted-foreground" title={formatDateTime(log.createdAt)}>
                            {timeAgo(log.createdAt)}
                          </td>
                          <td className="p-3">
                            <span className="inline-flex items-center gap-1.5">
                              <span className={cn('h-1.5 w-1.5 rounded-full', LOG_LEVEL_DOT[log.level] || 'bg-zinc-400')} />
                              <Badge className={cn('text-[9px]', LOG_LEVEL_BADGE[log.level] || LOG_LEVEL_BADGE.info)}>
                                {log.level}
                              </Badge>
                            </span>
                          </td>
                          <td className="hidden p-3 md:table-cell">
                            <Badge className={cn('text-[9px]', LOG_CATEGORY_BADGE[log.category] || LOG_CATEGORY_BADGE.application)}>
                              {log.category}
                            </Badge>
                          </td>
                          <td className="hidden p-3 sm:table-cell">
                            <code className="font-mono text-[10px] text-muted-foreground">{log.service}</code>
                          </td>
                          <td className="max-w-[260px] truncate p-3 text-xs" title={log.message}>
                            {log.message}
                          </td>
                          <td className="hidden p-3 lg:table-cell">
                            {log.requestId ? (
                              <code className="font-mono text-[10px] text-muted-foreground" title={log.requestId}>
                                {log.requestId.slice(0, 10)}…
                              </code>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ---- Details panel ---- */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 font-display text-base">
              <FileText className="h-4 w-4 text-primary" /> Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AnimatePresence mode="wait">
              {selectedLog ? (
                <motion.div
                  key={selectedLog.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-3"
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={cn('h-2 w-2 rounded-full', LOG_LEVEL_DOT[selectedLog.level] || 'bg-zinc-400')} />
                    <Badge className={cn('text-[9px]', LOG_LEVEL_BADGE[selectedLog.level] || LOG_LEVEL_BADGE.info)}>
                      {selectedLog.level}
                    </Badge>
                    <Badge className={cn('text-[9px]', LOG_CATEGORY_BADGE[selectedLog.category] || LOG_CATEGORY_BADGE.application)}>
                      {selectedLog.category}
                    </Badge>
                    <Badge className={cn('text-[9px] font-mono', LOG_SERVICE_BADGE[selectedLog.service] || LOG_SERVICE_BADGE.app)}>
                      {selectedLog.service}
                    </Badge>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-muted/40 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Message</p>
                    <p className="mt-1 text-sm">{selectedLog.message}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Timestamp</p>
                      <p className="mt-0.5 font-mono text-[11px]">{formatDateTime(selectedLog.createdAt)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">IP Address</p>
                      <p className="mt-0.5 font-mono text-[11px]">{selectedLog.ipAddress || '—'}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Request ID</p>
                      <p className="mt-0.5 font-mono text-[11px] break-all">{selectedLog.requestId || '—'}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Organization</p>
                      <p className="mt-0.5 font-mono text-[11px]">{selectedLog.organizationId || '—'}</p>
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Metadata</p>
                    <pre className="votewise-scroll max-h-64 overflow-auto rounded-lg border border-border/60 bg-zinc-50 p-3 text-[10px] leading-relaxed text-foreground dark:bg-zinc-950/60">
{selectedLog.metadata ? formatMetadata(selectedLog.metadata) : '// no metadata attached'}
                    </pre>
                  </div>
                </motion.div>
              ) : (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  <Inbox className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  Click a log entry to inspect its metadata, request ID, and timestamp.
                </div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function formatMetadata(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

// ===========================================================================
// TAB 8 — Alerts (Alerting)
// ===========================================================================

function AlertsTab() {
  const [events, setEvents] = useState<AlertEvent[]>([])
  const [rules, setRules] = useState<AlertRule[]>([])
  const [stats, setStats] = useState<AlertStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ackingId, setAcingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const firstLoadRef = useRef(true)

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true)
    try {
      setError(null)
      const res = await api.pihedAlerts(false) as { events: AlertEvent[]; rules: AlertRule[]; stats: AlertStats }
      setEvents(res.events || [])
      setRules(res.rules || [])
      setStats(res.stats)
    } catch (e: any) {
      if (firstLoadRef.current) {
        setError(e?.message || 'Failed to load alerts')
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
      firstLoadRef.current = false
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(() => load(true), 30000)
    return () => clearInterval(id)
  }, [load])

  async function handleAck(id: string) {
    setAcingId(id)
    try {
      await api.pihedAckAlert(id)
      toast.success('Alert acknowledged', { description: 'The alert has been marked as resolved.' })
      await load(true)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to acknowledge alert')
    } finally {
      setAcingId(null)
    }
  }

  async function handleToggle(rule: AlertRule, enabled: boolean) {
    setTogglingId(rule.id)
    try {
      await api.pihedToggleAlertRule(rule.id, enabled)
      toast.success(`Rule ${enabled ? 'enabled' : 'disabled'}`, { description: rule.name })
      await load(true)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to toggle rule')
    } finally {
      setTogglingId(null)
    }
  }

  if (loading) return <LoadingRow label="Loading alerts…" />
  if (error && !stats) {
    return (
      <Card>
        <CardContent>
          <ErrorState message={error} onRetry={() => load()} />
        </CardContent>
      </Card>
    )
  }

  const severityChips = (['critical', 'warning', 'info'] as const)
    .map((s) => ({ value: s, count: stats?.bySeverity?.[s] || 0 }))
    .filter((s) => s.count > 0)

  return (
    <div className="space-y-6">
      {/* ---- Header ---- */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <Card className="votewise-card-glow">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
                <BellRing className="h-6 w-6" />
              </div>
              <div>
                <h2 className="font-display text-xl font-bold">Alerting</h2>
                <p className="max-w-2xl text-sm text-muted-foreground">
                  Critical events trigger alerts via Email, SMS, WhatsApp, Slack, and Microsoft Teams.
                </p>
              </div>
            </div>
            <div className="flex flex-col items-start gap-1.5 sm:items-end">
              <Button onClick={() => load()} variant="outline" size="sm" disabled={refreshing} className="gap-1.5">
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

      {/* ---- Stat cards ---- */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <StatCard label="Total (24h)" value={formatNumber(stats.total24h)} icon={BellRing} accent="bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300" />
          <StatCard label="Critical (24h)" value={formatNumber(stats.critical24h)} icon={Siren} accent={stats.critical24h > 0 ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300' : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300'} />
          <Card className={cn(stats.unacknowledged > 0 && 'votewise-card-glow ring-1 ring-red-400/40 dark:ring-red-700/40')}>
            <CardContent className="p-4">
              <div className={cn(
                'grid h-9 w-9 place-items-center rounded-lg',
                stats.unacknowledged > 0
                  ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300'
                  : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300',
              )}>
                {stats.unacknowledged > 0 ? <AlertCircle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
              </div>
              <div className="mt-3 flex items-center gap-1.5">
                <span className="font-display text-xl font-bold tabular-nums">{formatNumber(stats.unacknowledged)}</span>
                {stats.unacknowledged > 0 && (
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                  </span>
                )}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Unacknowledged</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                <Boxes className="h-3 w-3" /> By Severity
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {severityChips.length === 0 ? (
                  <span className="text-xs text-muted-foreground">No data yet</span>
                ) : (
                  severityChips.map((s) => (
                    <Badge key={s.value} className={cn('text-[9px]', ALERT_SEVERITY_BADGE[s.value] || ALERT_SEVERITY_BADGE.info)}>
                      {s.value}: {formatNumber(s.count)}
                    </Badge>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ---- Active Alert Events ---- */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 font-display text-base">
              <Siren className="h-4 w-4 text-red-500" /> Active Alert Events
              <Badge variant="outline" className="text-[10px]">{events.length}</Badge>
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {events.length === 0 ? (
            <EmptyState icon={BellRing} title="No alert events" hint="Alert events will appear here when alert rules fire." />
          ) : (
            <div className="votewise-scroll max-h-[600px] space-y-3 overflow-y-auto p-4">
              <AnimatePresence initial={false}>
                {events.slice(0, 50).map((ev, i) => {
                  const sev = ev.severity
                  const channels = safeParseArray(ev.channels)
                  const delivered = safeParseDelivered(ev.delivered)
                  return (
                    <motion.div
                      key={ev.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={{ duration: 0.25, delay: Math.min(i * 0.02, 0.4) }}
                    >
                      <div className={cn(
                        'rounded-lg border p-3',
                        ALERT_SEVERITY_RING[sev] || ALERT_SEVERITY_RING.info,
                        sev === 'critical' && 'bg-red-50/40 dark:bg-red-950/20',
                      )}>
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {sev === 'critical' && (
                                <span className="relative flex h-2 w-2">
                                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                                  <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                                </span>
                              )}
                              <Badge className={cn('text-[9px]', ALERT_SEVERITY_BADGE[sev] || ALERT_SEVERITY_BADGE.info)}>
                                {sev}
                              </Badge>
                              <span className="font-semibold">{ev.ruleName}</span>
                              <code className="font-mono text-[10px] text-muted-foreground">· {ev.metric}</code>
                            </div>
                            <p className="mt-1 text-sm text-foreground">{ev.message}</p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                              <span className="font-mono">
                                value <span className="text-foreground">{ev.value.toFixed(2)}</span>
                                {' '}/ threshold <span className="text-foreground">{ev.threshold}</span>
                              </span>
                              <span>· {timeAgo(ev.createdAt)}</span>
                              {ev.acknowledged && (
                                <Badge className="bg-emerald-100 text-emerald-700 text-[9px] dark:bg-emerald-500/15 dark:text-emerald-300">
                                  <CheckCircle2 className="mr-1 h-3 w-3" /> Acked by {ev.acknowledgedBy || 'admin'}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1.5">
                            {!ev.acknowledged && (
                              <Button
                                onClick={() => handleAck(ev.id)}
                                disabled={ackingId === ev.id}
                                size="sm"
                                variant="outline"
                                className="gap-1.5"
                              >
                                {ackingId === ev.id
                                  ? <Loader2 className="h-3 w-3 animate-spin" />
                                  : <CheckCircle2 className="h-3 w-3" />}
                                Acknowledge
                              </Button>
                            )}
                          </div>
                        </div>
                        {/* Channels delivered */}
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-border/40 pt-2">
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Channels:</span>
                          {channels.length === 0 ? (
                            <span className="text-[10px] text-muted-foreground">—</span>
                          ) : (
                            channels.map((ch) => {
                              const meta = ALERT_CHANNEL_META[ch] || ALERT_CHANNEL_META.email
                              const delivery = delivered.find((d) => d.channel === ch)
                              const Icon = meta.icon
                              const isSent = delivery?.status === 'sent'
                              return (
                                <Tooltip key={ch}>
                                  <TooltipTrigger asChild>
                                    <span className={cn(
                                      'inline-flex items-center gap-1 rounded-md border border-border/60 px-1.5 py-0.5 text-[10px]',
                                      isSent
                                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                                        : 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300',
                                    )}>
                                      <Icon className="h-3 w-3" />
                                      {meta.label}
                                      {isSent
                                        ? <CheckCircle2 className="h-2.5 w-2.5" />
                                        : <XCircle className="h-2.5 w-2.5" />}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {delivery
                                      ? `${meta.label}: ${delivery.status} at ${formatDateTime(delivery.at)}`
                                      : `${meta.label}: not dispatched`}
                                  </TooltipContent>
                                </Tooltip>
                              )
                            })
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---- Alert Rules ---- */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-display text-base">
            <Shield className="h-4 w-4 text-primary" /> Alert Rules
            <Badge variant="outline" className="text-[10px]">{rules.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rules.length === 0 ? (
            <EmptyState icon={Shield} title="No alert rules" hint="Alert rules will be seeded on first scheduler run." />
          ) : (
            <div className="votewise-scroll overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
                  <tr className="text-left">
                    <th className="p-3 font-semibold">Rule</th>
                    <th className="hidden p-3 font-semibold md:table-cell">Metric</th>
                    <th className="hidden p-3 font-semibold lg:table-cell">Condition</th>
                    <th className="p-3 font-semibold">Severity</th>
                    <th className="hidden p-3 font-semibold sm:table-cell">Channels</th>
                    <th className="p-3 font-semibold">Enabled</th>
                    <th className="hidden p-3 font-semibold lg:table-cell">Last Fired</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((r) => {
                    const channels = safeParseArray(r.channels)
                    return (
                      <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                        <td className="p-3">
                          <div className="font-medium">{r.name}</div>
                          {r.description && (
                            <div className="text-[10px] text-muted-foreground">{r.description}</div>
                          )}
                        </td>
                        <td className="hidden p-3 md:table-cell">
                          <code className="font-mono text-[10px] text-muted-foreground">{r.metric}</code>
                        </td>
                        <td className="hidden p-3 lg:table-cell">
                          <code className="font-mono text-[10px]">
                            {r.condition} {r.threshold}
                          </code>
                          <div className="text-[10px] text-muted-foreground">{r.windowMinutes}m window</div>
                        </td>
                        <td className="p-3">
                          <Badge className={cn('text-[9px]', ALERT_SEVERITY_BADGE[r.severity] || ALERT_SEVERITY_BADGE.info)}>
                            {r.severity}
                          </Badge>
                        </td>
                        <td className="hidden p-3 sm:table-cell">
                          <div className="flex flex-wrap gap-1">
                            {channels.map((ch) => {
                              const meta = ALERT_CHANNEL_META[ch] || ALERT_CHANNEL_META.email
                              const Icon = meta.icon
                              return (
                                <span key={ch} className={cn('inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px]', meta.badge)}>
                                  <Icon className="h-2.5 w-2.5" />
                                  {meta.label}
                                </span>
                              )
                            })}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={r.enabled}
                              disabled={togglingId === r.id}
                              onCheckedChange={(checked) => handleToggle(r, checked === true)}
                            />
                            {togglingId === r.id && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                          </div>
                        </td>
                        <td className="hidden p-3 text-[11px] text-muted-foreground lg:table-cell">
                          {r.lastFiredAt ? timeAgo(r.lastFiredAt) : 'Never'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function safeParseArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function safeParseDelivered(raw: string): Array<{ channel: string; status: string; at: string }> {
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// ===========================================================================
// TAB 9 — Costs (Cost Monitoring)
// ===========================================================================

const COST_PERIODS: Array<{ value: number; label: string }> = [
  { value: 7, label: '7d' },
  { value: 30, label: '30d' },
  { value: 90, label: '90d' },
  { value: 365, label: '365d' },
]

const COST_CATEGORY_ORDER: Array<{ key: string; label: string }> = [
  { key: 'infrastructure', label: 'Infrastructure' },
  { key: 'compute', label: 'Compute' },
  { key: 'database', label: 'Database' },
  { key: 'storage', label: 'Storage' },
  { key: 'sms', label: 'SMS' },
  { key: 'email', label: 'Email' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'cdn', label: 'CDN' },
  { key: 'other', label: 'Other' },
]

function formatUsd(n: number): string {
  if (!Number.isFinite(n)) return '$0.00'
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatNgn(n: number): string {
  if (!Number.isFinite(n)) return '₦0'
  return '₦' + n.toLocaleString('en-NG', { maximumFractionDigits: 0 })
}

function CostsTab() {
  const [days, setDays] = useState(30)
  const [summary, setSummary] = useState<CostSummary | null>(null)
  const [trend, setTrend] = useState<CostTrendPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const firstLoadRef = useRef(true)

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true)
    try {
      setError(null)
      const res = await api.pihedCosts(days) as { summary: CostSummary; trend: CostTrendPoint[]; days: number }
      setSummary(res.summary)
      setTrend(res.trend || [])
    } catch (e: any) {
      if (firstLoadRef.current) {
        setError(e?.message || 'Failed to load cost data')
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
      firstLoadRef.current = false
    }
  }, [days])

  useEffect(() => {
    load()
    const id = setInterval(() => load(true), 60000)
    return () => clearInterval(id)
  }, [load])

  // Memoize derived chart data
  const categoryBars = useMemo(() => {
    if (!summary) return []
    const total = summary.totalUsd || 0
    return COST_CATEGORY_ORDER
      .map((c) => ({
        key: c.key,
        label: c.label,
        amount: summary.byCategory?.[c.key] || 0,
        pct: total > 0 ? ((summary.byCategory?.[c.key] || 0) / total) * 100 : 0,
        color: COST_CATEGORY_COLOR[c.key] || COST_CATEGORY_COLOR.other,
      }))
      .filter((c) => c.amount > 0)
      .sort((a, b) => b.amount - a.amount)
  }, [summary])

  const serviceRows = useMemo(() => {
    if (!summary) return []
    return Object.entries(summary.byService || {})
      .map(([service, amount]) => ({ service, amount }))
      .sort((a, b) => b.amount - a.amount)
  }, [summary])

  const trendData = useMemo(() => {
    return trend.map((p) => ({
      date: p.date,
      total: Number(p.total.toFixed(2)),
      ...COST_CATEGORY_ORDER.reduce((acc, c) => {
        acc[c.key] = Number((p.costs?.[c.key] || 0).toFixed(2))
        return acc
      }, {} as Record<string, number>),
    }))
  }, [trend])

  // Projections
  const dailyAverage = summary && days > 0 ? summary.totalUsd / days : 0
  const projectedMonthly = dailyAverage * 30
  // Approx voter count: derived from registered voters. Use a placeholder if not available.
  const costPerVoter = summary && summary.totalUsd > 0 ? summary.totalUsd / 50000 : 0

  if (loading) return <LoadingRow label="Loading cost data…" />
  if (error && !summary) {
    return (
      <Card>
        <CardContent>
          <ErrorState message={error} onRetry={() => load()} />
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
                <DollarSign className="h-6 w-6" />
              </div>
              <div>
                <h2 className="font-display text-xl font-bold">Cost Monitoring</h2>
                <p className="max-w-2xl text-sm text-muted-foreground">
                  Track infrastructure, storage, SMS, email, compute, and database costs. Prevent unexpected spending.
                </p>
              </div>
            </div>
            <div className="flex flex-col items-start gap-2 sm:items-end">
              {/* Period selector */}
              <div className="flex items-center rounded-md border border-border/60 bg-card p-0.5">
                {COST_PERIODS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setDays(p.value)}
                    className={cn(
                      'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                      days === p.value
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <Button onClick={() => load()} variant="outline" size="sm" disabled={refreshing} className="gap-1.5">
                {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ---- Top stat cards ---- */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Card className="votewise-card-glow">
            <CardContent className="p-4">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-accent text-accent-foreground">
                <DollarSign className="h-5 w-5" />
              </div>
              <div className="mt-3 font-display text-xl font-bold tabular-nums">{formatUsd(summary.totalUsd)}</div>
              <div className="text-[10px] text-muted-foreground">{formatNgn(summary.totalNgn)} NGN · {days}d</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Cost</div>
            </CardContent>
          </Card>
          <StatCard label="Daily Average" value={formatUsd(dailyAverage)} icon={TrendingUp} accent="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" />
          <Card className="votewise-card-glow">
            <CardContent className="p-4">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                <Calculator className="h-5 w-5" />
              </div>
              <div className="mt-3 font-display text-xl font-bold tabular-nums">{formatUsd(projectedMonthly)}</div>
              <div className="text-[10px] text-muted-foreground">extrapolated from {days}d</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Projected Monthly</div>
            </CardContent>
          </Card>
          <StatCard label="Cost / Voter" value={formatUsd(costPerVoter)} icon={Hash} accent="bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300" />
        </div>
      )}

      {/* ---- Cost by Category (horizontal bars) + Trend (area chart) ---- */}
      <div className="grid gap-3 lg:grid-cols-2">
        {/* By Category */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 font-display text-base">
              <Boxes className="h-4 w-4 text-primary" /> Cost by Category
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {categoryBars.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No cost data for this period.</div>
            ) : (
              categoryBars.map((c, i) => (
                <motion.div
                  key={c.key}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.04 }}
                  className="space-y-1"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                      {c.label}
                    </span>
                    <span className="font-mono tabular-nums">
                      {formatUsd(c.amount)} <span className="text-muted-foreground">· {c.pct.toFixed(1)}%</span>
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${c.pct}%` }}
                      transition={{ duration: 0.5, delay: i * 0.04 }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: c.color }}
                    />
                  </div>
                </motion.div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Trend */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 font-display text-base">
              <TrendingUp className="h-4 w-4 text-primary" /> Cost Trend
              <Badge variant="outline" className="text-[10px]">{days} days</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trendData.length < 2 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                Not enough trend data to render a chart for this period.
              </div>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
                    <defs>
                      <linearGradient id="costTrendFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.12} vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.6 }}
                      tickFormatter={(d) => d.slice(5)}
                      axisLine={false}
                      tickLine={false}
                      minTickGap={20}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.6 }}
                      tickFormatter={(v) => `$${v.toFixed(0)}`}
                      axisLine={false}
                      tickLine={false}
                      width={48}
                    />
                    <RechartsTooltip
                      cursor={{ stroke: '#10b981', strokeOpacity: 0.4 }}
                      contentStyle={{
                        backgroundColor: 'rgba(24, 24, 27, 0.96)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 8,
                        fontSize: 11,
                        color: '#fff',
                      }}
                      labelStyle={{ color: '#a1a1aa', fontSize: 10 }}
                      formatter={(value: any) => [formatUsd(Number(value)), 'Total']}
                      labelFormatter={(l) => String(l)}
                    />
                    <Area
                      type="monotone"
                      dataKey="total"
                      stroke="#10b981"
                      strokeWidth={2}
                      fill="url(#costTrendFill)"
                      dot={false}
                      activeDot={{ r: 4, fill: '#10b981', stroke: '#fff', strokeWidth: 1.5 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ---- Stacked daily breakdown ---- */}
      {trendData.length >= 2 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 font-display text-base">
              <Boxes className="h-4 w-4 text-primary" /> Daily Breakdown by Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.12} vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.6 }}
                    tickFormatter={(d) => d.slice(5)}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={20}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.6 }}
                    tickFormatter={(v) => `$${v.toFixed(0)}`}
                    axisLine={false}
                    tickLine={false}
                    width={48}
                  />
                  <RechartsTooltip
                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                    contentStyle={{
                      backgroundColor: 'rgba(24, 24, 27, 0.96)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 8,
                      fontSize: 11,
                      color: '#fff',
                    }}
                    labelStyle={{ color: '#a1a1aa', fontSize: 10 }}
                    formatter={(value: any, name: any) => [formatUsd(Number(value)), String(name).charAt(0).toUpperCase() + String(name).slice(1)]}
                    labelFormatter={(l) => String(l)}
                  />
                  {COST_CATEGORY_ORDER.filter((c) => trendData.some((d) => (d as any)[c.key] > 0)).map((c) => (
                    <Bar
                      key={c.key}
                      dataKey={c.key}
                      stackId="costs"
                      fill={COST_CATEGORY_COLOR[c.key] || COST_CATEGORY_COLOR.other}
                      radius={[0, 0, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* Legend */}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[10px]">
              {COST_CATEGORY_ORDER.filter((c) => trendData.some((d) => (d as any)[c.key] > 0)).map((c) => (
                <span key={c.key} className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COST_CATEGORY_COLOR[c.key] }} />
                  <span className="text-muted-foreground">{c.label}</span>
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ---- Cost by Service ---- */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-display text-base">
            <Server className="h-4 w-4 text-primary" /> Cost by Service / Provider
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {serviceRows.length === 0 ? (
            <EmptyState icon={Server} title="No provider costs" hint="Per-provider spend will appear here once cost records exist." />
          ) : (
            <div className="votewise-scroll overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
                  <tr className="text-left">
                    <th className="p-3 font-semibold">Provider</th>
                    <th className="p-3 text-right font-semibold">Amount (USD)</th>
                    <th className="hidden p-3 text-right font-semibold sm:table-cell">Share</th>
                    <th className="hidden p-3 font-semibold md:table-cell">Visual</th>
                  </tr>
                </thead>
                <tbody>
                  {serviceRows.map((s) => {
                    const share = summary && summary.totalUsd > 0 ? (s.amount / summary.totalUsd) * 100 : 0
                    return (
                      <tr key={s.service} className="border-t border-border hover:bg-muted/30">
                        <td className="p-3">
                          <code className="font-mono text-xs">{s.service}</code>
                        </td>
                        <td className="p-3 text-right font-mono tabular-nums">{formatUsd(s.amount)}</td>
                        <td className="hidden p-3 text-right font-mono text-xs text-muted-foreground sm:table-cell">
                          {share.toFixed(1)}%
                        </td>
                        <td className="hidden p-3 md:table-cell">
                          <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{ width: `${Math.max(2, share)}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ===========================================================================
// TAB 10 — Load Testing + DR Runbook
// ===========================================================================

function LoadTestingTab() {
  return (
    <div className="space-y-8">
      <LoadTestingSection />
      <DisasterRecoverySection />
    </div>
  )
}

function LoadTestingSection() {
  const [presets, setPresets] = useState<LoadTestPreset[]>([])
  const [history, setHistory] = useState<LoadTestHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [runningKey, setRunningKey] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, LoadTestResult>>({})
  const [selectedHistory, setSelectedHistory] = useState<LoadTestHistoryItem | null>(null)

  const load = useCallback(async () => {
    try {
      setError(null)
      const res = await api.pihedLoadTests() as { presets: LoadTestPreset[]; history: LoadTestHistoryItem[] }
      setPresets(res.presets || [])
      setHistory(res.history || [])
    } catch (e: any) {
      setError(e?.message || 'Failed to load load test data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleRun(preset: LoadTestPreset) {
    setRunningKey(preset.key)
    try {
      const res = await api.pihedRunLoadTest(preset.key) as { result: LoadTestResult; message: string }
      setResults((r) => ({ ...r, [preset.key]: res.result }))
      toast.success(`Load test complete: ${res.result.verdict}`, {
        description: `${preset.label} · ${res.result.errorRatePct}% errors · p95 ${res.result.p95LatencyMs}ms`,
      })
      await load()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to run load test')
    } finally {
      setRunningKey(null)
    }
  }

  if (loading) return <LoadingRow label="Loading load test data…" />
  if (error && presets.length === 0) {
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
      {/* ---- Section header ---- */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <Card className="votewise-card-glow">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
                <Gauge className="h-6 w-6" />
              </div>
              <div>
                <h2 className="font-display text-xl font-bold">Performance Testing</h2>
                <p className="max-w-2xl text-sm text-muted-foreground">
                  Before every major release, test at 10K / 50K / 100K / 500K / 1M concurrent voters.
                  Measure response time, error rate, resource usage.
                </p>
              </div>
            </div>
            <Button onClick={load} variant="outline" size="sm" className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* ---- Preset cards ---- */}
      <div>
        <h3 className="mb-3 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Test Presets
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {presets.map((p, i) => {
            const isRunning = runningKey === p.key
            const result = results[p.key]
            return (
              <motion.div
                key={p.key}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.04 }}
              >
                <Card className={cn(
                  'h-full transition-colors',
                  result?.verdict === 'PASS' && 'border-emerald-300/50 dark:border-emerald-800/50',
                  result?.verdict === 'DEGRADED' && 'border-amber-300/50 dark:border-amber-800/50',
                  result?.verdict === 'FAIL' && 'border-red-300/60 dark:border-red-900/60',
                )}>
                  <CardContent className="flex h-full flex-col p-4">
                    <div className="flex items-start justify-between">
                      <Badge className={cn('text-[10px]', LOAD_TEST_PRESET_BADGE[p.key] || LOAD_TEST_PRESET_BADGE['10k'])}>
                        {p.key.toUpperCase()}
                      </Badge>
                      {result && (
                        <Badge className={cn('text-[9px]', LOAD_TEST_VERDICT_BADGE[result.verdict])}>
                          {result.verdict}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-2 font-display text-2xl font-bold tabular-nums">
                      {p.concurrentVoters.toLocaleString()}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">concurrent voters</div>
                    <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Timer className="h-3 w-3" /> {p.durationMinutes}m
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" /> ramp {p.rampUpSeconds}s
                      </span>
                    </div>

                    {/* Inline result */}
                    {result && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        transition={{ duration: 0.3 }}
                        className="mt-3 space-y-1.5 border-t border-border/40 pt-3 text-[10px]"
                      >
                        <div className="grid grid-cols-2 gap-1.5">
                          <ResultStat label="Total reqs" value={formatNumber(result.totalRequests)} />
                          <ResultStat label="Errors" value={`${result.errorRatePct}%`} accent={result.errorRatePct > 1 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'} />
                          <ResultStat label="p50" value={`${result.p50LatencyMs}ms`} />
                          <ResultStat label="p95" value={`${result.p95LatencyMs}ms`} />
                          <ResultStat label="p99" value={`${result.p99LatencyMs}ms`} />
                          <ResultStat label="RPS" value={formatNumber(result.requestsPerSecond)} />
                          <ResultStat label="Peak mem" value={`${result.resourceUsage.peakMemoryMb}MB`} />
                          <ResultStat label="Avg CPU" value={`${result.resourceUsage.avgCpuPct}%`} />
                        </div>
                        <p className="text-[10px] leading-snug text-muted-foreground">{result.notes}</p>
                      </motion.div>
                    )}

                    <div className="mt-auto pt-3">
                      <Button
                        onClick={() => handleRun(p)}
                        disabled={isRunning}
                        size="sm"
                        className="w-full gap-1.5"
                      >
                        {isRunning
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Play className="h-3.5 w-3.5" />}
                        {isRunning ? 'Running…' : result ? 'Re-run Test' : 'Run Test'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* ---- History table ---- */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-display text-base">
            <History className="h-4 w-4 text-primary" /> Load Test History
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {history.length === 0 ? (
            <EmptyState icon={History} title="No runs yet" hint="Run a preset above to see the history." />
          ) : (
            <div className="votewise-scroll overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
                  <tr className="text-left">
                    <th className="p-3 font-semibold">Date</th>
                    <th className="p-3 font-semibold">Preset</th>
                    <th className="p-3 font-semibold">Verdict</th>
                    <th className="hidden p-3 text-right font-semibold sm:table-cell">Error Rate</th>
                    <th className="hidden p-3 text-right font-semibold md:table-cell">p95</th>
                    <th className="hidden p-3 text-right font-semibold lg:table-cell">RPS</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr
                      key={h.id}
                      onClick={() => setSelectedHistory(selectedHistory?.id === h.id ? null : h)}
                      className={cn(
                        'cursor-pointer border-t border-border hover:bg-muted/30',
                        selectedHistory?.id === h.id && 'bg-primary/5',
                      )}
                    >
                      <td className="whitespace-nowrap p-3 text-xs text-muted-foreground">
                        {timeAgo(h.startedAt)}
                      </td>
                      <td className="p-3">
                        <Badge className={cn('text-[9px]', LOAD_TEST_PRESET_BADGE[h.preset] || LOAD_TEST_PRESET_BADGE['10k'])}>
                          {h.preset.toUpperCase()}
                        </Badge>
                        <div className="mt-0.5 text-[10px] text-muted-foreground">
                          {h.config.concurrentVoters.toLocaleString()} voters
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge className={cn('text-[9px]', LOAD_TEST_VERDICT_BADGE[h.verdict])}>
                          {h.verdict}
                        </Badge>
                      </td>
                      <td className="hidden p-3 text-right font-mono text-xs sm:table-cell">
                        <span className={h.errorRatePct > 1 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}>
                          {h.errorRatePct.toFixed(2)}%
                        </span>
                      </td>
                      <td className="hidden p-3 text-right font-mono text-xs md:table-cell">{h.p95LatencyMs}ms</td>
                      <td className="hidden p-3 text-right font-mono text-xs lg:table-cell">{formatNumber(h.requestsPerSecond)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---- Selected history detail panel ---- */}
      <AnimatePresence>
        {selectedHistory && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            <Card className="votewise-card-glow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 font-display text-base">
                    <FileText className="h-4 w-4 text-primary" /> Run Detail · {selectedHistory.preset.toUpperCase()}
                  </CardTitle>
                  <Badge className={cn('text-[10px]', LOAD_TEST_VERDICT_BADGE[selectedHistory.verdict])}>
                    {selectedHistory.verdict}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  <StatCell label="Total Requests" value={formatNumber(selectedHistory.totalRequests)} icon={Hash} />
                  <StatCell label="Successful" value={formatNumber(selectedHistory.successfulRequests)} icon={CheckCircle2} />
                  <StatCell label="Failed" value={formatNumber(selectedHistory.failedRequests)} icon={XCircle} />
                  <StatCell label="Error Rate" value={`${selectedHistory.errorRatePct}%`} icon={AlertCircle} />
                  <StatCell label="Avg Latency" value={`${selectedHistory.avgLatencyMs}ms`} icon={Clock} />
                  <StatCell label="p50" value={`${selectedHistory.p50LatencyMs}ms`} icon={TrendingUp} />
                  <StatCell label="p95" value={`${selectedHistory.p95LatencyMs}ms`} icon={TrendingUp} />
                  <StatCell label="p99" value={`${selectedHistory.p99LatencyMs}ms`} icon={TrendingUp} />
                  <StatCell label="Max Latency" value={`${selectedHistory.maxLatencyMs}ms`} icon={Clock} />
                  <StatCell label="RPS" value={formatNumber(selectedHistory.requestsPerSecond)} icon={Activity} />
                  <StatCell label="Peak Memory" value={`${selectedHistory.resourceUsage.peakMemoryMb}MB`} icon={MemoryStick} />
                  <StatCell label="Avg CPU" value={`${selectedHistory.resourceUsage.avgCpuPct}%`} icon={Cpu} />
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                  <StatCell label="Voters" value={selectedHistory.config.concurrentVoters.toLocaleString()} icon={Hash} />
                  <StatCell label="Duration" value={`${selectedHistory.config.durationMinutes}m`} icon={Timer} />
                  <StatCell label="Ramp-up" value={`${selectedHistory.config.rampUpSeconds}s`} icon={TrendingUp} />
                  <StatCell label="Endpoint" value={selectedHistory.config.targetEndpoint} icon={Activity} />
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/40 p-3 text-xs">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Notes</p>
                  <p className="mt-1">{selectedHistory.notes}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                  <span>Started: <span className="font-mono text-foreground">{formatDateTime(selectedHistory.startedAt)}</span></span>
                  <span>·</span>
                  <span>Completed: <span className="font-mono text-foreground">{formatDateTime(selectedHistory.completedAt)}</span></span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ResultStat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded border border-border/40 bg-muted/30 px-1.5 py-1">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn('font-mono text-[11px] font-semibold tabular-nums', accent)}>{value}</div>
    </div>
  )
}

// --- DR Runbook section ----------------------------------------------------

const DR_RUNBOOKS: Array<{
  id: string
  title: string
  severity: 'critical' | 'warning' | 'info'
  steps: string[]
}> = [
  {
    id: 'db-corruption',
    title: 'Database corruption detected',
    severity: 'critical',
    steps: [
      'Trigger `ElectionLock` to freeze all active elections (prevents new votes).',
      'Snapshot the corrupted instance (for forensics).',
      'Restore from the most recent hourly backup via PITR.',
      'Verify the restored instance with `scripts/verify-backup.sh`.',
      'Repoint the application to the restored instance.',
      'Release the `ElectionLock`.',
      'File an incident report.',
    ],
  },
  {
    id: 'region-failure',
    title: 'Region failure',
    severity: 'critical',
    steps: [
      'Trigger `ElectionLock` globally.',
      'Run `scripts/dr-failover.sh` — promotes the DR region.',
      'Verify `https://votewise.com.ng/api/pihed/health` returns `ready: true`.',
      'Release the `ElectionLock`.',
      'Once the primary region recovers, fail back with `scripts/dr-failback.sh`.',
    ],
  },
  {
    id: 'vote-loss-suspected',
    title: 'Vote loss suspected',
    severity: 'critical',
    steps: [
      'Trigger `ElectionLock`.',
      'Query `VoteRecord` count vs `CandidateTally` sum — they must match.',
      'If mismatch: restore from PITR to a scratch instance, diff the tables, identify the missing records.',
      'Re-apply missing records from the audit log (`AuditEvent` table).',
      'Release the `ElectionLock`.',
    ],
  },
]

const DR_BACKUP_SCHEDULE: Array<{ type: string; frequency: string; retention: string; storage: string; badge: string }> = [
  {
    type: 'Hourly',
    frequency: 'every hour at :05',
    retention: '24 hours',
    storage: 'S3 `backups` bucket (region A)',
    badge: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300',
  },
  {
    type: 'Daily',
    frequency: '02:00 daily',
    retention: '7 days',
    storage: 'S3 `backups` + cross-region DR',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  },
  {
    type: 'Weekly',
    frequency: 'Sun 03:00',
    retention: '4 weeks',
    storage: 'S3 `backups` + Glacier lifecycle',
    badge: 'bg-accent text-accent-foreground',
  },
  {
    type: 'Monthly',
    frequency: '1st 04:00',
    retention: '12 months',
    storage: 'S3 `backups` + Glacier Deep Archive',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  },
]

const DR_SCRIPTS: Array<{ path: string; description: string }> = [
  { path: 'scripts/dr-test.sh', description: 'Verify the latest backup is restorable' },
  { path: 'scripts/dr-failover.sh', description: 'Run a full failover drill — promotes the DR region' },
  { path: 'scripts/blue-green-deploy.sh', description: 'Blue-green deployment switcher with health gate' },
  { path: 'scripts/rollback.sh', description: 'Rollback the active deployment to the previous version' },
]

function DisasterRecoverySection() {
  return (
    <div className="space-y-6">
      {/* ---- Header ---- */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <Card className="votewise-card-glow">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <h2 className="font-display text-xl font-bold">Disaster Recovery Runbook</h2>
                <p className="max-w-2xl text-sm text-muted-foreground">
                  Documented recovery procedures. Tested monthly (restore drill), quarterly (failover drill), annually (cold-start).
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ---- RTO / RPO / Vote Loss stat badges ---- */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="votewise-card-glow border-emerald-300/40 dark:border-emerald-800/40">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">RTO</div>
              <div className="font-display text-lg font-bold text-emerald-700 dark:text-emerald-300">&lt; 30 min</div>
              <div className="text-[10px] text-muted-foreground">Recovery Time Objective</div>
            </div>
          </CardContent>
        </Card>
        <Card className="votewise-card-glow border-amber-300/40 dark:border-amber-800/40">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
              <Timer className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">RPO</div>
              <div className="font-display text-lg font-bold text-amber-700 dark:text-amber-300">&lt; 5 min</div>
              <div className="text-[10px] text-muted-foreground">PITR + WAL streaming</div>
            </div>
          </CardContent>
        </Card>
        <Card className="votewise-card-glow border-red-300/40 dark:border-red-900/40">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Vote Loss</div>
              <div className="font-display text-lg font-bold text-red-700 dark:text-red-300">0</div>
              <div className="text-[10px] text-muted-foreground">Transactional + receipt-anchored</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ---- Runbooks (accordion) ---- */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-display text-base">
            <FileText className="h-4 w-4 text-primary" /> Runbooks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible defaultValue="db-corruption" className="w-full">
            {DR_RUNBOOKS.map((rb) => (
              <AccordionItem key={rb.id} value={rb.id}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex flex-1 items-center gap-2 pr-2">
                    <Badge className={cn('text-[9px]', ALERT_SEVERITY_BADGE[rb.severity] || ALERT_SEVERITY_BADGE.critical)}>
                      {rb.severity}
                    </Badge>
                    <span className="text-left font-medium">{rb.title}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <ol className="ml-1 space-y-2">
                    {rb.steps.map((step, i) => (
                      <motion.li
                        key={i}
                        initial={{ opacity: 0, x: -4 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2, delay: i * 0.03 }}
                        className="flex items-start gap-2.5 text-sm"
                      >
                        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/10 font-mono text-[10px] font-bold text-primary">
                          {i + 1}
                        </span>
                        <span className="text-foreground">{step}</span>
                      </motion.li>
                    ))}
                  </ol>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      {/* ---- Backup schedule ---- */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-display text-base">
            <Database className="h-4 w-4 text-primary" /> Backup Schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="votewise-scroll overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
                <tr className="text-left">
                  <th className="p-3 font-semibold">Type</th>
                  <th className="p-3 font-semibold">Frequency</th>
                  <th className="hidden p-3 font-semibold sm:table-cell">Retention</th>
                  <th className="hidden p-3 font-semibold md:table-cell">Storage</th>
                </tr>
              </thead>
              <tbody>
                {DR_BACKUP_SCHEDULE.map((row) => (
                  <tr key={row.type} className="border-t border-border hover:bg-muted/30">
                    <td className="p-3">
                      <Badge className={cn('text-[9px]', row.badge)}>{row.type}</Badge>
                    </td>
                    <td className="p-3 font-mono text-xs">{row.frequency}</td>
                    <td className="hidden p-3 font-mono text-xs sm:table-cell">{row.retention}</td>
                    <td className="hidden p-3 text-xs text-muted-foreground md:table-cell">{row.storage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-border/40 p-3 text-[10px] text-muted-foreground">
            All backups are AES-256 encrypted at rest and TLS-encrypted in transit. The `backups` bucket
            replicates to <code className="font-mono">eu-central-1</code> (Frankfurt) for cross-region disaster recovery.
          </div>
        </CardContent>
      </Card>

      {/* ---- DR scripts ---- */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-display text-base">
            <Terminal className="h-4 w-4 text-primary" /> DR &amp; Deployment Scripts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {DR_SCRIPTS.map((s) => (
            <div
              key={s.path}
              className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/40 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <code className="font-mono text-xs font-semibold text-foreground">./{s.path}</code>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{s.description}</p>
              </div>
              <CopyButton text={`./${s.path}`} size="sm" />
            </div>
          ))}
          <div className="mt-3 rounded-lg border border-emerald-300/40 bg-emerald-50/60 p-3 text-xs text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-950/20 dark:text-emerald-200">
            <p className="flex items-center gap-1.5 font-semibold">
              <Power className="h-3.5 w-3.5" /> Recovery Test Schedule
            </p>
            <ul className="mt-1 space-y-0.5 text-[11px] opacity-90">
              <li>· <strong>Monthly</strong> — restore latest daily backup to scratch RDS, verify counts, tear down.</li>
              <li>· <strong>Quarterly</strong> — full failover drill (promote DR region, smoke tests, fail back).</li>
              <li>· <strong>Annually</strong> — full cold-start from backups only (validates Terraform + restore path end-to-end).</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ===========================================================================
// TAB 11 — Postmortems (Incident Lifecycle)
// Blameless incident reviews: detect → alert → respond → postmortem → improve.
// ===========================================================================

const PM_SEVERITY_BADGE: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300 ring-1 ring-red-400/40 dark:ring-red-700/40',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  info: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300',
}

const PM_STATUS_BADGE: Record<string, string> = {
  published: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 ring-1 ring-emerald-300/40 dark:ring-emerald-700/40',
  draft: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300',
  archived: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-400',
}

const PM_ACTION_STATUS_BADGE: Record<string, string> = {
  todo: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300',
  'in-progress': 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  done: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
}

interface Postmortem {
  id: string
  incidentId: string | null
  title: string
  severity: string
  status: string
  summary: string
  timeline: string
  rootCause: string
  impact: string
  whatWentWell: string
  whatWentWrong: string
  actionItems: string
  lessonsLearned: string
  authoredBy: string
  authoredByName: string | null
  reviewedBy: string | null
  reviewedAt: string | null
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

interface PostmortemDetail extends Postmortem {
  timeline: Array<{ time: string; event: string }>
  whatWentWell: string[]
  whatWentWrong: string[]
  actionItems: Array<{ item: string; owner?: string; due?: string; status: string }>
  lessonsLearned: string[]
}

interface PostmortemStats {
  total: number
  published: number
  drafts: number
  recent90d: number
  openActionItems: number
}

function PostmortemsTab() {
  const [postmortems, setPostmortems] = useState<Postmortem[]>([])
  const [stats, setStats] = useState<PostmortemStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const firstLoadRef = useRef(true)

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true)
    try {
      setError(null)
      const res = await api.pihedPostmortems() as { postmortems: Postmortem[]; stats: PostmortemStats }
      setPostmortems(res.postmortems || [])
      setStats(res.stats)
    } catch (e: any) {
      if (firstLoadRef.current) setError(e?.message || 'Failed to load postmortems')
    } finally {
      setLoading(false)
      setRefreshing(false)
      firstLoadRef.current = false
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(() => load(true), 60000)
    return () => clearInterval(id)
  }, [load])

  if (loading) return <LoadingRow label="Loading postmortems…" />
  if (error && !stats) {
    return (
      <Card>
        <CardContent>
          <ErrorState message={error} onRetry={() => load()} />
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
                <FileText className="h-6 w-6" />
              </div>
              <div>
                <h2 className="font-display text-xl font-bold">Postmortems</h2>
                <p className="max-w-2xl text-sm text-muted-foreground">
                  Blameless incident reviews. Learn from every failure. Complete the incident lifecycle:
                  detect → alert → respond → postmortem → improve.
                </p>
              </div>
            </div>
            <div className="flex flex-col items-start gap-1.5 sm:items-end">
              <Button onClick={() => setCreateOpen(true)} size="sm" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Create Postmortem
              </Button>
              <Button onClick={() => load()} variant="outline" size="sm" disabled={refreshing} className="gap-1.5">
                {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Refresh
              </Button>
              <Badge variant="secondary" className="gap-1.5 text-xs text-muted-foreground">
                <span className="votewise-live-dot inline-block h-2 w-2 rounded-full bg-emerald-500" />
                Auto · 60s
              </Badge>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ---- Stat cards ---- */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="votewise-card-glow">
            <CardContent className="p-4">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300">
                <FileText className="h-5 w-5" />
              </div>
              <div className="mt-3 font-display text-xl font-bold tabular-nums">{formatNumber(stats.total)}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</div>
            </CardContent>
          </Card>
          <Card className="votewise-card-glow border-emerald-300/40 dark:border-emerald-800/40">
            <CardContent className="p-4">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="mt-3 font-display text-xl font-bold tabular-nums">{formatNumber(stats.published)}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Published</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300">
                <FileText className="h-5 w-5" />
              </div>
              <div className="mt-3 font-display text-xl font-bold tabular-nums">{formatNumber(stats.drafts)}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Drafts</div>
            </CardContent>
          </Card>
          <Card className={cn(stats.openActionItems > 0 && 'votewise-card-glow ring-1 ring-red-400/40 dark:ring-red-700/40')}>
            <CardContent className="p-4">
              <div className={cn(
                'grid h-9 w-9 place-items-center rounded-lg',
                stats.openActionItems > 0
                  ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300'
                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
              )}>
                {stats.openActionItems > 0 ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
              </div>
              <div className="mt-3 flex items-center gap-1.5">
                <span className="font-display text-xl font-bold tabular-nums">{formatNumber(stats.openActionItems)}</span>
                {stats.openActionItems > 0 && (
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                  </span>
                )}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Open Action Items</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ---- Postmortem list ---- */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-display text-base">
            <ScrollText className="h-4 w-4 text-primary" /> Incident Postmortems
            <Badge variant="outline" className="text-[10px]">{postmortems.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {postmortems.length === 0 ? (
            <EmptyState icon={FileText} title="No postmortems yet" hint="Create your first blameless incident review to complete the incident lifecycle." />
          ) : (
            <div className="votewise-scroll max-h-[600px] space-y-3 overflow-y-auto p-4">
              {postmortems.map((pm, i) => (
                <motion.div
                  key={pm.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.4) }}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedId(pm.id)}
                    className="w-full rounded-lg border border-border/60 bg-card p-4 text-left transition-all hover:border-primary/40 hover:bg-muted/30 hover:shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge className={cn('text-[9px]', PM_SEVERITY_BADGE[pm.severity] || PM_SEVERITY_BADGE.info)}>
                            {pm.severity}
                          </Badge>
                          <Badge className={cn('text-[9px]', PM_STATUS_BADGE[pm.status] || PM_STATUS_BADGE.draft)}>
                            {pm.status}
                          </Badge>
                        </div>
                        <h4 className="mt-1.5 font-display text-sm font-semibold leading-tight">{pm.title}</h4>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{pm.summary}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1 text-[10px] text-muted-foreground">
                        <span className="max-w-[12rem] truncate">{pm.authoredByName || '—'}</span>
                        <span>{timeAgo(pm.createdAt)}</span>
                      </div>
                    </div>
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---- Detail dialog ---- */}
      {selectedId && (
        <PostmortemDetailDialog
          id={selectedId}
          onClose={() => setSelectedId(null)}
          onChanged={() => load(true)}
        />
      )}

      {/* ---- Create dialog ---- */}
      <PostmortemCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => load(true)}
      />
    </div>
  )
}

function PostmortemDetailDialog({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const [pm, setPm] = useState<PostmortemDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [togglingItem, setTogglingItem] = useState<number | null>(null)

  const load = useCallback(async () => {
    try {
      setError(null)
      const res = await api.pihedPostmortem(id) as { postmortem: PostmortemDetail }
      setPm(res.postmortem)
    } catch (e: any) {
      setError(e?.message || 'Failed to load postmortem')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  async function handlePublish() {
    setPublishing(true)
    try {
      await api.pihedUpdatePostmortem(id, { status: 'published' })
      toast.success('Postmortem published', { description: 'It is now visible across the organization.' })
      await load()
      onChanged()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to publish')
    } finally {
      setPublishing(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await api.pihedDeletePostmortem(id)
      toast.success('Postmortem deleted')
      onChanged()
      onClose()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete')
    } finally {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  async function handleToggleActionItem(idx: number) {
    if (!pm) return
    const items = [...pm.actionItems]
    const item = items[idx]
    if (!item) return
    const done = item.status === 'done' || item.status === 'completed'
    const newStatus = done ? 'todo' : 'done'
    items[idx] = { ...item, status: newStatus }
    setPm({ ...pm, actionItems: items })
    setTogglingItem(idx)
    try {
      await api.pihedUpdatePostmortem(id, { actionItems: items })
      toast.success(newStatus === 'done' ? 'Action item marked done' : 'Action item reopened')
      onChanged()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update action item')
      await load()
    } finally {
      setTogglingItem(null)
    }
  }

  return (
    <>
      <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden p-0">
          <DialogHeader className="border-b border-border/60 p-6 pb-4">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading postmortem…
              </div>
            ) : error ? (
              <ErrorState message={error} onRetry={load} />
            ) : pm ? (
              <>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge className={cn('text-[9px]', PM_SEVERITY_BADGE[pm.severity] || PM_SEVERITY_BADGE.info)}>
                    {pm.severity}
                  </Badge>
                  <Badge className={cn('text-[9px]', PM_STATUS_BADGE[pm.status] || PM_STATUS_BADGE.draft)}>
                    {pm.status}
                  </Badge>
                  {pm.incidentId && (
                    <Badge variant="outline" className="text-[9px]">incident: {pm.incidentId.slice(0, 8)}</Badge>
                  )}
                </div>
                <DialogTitle className="mt-2 font-display text-xl">{pm.title}</DialogTitle>
                <DialogDescription className="sr-only">Postmortem detail</DialogDescription>
              </>
            ) : null}
          </DialogHeader>

          {pm && (
            <div className="votewise-scroll max-h-[calc(90vh-220px)] space-y-6 overflow-y-auto p-6">
              {/* Summary */}
              <section>
                <SectionLabel icon={FileText} label="Summary" />
                <p className="mt-2 text-sm leading-relaxed text-foreground">{pm.summary}</p>
              </section>

              {/* Timeline */}
              {pm.timeline.length > 0 && (
                <section>
                  <SectionLabel icon={Clock} label="Timeline" />
                  <div className="mt-3 space-y-3 border-l-2 border-border pl-4">
                    {pm.timeline.map((t, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -4 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2, delay: i * 0.03 }}
                        className="relative"
                      >
                        <span className="absolute -left-[21px] top-1 grid h-3 w-3 place-items-center rounded-full border-2 border-background bg-primary" />
                        <div className="flex flex-wrap gap-2">
                          <span className="shrink-0 font-mono text-xs font-semibold text-primary">{t.time}</span>
                          <span className="text-sm text-foreground">{t.event}</span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </section>
              )}

              {/* Root Cause + Impact (2-col) */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <section className="rounded-lg border border-red-300/30 bg-red-50/40 p-4 dark:border-red-900/30 dark:bg-red-950/10">
                  <SectionLabel icon={AlertCircle} label="Root Cause" accent="text-red-600 dark:text-red-400" />
                  <p className="mt-2 text-sm leading-relaxed">{pm.rootCause}</p>
                </section>
                <section className="rounded-lg border border-amber-300/30 bg-amber-50/40 p-4 dark:border-amber-900/30 dark:bg-amber-950/10">
                  <SectionLabel icon={AlertTriangle} label="Impact" accent="text-amber-600 dark:text-amber-400" />
                  <p className="mt-2 text-sm leading-relaxed">{pm.impact}</p>
                </section>
              </div>

              {/* What Went Well / Wrong (2-col) */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <section>
                  <SectionLabel icon={CheckCircle2} label="What Went Well" accent="text-emerald-600 dark:text-emerald-400" />
                  <ul className="mt-2 space-y-1.5">
                    {pm.whatWentWell.length === 0 ? (
                      <li className="text-xs text-muted-foreground">—</li>
                    ) : pm.whatWentWell.map((w, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span>{w}</span>
                      </li>
                    ))}
                  </ul>
                </section>
                <section>
                  <SectionLabel icon={XCircle} label="What Went Wrong" accent="text-red-600 dark:text-red-400" />
                  <ul className="mt-2 space-y-1.5">
                    {pm.whatWentWrong.length === 0 ? (
                      <li className="text-xs text-muted-foreground">—</li>
                    ) : pm.whatWentWrong.map((w, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                        <span>{w}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>

              {/* Action Items */}
              <section>
                <SectionLabel icon={ListChecks} label={`Action Items (${pm.actionItems.length})`} />
                <div className="votewise-scroll mt-2 overflow-x-auto rounded-lg border border-border/60">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/60">
                      <tr className="text-left">
                        <th className="w-10 p-2"></th>
                        <th className="p-2 font-semibold">Item</th>
                        <th className="hidden p-2 font-semibold sm:table-cell">Owner</th>
                        <th className="hidden p-2 font-semibold md:table-cell">Due</th>
                        <th className="p-2 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pm.actionItems.length === 0 ? (
                        <tr><td colSpan={5} className="p-4 text-center text-xs text-muted-foreground">No action items yet</td></tr>
                      ) : pm.actionItems.map((a, i) => {
                        const done = a.status === 'done' || a.status === 'completed'
                        return (
                          <tr key={i} className="border-t border-border/60">
                            <td className="p-2">
                              <Checkbox
                                checked={done}
                                disabled={togglingItem === i}
                                onCheckedChange={() => handleToggleActionItem(i)}
                              />
                            </td>
                            <td className={cn('p-2', done && 'text-muted-foreground line-through')}>{a.item}</td>
                            <td className="hidden p-2 text-xs text-muted-foreground sm:table-cell">{a.owner || '—'}</td>
                            <td className="hidden p-2 text-xs text-muted-foreground md:table-cell">{a.due || '—'}</td>
                            <td className="p-2">
                              <Badge className={cn('text-[9px]', PM_ACTION_STATUS_BADGE[a.status] || PM_ACTION_STATUS_BADGE.todo)}>
                                {a.status}
                              </Badge>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Lessons Learned */}
              {pm.lessonsLearned.length > 0 && (
                <section>
                  <SectionLabel icon={Lightbulb} label="Lessons Learned" accent="text-amber-600 dark:text-amber-400" />
                  <ul className="mt-2 space-y-1.5">
                    {pm.lessonsLearned.map((l, i) => (
                      <li key={i} className="flex items-start gap-2 rounded-md bg-amber-50/60 p-2 text-sm dark:bg-amber-950/10">
                        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                        <span>{l}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Footer */}
              <section className="border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <span>Authored by: <span className="font-medium text-foreground">{pm.authoredByName || '—'}</span></span>
                  <span>Reviewed by: <span className="font-medium text-foreground">{pm.reviewedBy || '—'}</span></span>
                  <span>Published: <span className="font-medium text-foreground">{pm.publishedAt ? formatDateTime(pm.publishedAt) : '—'}</span></span>
                </div>
              </section>
            </div>
          )}

          {pm && (
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/60 p-4">
              {pm.status === 'draft' && (
                <Button onClick={handlePublish} disabled={publishing} className="gap-1.5">
                  {publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  Publish
                </Button>
              )}
              <Button onClick={() => setConfirmDelete(true)} variant="destructive" size="sm" className="gap-1.5">
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this postmortem?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the postmortem and all its content. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
            >
              {deleting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function PostmortemCreateDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    title: '',
    severity: 'warning',
    summary: '',
    rootCause: '',
    impact: '',
  })
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!form.title.trim() || !form.summary.trim() || !form.rootCause.trim()) {
      toast.error('Title, summary, and root cause are required')
      return
    }
    setBusy(true)
    try {
      await api.pihedCreatePostmortem({
        title: form.title.trim(),
        severity: form.severity,
        summary: form.summary.trim(),
        rootCause: form.rootCause.trim(),
        impact: form.impact.trim() || 'Not yet documented.',
      })
      toast.success('Postmortem created', { description: 'You can now add timeline, action items, and lessons via the detail view.' })
      setForm({ title: '', severity: 'warning', summary: '', rootCause: '', impact: '' })
      onOpenChange(false)
      onCreated()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to create postmortem')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border/60 p-6 pb-4">
          <DialogTitle className="font-display text-lg">Create Postmortem</DialogTitle>
          <DialogDescription>
            Start a blameless review. You can fill in the timeline, action items, and lessons learned after creation.
          </DialogDescription>
        </DialogHeader>
        <div className="votewise-scroll max-h-[calc(90vh-220px)] space-y-4 overflow-y-auto p-6">
          <div className="space-y-1.5">
            <Label>Title *</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. API latency spike during SUG election peak"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Severity *</Label>
            <Select value={form.severity} onValueChange={(v) => setForm((f) => ({ ...f, severity: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="critical">Critical — major outage / data loss</SelectItem>
                <SelectItem value="warning">Warning — degraded performance</SelectItem>
                <SelectItem value="info">Info — minor / near-miss</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Summary *</Label>
            <Textarea
              value={form.summary}
              onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
              rows={3}
              placeholder="One-paragraph summary of what happened, the impact, and the resolution."
            />
          </div>
          <div className="space-y-1.5">
            <Label>Root Cause *</Label>
            <Textarea
              value={form.rootCause}
              onChange={(e) => setForm((f) => ({ ...f, rootCause: e.target.value }))}
              rows={3}
              placeholder="The underlying technical or process cause. Blameless — focus on systems, not people."
            />
          </div>
          <div className="space-y-1.5">
            <Label>Impact</Label>
            <Textarea
              value={form.impact}
              onChange={(e) => setForm((f) => ({ ...f, impact: e.target.value }))}
              rows={2}
              placeholder="User-visible impact, duration, vote loss (should be 0), etc."
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border/60 p-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy} className="gap-1.5">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Create Postmortem
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function SectionLabel({ icon: Icon, label, accent }: { icon: any; label: string; accent?: string }) {
  return (
    <div className={cn('flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground', accent)}>
      <Icon className="h-3.5 w-3.5" /> {label}
    </div>
  )
}

// ===========================================================================
// TAB 12 — Scheduled Maintenance (Maintenance Windows)
// Plan future maintenance windows, notify affected orgs, auto-activate.
// ===========================================================================

const MAINT_LEVEL_BADGE: Record<string, string> = {
  PLATFORM: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300 ring-1 ring-red-400/40 dark:ring-red-700/40',
  ORGANIZATION: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  MODULE: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300',
}

const MAINT_STATUS_BADGE: Record<string, string> = {
  SCHEDULED: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300',
  IN_PROGRESS: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 ring-1 ring-amber-400/40 dark:ring-amber-700/40',
  COMPLETED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  CANCELLED: 'bg-zinc-100 text-zinc-500 line-through dark:bg-zinc-500/15 dark:text-zinc-400',
}

interface ScheduledMaintenance {
  id: string
  title: string
  description: string
  level: string
  organizationId: string | null
  module: string | null
  scheduledStart: string
  scheduledEnd: string
  status: string
  notifiedOrgs: boolean
  createdBy: string
  createdByName: string | null
  createdAt: string
  updatedAt: string
}

interface MaintenanceStats {
  total: number
  scheduled: number
  inProgress: number
  completed: number
  cancelled: number
  upcoming: number
}

function MaintenanceTab() {
  const [windows, setWindows] = useState<ScheduledMaintenance[]>([])
  const [stats, setStats] = useState<MaintenanceStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [cancelTarget, setCancelTarget] = useState<ScheduledMaintenance | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const firstLoadRef = useRef(true)

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true)
    try {
      setError(null)
      const res = await api.pihedMaintenanceSchedule() as { windows: ScheduledMaintenance[]; stats: MaintenanceStats }
      setWindows(res.windows || [])
      setStats(res.stats)
    } catch (e: any) {
      if (firstLoadRef.current) setError(e?.message || 'Failed to load maintenance schedule')
    } finally {
      setLoading(false)
      setRefreshing(false)
      firstLoadRef.current = false
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(() => load(true), 30000)
    return () => clearInterval(id)
  }, [load])

  async function handleCancel() {
    if (!cancelTarget) return
    setCancelling(true)
    try {
      await api.pihedCancelMaintenance(cancelTarget.id)
      toast.success('Maintenance window cancelled')
      setCancelTarget(null)
      await load(true)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to cancel maintenance')
    } finally {
      setCancelling(false)
    }
  }

  if (loading) return <LoadingRow label="Loading maintenance schedule…" />
  if (error && !stats) {
    return (
      <Card>
        <CardContent>
          <ErrorState message={error} onRetry={() => load()} />
        </CardContent>
      </Card>
    )
  }

  const upcoming = windows.filter((w) => w.status === 'SCHEDULED')
  const active = windows.filter((w) => w.status === 'IN_PROGRESS')
  const past = windows.filter((w) => w.status === 'COMPLETED' || w.status === 'CANCELLED')

  return (
    <div className="space-y-6">
      {/* ---- Header ---- */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <Card className="votewise-card-glow">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
                <Wrench className="h-6 w-6" />
              </div>
              <div>
                <h2 className="font-display text-xl font-bold">Scheduled Maintenance</h2>
                <p className="max-w-2xl text-sm text-muted-foreground">
                  Plan future maintenance windows, notify affected organizations, and auto-activate when the window starts.
                </p>
              </div>
            </div>
            <div className="flex flex-col items-start gap-1.5 sm:items-end">
              <Button onClick={() => setCreateOpen(true)} size="sm" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Schedule Maintenance
              </Button>
              <Button onClick={() => load()} variant="outline" size="sm" disabled={refreshing} className="gap-1.5">
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

      {/* ---- Stat cards ---- */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Card className="votewise-card-glow">
            <CardContent className="p-4">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300">
                <Wrench className="h-5 w-5" />
              </div>
              <div className="mt-3 font-display text-xl font-bold tabular-nums">{formatNumber(stats.total)}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300">
                <CalendarClock className="h-5 w-5" />
              </div>
              <div className="mt-3 font-display text-xl font-bold tabular-nums">{formatNumber(stats.scheduled)}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Scheduled</div>
            </CardContent>
          </Card>
          <Card className={cn(stats.inProgress > 0 && 'votewise-card-glow ring-1 ring-amber-400/40 dark:ring-amber-700/40')}>
            <CardContent className="p-4">
              <div className={cn(
                'grid h-9 w-9 place-items-center rounded-lg',
                stats.inProgress > 0
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                  : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300',
              )}>
                <Activity className="h-5 w-5" />
              </div>
              <div className="mt-3 flex items-center gap-1.5">
                <span className="font-display text-xl font-bold tabular-nums">{formatNumber(stats.inProgress)}</span>
                {stats.inProgress > 0 && (
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                  </span>
                )}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">In Progress</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="mt-3 font-display text-xl font-bold tabular-nums">{formatNumber(stats.completed)}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Completed</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-zinc-100 text-zinc-500 dark:bg-zinc-500/15 dark:text-zinc-400">
                <Ban className="h-5 w-5" />
              </div>
              <div className="mt-3 font-display text-xl font-bold tabular-nums">{formatNumber(stats.cancelled)}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Cancelled</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ---- Maintenance groups ---- */}
      {windows.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState icon={Wrench} title="No maintenance scheduled" hint="Plan your next maintenance window to notify affected organizations in advance." />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <MaintenanceGroup title="Active" icon={Activity} accent="text-amber-600 dark:text-amber-400" items={active} onCancel={setCancelTarget} />
          <MaintenanceGroup title="Upcoming" icon={CalendarClock} accent="text-zinc-600 dark:text-zinc-300" items={upcoming} onCancel={setCancelTarget} />
          <MaintenanceGroup title="Past" icon={History} accent="text-muted-foreground" items={past} onCancel={setCancelTarget} />
        </div>
      )}

      {/* ---- Create dialog ---- */}
      <MaintenanceCreateDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={() => load(true)} />

      {/* ---- Cancel confirm ---- */}
      <AlertDialog open={!!cancelTarget} onOpenChange={(o) => { if (!o) setCancelTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this maintenance window?</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelTarget?.title} will be marked as cancelled. Affected organizations will no longer be notified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Keep</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={cancelling}
              className="bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
            >
              {cancelling && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Cancel Window
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function MaintenanceGroup({ title, icon: Icon, accent, items, onCancel }: {
  title: string
  icon: any
  accent: string
  items: ScheduledMaintenance[]
  onCancel: (w: ScheduledMaintenance) => void
}) {
  if (items.length === 0) return null
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className={cn('flex items-center gap-2 font-display text-base', accent)}>
          <Icon className="h-4 w-4" /> {title}
          <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="votewise-scroll max-h-[600px] space-y-3 overflow-y-auto p-4">
          {items.map((w, i) => (
            <MaintenanceCard key={w.id} w={w} index={i} onCancel={() => onCancel(w)} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function MaintenanceCard({ w, index, onCancel }: { w: ScheduledMaintenance; index: number; onCancel: () => void }) {
  const countdown = useMemo(() => maintenanceCountdown(w), [w])
  const cancelled = w.status === 'CANCELLED'
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.4) }}
      className={cn(
        'rounded-lg border border-border/60 bg-card p-4',
        cancelled && 'opacity-60',
        w.status === 'IN_PROGRESS' && 'border-amber-300/60 dark:border-amber-800/60',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge className={cn('text-[9px]', MAINT_LEVEL_BADGE[w.level] || MAINT_LEVEL_BADGE.MODULE)}>
              {w.level}
            </Badge>
            <Badge className={cn('text-[9px]', MAINT_STATUS_BADGE[w.status] || MAINT_STATUS_BADGE.SCHEDULED)}>
              {w.status.replace('_', ' ')}
            </Badge>
            {w.status === 'IN_PROGRESS' && (
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
              </span>
            )}
          </div>
          <h4 className={cn('mt-1.5 font-display text-sm font-semibold', cancelled && 'line-through')}>{w.title}</h4>
          <p className={cn('mt-1 line-clamp-2 text-xs text-muted-foreground', cancelled && 'line-through')}>{w.description}</p>
        </div>
        {w.status === 'SCHEDULED' && (
          <Button onClick={onCancel} variant="outline" size="sm" className="shrink-0 gap-1.5">
            <Ban className="h-3.5 w-3.5" /> Cancel
          </Button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/40 pt-2 text-[11px]">
        <span className="inline-flex items-center gap-1 font-mono">
          <CalendarClock className="h-3 w-3 text-muted-foreground" />
          {formatDateTime(w.scheduledStart)} → {formatDateTime(w.scheduledEnd)}
          <span className="ml-1 text-muted-foreground">({maintenanceDuration(w)})</span>
        </span>
        <Badge variant="outline" className={cn('text-[9px]', countdown.accent)}>{countdown.label}</Badge>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-[10px] text-muted-foreground">
        {w.module && <span>module: <span className="font-mono text-foreground">{w.module}</span></span>}
        {w.organizationId && <span>org: <span className="font-mono text-foreground">{w.organizationId.slice(0, 8)}</span></span>}
        <span>by {w.createdByName || '—'}</span>
        <span>· {timeAgo(w.createdAt)}</span>
      </div>
    </motion.div>
  )
}

function maintenanceDuration(w: ScheduledMaintenance): string {
  const ms = new Date(w.scheduledEnd).getTime() - new Date(w.scheduledStart).getTime()
  if (!Number.isFinite(ms) || ms <= 0) return '—'
  const mins = Math.round(ms / 60000)
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

function maintenanceCountdown(w: ScheduledMaintenance): { label: string; accent: string } {
  const now = Date.now()
  const start = new Date(w.scheduledStart).getTime()
  const end = new Date(w.scheduledEnd).getTime()
  if (w.status === 'CANCELLED') return { label: 'cancelled', accent: 'text-zinc-500' }
  if (w.status === 'COMPLETED' || now > end) {
    const ago = now - end
    if (ago < 0) return { label: 'completed', accent: 'text-emerald-600 dark:text-emerald-400' }
    return { label: `completed ${humanizeDuration(ago)} ago`, accent: 'text-emerald-600 dark:text-emerald-400' }
  }
  if (w.status === 'IN_PROGRESS' || (now >= start && now < end)) {
    return { label: 'active now', accent: 'text-amber-600 dark:text-amber-400' }
  }
  const until = start - now
  return { label: `in ${humanizeDuration(until)}`, accent: 'text-zinc-600 dark:text-zinc-300' }
}

function humanizeDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return 'now'
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return `${sec}s`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day}d`
  const mo = Math.floor(day / 30)
  return `${mo}mo`
}

function MaintenanceCreateDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    level: 'PLATFORM',
    organizationId: '',
    module: '',
    scheduledStart: '',
    scheduledEnd: '',
  })
  const [orgs, setOrgs] = useState<Array<{ id: string; name: string }>>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      api.listOrganizations()
        .then((d: any) => setOrgs(d.organizations || []))
        .catch(() => {})
    }
  }, [open])

  function defaultWindow() {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    d.setHours(2, 0, 0, 0)
    const start = new Date(d)
    const end = new Date(d.getTime() + 2 * 60 * 60 * 1000)
    const toLocal = (dt: Date) => {
      const pad = (n: number) => String(n).padStart(2, '0')
      return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`
    }
    setForm((f) => ({ ...f, scheduledStart: toLocal(start), scheduledEnd: toLocal(end) }))
  }

  async function submit() {
    if (!form.title.trim() || !form.description.trim() || !form.scheduledStart || !form.scheduledEnd) {
      toast.error('Title, description, start, and end are required')
      return
    }
    const start = new Date(form.scheduledStart)
    const end = new Date(form.scheduledEnd)
    if (end <= start) {
      toast.error('End time must be after start time')
      return
    }
    setBusy(true)
    try {
      const payload: any = {
        title: form.title.trim(),
        description: form.description.trim(),
        level: form.level,
        scheduledStart: start.toISOString(),
        scheduledEnd: end.toISOString(),
      }
      if (form.level === 'ORGANIZATION' && form.organizationId) payload.organizationId = form.organizationId
      if (form.level === 'MODULE' && form.module.trim()) payload.module = form.module.trim()
      await api.pihedScheduleMaintenance(payload)
      toast.success('Maintenance window scheduled')
      setForm({ title: '', description: '', level: 'PLATFORM', organizationId: '', module: '', scheduledStart: '', scheduledEnd: '' })
      onOpenChange(false)
      onCreated()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to schedule maintenance')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border/60 p-6 pb-4">
          <DialogTitle className="font-display text-lg">Schedule Maintenance Window</DialogTitle>
          <DialogDescription>
            Plan a future maintenance window. Affected organizations will be notified, and the window will auto-activate when it starts.
          </DialogDescription>
        </DialogHeader>
        <div className="votewise-scroll max-h-[calc(90vh-220px)] space-y-4 overflow-y-auto p-6">
          <div className="space-y-1.5">
            <Label>Title *</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Database maintenance — index rebuild"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Description *</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              placeholder="What will be done? Will there be downtime? Who is affected?"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Level *</Label>
              <Select value={form.level} onValueChange={(v) => setForm((f) => ({ ...f, level: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PLATFORM">PLATFORM — entire platform</SelectItem>
                  <SelectItem value="ORGANIZATION">ORGANIZATION — single org</SelectItem>
                  <SelectItem value="MODULE">MODULE — single module</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.level === 'ORGANIZATION' && (
              <div className="space-y-1.5">
                <Label>Organization *</Label>
                <Select value={form.organizationId} onValueChange={(v) => setForm((f) => ({ ...f, organizationId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select organization…" /></SelectTrigger>
                  <SelectContent>
                    {orgs.length === 0 ? (
                      <SelectItem value="__none__" disabled>No active organizations found</SelectItem>
                    ) : orgs.map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {form.level === 'MODULE' && (
              <div className="space-y-1.5">
                <Label>Module name *</Label>
                <Input
                  value={form.module}
                  onChange={(e) => setForm((f) => ({ ...f, module: e.target.value }))}
                  placeholder="e.g. results-service"
                />
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Scheduled start *</Label>
              <Input
                type="datetime-local"
                value={form.scheduledStart}
                onChange={(e) => setForm((f) => ({ ...f, scheduledStart: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Scheduled end *</Label>
              <Input
                type="datetime-local"
                value={form.scheduledEnd}
                onChange={(e) => setForm((f) => ({ ...f, scheduledEnd: e.target.value }))}
              />
            </div>
          </div>
          <Button onClick={defaultWindow} variant="outline" size="sm" className="gap-1.5">
            <CalendarClock className="h-3.5 w-3.5" /> Suggest: tomorrow 02:00 → 04:00
          </Button>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border/60 p-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy} className="gap-1.5">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarClock className="h-3.5 w-3.5" />}
            Schedule Window
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

