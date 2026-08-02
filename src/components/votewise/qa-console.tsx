'use client'

// =============================================================================
// VoteWise — Admin QA Console
// Chapter 18 — TQASGR (Testing, QA, Security Certification, Go-Live Readiness)
// =============================================================================
// 6 tabs:
//   1. Test Suites — automated testing pipeline (unit / integration / e2e /
//      security / fraud-sim / performance / accessibility / browser)
//   2. Release Checklist — release readiness gate (every release must verify)
//   3. Go-Live Checklist — per-org pre-launch gate (every election launch)
//   4. Pilot Elections — controlled small-scale elections before GA
//   5. Compliance — ISO 27001 / SOC 2 / GDPR / NDPR frameworks + evidence
//   6. Certifications — digitally-signed election certification seals
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
  ShieldCheck, FlaskConical, PackageCheck, PlaneTakeoff, TestTube,
  Award, BadgeCheck, Loader2, RefreshCw, Plus, CheckCircle2, AlertCircle,
  XCircle, AlertTriangle, Lock, Play, ListChecks, TrendingUp, Hash,
  Clock, Copy, ExternalLink, ChevronDown, ChevronRight, FileText,
  Sparkles, ArrowLeft, Building2, Calendar, Users, Gauge, Activity,
  ShieldAlert, Stamp, Filter, Eraser, StickyNote, Edit3, Save,
  CircleCheck, CircleDot, CircleSlash, Ban,
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
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ---------------------------------------------------------------------------
// Palette + type maps (emerald / gold / amber / zinc / red only)
// ---------------------------------------------------------------------------

const TEST_TYPE_BADGE: Record<string, string> = {
  unit: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  integration: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 ring-1 ring-emerald-300/40 dark:ring-emerald-700/40',
  e2e: 'bg-accent text-accent-foreground',
  security: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  'fraud-sim': 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300 ring-1 ring-red-400/40 dark:ring-red-700/40',
  performance: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  accessibility: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 ring-1 ring-amber-300/40 dark:ring-amber-700/40',
  browser: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300',
}

const TEST_TYPE_LABEL: Record<string, string> = {
  unit: 'Unit',
  integration: 'Integration',
  e2e: 'End-to-End',
  security: 'Security',
  'fraud-sim': 'Fraud Sim',
  performance: 'Performance',
  accessibility: 'Accessibility',
  browser: 'Browser',
}

const MODULE_BADGE: Record<string, string> = {
  sve: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  eifdirs: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  cnse: 'bg-accent text-accent-foreground',
  raei: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  bspcm: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 ring-1 ring-amber-300/40 dark:ring-amber-700/40',
  paoem: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 ring-1 ring-emerald-300/40 dark:ring-emerald-700/40',
  aidp: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300',
  pihed: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/20 dark:text-zinc-300 ring-1 ring-zinc-300/40 dark:ring-zinc-700/40',
  tqasgr: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  core: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300',
}

const MODULE_LABEL: Record<string, string> = {
  sve: 'SVE',
  eifdirs: 'EIFDIRS',
  cnse: 'CNSE',
  raei: 'RAEI',
  bspcm: 'BSPCM',
  paoem: 'PAOEM',
  aidp: 'AIDP',
  pihed: 'PIHED',
  tqasgr: 'TQASGR',
  core: 'Core',
}

const TEST_CATEGORY_BADGE: Record<string, string> = {
  'happy-path': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  'edge-case': 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  'error-handling': 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 ring-1 ring-amber-300/40 dark:ring-amber-700/40',
  security: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  performance: 'bg-accent text-accent-foreground',
  a11y: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300',
}

const TEST_SEVERITY_BADGE: Record<string, string> = {
  blocker: 'bg-red-600 text-white dark:bg-red-700 dark:text-red-50',
  critical: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  major: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  normal: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300',
  minor: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-400',
}

const TEST_STATUS_BADGE: Record<string, string> = {
  passed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  skipped: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-400',
  pending: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-400',
  running: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  flaky: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 ring-1 ring-amber-300/40 dark:ring-amber-700/40',
}

const RUN_STATUS_BADGE: Record<string, string> = {
  passed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  partial: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  running: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 ring-1 ring-amber-300/40 dark:ring-amber-700/40',
  aborted: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-400',
}

const RELEASE_CATEGORY_META: Record<string, { label: string; badge: string }> = {
  testing: { label: 'Testing', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
  'code-review': { label: 'Code Review', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 ring-1 ring-emerald-300/40 dark:ring-emerald-700/40' },
  security: { label: 'Security', badge: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300' },
  performance: { label: 'Performance', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  a11y: { label: 'Accessibility', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 ring-1 ring-amber-300/40 dark:ring-amber-700/40' },
  docs: { label: 'Documentation', badge: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300' },
  backup: { label: 'Backup', badge: 'bg-accent text-accent-foreground' },
  monitoring: { label: 'Monitoring', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
  rollback: { label: 'Rollback', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  approval: { label: 'Approval', badge: 'bg-accent text-accent-foreground' },
}

const GOLIVE_CATEGORY_META: Record<string, { label: string; badge: string }> = {
  org: { label: 'Organization', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
  election: { label: 'Election', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 ring-1 ring-emerald-300/40 dark:ring-emerald-700/40' },
  candidates: { label: 'Candidates', badge: 'bg-accent text-accent-foreground' },
  voters: { label: 'Voters', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  otvp: { label: 'OTVP Channels', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 ring-1 ring-amber-300/40 dark:ring-amber-700/40' },
  infra: { label: 'Infrastructure', badge: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300' },
  monitoring: { label: 'Monitoring', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
  backup: { label: 'Backup', badge: 'bg-accent text-accent-foreground' },
  ssl: { label: 'SSL', badge: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300' },
  domain: { label: 'Domain', badge: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300' },
  support: { label: 'Support', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
}

const PILOT_TYPE_BADGE: Record<string, string> = {
  'student-association': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  ngo: 'bg-accent text-accent-foreground',
  'company-committee': 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  department: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 ring-1 ring-amber-300/40 dark:ring-amber-700/40',
  faculty: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 ring-1 ring-emerald-300/40 dark:ring-emerald-700/40',
  other: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300',
}

const PILOT_TYPE_LABEL: Record<string, string> = {
  'student-association': 'Student Association',
  ngo: 'NGO',
  'company-committee': 'Company Committee',
  department: 'Department',
  faculty: 'Faculty',
  other: 'Other',
}

const PILOT_SCALE_BADGE: Record<string, string> = {
  micro: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300',
  small: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  large: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
}

const PILOT_STATUS_BADGE: Record<string, string> = {
  PLANNED: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300',
  ACTIVE: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 ring-1 ring-amber-300/40 dark:ring-amber-700/40',
  COMPLETED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  CANCELLED: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-400 line-through',
}

const COMPLIANCE_STATUS_BADGE: Record<string, string> = {
  certified: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 ring-1 ring-emerald-300/40 dark:ring-emerald-700/40',
  'in-progress': 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  'not-started': 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300',
  expired: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
}

const COMPLIANCE_STATUS_LABEL: Record<string, string> = {
  certified: 'Certified',
  'in-progress': 'In Progress',
  'not-started': 'Not Started',
  expired: 'Expired',
}

const EVIDENCE_STATUS_META: Record<string, { badge: string; icon: any; label: string }> = {
  met: { badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', icon: CircleCheck, label: 'Met' },
  'in-progress': { badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300', icon: CircleDot, label: 'In Progress' },
  'not-met': { badge: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300', icon: CircleSlash, label: 'Not Met' },
}

const CERT_STATUS_BADGE: Record<string, string> = {
  CERTIFIED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 ring-1 ring-emerald-300/40 dark:ring-emerald-700/40',
  REVOKED: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  EXPIRED: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-400',
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

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: '2-digit',
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
    return formatDate(iso)
  } catch {
    return iso
  }
}

function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null
  try {
    const ms = new Date(iso).getTime() - Date.now()
    return Math.ceil(ms / (1000 * 60 * 60 * 24))
  } catch {
    return null
  }
}

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '0'
  return n.toLocaleString('en-NG')
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
// Types — mirror TQASGR backend
// ---------------------------------------------------------------------------

interface TestSuite {
  id: string
  name: string
  type: string
  module: string
  description: string | null
  totalCases: number
  enabled: boolean
  caseCount?: number
  createdAt: string
}

interface TestCase {
  id: string
  suiteId: string
  name: string
  description: string | null
  category: string
  severity: string
  status: string
  durationMs: number
  errorMessage: string | null
  lastRunAt: string | null
}

interface TestStats {
  suites: number
  cases: number
  runs: number
  passedRuns: number
  failedRuns: number
  passRate: number
  byType: Record<string, number>
}

interface ReleaseChecklistSummary {
  version: string
  createdAt: string
  total: number
  verified: number
  required: number
  requiredVerified: number
  ready: boolean
  progressPct: number
}

interface ReleaseChecklistItem {
  id: string
  version: string
  itemName: string
  category: string
  required: boolean
  verified: boolean
  verifiedBy: string | null
  verifiedAt: string | null
  notes: string | null
  createdAt: string
}

interface GoLiveSummary {
  total: number
  verified: number
  required: number
  requiredVerified: number
  ready: boolean
  progressPct: number
}

interface GoLiveChecklistItem {
  id: string
  organizationId: string
  electionId: string | null
  itemName: string
  category: string
  required: boolean
  verified: boolean
  verifiedBy: string | null
  verifiedAt: string | null
  notes: string | null
  createdAt: string
}

interface PilotMetrics {
  turnout?: number
  errorRate?: number
  p95Latency?: number
  incidents?: number
}

interface SuccessCriterion {
  criterion: string
  met: boolean
}

interface PilotElection {
  id: string
  organizationId: string
  electionId: string | null
  name: string
  type: string
  scale: string
  expectedVoters: number
  actualVoters: number
  status: string
  startDate: string | null
  endDate: string | null
  metrics: string | null
  lessonsLearned: string | null
  successCriteria: string | null
  approvedForGA: boolean
  createdBy: string | null
  createdByName: string | null
  createdAt: string
}

interface PilotStats {
  total: number
  planned: number
  active: number
  completed: number
  approvedForGA: number
}

interface ComplianceEvidence {
  control: string
  status: string
  evidence: string
  lastReviewed: string
}

interface ComplianceFramework {
  id: string
  name: string
  description: string | null
  status: string
  totalControls: number
  metControls: number
  certifyingBody: string | null
  certificateUrl: string | null
  validFrom: string | null
  validUntil: string | null
  evidence: string | null
  createdAt: string
}

interface ComplianceStats {
  total: number
  certified: number
  inProgress: number
  notStarted: number
}

interface CertificationSeal {
  id: string
  certificationId: string
  electionId: string
  organizationId: string | null
  electionName: string
  organizationName: string | null
  status: string
  integrityScore: number
  votesVerified: number
  auditLogsComplete: boolean
  observerReportsComplete: boolean
  securityIncidents: string
  certifiedBy: string
  certifiedAt: string
  revokedAt: string | null
  revokeReason: string | null
  createdAt: string
}

interface Organization {
  id: string
  name: string
  slug: string
  subdomain: string
}

// ---------------------------------------------------------------------------
// MAIN COMPONENT
// ===========================================================================

export function QaConsole() {
  return (
    <Suspense fallback={<BootLoader />}>
      <QaConsoleInner />
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

function QaConsoleInner() {
  const [authed, setAuthed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [official, setOfficial] = useState<any>(null)
  const [tab, setTab] = useState<string>('tests')

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
    return <QaLogin onSuccess={(o) => { setOfficial(o); setAuthed(true) }} />
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
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-2xl font-bold sm:text-3xl">QA Console</h1>
                  <Badge variant="outline" className="gap-1 text-[10px] uppercase tracking-wider">
                    <FlaskConical className="h-3 w-3" /> TQASGR · Ch. 18
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Testing, QA, security certification &amp; go-live readiness control room for VoteWise platform admins.
                </p>
              </div>
            </div>
            <div className="flex flex-col items-start gap-2 sm:items-end">
              <div className="flex items-center gap-2">
                <Button asChild variant="outline" size="sm" className="gap-1.5">
                  <Link href="/admin/infrastructure">
                    <ArrowLeft className="h-4 w-4" /> Infrastructure
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="gap-1.5">
                  <Link href="/admin">
                    <ArrowLeft className="h-4 w-4" /> Admin
                  </Link>
                </Button>
              </div>
              <Badge variant="outline" className="gap-1.5">
                <ShieldCheck className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
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
            <TabsTrigger value="tests" className="gap-1.5">
              <FlaskConical className="h-4 w-4" /> Test Suites
            </TabsTrigger>
            <TabsTrigger value="release" className="gap-1.5">
              <PackageCheck className="h-4 w-4" /> Release
            </TabsTrigger>
            <TabsTrigger value="golive" className="gap-1.5">
              <PlaneTakeoff className="h-4 w-4" /> Go-Live
            </TabsTrigger>
            <TabsTrigger value="pilots" className="gap-1.5">
              <TestTube className="h-4 w-4" /> Pilots
            </TabsTrigger>
            <TabsTrigger value="compliance" className="gap-1.5">
              <Award className="h-4 w-4" /> Compliance
            </TabsTrigger>
            <TabsTrigger value="certifications" className="gap-1.5">
              <BadgeCheck className="h-4 w-4" /> Certifications
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="tests" className="mt-0">
          <TestSuitesTab />
        </TabsContent>
        <TabsContent value="release" className="mt-0">
          <ReleaseChecklistTab />
        </TabsContent>
        <TabsContent value="golive" className="mt-0">
          <GoLiveChecklistTab />
        </TabsContent>
        <TabsContent value="pilots" className="mt-0">
          <PilotsTab />
        </TabsContent>
        <TabsContent value="compliance" className="mt-0">
          <ComplianceTab />
        </TabsContent>
        <TabsContent value="certifications" className="mt-0">
          <CertificationsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Login gate
// ---------------------------------------------------------------------------

function QaLogin({ onSuccess }: { onSuccess: (o: any) => void }) {
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
          <CardTitle className="mt-3 font-display">QA Console</CardTitle>
          <p className="text-sm text-muted-foreground">
            Platform admin access required to manage testing, QA, compliance &amp; certifications.
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

function StatCard({
  icon: Icon, label, value, accent = 'zinc', glow = false, pulse = false,
}: {
  icon: any
  label: string
  value: string | number
  accent?: 'emerald' | 'gold' | 'amber' | 'zinc' | 'red'
  glow?: boolean
  pulse?: boolean
}) {
  const accentClasses: Record<string, string> = {
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    gold: 'bg-accent/15 text-accent-foreground',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    zinc: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-300',
    red: 'bg-red-500/10 text-red-600 dark:text-red-400',
  }
  return (
    <Card className={cn('overflow-hidden', glow && 'votewise-card-glow')}>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl', accentClasses[accent], pulse && 'animate-pulse')}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="truncate font-display text-2xl font-bold leading-tight">{value}</div>
        </div>
      </CardContent>
    </Card>
  )
}

function TabHeaderCard({
  icon: Icon, title, description,
}: {
  icon: any
  title: string
  description: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="mb-6"
    >
      <Card className="votewise-card-glow overflow-hidden">
        <CardContent className="flex items-start gap-4 p-5">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold leading-tight sm:text-xl">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ===========================================================================
// TAB 1 — Test Suites
// ===========================================================================

function TestSuitesTab() {
  const [suites, setSuites] = useState<TestSuite[]>([])
  const [stats, setStats] = useState<TestStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [moduleFilter, setModuleFilter] = useState<string>('all')
  const [runningAll, setRunningAll] = useState(false)
  const [runningSuiteId, setRunningSuiteId] = useState<string | null>(null)
  const [expandedSuiteId, setExpandedSuiteId] = useState<string | null>(null)
  const [casesBySuite, setCasesBySuite] = useState<Record<string, TestCase[]>>({})
  const [loadingCases, setLoadingCases] = useState<string | null>(null)
  const firstLoad = useRef(true)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const type = typeFilter !== 'all' ? typeFilter : undefined
      const mod = moduleFilter !== 'all' ? moduleFilter : undefined
      const res = await api.tqasgrTests(type, mod) as { suites: TestSuite[]; stats: TestStats }
      setSuites(res.suites || [])
      setStats(res.stats || null)
      setError(null)
    } catch (e: any) {
      if (firstLoad.current || !silent) setError(e?.message || 'Failed to load test suites')
    } finally {
      setLoading(false)
      firstLoad.current = false
    }
  }, [typeFilter, moduleFilter])

  useEffect(() => { load() }, [load])

  // 60s auto-refresh (silent)
  useEffect(() => {
    const t = setInterval(() => load(true), 60_000)
    return () => clearInterval(t)
  }, [load])

  async function runAll() {
    setRunningAll(true)
    try {
      const res = await api.tqasgrRunAllSuites() as { summary: any; message: string }
      toast.success(res.message || `Ran ${res.summary?.completed} suites`)
      await load(true)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to run all suites')
    } finally {
      setRunningAll(false)
    }
  }

  async function runSuite(suite: TestSuite) {
    setRunningSuiteId(suite.id)
    try {
      const res = await api.tqasgrRunSuite(suite.id) as { run: any; message: string }
      const status = res.run?.status || 'completed'
      const passed = res.run?.passed ?? 0
      const failed = res.run?.failed ?? 0
      if (status === 'passed') {
        toast.success(`✓ ${suite.name} — all ${passed} cases passed`)
      } else if (status === 'partial') {
        toast.warning(`${suite.name} — ${passed} passed, ${failed} failed (partial)`)
      } else {
        toast.error(`${suite.name} — ${failed} case(s) failed`)
      }
      await load(true)
      // Refresh expanded cases if open
      if (expandedSuiteId === suite.id) {
        await expandSuite(suite.id, true)
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to run suite')
    } finally {
      setRunningSuiteId(null)
    }
  }

  async function expandSuite(suiteId: string, force = false) {
    if (expandedSuiteId === suiteId && !force) {
      setExpandedSuiteId(null)
      return
    }
    setExpandedSuiteId(suiteId)
    if (casesBySuite[suiteId] && !force) return
    setLoadingCases(suiteId)
    try {
      // The list endpoint doesn't return cases; re-fetch stats + use suite detail via run results.
      // We fetch via the tests endpoint which returns suites+stats, but for cases we need a
      // dedicated call. The backend's getTestSuite(id) is exposed through a separate path —
      // but the client api doesn't have it. We approximate by reading the most recent run's
      // resultsJson. To keep this self-contained, we hit the tests endpoint and derive cases
      // from the suite's totalCases count with a synthetic display if no run exists.
      // Actually — the spec requires showing test cases. We fetch them via the suite detail
      // endpoint which the backend exposes at /api/tqasgr/tests/[suiteId] (GET). But the client
      // api.tqasgrTests doesn't cover that. We'll fetch directly.
      const res = await fetch(`/api/tqasgr/tests/${suiteId}`).then((r) => r.json()).catch(() => null) as { suite: any; cases?: TestCase[]; runs?: any[] } | null
      if (res?.cases) {
        setCasesBySuite((m) => ({ ...m, [suiteId]: res.cases }))
      }
    } catch {
      /* silent */
    } finally {
      setLoadingCases(null)
    }
  }

  // Group suites by type
  const grouped = useMemo(() => {
    const g: Record<string, TestSuite[]> = {}
    for (const s of suites) {
      if (!g[s.type]) g[s.type] = []
      g[s.type].push(s)
    }
    return g
  }, [suites])

  const typeOrder = ['unit', 'integration', 'e2e', 'security', 'fraud-sim', 'performance', 'accessibility', 'browser']

  if (loading) {
    return (
      <div>
        <TabHeaderCard
          icon={FlaskConical}
          title="Automated Testing Pipeline"
          description="Unit, Integration, E2E, Security, Fraud Simulation, Performance, Accessibility, Browser. Every module tested before release."
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}><CardContent className="h-20 animate-pulse bg-muted/40 p-4" /></Card>
          ))}
        </div>
        <LoadingRow label="Loading test suites…" />
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <TabHeaderCard
          icon={FlaskConical}
          title="Automated Testing Pipeline"
          description="Unit, Integration, E2E, Security, Fraud Simulation, Performance, Accessibility, Browser. Every module tested before release."
        />
        <ErrorState message={error} onRetry={() => load()} />
      </div>
    )
  }

  return (
    <div>
      <TabHeaderCard
        icon={FlaskConical}
        title="Automated Testing Pipeline"
        description="Unit, Integration, E2E, Security, Fraud Simulation, Performance, Accessibility, Browser. Every module tested before release."
      />

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard icon={FlaskConical} label="Total Suites" value={stats?.suites ?? 0} accent="emerald" glow />
        <StatCard icon={ListChecks} label="Total Cases" value={stats?.cases ?? 0} accent="emerald" />
        <StatCard icon={Play} label="Total Runs" value={stats?.runs ?? 0} accent="gold" />
        <StatCard
          icon={TrendingUp}
          label="Pass Rate"
          value={`${stats?.passRate ?? 0}%`}
          accent={(stats?.failedRuns ?? 0) === 0 ? 'emerald' : 'amber'}
        />
        <StatCard
          icon={XCircle}
          label="Failed Runs"
          value={stats?.failedRuns ?? 0}
          accent={(stats?.failedRuns ?? 0) > 0 ? 'red' : 'zinc'}
          pulse={(stats?.failedRuns ?? 0) > 0}
        />
      </div>

      {/* Run all + filters */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button onClick={runAll} disabled={runningAll} className="gap-2 self-start">
          {runningAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {runningAll ? 'Running all suites…' : 'Run All Suites'}
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-9 w-[150px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {typeOrder.map((t) => (
                <SelectItem key={t} value={t}>{TEST_TYPE_LABEL[t] || t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={moduleFilter} onValueChange={setModuleFilter}>
            <SelectTrigger className="h-9 w-[150px]">
              <SelectValue placeholder="Module" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Modules</SelectItem>
              {Object.keys(MODULE_LABEL).map((m) => (
                <SelectItem key={m} value={m}>{MODULE_LABEL[m]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(typeFilter !== 'all' || moduleFilter !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={() => { setTypeFilter('all'); setModuleFilter('all') }}
            >
              <Eraser className="h-3.5 w-3.5" /> Clear
            </Button>
          )}
        </div>
      </div>

      {/* Suite list grouped by type */}
      {suites.length === 0 ? (
        <EmptyState icon={FlaskConical} title="No test suites" hint="Adjust filters or run all suites to see results." />
      ) : (
        <div className="max-h-[600px] space-y-6 overflow-y-auto votewise-scroll pr-1">
          {typeOrder.filter((t) => grouped[t]?.length).map((t) => (
            <div key={t}>
              <div className="mb-2 flex items-center gap-2">
                <Badge className={cn('text-xs', TEST_TYPE_BADGE[t])}>{TEST_TYPE_LABEL[t] || t}</Badge>
                <span className="text-sm text-muted-foreground">{grouped[t].length} suite{grouped[t].length !== 1 ? 's' : ''}</span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {grouped[t].map((suite) => {
                  const expanded = expandedSuiteId === suite.id
                  return (
                    <motion.div
                      key={suite.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Card className={cn('overflow-hidden transition-shadow', expanded && 'ring-1 ring-primary/30')}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-2">
                            <button
                              onClick={() => expandSuite(suite.id)}
                              className="flex-1 text-left"
                            >
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-semibold leading-tight">{suite.name}</span>
                              </div>
                              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                <Badge variant="outline" className={cn('text-[10px] uppercase', TEST_TYPE_BADGE[suite.type])}>
                                  {TEST_TYPE_LABEL[suite.type] || suite.type}
                                </Badge>
                                <Badge variant="outline" className={cn('text-[10px] uppercase', MODULE_BADGE[suite.module])}>
                                  {MODULE_LABEL[suite.module] || suite.module}
                                </Badge>
                                <Badge variant="outline" className="text-[10px]">
                                  {suite.caseCount ?? suite.totalCases} cases
                                </Badge>
                              </div>
                              {suite.description && (
                                <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{suite.description}</p>
                              )}
                            </button>
                            <div className="flex shrink-0 flex-col items-end gap-1.5">
                              <Button
                                size="sm"
                                variant="default"
                                disabled={runningSuiteId === suite.id}
                                onClick={() => runSuite(suite)}
                                className="gap-1.5"
                              >
                                {runningSuiteId === suite.id
                                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  : <Play className="h-3.5 w-3.5" />}
                                Run
                              </Button>
                              <button
                                onClick={() => expandSuite(suite.id)}
                                className="text-muted-foreground hover:text-foreground"
                                aria-label={expanded ? 'Collapse' : 'Expand'}
                              >
                                {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </button>
                            </div>
                          </div>

                          <AnimatePresence>
                            {expanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <div className="mt-3 border-t border-border/60 pt-3">
                                  {loadingCases === suite.id ? (
                                    <LoadingRow label="Loading test cases…" />
                                  ) : casesBySuite[suite.id]?.length ? (
                                    <div className="max-h-72 space-y-1.5 overflow-y-auto votewise-scroll pr-1">
                                      {casesBySuite[suite.id].map((tc) => (
                                        <div
                                          key={tc.id}
                                          className="flex items-start gap-2 rounded-lg border border-border/50 bg-muted/30 p-2"
                                        >
                                          <div className="mt-0.5 shrink-0">
                                            {tc.status === 'passed' && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                                            {tc.status === 'failed' && <XCircle className="h-4 w-4 text-red-500" />}
                                            {tc.status === 'skipped' && <CircleSlash className="h-4 w-4 text-zinc-400" />}
                                            {tc.status === 'pending' && <CircleDot className="h-4 w-4 text-zinc-400" />}
                                            {tc.status === 'running' && <Loader2 className="h-4 w-4 animate-spin text-amber-500" />}
                                          </div>
                                          <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                              <span className="text-sm font-medium leading-tight">{tc.name}</span>
                                            </div>
                                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                              <Badge variant="outline" className={cn('text-[9px] uppercase', TEST_CATEGORY_BADGE[tc.category] || 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300')}>
                                                {tc.category}
                                              </Badge>
                                              <Badge variant="outline" className={cn('text-[9px] uppercase', TEST_SEVERITY_BADGE[tc.severity] || 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300')}>
                                                {tc.severity}
                                              </Badge>
                                              <Badge variant="outline" className={cn('text-[9px] uppercase', TEST_STATUS_BADGE[tc.status] || 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300')}>
                                                {tc.status}
                                              </Badge>
                                              {tc.durationMs > 0 && (
                                                <span className="text-[10px] text-muted-foreground">{formatDuration(tc.durationMs)}</span>
                                              )}
                                            </div>
                                            {tc.errorMessage && (
                                              <p className="mt-1 rounded bg-red-500/10 p-1.5 font-mono text-[10px] text-red-600 dark:text-red-400">
                                                {tc.errorMessage}
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="py-3 text-center text-xs text-muted-foreground">No test cases found.</p>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ===========================================================================
// TAB 2 — Release Checklist
// ===========================================================================

function ReleaseChecklistTab() {
  const [checklists, setChecklists] = useState<ReleaseChecklistSummary[]>([])
  const [selectedVersion, setSelectedVersion] = useState<string>('')
  const [items, setItems] = useState<ReleaseChecklistItem[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [loadingItems, setLoadingItems] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [creatingVersion, setCreatingVersion] = useState(false)
  const [newVersion, setNewVersion] = useState('')
  const [verifyingId, setVerifyingId] = useState<string | null>(null)
  const [editingNotes, setEditingNotes] = useState<string | null>(null)
  const [notesDraft, setNotesDraft] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const firstLoad = useRef(true)

  const loadList = useCallback(async (silent = false) => {
    if (!silent) setLoadingList(true)
    try {
      const res = await api.tqasgrReleaseChecklists() as { checklists: ReleaseChecklistSummary[] }
      const list = res.checklists || []
      setChecklists(list)
      setError(null)
      // Auto-select the first/newest version if none selected
      if (list.length > 0 && !selectedVersion) {
        setSelectedVersion(list[0].version)
      }
    } catch (e: any) {
      if (firstLoad.current || !silent) setError(e?.message || 'Failed to load release checklists')
    } finally {
      setLoadingList(false)
      firstLoad.current = false
    }
  }, [selectedVersion])

  const loadItems = useCallback(async (version: string, silent = false) => {
    if (!version) return
    if (!silent) setLoadingItems(true)
    try {
      const res = await api.tqasgrReleaseChecklist(version) as { items: ReleaseChecklistItem[] }
      setItems(res.items || [])
      setError(null)
    } catch (e: any) {
      if (!silent) setError(e?.message || 'Failed to load checklist items')
    } finally {
      setLoadingItems(false)
    }
  }, [])

  useEffect(() => { loadList() }, [loadList])

  useEffect(() => {
    if (selectedVersion) loadItems(selectedVersion)
    else setItems([])
  }, [selectedVersion, loadItems])

  // 30s auto-refresh
  useEffect(() => {
    const t = setInterval(() => {
      loadList(true)
      if (selectedVersion) loadItems(selectedVersion, true)
    }, 30_000)
    return () => clearInterval(t)
  }, [loadList, loadItems, selectedVersion])

  async function createVersion() {
    const v = newVersion.trim()
    if (!v) {
      toast.error('Please enter a version string (e.g. v18.1.0)')
      return
    }
    setCreatingVersion(true)
    try {
      await api.tqasgrCreateReleaseChecklist(v)
      toast.success(`Release checklist created for ${v}`)
      setNewVersion('')
      await loadList(true)
      setSelectedVersion(v)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to create checklist')
    } finally {
      setCreatingVersion(false)
    }
  }

  async function toggleItem(item: ReleaseChecklistItem) {
    setVerifyingId(item.id)
    try {
      const newVerified = !item.verified
      await api.tqasgrVerifyChecklistItem(item.version, item.id, newVerified)
      toast.success(newVerified ? 'Item verified' : 'Item unverified')
      await loadItems(item.version, true)
      await loadList(true)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update item')
    } finally {
      setVerifyingId(null)
    }
  }

  async function saveNotes(item: ReleaseChecklistItem) {
    setSavingNotes(true)
    try {
      await api.tqasgrVerifyChecklistItem(item.version, item.id, item.verified, notesDraft.trim() || undefined)
      toast.success('Notes saved')
      setEditingNotes(null)
      await loadItems(item.version, true)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save notes')
    } finally {
      setSavingNotes(false)
    }
  }

  // Current checklist summary
  const currentSummary = checklists.find((c) => c.version === selectedVersion) || null

  // Group items by category
  const grouped = useMemo(() => {
    const g: Record<string, ReleaseChecklistItem[]> = {}
    for (const it of items) {
      if (!g[it.category]) g[it.category] = []
      g[it.category].push(it)
    }
    return g
  }, [items])

  const categoryOrder = ['testing', 'code-review', 'security', 'performance', 'a11y', 'docs', 'backup', 'monitoring', 'rollback', 'approval']

  if (loadingList) {
    return (
      <div>
        <TabHeaderCard
          icon={PackageCheck}
          title="Release Readiness Checklist"
          description="Every release must verify all items. No exceptions."
        />
        <LoadingRow label="Loading release checklists…" />
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <TabHeaderCard
          icon={PackageCheck}
          title="Release Readiness Checklist"
          description="Every release must verify all items. No exceptions."
        />
        <ErrorState message={error} onRetry={() => loadList()} />
      </div>
    )
  }

  return (
    <div>
      <TabHeaderCard
        icon={PackageCheck}
        title="Release Readiness Checklist"
        description="Every release must verify all items. No exceptions."
      />

      {/* Version selector + create */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Release Version</Label>
            <Select value={selectedVersion} onValueChange={setSelectedVersion}>
              <SelectTrigger className="h-9 w-[200px]">
                <SelectValue placeholder="Select version" />
              </SelectTrigger>
              <SelectContent>
                {checklists.map((c) => (
                  <SelectItem key={c.version} value={c.version}>
                    {c.version} {c.ready && '✓'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">New Version</Label>
            <Input
              value={newVersion}
              onChange={(e) => setNewVersion(e.target.value)}
              placeholder="v18.1.0"
              className="h-9 w-[160px]"
              onKeyDown={(e) => e.key === 'Enter' && !creatingVersion && createVersion()}
            />
          </div>
          <Button onClick={createVersion} disabled={creatingVersion} variant="outline" className="gap-1.5">
            {creatingVersion ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create
          </Button>
        </div>
      </div>

      {!selectedVersion ? (
        <EmptyState
          icon={PackageCheck}
          title="No release checklist selected"
          hint="Select a version above or create a new one to begin."
        />
      ) : loadingItems ? (
        <LoadingRow label="Loading checklist items…" />
      ) : (
        <>
          {/* Progress + readiness gate */}
          {currentSummary && (
            <Card className="votewise-card-glow mb-6 overflow-hidden">
              <CardContent className="p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Hash className="h-4 w-4 text-muted-foreground" />
                    <span className="font-display text-lg font-bold">{currentSummary.version}</span>
                    <Badge variant="outline" className="text-xs">
                      {currentSummary.requiredVerified} / {currentSummary.required} required
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {currentSummary.verified} / {currentSummary.total} total
                    </Badge>
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">{currentSummary.progressPct}%</span>
                </div>
                <Progress
                  value={currentSummary.progressPct}
                  className={cn(
                    'h-3',
                    currentSummary.ready
                      ? '[&>div]:bg-emerald-500'
                      : currentSummary.requiredVerified > 0
                      ? '[&>div]:bg-amber-500'
                      : '[&>div]:bg-zinc-400',
                  )}
                />
                <div className="mt-4">
                  {currentSummary.ready ? (
                    <div className="flex items-center gap-3 rounded-lg border border-emerald-300/50 bg-emerald-500/10 p-4 dark:border-emerald-700/50 dark:bg-emerald-500/15">
                      <CheckCircle2 className="h-8 w-8 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <div>
                        <p className="font-display text-lg font-bold text-emerald-700 dark:text-emerald-300">✓ READY FOR RELEASE</p>
                        <p className="text-sm text-emerald-600/80 dark:text-emerald-400/80">
                          All {currentSummary.required} required items verified. {currentSummary.version} is cleared to ship.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 rounded-lg border border-amber-300/50 bg-amber-500/10 p-4 dark:border-amber-700/50 dark:bg-amber-500/15">
                      <AlertTriangle className="h-8 w-8 shrink-0 text-amber-600 dark:text-amber-400" />
                      <div>
                        <p className="font-display text-lg font-bold text-amber-700 dark:text-amber-300">
                          {currentSummary.required - currentSummary.requiredVerified} required item(s) remaining
                        </p>
                        <p className="text-sm text-amber-600/80 dark:text-amber-400/80">
                          {currentSummary.requiredVerified} of {currentSummary.required} required items verified. Cannot release until all required items are checked.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Items grouped by category */}
          {items.length === 0 ? (
            <EmptyState icon={ListChecks} title="No checklist items" hint="This version has no items yet." />
          ) : (
            <div className="max-h-[600px] space-y-4 overflow-y-auto votewise-scroll pr-1">
              {categoryOrder.filter((c) => grouped[c]?.length).map((cat) => {
                const meta = RELEASE_CATEGORY_META[cat] || { label: cat, badge: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300' }
                const catItems = grouped[cat]
                const catVerified = catItems.filter((i) => i.verified).length
                return (
                  <Card key={cat} className="overflow-hidden">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge className={cn('text-xs uppercase', meta.badge)}>{meta.label}</Badge>
                          <span className="text-sm text-muted-foreground">{catVerified}/{catItems.length}</span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-1.5 pt-0">
                      {catItems.map((item) => {
                        const isVerifying = verifyingId === item.id
                        const isEditing = editingNotes === item.id
                        return (
                          <div
                            key={item.id}
                            className={cn(
                              'rounded-lg border p-3 transition-colors',
                              item.verified
                                ? 'border-emerald-300/40 bg-emerald-500/5 dark:border-emerald-700/40 dark:bg-emerald-500/10'
                                : 'border-border/60 bg-muted/20',
                            )}
                          >
                            <div className="flex items-start gap-3">
                              <Checkbox
                                checked={item.verified}
                                disabled={isVerifying}
                                onCheckedChange={() => toggleItem(item)}
                                className="mt-0.5"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className={cn('text-sm font-medium', item.verified && 'text-emerald-700 dark:text-emerald-300')}>
                                    {item.itemName}
                                  </span>
                                  {item.required ? (
                                    <Badge variant="outline" className="text-[9px] uppercase text-red-600 dark:text-red-400">Required</Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-[9px] uppercase text-zinc-500">Optional</Badge>
                                  )}
                                  {isVerifying && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                                </div>
                                {item.verified && (item.verifiedBy || item.verifiedAt) && (
                                  <p className="mt-1 text-[11px] text-muted-foreground">
                                    {item.verifiedBy && <>Verified by <span className="font-medium text-foreground">{item.verifiedBy}</span></>}
                                    {item.verifiedBy && item.verifiedAt && ' · '}
                                    {item.verifiedAt && timeAgo(item.verifiedAt)}
                                  </p>
                                )}
                                {item.notes && !isEditing && (
                                  <p className="mt-1 rounded bg-muted/50 p-1.5 text-[11px] text-muted-foreground">
                                    <StickyNote className="mr-1 inline h-3 w-3" />
                                    {item.notes}
                                  </p>
                                )}
                                {isEditing ? (
                                  <div className="mt-2 space-y-1.5">
                                    <Textarea
                                      value={notesDraft}
                                      onChange={(e) => setNotesDraft(e.target.value)}
                                      placeholder="Add notes (e.g. link to evidence, build ID)"
                                      className="min-h-[60px] text-xs"
                                    />
                                    <div className="flex gap-1.5">
                                      <Button size="sm" onClick={() => saveNotes(item)} disabled={savingNotes} className="gap-1.5">
                                        {savingNotes ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                        Save
                                      </Button>
                                      <Button size="sm" variant="ghost" onClick={() => setEditingNotes(null)}>Cancel</Button>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => { setEditingNotes(item.id); setNotesDraft(item.notes || '') }}
                                    className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                                  >
                                    <Edit3 className="h-3 w-3" />
                                    {item.notes ? 'Edit note' : 'Add note'}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ===========================================================================
// TAB 3 — Go-Live Checklist
// ===========================================================================

function GoLiveChecklistTab() {
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [selectedOrg, setSelectedOrg] = useState<string>('')
  const [selectedElection, setSelectedElection] = useState<string>('')
  const [items, setItems] = useState<GoLiveChecklistItem[]>([])
  const [summary, setSummary] = useState<GoLiveSummary | null>(null)
  const [loadingOrgs, setLoadingOrgs] = useState(true)
  const [loadingItems, setLoadingItems] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [verifyingId, setVerifyingId] = useState<string | null>(null)
  const [editingNotes, setEditingNotes] = useState<string | null>(null)
  const [notesDraft, setNotesDraft] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const firstLoad = useRef(true)

  // Load orgs once
  useEffect(() => {
    api
      .listOrganizations()
      .then((res: any) => {
        setOrgs(res.organizations || [])
        if ((res.organizations || []).length > 0) setSelectedOrg(res.organizations[0].id)
      })
      .catch((e: any) => setError(e?.message || 'Failed to load organizations'))
      .finally(() => setLoadingOrgs(false))
  }, [])

  const loadItems = useCallback(async (org: string, election: string, silent = false) => {
    if (!org) return
    if (!silent) setLoadingItems(true)
    try {
      const res = await api.tqasgrGoLiveChecklist(org, election || undefined) as { items: GoLiveChecklistItem[]; summary: GoLiveSummary }
      setItems(res.items || [])
      setSummary(res.summary || null)
      setError(null)
    } catch (e: any) {
      if (firstLoad.current || !silent) setError(e?.message || 'Failed to load go-live checklist')
      setItems([])
      setSummary(null)
    } finally {
      setLoadingItems(false)
      firstLoad.current = false
    }
  }, [])

  useEffect(() => {
    firstLoad.current = true
    if (selectedOrg) loadItems(selectedOrg, selectedElection)
    else { setItems([]); setSummary(null) }
  }, [selectedOrg, selectedElection, loadItems])

  // 30s auto-refresh
  useEffect(() => {
    if (!selectedOrg) return
    const t = setInterval(() => loadItems(selectedOrg, selectedElection, true), 30_000)
    return () => clearInterval(t)
  }, [selectedOrg, selectedElection, loadItems])

  async function createChecklist() {
    if (!selectedOrg) {
      toast.error('Please select an organization first')
      return
    }
    setCreating(true)
    try {
      await api.tqasgrCreateGoLiveChecklist(selectedOrg, selectedElection || undefined)
      toast.success('Go-live checklist created')
      await loadItems(selectedOrg, selectedElection, true)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to create checklist')
    } finally {
      setCreating(false)
    }
  }

  async function verifyItem(item: GoLiveChecklistItem) {
    setVerifyingId(item.id)
    try {
      await api.tqasgrVerifyGoLiveItem(item.id, notesDraft.trim() || undefined)
      toast.success('Item verified')
      await loadItems(selectedOrg, selectedElection, true)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to verify item')
    } finally {
      setVerifyingId(null)
    }
  }

  async function saveNotes(item: GoLiveChecklistItem) {
    setSavingNotes(true)
    try {
      await api.tqasgrVerifyGoLiveItem(item.id, notesDraft.trim() || undefined)
      toast.success('Notes saved')
      setEditingNotes(null)
      await loadItems(selectedOrg, selectedElection, true)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save notes')
    } finally {
      setSavingNotes(false)
    }
  }

  // Group items by category
  const grouped = useMemo(() => {
    const g: Record<string, GoLiveChecklistItem[]> = {}
    for (const it of items) {
      if (!g[it.category]) g[it.category] = []
      g[it.category].push(it)
    }
    return g
  }, [items])

  const categoryOrder = ['org', 'election', 'candidates', 'voters', 'otvp', 'infra', 'monitoring', 'backup', 'ssl', 'domain', 'support']

  if (loadingOrgs) {
    return (
      <div>
        <TabHeaderCard
          icon={PlaneTakeoff}
          title="Production Go-Live Checklist"
          description="Before any organization launches an election, verify all items are checked."
        />
        <LoadingRow label="Loading organizations…" />
      </div>
    )
  }

  if (error && !selectedOrg) {
    return (
      <div>
        <TabHeaderCard
          icon={PlaneTakeoff}
          title="Production Go-Live Checklist"
          description="Before any organization launches an election, verify all items are checked."
        />
        <ErrorState message={error} onRetry={() => window.location.reload()} />
      </div>
    )
  }

  return (
    <div>
      <TabHeaderCard
        icon={PlaneTakeoff}
        title="Production Go-Live Checklist"
        description="Before any organization launches an election, verify all items are checked."
      />

      {/* Org + election selectors + create */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Organization</Label>
            <Select value={selectedOrg} onValueChange={(v) => { setSelectedOrg(v); setSelectedElection('') }}>
              <SelectTrigger className="h-9 w-[220px]">
                <SelectValue placeholder="Select organization" />
              </SelectTrigger>
              <SelectContent>
                {orgs.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Election (optional)</Label>
            <Input
              value={selectedElection}
              onChange={(e) => setSelectedElection(e.target.value)}
              placeholder="Election ID"
              className="h-9 w-[200px]"
            />
          </div>
        </div>
        {selectedOrg && items.length === 0 && !loadingItems && (
          <Button onClick={createChecklist} disabled={creating} className="gap-1.5">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create Go-Live Checklist
          </Button>
        )}
      </div>

      {!selectedOrg ? (
        <EmptyState
          icon={PlaneTakeoff}
          title="No organization selected"
          hint="Select an organization above to view or create its go-live checklist."
        />
      ) : loadingItems ? (
        <LoadingRow label="Loading go-live checklist…" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No go-live checklist yet"
          hint="Click 'Create Go-Live Checklist' to generate the 16-point pre-launch checklist for this organization."
        />
      ) : (
        <>
          {/* Progress + readiness gate */}
          {summary && (
            <Card className="votewise-card-glow mb-6 overflow-hidden">
              <CardContent className="p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="font-display text-lg font-bold">
                      {orgs.find((o) => o.id === selectedOrg)?.name || 'Organization'}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {summary.requiredVerified} / {summary.required} required
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {summary.verified} / {summary.total} total
                    </Badge>
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">{summary.progressPct}%</span>
                </div>
                <Progress
                  value={summary.progressPct}
                  className={cn(
                    'h-3',
                    summary.ready
                      ? '[&>div]:bg-emerald-500'
                      : summary.requiredVerified > 0
                      ? '[&>div]:bg-amber-500'
                      : '[&>div]:bg-zinc-400',
                  )}
                />
                <div className="mt-4">
                  {summary.ready ? (
                    <div className="flex items-center gap-3 rounded-lg border border-emerald-300/50 bg-emerald-500/10 p-4 dark:border-emerald-700/50 dark:bg-emerald-500/15">
                      <CheckCircle2 className="h-8 w-8 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <div>
                        <p className="font-display text-lg font-bold text-emerald-700 dark:text-emerald-300">✓ READY FOR GO-LIVE</p>
                        <p className="text-sm text-emerald-600/80 dark:text-emerald-400/80">
                          All {summary.required} required items verified. This organization is cleared to launch.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 rounded-lg border border-amber-300/50 bg-amber-500/10 p-4 dark:border-amber-700/50 dark:bg-amber-500/15">
                      <AlertTriangle className="h-8 w-8 shrink-0 text-amber-600 dark:text-amber-400" />
                      <div>
                        <p className="font-display text-lg font-bold text-amber-700 dark:text-amber-300">
                          {summary.required - summary.requiredVerified} required item(s) remaining
                        </p>
                        <p className="text-sm text-amber-600/80 dark:text-amber-400/80">
                          {summary.requiredVerified} of {summary.required} required items verified. Do not launch until all required items are checked.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Items grouped by category */}
          <div className="max-h-[600px] space-y-4 overflow-y-auto votewise-scroll pr-1">
            {categoryOrder.filter((c) => grouped[c]?.length).map((cat) => {
              const meta = GOLIVE_CATEGORY_META[cat] || { label: cat, badge: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300' }
              const catItems = grouped[cat]
              const catVerified = catItems.filter((i) => i.verified).length
              return (
                <Card key={cat} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge className={cn('text-xs uppercase', meta.badge)}>{meta.label}</Badge>
                        <span className="text-sm text-muted-foreground">{catVerified}/{catItems.length}</span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-1.5 pt-0">
                    {catItems.map((item) => {
                      const isVerifying = verifyingId === item.id
                      const isEditing = editingNotes === item.id
                      return (
                        <div
                          key={item.id}
                          className={cn(
                            'rounded-lg border p-3 transition-colors',
                            item.verified
                              ? 'border-emerald-300/40 bg-emerald-500/5 dark:border-emerald-700/40 dark:bg-emerald-500/10'
                              : 'border-border/60 bg-muted/20',
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <Checkbox
                              checked={item.verified}
                              disabled={isVerifying || item.verified}
                              onCheckedChange={() => !item.verified && verifyItem(item)}
                              className="mt-0.5"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className={cn('text-sm font-medium', item.verified && 'text-emerald-700 dark:text-emerald-300')}>
                                  {item.itemName}
                                </span>
                                {item.required ? (
                                  <Badge variant="outline" className="text-[9px] uppercase text-red-600 dark:text-red-400">Required</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[9px] uppercase text-zinc-500">Optional</Badge>
                                )}
                                {isVerifying && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                              </div>
                              {item.verified && (item.verifiedBy || item.verifiedAt) && (
                                <p className="mt-1 text-[11px] text-muted-foreground">
                                  {item.verifiedBy && <>Verified by <span className="font-medium text-foreground">{item.verifiedBy}</span></>}
                                  {item.verifiedBy && item.verifiedAt && ' · '}
                                  {item.verifiedAt && timeAgo(item.verifiedAt)}
                                </p>
                              )}
                              {item.notes && !isEditing && (
                                <p className="mt-1 rounded bg-muted/50 p-1.5 text-[11px] text-muted-foreground">
                                  <StickyNote className="mr-1 inline h-3 w-3" />
                                  {item.notes}
                                </p>
                              )}
                              {isEditing ? (
                                <div className="mt-2 space-y-1.5">
                                  <Textarea
                                    value={notesDraft}
                                    onChange={(e) => setNotesDraft(e.target.value)}
                                    placeholder="Add notes (e.g. test result, link)"
                                    className="min-h-[60px] text-xs"
                                  />
                                  <div className="flex gap-1.5">
                                    <Button size="sm" onClick={() => saveNotes(item)} disabled={savingNotes} className="gap-1.5">
                                      {savingNotes ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                      Save
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => setEditingNotes(null)}>Cancel</Button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => { setEditingNotes(item.id); setNotesDraft(item.notes || '') }}
                                  className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                                >
                                  <Edit3 className="h-3 w-3" />
                                  {item.notes ? 'Edit note' : 'Add note'}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ===========================================================================
// TAB 4 — Pilot Elections
// ===========================================================================

function PilotsTab() {
  const [pilots, setPilots] = useState<PilotElection[]>([])
  const [stats, setStats] = useState<PilotStats | null>(null)
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const firstLoad = useRef(true)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await api.tqasgrPilots() as { pilots: PilotElection[]; stats: PilotStats }
      setPilots(res.pilots || [])
      setStats(res.stats || null)
      setError(null)
    } catch (e: any) {
      if (firstLoad.current || !silent) setError(e?.message || 'Failed to load pilot elections')
    } finally {
      setLoading(false)
      firstLoad.current = false
    }
  }, [])

  useEffect(() => {
    load()
    api.listOrganizations().then((r: any) => setOrgs(r.organizations || [])).catch(() => {})
  }, [load])

  // 30s auto-refresh
  useEffect(() => {
    const t = setInterval(() => load(true), 30_000)
    return () => clearInterval(t)
  }, [load])

  async function approveForGA(pilot: PilotElection) {
    setApprovingId(pilot.id)
    try {
      await api.tqasgrUpdatePilot(pilot.id, { approvedForGA: true })
      toast.success(`${pilot.name} approved for general availability`)
      await load(true)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to approve pilot')
    } finally {
      setApprovingId(null)
    }
  }

  if (loading) {
    return (
      <div>
        <TabHeaderCard
          icon={TestTube}
          title="Pilot Elections"
          description="Controlled small-scale elections before general availability. Monitor every metric."
        />
        <LoadingRow label="Loading pilot elections…" />
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <TabHeaderCard
          icon={TestTube}
          title="Pilot Elections"
          description="Controlled small-scale elections before general availability. Monitor every metric."
        />
        <ErrorState message={error} onRetry={() => load()} />
      </div>
    )
  }

  return (
    <div>
      <TabHeaderCard
        icon={TestTube}
        title="Pilot Elections"
        description="Controlled small-scale elections before general availability. Monitor every metric."
      />

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard icon={TestTube} label="Total" value={stats?.total ?? 0} accent="emerald" glow />
        <StatCard icon={Clock} label="Planned" value={stats?.planned ?? 0} accent="zinc" />
        <StatCard icon={Activity} label="Active" value={stats?.active ?? 0} accent="amber" pulse={(stats?.active ?? 0) > 0} />
        <StatCard icon={CheckCircle2} label="Completed" value={stats?.completed ?? 0} accent="emerald" />
        <StatCard icon={BadgeCheck} label="Approved for GA" value={stats?.approvedForGA ?? 0} accent="gold" />
      </div>

      {/* Create button */}
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setShowCreate(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> Create Pilot
        </Button>
      </div>

      {/* Pilot list */}
      {pilots.length === 0 ? (
        <EmptyState icon={TestTube} title="No pilot elections" hint="Create a pilot to start monitoring a controlled election." />
      ) : (
        <div className="max-h-[600px] space-y-4 overflow-y-auto votewise-scroll pr-1">
          {pilots.map((pilot) => {
            const metrics: PilotMetrics = pilot.metrics ? safeParseJSON<PilotMetrics>(pilot.metrics, {}) : {}
            const criteria: SuccessCriterion[] = pilot.successCriteria ? safeParseJSON<SuccessCriterion[]>(pilot.successCriteria, []) : []
            const expanded = expandedId === pilot.id
            return (
              <motion.div
                key={pilot.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Card className={cn(
                  'overflow-hidden',
                  pilot.status === 'ACTIVE' && 'ring-1 ring-amber-300/50 dark:ring-amber-700/50',
                  pilot.status === 'CANCELLED' && 'opacity-70',
                )}>
                  <CardContent className="p-4">
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-2">
                      <button onClick={() => setExpandedId(expanded ? null : pilot.id)} className="flex-1 text-left">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-display font-bold leading-tight">{pilot.name}</span>
                          {pilot.status === 'ACTIVE' && (
                            <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-amber-500" />
                          )}
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline" className={cn('text-[10px] uppercase', PILOT_TYPE_BADGE[pilot.type] || 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300')}>
                            {PILOT_TYPE_LABEL[pilot.type] || pilot.type}
                          </Badge>
                          <Badge variant="outline" className={cn('text-[10px] uppercase', PILOT_SCALE_BADGE[pilot.scale] || 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300')}>
                            {pilot.scale}
                          </Badge>
                          <Badge variant="outline" className={cn('text-[10px] uppercase', PILOT_STATUS_BADGE[pilot.status] || 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300')}>
                            {pilot.status}
                          </Badge>
                          {pilot.approvedForGA && (
                            <Badge className="text-[10px] uppercase bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 ring-1 ring-emerald-300/40 dark:ring-emerald-700/40">
                              <BadgeCheck className="mr-1 h-3 w-3" /> GA Approved
                            </Badge>
                          )}
                        </div>
                      </button>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {pilot.status === 'COMPLETED' && !pilot.approvedForGA && (
                          <Button
                            size="sm"
                            onClick={() => approveForGA(pilot)}
                            disabled={approvingId === pilot.id}
                            className="gap-1.5"
                          >
                            {approvingId === pilot.id
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <BadgeCheck className="h-3.5 w-3.5" />}
                            Approve for GA
                          </Button>
                        )}
                        <button
                          onClick={() => setExpandedId(expanded ? null : pilot.id)}
                          className="text-muted-foreground hover:text-foreground"
                          aria-label={expanded ? 'Collapse' : 'Expand'}
                        >
                          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Voters + dates */}
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <div className="rounded-lg bg-muted/40 p-2">
                        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                          <Users className="h-3 w-3" /> Expected
                        </div>
                        <div className="font-display text-sm font-bold">{formatNumber(pilot.expectedVoters)}</div>
                      </div>
                      <div className="rounded-lg bg-muted/40 p-2">
                        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                          <Users className="h-3 w-3" /> Actual
                        </div>
                        <div className="font-display text-sm font-bold">{formatNumber(pilot.actualVoters)}</div>
                      </div>
                      <div className="rounded-lg bg-muted/40 p-2">
                        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                          <Calendar className="h-3 w-3" /> Start
                        </div>
                        <div className="text-xs font-medium">{formatDate(pilot.startDate)}</div>
                      </div>
                      <div className="rounded-lg bg-muted/40 p-2">
                        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                          <Calendar className="h-3 w-3" /> End
                        </div>
                        <div className="text-xs font-medium">{formatDate(pilot.endDate)}</div>
                      </div>
                    </div>

                    {/* Metrics grid */}
                    {pilot.metrics && (
                      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <div className="rounded-lg border border-emerald-300/30 bg-emerald-500/5 p-2 dark:border-emerald-700/30 dark:bg-emerald-500/10">
                          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                            <TrendingUp className="h-3 w-3" /> Turnout
                          </div>
                          <div className="font-display text-sm font-bold text-emerald-700 dark:text-emerald-300">
                            {metrics.turnout != null ? `${metrics.turnout}%` : '—'}
                          </div>
                        </div>
                        <div className="rounded-lg border border-red-300/30 bg-red-500/5 p-2 dark:border-red-700/30 dark:bg-red-500/10">
                          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                            <XCircle className="h-3 w-3" /> Error Rate
                          </div>
                          <div className="font-display text-sm font-bold text-red-700 dark:text-red-300">
                            {metrics.errorRate != null ? `${metrics.errorRate}%` : '—'}
                          </div>
                        </div>
                        <div className="rounded-lg border border-amber-300/30 bg-amber-500/5 p-2 dark:border-amber-700/30 dark:bg-amber-500/10">
                          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                            <Gauge className="h-3 w-3" /> p95 Latency
                          </div>
                          <div className="font-display text-sm font-bold text-amber-700 dark:text-amber-300">
                            {metrics.p95Latency != null ? `${metrics.p95Latency}ms` : '—'}
                          </div>
                        </div>
                        <div className="rounded-lg border border-zinc-300/30 bg-zinc-500/5 p-2 dark:border-zinc-700/30 dark:bg-zinc-500/10">
                          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                            <ShieldAlert className="h-3 w-3" /> Incidents
                          </div>
                          <div className="font-display text-sm font-bold">
                            {metrics.incidents ?? 0}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Success criteria */}
                    {criteria.length > 0 && (
                      <div className="mt-3">
                        <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Success Criteria</p>
                        <div className="flex flex-wrap gap-1.5">
                          {criteria.map((c, i) => (
                            <Badge
                              key={i}
                              variant="outline"
                              className={cn(
                                'text-[10px] gap-1',
                                c.met
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                                  : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-400',
                              )}
                            >
                              {c.met ? <CheckCircle2 className="h-3 w-3" /> : <CircleSlash className="h-3 w-3" />}
                              {c.criterion}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Created by */}
                    {pilot.createdByName && (
                      <p className="mt-3 text-[11px] text-muted-foreground">
                        Created by <span className="font-medium text-foreground">{pilot.createdByName}</span> · {timeAgo(pilot.createdAt)}
                      </p>
                    )}

                    {/* Expandable lessons learned */}
                    <AnimatePresence>
                      {expanded && pilot.lessonsLearned && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-3 border-t border-border/60 pt-3">
                            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                              <Sparkles className="h-3 w-3" /> Lessons Learned
                            </p>
                            <p className="text-sm text-muted-foreground">{pilot.lessonsLearned}</p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Create dialog */}
      <PilotCreateDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        orgs={orgs}
        onCreated={() => { setShowCreate(false); load(true) }}
      />
    </div>
  )
}

function PilotCreateDialog({
  open, onOpenChange, orgs, onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  orgs: Organization[]
  onCreated: () => void
}) {
  const [form, setForm] = useState({
    name: '',
    type: 'student-association',
    scale: 'small',
    expectedVoters: '500',
    startDate: '',
    endDate: '',
    organizationId: '',
  })
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!form.name.trim()) { toast.error('Please enter a pilot name'); return }
    if (!form.organizationId) { toast.error('Please select an organization'); return }
    const ev = parseInt(form.expectedVoters, 10)
    if (!Number.isFinite(ev) || ev <= 0) { toast.error('Expected voters must be a positive number'); return }
    if (form.startDate && form.endDate && new Date(form.endDate) <= new Date(form.startDate)) {
      toast.error('End date must be after start date'); return
    }
    setBusy(true)
    try {
      await api.tqasgrCreatePilot({
        name: form.name.trim(),
        type: form.type,
        scale: form.scale,
        expectedVoters: ev,
        organizationId: form.organizationId,
        startDate: form.startDate ? new Date(form.startDate).toISOString() : undefined,
        endDate: form.endDate ? new Date(form.endDate).toISOString() : undefined,
      })
      toast.success('Pilot election created')
      setForm({ name: '', type: 'student-association', scale: 'small', expectedVoters: '500', startDate: '', endDate: '', organizationId: '' })
      onCreated()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to create pilot')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto votewise-scroll">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5 text-primary" /> Create Pilot Election
          </DialogTitle>
          <DialogDescription>
            Schedule a controlled small-scale election to validate the platform before general availability.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Pilot Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Faculty of Science SUG Pilot"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PILOT_TYPE_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Scale</Label>
              <Select value={form.scale} onValueChange={(v) => setForm((f) => ({ ...f, scale: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="micro">Micro (&lt; 500)</SelectItem>
                  <SelectItem value="small">Small (500–5k)</SelectItem>
                  <SelectItem value="medium">Medium (5k–50k)</SelectItem>
                  <SelectItem value="large">Large (&gt; 50k)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Expected Voters</Label>
            <Input
              type="number"
              min="1"
              value={form.expectedVoters}
              onChange={(e) => setForm((f) => ({ ...f, expectedVoters: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Organization</Label>
            <Select value={form.organizationId} onValueChange={(v) => setForm((f) => ({ ...f, organizationId: v }))}>
              <SelectTrigger><SelectValue placeholder="Select organization" /></SelectTrigger>
              <SelectContent>
                {orgs.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start Date</Label>
              <Input
                type="datetime-local"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>End Date</Label>
              <Input
                type="datetime-local"
                value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy} className="gap-1.5">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create Pilot
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ===========================================================================
// TAB 5 — Compliance
// ===========================================================================

function ComplianceTab() {
  const [frameworks, setFrameworks] = useState<ComplianceFramework[]>([])
  const [stats, setStats] = useState<ComplianceStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const firstLoad = useRef(true)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await api.tqasgrCompliance() as { frameworks: ComplianceFramework[]; stats: ComplianceStats }
      setFrameworks(res.frameworks || [])
      setStats(res.stats || null)
      setError(null)
    } catch (e: any) {
      if (firstLoad.current || !silent) setError(e?.message || 'Failed to load compliance frameworks')
    } finally {
      setLoading(false)
      firstLoad.current = false
    }
  }, [])

  useEffect(() => { load() }, [load])

  // 60s auto-refresh
  useEffect(() => {
    const t = setInterval(() => load(true), 60_000)
    return () => clearInterval(t)
  }, [load])

  if (loading) {
    return (
      <div>
        <TabHeaderCard
          icon={Award}
          title="Compliance Certification"
          description="Prepare for ISO 27001, SOC 2, GDPR, NDPR. Maintain evidence and audit records."
        />
        <LoadingRow label="Loading compliance frameworks…" />
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <TabHeaderCard
          icon={Award}
          title="Compliance Certification"
          description="Prepare for ISO 27001, SOC 2, GDPR, NDPR. Maintain evidence and audit records."
        />
        <ErrorState message={error} onRetry={() => load()} />
      </div>
    )
  }

  return (
    <div>
      <TabHeaderCard
        icon={Award}
        title="Compliance Certification"
        description="Prepare for ISO 27001, SOC 2, GDPR, NDPR. Maintain evidence and audit records."
      />

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Award} label="Total Frameworks" value={stats?.total ?? 0} accent="emerald" glow />
        <StatCard icon={BadgeCheck} label="Certified" value={stats?.certified ?? 0} accent="emerald" />
        <StatCard icon={Loader2} label="In Progress" value={stats?.inProgress ?? 0} accent="amber" />
        <StatCard icon={CircleSlash} label="Not Started" value={stats?.notStarted ?? 0} accent="zinc" />
      </div>

      {/* Framework list */}
      {frameworks.length === 0 ? (
        <EmptyState icon={Award} title="No compliance frameworks" hint="Frameworks are seeded automatically. Try refreshing." />
      ) : (
        <div className="max-h-[600px] space-y-4 overflow-y-auto votewise-scroll pr-1">
          {frameworks.map((fw) => {
            const evidence: ComplianceEvidence[] = fw.evidence ? safeParseJSON<ComplianceEvidence[]>(fw.evidence, []) : []
            const progressPct = fw.totalControls > 0 ? Math.round((fw.metControls / fw.totalControls) * 100) : 0
            const daysToExpiry = daysUntil(fw.validUntil)
            const expiringSoon = fw.status === 'certified' && daysToExpiry != null && daysToExpiry < 60 && daysToExpiry >= 0
            const expired = fw.status === 'expired' || (daysToExpiry != null && daysToExpiry < 0)
            const expanded = expandedId === fw.id
            return (
              <motion.div
                key={fw.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Card className={cn(
                  'overflow-hidden',
                  fw.status === 'certified' && 'ring-1 ring-emerald-300/40 dark:ring-emerald-700/40',
                  expired && 'ring-1 ring-red-400/40 dark:ring-red-800/40',
                )}>
                  <CardContent className="p-4">
                    {/* Header */}
                    <button onClick={() => setExpandedId(expanded ? null : fw.id)} className="flex w-full items-start justify-between gap-2 text-left">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-display text-lg font-bold leading-tight">{fw.name}</span>
                          <Badge variant="outline" className={cn('text-[10px] uppercase', COMPLIANCE_STATUS_BADGE[fw.status] || 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300')}>
                            {COMPLIANCE_STATUS_LABEL[fw.status] || fw.status}
                          </Badge>
                          {expiringSoon && (
                            <Badge variant="outline" className="text-[10px] uppercase bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 ring-1 ring-amber-300/40 dark:ring-amber-700/40">
                              <AlertTriangle className="mr-1 h-3 w-3" /> Expires in {daysToExpiry}d
                            </Badge>
                          )}
                          {expired && fw.status === 'certified' && (
                            <Badge variant="outline" className="text-[10px] uppercase bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300">
                              <XCircle className="mr-1 h-3 w-3" /> Expired
                            </Badge>
                          )}
                        </div>
                        {fw.description && (
                          <p className="mt-1 text-sm text-muted-foreground">{fw.description}</p>
                        )}
                      </div>
                      <div className="shrink-0 text-muted-foreground">
                        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </div>
                    </button>

                    {/* Progress */}
                    <div className="mt-3">
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-muted-foreground">Controls Met</span>
                        <span className="text-xs font-bold">{fw.metControls} / {fw.totalControls} ({progressPct}%)</span>
                      </div>
                      <Progress
                        value={progressPct}
                        className={cn(
                          'h-2.5',
                          progressPct === 100 ? '[&>div]:bg-emerald-500' : progressPct >= 50 ? '[&>div]:bg-amber-500' : '[&>div]:bg-red-500',
                        )}
                      />
                    </div>

                    {/* Meta */}
                    <div className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
                      {fw.certifyingBody && (
                        <div>
                          <span className="text-muted-foreground">Certifying body: </span>
                          <span className="font-medium">{fw.certifyingBody}</span>
                        </div>
                      )}
                      {fw.validFrom && (
                        <div>
                          <span className="text-muted-foreground">Valid from: </span>
                          <span className="font-medium">{formatDate(fw.validFrom)}</span>
                        </div>
                      )}
                      {fw.validUntil && (
                        <div>
                          <span className="text-muted-foreground">Valid until: </span>
                          <span className={cn('font-medium', expiringSoon && 'text-amber-600 dark:text-amber-400', expired && 'text-red-600 dark:text-red-400')}>
                            {formatDate(fw.validUntil)}
                          </span>
                        </div>
                      )}
                    </div>

                    {fw.certificateUrl && (
                      <a
                        href={fw.certificateUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" /> View certificate
                      </a>
                    )}

                    {/* Expandable evidence */}
                    <AnimatePresence>
                      {expanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-3 border-t border-border/60 pt-3">
                            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                              <FileText className="h-3 w-3" /> Evidence ({evidence.length} controls)
                            </p>
                            {evidence.length === 0 ? (
                              <p className="py-2 text-center text-xs text-muted-foreground">No evidence recorded.</p>
                            ) : (
                              <div className="space-y-1.5">
                                {evidence.map((ev, i) => {
                                  const meta = EVIDENCE_STATUS_META[ev.status] || EVIDENCE_STATUS_META['not-met']
                                  const StatusIcon = meta.icon
                                  return (
                                    <div
                                      key={i}
                                      className={cn(
                                        'rounded-lg border p-2.5',
                                        ev.status === 'met' && 'border-emerald-300/40 bg-emerald-500/5 dark:border-emerald-700/40 dark:bg-emerald-500/10',
                                        ev.status === 'in-progress' && 'border-amber-300/40 bg-amber-500/5 dark:border-amber-700/40 dark:bg-amber-500/10',
                                        ev.status === 'not-met' && 'border-red-300/40 bg-red-500/5 dark:border-red-700/40 dark:bg-red-500/10',
                                      )}
                                    >
                                      <div className="flex items-start gap-2">
                                        <StatusIcon className={cn(
                                          'mt-0.5 h-4 w-4 shrink-0',
                                          ev.status === 'met' && 'text-emerald-500',
                                          ev.status === 'in-progress' && 'text-amber-500',
                                          ev.status === 'not-met' && 'text-red-500',
                                        )} />
                                        <div className="min-w-0 flex-1">
                                          <div className="flex flex-wrap items-center gap-1.5">
                                            <span className="text-sm font-medium leading-tight">{ev.control}</span>
                                            <Badge variant="outline" className={cn('text-[9px] uppercase', meta.badge)}>{meta.label}</Badge>
                                          </div>
                                          <p className="mt-1 text-xs text-muted-foreground">{ev.evidence}</p>
                                          <p className="mt-0.5 text-[10px] text-muted-foreground">Last reviewed: {formatDate(ev.lastReviewed)}</p>
                                        </div>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ===========================================================================
// TAB 6 — Certifications
// ===========================================================================

function CertificationsTab() {
  const [seals, setSeals] = useState<CertificationSeal[]>([])
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const firstLoad = useRef(true)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await api.tqasgrCertifications() as { seals: CertificationSeal[] }
      setSeals(res.seals || [])
      setError(null)
    } catch (e: any) {
      if (firstLoad.current || !silent) setError(e?.message || 'Failed to load certifications')
    } finally {
      setLoading(false)
      firstLoad.current = false
    }
  }, [])

  useEffect(() => {
    load()
    api.listOrganizations().then((r: any) => setOrgs(r.organizations || [])).catch(() => {})
  }, [load])

  // 30s auto-refresh
  useEffect(() => {
    const t = setInterval(() => load(true), 30_000)
    return () => clearInterval(t)
  }, [load])

  if (loading) {
    return (
      <div>
        <TabHeaderCard
          icon={BadgeCheck}
          title="VoteWise Certification Seal"
          description="Every completed election can receive a digitally signed certification package with a verifiable Certification ID."
        />
        <LoadingRow label="Loading certifications…" />
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <TabHeaderCard
          icon={BadgeCheck}
          title="VoteWise Certification Seal"
          description="Every completed election can receive a digitally signed certification package with a verifiable Certification ID."
        />
        <ErrorState message={error} onRetry={() => load()} />
      </div>
    )
  }

  return (
    <div>
      <TabHeaderCard
        icon={BadgeCheck}
        title="VoteWise Certification Seal"
        description="Every completed election can receive a digitally signed certification package with a verifiable Certification ID."
      />

      {/* Issue button */}
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setShowCreate(true)} className="gap-1.5">
          <Stamp className="h-4 w-4" /> Issue Certification
        </Button>
      </div>

      {/* Certification list */}
      {seals.length === 0 ? (
        <EmptyState icon={BadgeCheck} title="No certifications issued" hint="Issue a certification seal for a completed election to get started." />
      ) : (
        <div className="max-h-[600px] space-y-4 overflow-y-auto votewise-scroll pr-1">
          {seals.map((seal) => (
            <motion.div
              key={seal.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Card className={cn(
                'overflow-hidden',
                seal.status === 'CERTIFIED' && 'ring-1 ring-emerald-300/40 dark:ring-emerald-700/40',
                seal.status === 'REVOKED' && 'ring-1 ring-red-400/40 dark:ring-red-800/40 opacity-80',
              )}>
                <CardContent className="p-4">
                  {/* Certification ID + status */}
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                        <Hash className="h-3 w-3" /> Certification ID
                      </div>
                      <div className="font-mono text-lg font-bold leading-tight tracking-tight">{seal.certificationId}</div>
                    </div>
                    <Badge className={cn('text-[10px] uppercase', CERT_STATUS_BADGE[seal.status] || 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300')}>
                      {seal.status}
                    </Badge>
                  </div>

                  {/* Election + org */}
                  <div className="mt-3">
                    <p className="font-display text-base font-bold leading-tight">{seal.electionName}</p>
                    {seal.organizationName && (
                      <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                        <Building2 className="h-3.5 w-3.5" /> {seal.organizationName}
                      </p>
                    )}
                  </div>

                  {/* Stats grid */}
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <div className="rounded-lg bg-muted/40 p-2">
                      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                        <ShieldCheck className="h-3 w-3" /> Integrity
                      </div>
                      <div className="font-display text-sm font-bold text-emerald-700 dark:text-emerald-300">
                        {seal.integrityScore.toFixed(2)}%
                      </div>
                    </div>
                    <div className="rounded-lg bg-muted/40 p-2">
                      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                        <Users className="h-3 w-3" /> Votes Verified
                      </div>
                      <div className="font-display text-sm font-bold">{formatNumber(seal.votesVerified)}</div>
                    </div>
                    <div className="rounded-lg bg-muted/40 p-2">
                      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                        <Clock className="h-3 w-3" /> Certified At
                      </div>
                      <div className="text-xs font-medium">{formatDate(seal.certifiedAt)}</div>
                    </div>
                  </div>

                  {/* Audit + observer flags */}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {seal.auditLogsComplete ? (
                      <Badge variant="outline" className="text-[10px] gap-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                        <CheckCircle2 className="h-3 w-3" /> Audit Logs Complete
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] gap-1 bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300">
                        <XCircle className="h-3 w-3" /> Audit Logs Incomplete
                      </Badge>
                    )}
                    {seal.observerReportsComplete ? (
                      <Badge variant="outline" className="text-[10px] gap-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                        <CheckCircle2 className="h-3 w-3" /> Observer Reports Complete
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] gap-1 bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300">
                        <XCircle className="h-3 w-3" /> Observer reports incomplete
                      </Badge>
                    )}
                  </div>

                  {/* Security incidents */}
                  {seal.securityIncidents && seal.securityIncidents !== 'None Critical' && (
                    <p className="mt-2 rounded bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
                      <ShieldAlert className="mr-1 inline h-3 w-3" />
                      Security incidents: {seal.securityIncidents}
                    </p>
                  )}

                  {/* Revocation notice */}
                  {seal.status === 'REVOKED' && (
                    <p className="mt-2 rounded bg-red-500/10 p-2 text-xs text-red-700 dark:text-red-300">
                      <Ban className="mr-1 inline h-3 w-3" />
                      Revoked on {formatDate(seal.revokedAt)}{seal.revokeReason ? `: ${seal.revokeReason}` : ''}
                    </p>
                  )}

                  {/* Certified by */}
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Certified by <span className="font-medium text-foreground">{seal.certifiedBy}</span>
                  </p>

                  {/* Actions */}
                  <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-3">
                    <Button asChild size="sm" variant="default" className="gap-1.5">
                      <Link href={`/certify/${encodeURIComponent(seal.certificationId)}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" /> Verify
                      </Link>
                    </Button>
                    <CopyButton text={`${typeof window !== 'undefined' ? window.location.origin : ''}/certify/${encodeURIComponent(seal.certificationId)}`} size="sm" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Issue dialog */}
      <CertificationCreateDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        orgs={orgs}
        onCreated={() => { setShowCreate(false); load(true) }}
      />

    </div>
  )
}

function CertificationCreateDialog({
  open, onOpenChange, orgs, onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  orgs: Organization[]
  onCreated: () => void
}) {
  const [form, setForm] = useState({
    electionId: '',
    electionName: '',
    organizationId: '',
    organizationName: '',
    integrityScore: '99.98',
    votesVerified: '0',
    securityIncidents: 'None Critical',
    auditLogsComplete: true,
    observerReportsComplete: true,
  })
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!form.electionId.trim()) { toast.error('Please enter an election ID'); return }
    if (!form.electionName.trim()) { toast.error('Please enter an election name'); return }
    const score = parseFloat(form.integrityScore)
    if (!Number.isFinite(score) || score < 0 || score > 100) { toast.error('Integrity score must be 0–100'); return }
    const votes = parseInt(form.votesVerified, 10)
    if (!Number.isFinite(votes) || votes < 0) { toast.error('Votes verified must be a non-negative number'); return }
    setBusy(true)
    try {
      const org = orgs.find((o) => o.id === form.organizationId)
      await api.tqasgrIssueCertification({
        electionId: form.electionId.trim(),
        electionName: form.electionName.trim(),
        organizationId: form.organizationId || undefined,
        organizationName: org?.name || form.organizationName || undefined,
        integrityScore: score,
        votesVerified: votes,
        securityIncidents: form.securityIncidents,
        auditLogsComplete: form.auditLogsComplete,
        observerReportsComplete: form.observerReportsComplete,
      })
      toast.success('Certification seal issued')
      setForm({
        electionId: '', electionName: '', organizationId: '', organizationName: '',
        integrityScore: '99.98', votesVerified: '0', securityIncidents: 'None Critical',
        auditLogsComplete: true, observerReportsComplete: true,
      })
      onCreated()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to issue certification')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto votewise-scroll">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Stamp className="h-5 w-5 text-primary" /> Issue Certification Seal
          </DialogTitle>
          <DialogDescription>
            Issue a digitally-signed certification for a completed election. The seal gets a unique Certification ID (VW-YYYY-NNNNNN) verifiable at /certify/[id].
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Election ID</Label>
            <Input
              value={form.electionId}
              onChange={(e) => setForm((f) => ({ ...f, electionId: e.target.value }))}
              placeholder="e.g. election_abc123"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Election Name</Label>
            <Input
              value={form.electionName}
              onChange={(e) => setForm((f) => ({ ...f, electionName: e.target.value }))}
              placeholder="e.g. SUG General Elections 2025"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Organization</Label>
            <Select value={form.organizationId} onValueChange={(v) => setForm((f) => ({ ...f, organizationId: v }))}>
              <SelectTrigger><SelectValue placeholder="Select organization (optional)" /></SelectTrigger>
              <SelectContent>
                {orgs.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Integrity Score</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.integrityScore}
                onChange={(e) => setForm((f) => ({ ...f, integrityScore: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Votes Verified</Label>
              <Input
                type="number"
                min="0"
                value={form.votesVerified}
                onChange={(e) => setForm((f) => ({ ...f, votesVerified: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Security Incidents</Label>
            <Input
              value={form.securityIncidents}
              onChange={(e) => setForm((f) => ({ ...f, securityIncidents: e.target.value }))}
              placeholder="e.g. None Critical"
            />
          </div>
          <div className="flex flex-col gap-2 rounded-lg border border-border/60 p-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.auditLogsComplete}
                onCheckedChange={(v) => setForm((f) => ({ ...f, auditLogsComplete: !!v }))}
              />
              Audit logs complete
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.observerReportsComplete}
                onCheckedChange={(v) => setForm((f) => ({ ...f, observerReportsComplete: !!v }))}
              />
              Observer reports complete
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy} className="gap-1.5">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Stamp className="h-4 w-4" />}
            Issue Seal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Utility — safe JSON parse
// ---------------------------------------------------------------------------

function safeParseJSON<T>(s: string | null, fallback: T): T {
  if (!s) return fallback
  try {
    return JSON.parse(s) as T
  } catch {
    return fallback
  }
}
