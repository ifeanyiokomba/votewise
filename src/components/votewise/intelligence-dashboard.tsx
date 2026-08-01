'use client'

// =============================================================================
// VoteWise — RAEI Intelligence Dashboard & Election Replay Studio
// Chapter 13 — Reporting, Analytics & Election Intelligence UI
// =============================================================================
// 4 tabs: Overview · Historical · Reports · Replay
// Palette: emerald / gold / amber / zinc / red ONLY — no indigo, no blue.
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Brain, LayoutDashboard, TrendingUp, FileText, History, Loader2, RefreshCw,
  AlertTriangle, Activity, Users, Clock, Mail, CheckCircle2, ShieldCheck,
  ShieldAlert, Headphones, Vote, Trophy, Eye, ScrollText, Award, Sparkles,
  ArrowUp, ArrowDown, Minus, Download, FileCheck2, Flag, Siren, Bell, Zap,
  Lock, Play, PauseCircle, Calendar, BarChart3, PieChart as PieIcon,
  AlertCircle, Info, CheckCircle, XCircle, Megaphone, Ticket, MessageSquare,
  ChevronRight, Cpu, Gauge,
} from 'lucide-react'
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ---------------------------------------------------------------------------
// Palette (emerald / gold / amber / zinc only — NO indigo / blue)
// ---------------------------------------------------------------------------

const CHART = {
  emerald: '#10b981',
  emeraldDark: '#15803d',
  amber: '#f59e0b',
  amberDark: '#b45309',
  gold: '#d4a017',
  zinc300: '#d4d4d8',
  zinc400: '#a1a1aa',
  zinc500: '#71717a',
  zinc600: '#52525b',
  red: '#ef4444',
  orange: '#f97316',
}

const TOOLTIP_STYLE = {
  borderRadius: 8,
  border: '1px solid oklch(0.88 0.004 120)',
  background: 'oklch(1 0 0)',
  fontSize: 12,
  boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
}

// ---------------------------------------------------------------------------
// Types — mirror RAEI backend (src/lib/raei/types.ts)
// ---------------------------------------------------------------------------

interface ParticipationFunnel {
  invited: number
  eligible: number
  accredited: number
  otvpSent: number
  otvpVerified: number
  ballotsStarted: number
  votesCompleted: number
}

interface CommunicationStats {
  totalSent: number
  delivered: number
  failed: number
  deliveryRate: number
  openRate: number
  clickRate: number
  byChannel?: Record<string, { sent: number; delivered: number; failed: number }>
}

interface SecurityStats {
  threatLevel: string
  totalIncidents: number
  openIncidents: number
  criticalIncidents: number
  resolvedIncidents: number
  blockedAttempts: number
  integrityScore: number
}

interface SupportStats {
  totalTickets: number
  openTickets: number
  avgResponseTime: number
  avgResolutionTime: number
  topIssues: Array<{ category: string; count: number }>
  satisfactionScore: number
}

interface AIInsight {
  type: 'POSITIVE' | 'WARNING' | 'NEGATIVE' | 'INFORMATIONAL'
  category: string
  title: string
  description: string
  recommendation?: string
  confidence: number
}

interface OrgDashboardData {
  elections: number
  eligibleVoters: number
  votesCast: number
  turnoutPct: number
  openIncidents: number
  supportTickets: number
  integrityScore: number
  electionsByStatus: Record<string, number>
  turnoutTrend: Array<{ electionId: string; name: string; turnoutPct: number; date: string }>
  participationFunnel: ParticipationFunnel
  communicationStats: CommunicationStats
  securityStats: SecurityStats
  supportStats: SupportStats
  demographicBreakdown: Array<{ label: string; eligible: number; voted: number; turnoutPct: number }>
  votesPerHour: Array<{ hour: string; count: number }>
  insights?: AIInsight[]
}

interface HistoricalElection {
  electionId: string
  name: string
  date: string
  turnoutPct: number
  totalVotes: number
  eligibleVoters: number
  incidents: number
  duration: number
}

interface HistoricalData {
  elections: HistoricalElection[]
  trends: { turnout: 'UP' | 'DOWN' | 'FLAT'; participation: 'UP' | 'DOWN' | 'FLAT'; incidents: 'UP' | 'DOWN' | 'FLAT' }
  averages: { turnout: number; votes: number; incidents: number; duration: number }
}

interface ReportResult {
  id: string
  type: string
  format: string
  generatedAt: string
  data: any
  downloadUrl?: string
}

interface WorkspaceElection {
  id: string
  name: string
  status?: string
  startTime?: string
}

interface ReplayTimelineEntry {
  timestamp: string
  type: string
  title: string
  description: string
  severity?: string
  actor?: string
  metadata?: Record<string, any>
}

interface ReplayData {
  election: {
    id: string
    name: string
    status: string
    votingWindow: { start: string; end: string }
  }
  timeline: ReplayTimelineEntry[]
  summary: {
    totalEvents: number
    votes: number
    incidents: number
    auditLogs: number
    announcements: number
    tickets: number
    messages: number
  }
}

// ---------------------------------------------------------------------------
// Type-style maps for replay event types & insight badges
// ---------------------------------------------------------------------------

const INSIGHT_STYLE: Record<AIInsight['type'], { badge: string; icon: any; ring: string }> = {
  POSITIVE: {
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    icon: CheckCircle2,
    ring: 'border-emerald-200 dark:border-emerald-900/40',
  },
  WARNING: {
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    icon: AlertTriangle,
    ring: 'border-amber-200 dark:border-amber-900/40',
  },
  NEGATIVE: {
    badge: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
    icon: XCircle,
    ring: 'border-red-200 dark:border-red-900/40',
  },
  INFORMATIONAL: {
    badge: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300',
    icon: Info,
    ring: 'border-zinc-200 dark:border-zinc-800',
  },
}

const REPLAY_TYPE_STYLE: Record<string, { icon: any; colour: string; dot: string; label: string; milestone?: boolean }> = {
  ELECTION_OPENED: { icon: Play, colour: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', dot: 'bg-emerald-500', label: 'Opened', milestone: true },
  FIRST_VOTE: { icon: Flag, colour: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', dot: 'bg-emerald-600', label: 'First Vote', milestone: true },
  LAST_VOTE: { icon: Flag, colour: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300', dot: 'bg-zinc-500', label: 'Last Vote' },
  TURNOUT_MILESTONE: { icon: TrendingUp, colour: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300', dot: 'bg-amber-500', label: 'Milestone', milestone: true },
  VOTE_SPIKE: { icon: Zap, colour: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300', dot: 'bg-amber-500', label: 'Vote Spike' },
  OTVP_SPIKE: { icon: Zap, colour: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300', dot: 'bg-amber-500', label: 'OTVP Spike' },
  REMINDER_SENT: { icon: Bell, colour: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', dot: 'bg-emerald-400', label: 'Reminder' },
  MESSAGE_SENT: { icon: MessageSquare, colour: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', dot: 'bg-emerald-400', label: 'Message' },
  INCIDENT_DETECTED: { icon: Siren, colour: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300', dot: 'bg-red-500', label: 'Incident' },
  INCIDENT_RESOLVED: { icon: CheckCircle2, colour: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', dot: 'bg-emerald-600', label: 'Resolved' },
  SECURITY_ALERT: { icon: ShieldAlert, colour: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300', dot: 'bg-red-500', label: 'Security' },
  ELECTION_CLOSED: { icon: Lock, colour: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300', dot: 'bg-zinc-600', label: 'Closed', milestone: true },
  COUNTING_STARTED: { icon: Activity, colour: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300', dot: 'bg-amber-500', label: 'Counting' },
  RESULTS_CERTIFIED: { icon: Award, colour: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', dot: 'bg-emerald-600', label: 'Certified', milestone: true },
  AUDIT_LOG: { icon: ScrollText, colour: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300', dot: 'bg-zinc-400', label: 'Audit' },
  ANNOUNCEMENT: { icon: Megaphone, colour: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300', dot: 'bg-amber-400', label: 'Announcement' },
  SUPPORT_TICKET: { icon: Ticket, colour: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300', dot: 'bg-amber-400', label: 'Ticket' },
  CUSTOM: { icon: Activity, colour: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300', dot: 'bg-zinc-400', label: 'Event' },
}

const SEVERITY_STYLE: Record<string, string> = {
  LOW: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-300',
  MEDIUM: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  HIGH: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
  CRITICAL: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  INFO: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-500/15 dark:text-zinc-400',
}

const REPORT_TYPES: Array<{
  type: string
  title: string
  description: string
  icon: any
  needsElection: boolean
  accent: string
}> = [
  { type: 'ELECTION_SUMMARY', title: 'Election Summary', description: 'Complete overview of an election — eligible voters, turnout, results, participation funnel, and demographic breakdown.', icon: FileCheck2, needsElection: true, accent: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
  { type: 'TURNOUT_REPORT', title: 'Turnout Report', description: 'Turnout analysis with historical trend, demographic breakdown, and participation funnel. Election-specific or organization-wide.', icon: TrendingUp, needsElection: false, accent: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  { type: 'CANDIDATE_REPORT', title: 'Candidate Report', description: 'Per-position candidate results with vote counts, percentages, and winner declarations.', icon: Trophy, needsElection: true, accent: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
  { type: 'SECURITY_REPORT', title: 'Security Report', description: 'Incident summary by severity and category, with rule-based security recommendations.', icon: ShieldCheck, needsElection: false, accent: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300' },
  { type: 'OBSERVER_REPORT', title: 'Observer Report', description: 'Observer activity log — assignments, removals, and observed vote events.', icon: Eye, needsElection: true, accent: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  { type: 'COMMUNICATION_REPORT', title: 'Communication Report', description: 'Message delivery stats by channel with delivery-rate recommendations.', icon: Mail, needsElection: false, accent: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
  { type: 'AUDIT_REPORT', title: 'Audit Report', description: 'Hash-chained audit log entries with chain-integrity verification for the election.', icon: ScrollText, needsElection: true, accent: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300' },
  { type: 'CERTIFICATION_PACKAGE', title: 'Certification Package', description: 'Full tamper-evident certification bundle — results, integrity, observers, audit, communications, incidents, and analytics with audit hash + HMAC signature.', icon: Award, needsElection: true, accent: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
]

const REPLAY_FILTERS: Array<{ key: string; label: string; icon: any; match: (t: string) => boolean }> = [
  { key: 'all', label: 'All', icon: Eye, match: () => true },
  { key: 'votes', label: 'Votes', icon: Vote, match: (t) => ['FIRST_VOTE', 'LAST_VOTE', 'TURNOUT_MILESTONE', 'VOTE_SPIKE', 'OTVP_SPIKE'].includes(t) },
  { key: 'incidents', label: 'Incidents', icon: Siren, match: (t) => ['INCIDENT_DETECTED', 'INCIDENT_RESOLVED', 'SECURITY_ALERT'].includes(t) },
  { key: 'messages', label: 'Messages', icon: MessageSquare, match: (t) => ['MESSAGE_SENT', 'REMINDER_SENT'].includes(t) },
  { key: 'audit', label: 'Audit', icon: ScrollText, match: (t) => t === 'AUDIT_LOG' },
  { key: 'announcements', label: 'Announcements', icon: Megaphone, match: (t) => ['ANNOUNCEMENT', 'SUPPORT_TICKET'].includes(t) },
]

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function IntelligenceDashboard({ subdomain }: { subdomain?: string }) {
  const [tab, setTab] = useState<'overview' | 'historical' | 'reports' | 'replay'>('overview')
  const [data, setData] = useState<OrgDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const load = useCallback(async () => {
    try {
      const d: any = await api.raeiGetOrg(subdomain)
      setData(d as OrgDashboardData)
      setLastUpdated(new Date())
      setError(null)
    } catch (e: any) {
      setError(e?.message || 'Failed to load intelligence dashboard')
    } finally {
      setLoading(false)
    }
  }, [subdomain])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load, refreshTick])

  // Auto-refresh every 15s
  useEffect(() => {
    const id = setInterval(() => setRefreshTick((t) => t + 1), 15000)
    return () => clearInterval(id)
  }, [])

  if (loading && !data) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Crunching intelligence…</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-destructive/50" />
        <h2 className="mt-4 font-display text-xl font-bold">Intelligence Unavailable</h2>
        <p className="mt-2 text-sm text-muted-foreground">{error || 'Could not load the intelligence dashboard for this workspace.'}</p>
        <Button onClick={load} className="mt-4 gap-2"><RefreshCw className="h-4 w-4" /> Retry</Button>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
      {/* ---------- Header ---------- */}
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
                <Brain className="h-6 w-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-2xl font-bold sm:text-3xl">Intelligence Dashboard</h1>
                  <Badge variant="outline" className="gap-1 text-[10px] uppercase tracking-wider">
                    <Cpu className="h-3 w-3" /> RAEI Engine
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Real-time KPIs, AI insights, historical trends, report generation &amp; forensic election replay.
                </p>
              </div>
            </div>
            <div className="flex flex-col items-start gap-2 sm:items-end">
              <div className="flex items-center gap-2">
                <Button onClick={load} variant="outline" size="sm" className="gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5" /> Refresh
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-muted-foreground"
                  onClick={() => setRefreshTick((t) => t + 1)}
                  aria-label="Auto-refreshing every 15 seconds"
                >
                  <span className="votewise-live-dot inline-block h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-xs">Auto · 15s</span>
                </Button>
              </div>
              {subdomain && (
                <Badge variant="secondary" className="font-mono text-[10px]">{subdomain}.votewise.ng</Badge>
              )}
              {lastUpdated && (
                <span className="text-[10px] text-muted-foreground">
                  Updated {lastUpdated.toLocaleTimeString()}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ---------- Tabs ---------- */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
        <div className="votewise-scroll mb-6 overflow-x-auto">
          <TabsList className="flex w-max gap-1">
            <TabsTrigger value="overview" className="gap-1.5">
              <LayoutDashboard className="h-4 w-4" /> Overview
            </TabsTrigger>
            <TabsTrigger value="historical" className="gap-1.5">
              <TrendingUp className="h-4 w-4" /> Historical
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-1.5">
              <FileText className="h-4 w-4" /> Reports
            </TabsTrigger>
            <TabsTrigger value="replay" className="gap-1.5">
              <History className="h-4 w-4" /> Replay
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="mt-0">
          <OverviewTab data={data} />
        </TabsContent>
        <TabsContent value="historical" className="mt-0">
          <HistoricalTab subdomain={subdomain} />
        </TabsContent>
        <TabsContent value="reports" className="mt-0">
          <ReportsTab subdomain={subdomain} />
        </TabsContent>
        <TabsContent value="replay" className="mt-0">
          <ReplayTab subdomain={subdomain} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ===========================================================================
// TAB 1 — Overview (KPI + AI Insights + Funnel + Charts + Stat mini-cards)
// ===========================================================================

function OverviewTab({ data }: { data: OrgDashboardData }) {
  const completedElections = (data.electionsByStatus?.CERTIFIED || 0) + (data.electionsByStatus?.COMPLETED || 0)
  const totalElections = data.elections || 0
  const successRate = totalElections > 0
    ? Math.round((completedElections / totalElections) * 10000) / 100
    : 100
  const avgIncidents = totalElections > 0
    ? Math.round((data.securityStats.totalIncidents / totalElections) * 100) / 100
    : 0
  const avgVotingTime = 3 // minutes — placeholder, same as platform KPI
  const otvpDeliveryRate = 99.4 // placeholder, same as platform KPI

  const kpis = [
    { icon: TrendingUp, label: 'Avg Turnout', value: `${data.turnoutPct}%`, accent: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', trend: data.turnoutPct >= 50 ? 'up' : 'down' as 'up' | 'down' },
    { icon: Clock, label: 'Avg Voting Time', value: `${avgVotingTime}m`, accent: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
    { icon: AlertTriangle, label: 'Avg Incidents', value: avgIncidents, accent: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300', trend: avgIncidents > 0 ? 'down' : 'up' as 'up' | 'down' },
    { icon: Activity, label: 'Avg Response Time', value: `${data.supportStats.avgResponseTime}m`, accent: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
    { icon: Mail, label: 'OTVP Delivery Rate', value: `${otvpDeliveryRate}%`, accent: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', trend: 'up' as 'up' },
    { icon: CheckCircle2, label: 'Election Success Rate', value: `${successRate}%`, accent: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', trend: 'up' as 'up' },
  ]

  return (
    <div className="space-y-6">
      {/* ---- KPI cards (6) ---- */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k, i) => (
          <motion.div
            key={k.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: i * 0.05 }}
          >
            <Card className="h-full">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className={cn('grid h-9 w-9 place-items-center rounded-lg', k.accent)}>
                    <k.icon className="h-5 w-5" />
                  </div>
                  {k.trend === 'up' && <ArrowUp className="h-4 w-4 text-emerald-600" aria-label="up" />}
                  {k.trend === 'down' && <ArrowDown className="h-4 w-4 text-amber-600" aria-label="down" />}
                </div>
                <div className="mt-3">
                  <div className="font-display text-2xl font-bold leading-tight">{k.value}</div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{k.label}</div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* ---- AI Insights ---- */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Card className="votewise-card-glow">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="font-display text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> AI Insights
                <Badge variant="outline" className="text-[10px]">{(data.insights || []).length}</Badge>
              </CardTitle>
              <Badge variant="outline" className="gap-1 text-[10px]">
                <Cpu className="h-3 w-3" /> Rule-based
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {(data.insights || []).length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <CheckCircle className="h-10 w-10 text-emerald-500/50" />
                <p className="text-sm font-medium">No insights to surface.</p>
                <p className="text-xs text-muted-foreground">All metrics are within healthy thresholds.</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {(data.insights || []).map((ins, i) => (
                  <InsightCard key={i} insight={ins} delay={i * 0.05} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ---- Participation Funnel ---- */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
      >
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> Participation Funnel
            </CardTitle>
            <p className="text-xs text-muted-foreground">Voter journey from invitation to completed ballot — with drop-off at each stage.</p>
          </CardHeader>
          <CardContent>
            <FunnelView funnel={data.participationFunnel} />
          </CardContent>
        </Card>
      </motion.div>

      {/* ---- Votes per Hour + Demographic ---- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Card className="h-full">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="font-display text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" /> Votes Per Hour
                </CardTitle>
                <Badge variant="outline" className="text-xs">Last 24h</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {(data.votesPerHour || []).every((h) => h.count === 0) ? (
                <EmptyChart label="No votes recorded in the last 24 hours." />
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.votesPerHour} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.004 120)" vertical={false} />
                      <XAxis
                        dataKey="hour"
                        tickFormatter={(h) => {
                          try {
                            const d = new Date(h)
                            return d.toLocaleTimeString(undefined, { hour: '2-digit' })
                          } catch { return h }
                        }}
                        tick={{ fontSize: 10, fill: CHART.zinc500 }}
                        tickLine={false}
                        axisLine={{ stroke: 'oklch(0.88 0.004 120)' }}
                        interval={3}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: CHART.zinc500 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        contentStyle={TOOLTIP_STYLE}
                        formatter={(v: any) => [`${v} votes`, 'Votes']}
                        labelFormatter={(h) => {
                          try {
                            return new Date(h as string).toLocaleString(undefined, { hour: '2-digit', minute: '2-digit' })
                          } catch { return h }
                        }}
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={28}>
                        {(data.votesPerHour || []).map((entry, idx) => (
                          <Cell key={idx} fill={entry.count > 0 ? CHART.emerald : CHART.zinc300} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
        >
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" /> Demographic Breakdown
              </CardTitle>
              <p className="text-xs text-muted-foreground">Turnout by faculty / voter group.</p>
            </CardHeader>
            <CardContent>
              {(data.demographicBreakdown || []).length === 0 ? (
                <EmptyChart label="No demographic data available." />
              ) : (
                <div className="votewise-scroll max-h-64 space-y-3 overflow-y-auto pr-2">
                  {data.demographicBreakdown.map((d, i) => {
                    const palette = [CHART.emerald, CHART.amber, CHART.gold, CHART.emeraldDark, CHART.amberDark, CHART.zinc500]
                    const color = palette[i % palette.length]
                    return (
                      <div key={i} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="truncate font-medium">{d.label}</span>
                          <span className="font-mono text-xs">
                            <span className="font-semibold" style={{ color }}>{d.turnoutPct}%</span>
                            <span className="ml-1 text-muted-foreground">· {d.voted}/{d.eligible}</span>
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${Math.max(1, d.turnoutPct)}%`, backgroundColor: color }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ---- Stat mini-cards: Communication / Security / Support ---- */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatMiniCard
          icon={Mail}
          title="Communication"
          accent="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
          stats={[
            { label: 'Delivery Rate', value: `${data.communicationStats.deliveryRate}%`, pct: data.communicationStats.deliveryRate, color: CHART.emerald },
            { label: 'Open Rate', value: `${data.communicationStats.openRate}%`, pct: data.communicationStats.openRate, color: CHART.amber },
            { label: 'Click Rate', value: `${data.communicationStats.clickRate}%`, pct: data.communicationStats.clickRate, color: CHART.gold },
          ]}
        />
        <StatMiniCard
          icon={ShieldCheck}
          title="Security"
          accent="bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300"
          stats={[
            { label: 'Threat Level', value: data.securityStats.threatLevel, color: CHART.red },
            { label: 'Open Incidents', value: data.securityStats.openIncidents, color: CHART.amber },
            { label: 'Integrity Score', value: `${data.securityStats.integrityScore}`, pct: data.securityStats.integrityScore, color: CHART.emerald },
          ]}
        />
        <StatMiniCard
          icon={Headphones}
          title="Support"
          accent="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
          stats={[
            { label: 'Open Tickets', value: data.supportStats.openTickets, color: CHART.amber },
            { label: 'Avg Resolution', value: `${data.supportStats.avgResolutionTime}h`, color: CHART.emerald },
            { label: 'Top Issue', value: data.supportStats.topIssues[0]?.category?.replace(/_/g, ' ') || '—', color: CHART.zinc500 },
          ]}
        />
      </div>
    </div>
  )
}

function InsightCard({ insight, delay = 0 }: { insight: AIInsight; delay?: number }) {
  const style = INSIGHT_STYLE[insight.type] || INSIGHT_STYLE.INFORMATIONAL
  const Icon = style.icon
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
    >
      <div className={cn('rounded-lg border p-4', style.ring)}>
        <div className="flex flex-wrap items-center gap-2">
          <div className={cn('grid h-7 w-7 place-items-center rounded-md', style.badge)}>
            <Icon className="h-4 w-4" />
          </div>
          <Badge className={cn('text-[10px] uppercase tracking-wider', style.badge)}>{insight.type}</Badge>
          <Badge variant="outline" className="text-[10px]">{insight.category}</Badge>
          <div className="ml-auto flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Gauge className="h-3 w-3" /> {insight.confidence}%
          </div>
        </div>
        <h4 className="mt-2 font-display text-sm font-bold leading-tight">{insight.title}</h4>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{insight.description}</p>
        {insight.recommendation && (
          <div className="mt-2 flex items-start gap-1.5 rounded-md bg-muted/40 p-2 text-xs">
            <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
            <span>{insight.recommendation}</span>
          </div>
        )}
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Confidence</span>
            <span className="font-mono">{insight.confidence}%</span>
          </div>
          <Progress value={insight.confidence} className="h-1.5 [&_[data-slot=progress-indicator]]:bg-primary" />
        </div>
      </div>
    </motion.div>
  )
}

function FunnelView({ funnel }: { funnel: ParticipationFunnel }) {
  const stages: Array<{ key: keyof ParticipationFunnel; label: string; icon: any }> = [
    { key: 'invited', label: 'Invited', icon: Mail },
    { key: 'eligible', label: 'Eligible', icon: Users },
    { key: 'accredited', label: 'Accredited', icon: CheckCircle2 },
    { key: 'otvpSent', label: 'OTVP Sent', icon: Bell },
    { key: 'otvpVerified', label: 'OTVP Verified', icon: ShieldCheck },
    { key: 'ballotsStarted', label: 'Ballots Started', icon: FileText },
    { key: 'votesCompleted', label: 'Votes Completed', icon: Vote },
  ]
  const max = Math.max(stages.length ? funnel.invited : 1, 1)
  return (
    <div className="space-y-2">
      {stages.map((s, i) => {
        const value = funnel[s.key] || 0
        const prevValue = i === 0 ? value : (funnel[stages[i - 1].key] || 0)
        const width = Math.max(2, Math.round((value / max) * 100))
        const dropoff = i === 0 || prevValue === 0 ? 0 : Math.round((1 - value / prevValue) * 100)
        const color = i === 0 ? CHART.emerald
          : i < 3 ? CHART.emerald
          : i < 5 ? CHART.amber
          : CHART.gold
        const Icon = s.icon
        return (
          <div key={s.key} className="flex items-center gap-3">
            <div className="flex w-40 shrink-0 items-center gap-2">
              <div className="grid h-7 w-7 place-items-center rounded-md bg-primary/10 text-primary">
                <Icon className="h-3.5 w-3.5" />
              </div>
              <span className="text-xs font-medium">{s.label}</span>
            </div>
            <div className="relative h-7 flex-1 overflow-hidden rounded-md bg-muted/40">
              <div
                className="votewise-bar-anim absolute inset-y-0 left-0 rounded-md"
                style={{ width: `${width}%`, backgroundColor: color, opacity: 0.85 }}
              />
              <div className="absolute inset-0 flex items-center justify-between px-3 text-xs font-mono font-semibold">
                <span className="text-foreground">{value.toLocaleString()}</span>
                {i > 0 && dropoff > 0 && (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                    -{dropoff}% drop-off
                  </span>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function StatMiniCard({
  icon: Icon, title, accent, stats,
}: {
  icon: any
  title: string
  accent: string
  stats: Array<{ label: string; value: string | number; pct?: number; color?: string }>
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-sm flex items-center gap-2">
          <div className={cn('grid h-7 w-7 place-items-center rounded-md', accent)}>
            <Icon className="h-3.5 w-3.5" />
          </div>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {stats.map((s, i) => (
          <div key={i} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{s.label}</span>
              <span className="font-mono font-semibold" style={s.color ? { color: s.color } : undefined}>{s.value}</span>
            </div>
            {s.pct !== undefined && (
              <Progress value={s.pct} className="h-1.5 [&_[data-slot=progress-indicator]]:bg-primary" />
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
      <BarChart3 className="h-8 w-8 text-muted-foreground/30" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}

// ===========================================================================
// TAB 2 — Historical (Trend Analysis)
// ===========================================================================

function HistoricalTab({ subdomain }: { subdomain?: string }) {
  const [data, setData] = useState<HistoricalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const d: any = await api.raeiGetHistorical(subdomain)
      setData(d as HistoricalData)
    } catch (e: any) {
      setError(e?.message || 'Failed to load historical data')
    } finally {
      setLoading(false)
    }
  }, [subdomain])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <Card>
        <CardContent className="grid place-items-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="mt-2 text-sm text-muted-foreground">Loading historical data…</p>
        </CardContent>
      </Card>
    )
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-destructive/50" />
          <p className="mt-2 text-sm font-medium">{error || 'Historical data unavailable.'}</p>
          <Button onClick={load} variant="outline" size="sm" className="mt-3 gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  const elections = data.elections || []
  const chartData = elections.map((e) => ({
    name: e.name.length > 18 ? e.name.slice(0, 16) + '…' : e.name,
    fullName: e.name,
    date: e.date,
    turnout: e.turnoutPct,
    votes: e.totalVotes,
    incidents: e.incidents,
  }))

  const trendBadges: Array<{ label: string; dir: 'UP' | 'DOWN' | 'FLAT' }> = [
    { label: 'Turnout', dir: data.trends.turnout },
    { label: 'Participation', dir: data.trends.participation },
    { label: 'Incidents', dir: data.trends.incidents },
  ]

  return (
    <div className="space-y-6">
      {/* ---- Trend indicators + averages ---- */}
      <div className="grid gap-4 md:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" /> Trend Indicators
              </CardTitle>
              <p className="text-xs text-muted-foreground">Comparing recent vs. earlier elections.</p>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-3">
              {trendBadges.map((t) => (
                <div key={t.label} className="rounded-lg border border-border/60 p-3 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.label}</div>
                  <div className={cn(
                    'mt-1 flex items-center justify-center gap-1 font-display text-lg font-bold',
                    t.dir === 'UP' ? 'text-emerald-600 dark:text-emerald-400'
                      : t.dir === 'DOWN' ? 'text-amber-600 dark:text-amber-400'
                        : 'text-zinc-500',
                  )}>
                    {t.dir === 'UP' && <ArrowUp className="h-4 w-4" />}
                    {t.dir === 'DOWN' && <ArrowDown className="h-4 w-4" />}
                    {t.dir === 'FLAT' && <Minus className="h-4 w-4" />}
                    {t.dir.charAt(0) + t.dir.slice(1).toLowerCase()}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.05 }}>
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> Average Stats
              </CardTitle>
              <p className="text-xs text-muted-foreground">Across {elections.length} election{elections.length === 1 ? '' : 's'}.</p>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <AvgStat label="Avg Turnout" value={`${data.averages.turnout}%`} tone="emerald" />
              <AvgStat label="Avg Votes" value={data.averages.votes.toLocaleString()} tone="emerald" />
              <AvgStat label="Avg Incidents" value={data.averages.incidents} tone="amber" />
              <AvgStat label="Avg Duration" value={`${data.averages.duration}h`} tone="zinc" />
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ---- Turnout trend line chart ---- */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="font-display text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> Turnout Trend
              </CardTitle>
              <Badge variant="outline" className="gap-1 text-xs">
                <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: CHART.emerald }} />
                {elections.length} elections
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {elections.length === 0 ? (
              <EmptyChart label="No completed elections yet." />
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.004 120)" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10, fill: CHART.zinc500 }}
                      tickLine={false}
                      axisLine={{ stroke: 'oklch(0.88 0.004 120)' }}
                      interval={0}
                      angle={-15}
                      textAnchor="end"
                      height={50}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tickFormatter={(v) => `${v}%`}
                      tick={{ fontSize: 11, fill: CHART.zinc500 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(value: any, _name, item: any) => [
                        `${value}% turnout`,
                        item?.payload?.fullName || 'Election',
                      ]}
                      labelFormatter={(_v, payload) => {
                        const p = payload?.[0]?.payload
                        if (!p) return ''
                        try { return new Date(p.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) } catch { return p.date }
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="turnout"
                      stroke={CHART.emerald}
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: CHART.emerald, strokeWidth: 0 }}
                      activeDot={{ r: 6, fill: CHART.emeraldDark }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ---- Historical comparison table ---- */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
      >
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" /> Historical Comparison
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <div className="votewise-scroll max-h-[28rem] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead className="min-w-[12rem]">Election Name</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Turnout</TableHead>
                    <TableHead className="text-right">Total Votes</TableHead>
                    <TableHead className="text-right">Eligible</TableHead>
                    <TableHead className="text-right">Incidents</TableHead>
                    <TableHead className="text-right">Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {elections.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                        No elections recorded yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    elections.map((e) => (
                      <TableRow key={e.electionId} className="transition-colors hover:bg-muted/40">
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Vote className="h-3.5 w-3.5 shrink-0 text-primary/70" />
                            <span className="truncate">{e.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {new Date(e.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={cn('font-mono text-xs font-semibold', e.turnoutPct >= 50 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400')}>
                            {e.turnoutPct}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">{e.totalVotes.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{e.eligibleVoters.toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          {e.incidents > 0 ? (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">{e.incidents}</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap font-mono text-xs text-muted-foreground">{e.duration}h</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

function AvgStat({ label, value, tone }: { label: string; value: string | number; tone: 'emerald' | 'amber' | 'zinc' }) {
  const cls = {
    emerald: 'text-emerald-600 dark:text-emerald-400',
    amber: 'text-amber-600 dark:text-amber-400',
    zinc: 'text-zinc-600 dark:text-zinc-400',
  }[tone]
  return (
    <div className="rounded-lg border border-border/60 p-3 text-center">
      <div className={cn('font-display text-xl font-bold tabular-nums', cls)}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  )
}

// ===========================================================================
// TAB 3 — Reports (Report Center)
// ===========================================================================

function ReportsTab({ subdomain }: { subdomain?: string }) {
  const [elections, setElections] = useState<WorkspaceElection[]>([])
  const [selectedElection, setSelectedElection] = useState<string>('')
  const [generating, setGenerating] = useState<string | null>(null)
  const [report, setReport] = useState<ReportResult | null>(null)
  const [reportOpen, setReportOpen] = useState(false)

  useEffect(() => {
    api.workspaceDashboard(subdomain)
      .then((d: any) => {
        const list: WorkspaceElection[] = (d?.elections || []).map((e: any) => ({
          id: e.id,
          name: e.name,
          status: e.status,
          startTime: e.startTime,
        }))
        setElections(list)
        if (list.length > 0) setSelectedElection(list[0].id)
      })
      .catch(() => { /* ignore — non-fatal */ })
  }, [subdomain])

  async function handleGenerate(type: string, format: string, needsElection: boolean) {
    if (needsElection && !selectedElection) {
      toast.error('Please select an election first.')
      return
    }
    setGenerating(type)
    try {
      const result: any = await api.raeiGenerateReport(
        { type, format, electionId: needsElection ? selectedElection : undefined },
        subdomain,
      )
      setReport(result as ReportResult)
      setReportOpen(true)
      toast.success('Report generated successfully.')
    } catch (e: any) {
      toast.error(e?.message || 'Failed to generate report')
    } finally {
      setGenerating(null)
    }
  }

  function handleDownload() {
    if (!report) return
    try {
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${report.type}-${report.id}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Report downloaded.')
    } catch {
      toast.error('Failed to download report.')
    }
  }

  return (
    <div className="space-y-6">
      {/* ---- Election selector ---- */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="votewise-card-glow">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-base font-bold">Report Center</h3>
                <p className="text-xs text-muted-foreground">
                  Generate executive reports, audit logs, and certification packages on demand.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedElection} onValueChange={setSelectedElection}>
                <SelectTrigger className="w-[220px] sm:w-[280px]" aria-label="Election">
                  <SelectValue placeholder="Select election" />
                </SelectTrigger>
                <SelectContent>
                  {elections.length === 0 ? (
                    <SelectItem value="_none" disabled>No elections available</SelectItem>
                  ) : (
                    elections.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ---- Report type cards ---- */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {REPORT_TYPES.map((r, i) => (
          <motion.div
            key={r.type}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.04 }}
          >
            <Card className="flex h-full flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className={cn('grid h-10 w-10 place-items-center rounded-lg', r.accent)}>
                    <r.icon className="h-5 w-5" />
                  </div>
                  {r.needsElection && (
                    <Badge variant="outline" className="text-[9px] uppercase tracking-wider">Election</Badge>
                  )}
                </div>
                <CardTitle className="font-display text-sm mt-3">{r.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-3">
                <p className="text-xs leading-relaxed text-muted-foreground flex-1">{r.description}</p>
                <ReportFormatSelector
                  disabled={generating === r.type}
                  needsElection={r.needsElection}
                  hasElection={!!selectedElection}
                  onGenerate={(fmt) => handleGenerate(r.type, fmt, r.needsElection)}
                  generating={generating === r.type}
                />
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* ---- Report viewer dialog ---- */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <FileCheck2 className="h-5 w-5 text-primary" />
              {report?.type?.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
            </DialogTitle>
            <DialogDescription>
              Report ID <span className="font-mono text-xs">{report?.id}</span> · Generated{' '}
              {report?.generatedAt ? new Date(report.generatedAt).toLocaleString() : ''} · Format{' '}
              <Badge variant="outline" className="text-[10px]">{report?.format}</Badge>
            </DialogDescription>
          </DialogHeader>
          <div className="votewise-scroll max-h-[60vh] overflow-auto rounded-lg border border-border bg-muted/30 p-4">
            <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed">
              {report ? JSON.stringify(report.data, null, 2) : ''}
            </pre>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportOpen(false)}>Close</Button>
            <Button onClick={handleDownload} className="gap-1.5">
              <Download className="h-4 w-4" /> Download JSON
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ReportFormatSelector({
  disabled, needsElection, hasElection, onGenerate, generating,
}: {
  disabled: boolean
  needsElection: boolean
  hasElection: boolean
  onGenerate: (fmt: 'JSON' | 'CSV') => void
  generating: boolean
}) {
  const [fmt, setFmt] = useState<'JSON' | 'CSV'>('JSON')
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          variant={fmt === 'JSON' ? 'default' : 'outline'}
          className="h-7 flex-1 text-xs"
          onClick={() => setFmt('JSON')}
          disabled={disabled}
        >
          JSON
        </Button>
        <Button
          size="sm"
          variant={fmt === 'CSV' ? 'default' : 'outline'}
          className="h-7 flex-1 text-xs"
          onClick={() => setFmt('CSV')}
          disabled={disabled}
        >
          CSV
        </Button>
      </div>
      <Button
        size="sm"
        className="w-full gap-1.5"
        onClick={() => onGenerate(fmt)}
        disabled={disabled || (needsElection && !hasElection) || generating}
      >
        {generating ? (
          <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating…</>
        ) : (
          <><Sparkles className="h-3.5 w-3.5" /> Generate</>
        )}
      </Button>
      {needsElection && !hasElection && (
        <p className="text-[10px] text-amber-600 dark:text-amber-400">Select an election first.</p>
      )}
    </div>
  )
}

// ===========================================================================
// TAB 4 — Replay (Election Replay Studio)
// ===========================================================================

function ReplayTab({ subdomain }: { subdomain?: string }) {
  const [elections, setElections] = useState<WorkspaceElection[]>([])
  const [selected, setSelected] = useState<string>('')
  const [data, setData] = useState<ReplayData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    api.workspaceDashboard(subdomain)
      .then((d: any) => {
        const list: WorkspaceElection[] = (d?.elections || []).map((e: any) => ({
          id: e.id, name: e.name, status: e.status, startTime: e.startTime,
        }))
        setElections(list)
        if (list.length > 0) setSelected(list[0].id)
      })
      .catch(() => { /* ignore */ })
  }, [subdomain])

  const load = useCallback(async (electionId: string) => {
    if (!electionId) return
    setLoading(true)
    setError(null)
    try {
      const d: any = await api.raeiGetReplay(electionId, subdomain)
      setData(d as ReplayData)
    } catch (e: any) {
      setError(e?.message || 'Failed to load replay timeline')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [subdomain])

  useEffect(() => {
    if (selected) load(selected)
  }, [selected, load])

  function handleExport() {
    if (!data) return
    try {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `replay-${data.election.id}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Timeline exported.')
    } catch {
      toast.error('Failed to export timeline.')
    }
  }

  const timeline = data?.timeline || []
  const filtered = timeline.filter((e) => {
    const f = REPLAY_FILTERS.find((x) => x.key === filter)
    return f ? f.match(e.type) : true
  })

  return (
    <div className="space-y-6">
      {/* ---- Header with election selector + actions ---- */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <Card className="votewise-card-glow">
          <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <History className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-base font-bold">Election Replay Studio</h3>
                  <Badge variant="outline" className="gap-1 text-[10px]">
                    <Play className="h-3 w-3" /> Forensic Timeline
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Reconstruct any election&apos;s full event timeline — milestones, votes, incidents, audit logs, messages.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={selected} onValueChange={setSelected}>
                <SelectTrigger className="w-[220px] sm:w-[280px]" aria-label="Election">
                  <SelectValue placeholder="Select election" />
                </SelectTrigger>
                <SelectContent>
                  {elections.length === 0 ? (
                    <SelectItem value="_none" disabled>No elections available</SelectItem>
                  ) : (
                    elections.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={handleExport}
                disabled={!data || timeline.length === 0}
              >
                <Download className="h-3.5 w-3.5" /> Export Timeline
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {!selected ? (
        <Card>
          <CardContent className="grid place-items-center py-16 text-center">
            <History className="h-12 w-12 text-muted-foreground/30" />
            <p className="mt-3 text-sm font-medium">Select an election to load its replay timeline.</p>
            <p className="mt-1 text-xs text-muted-foreground">All event sources — votes, incidents, audit logs, messages — will be merged chronologically.</p>
          </CardContent>
        </Card>
      ) : loading ? (
        <Card>
          <CardContent className="grid place-items-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="mt-2 text-sm text-muted-foreground">Reconstructing forensic timeline…</p>
          </CardContent>
        </Card>
      ) : error || !data ? (
        <Card>
          <CardContent className="py-10 text-center">
            <AlertCircle className="mx-auto h-10 w-10 text-destructive/50" />
            <p className="mt-2 text-sm font-medium">{error || 'Replay unavailable.'}</p>
            <Button onClick={() => load(selected)} variant="outline" size="sm" className="mt-3 gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ---- Summary stats ---- */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <ReplayStat label="Total Events" value={data.summary.totalEvents} icon={Activity} colour="text-primary" />
            <ReplayStat label="Votes" value={data.summary.votes} icon={Vote} colour="text-emerald-600 dark:text-emerald-400" />
            <ReplayStat label="Incidents" value={data.summary.incidents} icon={Siren} colour="text-red-600 dark:text-red-400" />
            <ReplayStat label="Audit Logs" value={data.summary.auditLogs} icon={ScrollText} colour="text-zinc-600 dark:text-zinc-400" />
            <ReplayStat label="Messages" value={data.summary.messages} icon={MessageSquare} colour="text-emerald-600 dark:text-emerald-400" />
            <ReplayStat label="Announcements" value={data.summary.announcements} icon={Megaphone} colour="text-amber-600 dark:text-amber-400" />
          </div>

          {/* ---- Filter buttons ---- */}
          <Card>
            <CardContent className="p-4">
              <div className="votewise-scroll flex flex-wrap items-center gap-2 overflow-x-auto">
                {REPLAY_FILTERS.map((f) => {
                  const count = f.key === 'all'
                    ? timeline.length
                    : timeline.filter((e) => f.match(e.type)).length
                  const Icon = f.icon
                  return (
                    <Button
                      key={f.key}
                      size="sm"
                      variant={filter === f.key ? 'default' : 'outline'}
                      className="gap-1.5 text-xs"
                      onClick={() => setFilter(f.key)}
                    >
                      <Icon className="h-3.5 w-3.5" /> {f.label}
                      <Badge variant="secondary" className="ml-1 text-[9px]">{count}</Badge>
                    </Button>
                  )
                })}
                <div className="ml-auto flex items-center gap-2 text-[10px] text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span>
                    {data.election.votingWindow.start && new Date(data.election.votingWindow.start).toLocaleString()}
                    {' → '}
                    {data.election.votingWindow.end && new Date(data.election.votingWindow.end).toLocaleString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ---- Vertical timeline ---- */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" /> Chronological Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filtered.length === 0 ? (
                <div className="py-10 text-center">
                  <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground/40" />
                  <p className="mt-2 text-sm font-medium">No events to display for this filter.</p>
                  <p className="mt-1 text-xs text-muted-foreground">Try switching to another filter or the All view.</p>
                </div>
              ) : (
                <div className="votewise-scroll max-h-[600px] overflow-y-auto pr-2">
                  <ol className="relative ml-3 border-l-2 border-border">
                    {filtered.map((entry, i) => {
                      const style = REPLAY_TYPE_STYLE[entry.type] || REPLAY_TYPE_STYLE.CUSTOM
                      const Icon = style.icon
                      const isMilestone = style.milestone
                      const sev = entry.severity || 'INFO'
                      return (
                        <motion.li
                          key={i}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.3, delay: Math.min(i * 0.025, 0.6) }}
                          className="ml-5 pb-4"
                        >
                          {/* Timeline marker */}
                          <span
                            className={cn(
                              'absolute -left-[9px] mt-1 grid place-items-center rounded-full border-2 border-background',
                              isMilestone ? 'h-5 w-5' : 'h-4 w-4',
                              style.dot,
                            )}
                          >
                            {(entry.type === 'INCIDENT_DETECTED' || entry.type === 'SECURITY_ALERT') && (
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-60" />
                            )}
                          </span>

                          {/* Entry card */}
                          <div
                            className={cn(
                              'rounded-lg border p-3 transition-colors',
                              entry.type === 'INCIDENT_DETECTED' || entry.type === 'SECURITY_ALERT'
                                ? 'border-red-200 bg-red-50/40 dark:border-red-900/40 dark:bg-red-950/20'
                                : isMilestone
                                  ? 'border-primary/30 bg-primary/5'
                                  : 'border-border bg-card',
                            )}
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <div className={cn('grid h-6 w-6 place-items-center rounded-md', style.colour)}>
                                <Icon className="h-3.5 w-3.5" />
                              </div>
                              <Badge variant="outline" className="text-[9px] uppercase tracking-wider">{style.label}</Badge>
                              {entry.severity && (
                                <Badge className={cn('text-[9px]', SEVERITY_STYLE[sev] || SEVERITY_STYLE.INFO)}>{sev}</Badge>
                              )}
                              {isMilestone && (
                                <Badge className="bg-primary/10 text-primary text-[9px] gap-1">
                                  <Sparkles className="h-3 w-3" /> Milestone
                                </Badge>
                              )}
                              <span className="ml-auto flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {formatTimestamp(entry.timestamp)}
                              </span>
                            </div>
                            <p className="mt-1.5 text-sm font-medium leading-relaxed">{entry.title}</p>
                            {entry.description && entry.description !== entry.title && (
                              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{entry.description}</p>
                            )}
                            {(entry.actor || entry.metadata) && (
                              <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
                                {entry.actor && (
                                  <span className="flex items-center gap-1">
                                    <Users className="h-3 w-3" /> {entry.actor}
                                  </span>
                                )}
                                {entry.metadata?.riskScore !== undefined && entry.metadata.riskScore > 0 && (
                                  <span className="flex items-center gap-1">
                                    <ShieldAlert className="h-3 w-3" /> risk {entry.metadata.riskScore}
                                  </span>
                                )}
                                {entry.metadata?.channel && (
                                  <span className="flex items-center gap-1">
                                    <MessageSquare className="h-3 w-3" /> {entry.metadata.channel}
                                  </span>
                                )}
                                {entry.metadata?.status && (
                                  <span className="flex items-center gap-1">
                                    <Activity className="h-3 w-3" /> {entry.metadata.status}
                                  </span>
                                )}
                                {entry.metadata?.percentage !== undefined && (
                                  <span className="flex items-center gap-1">
                                    <TrendingUp className="h-3 w-3" /> {entry.metadata.percentage}%
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </motion.li>
                      )
                    })}
                  </ol>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function ReplayStat({ label, value, icon: Icon, colour }: { label: string; value: number; icon: any; colour: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <Icon className={cn('mx-auto h-4 w-4', colour)} />
        <div className={cn('mt-1 text-center font-display text-lg font-bold tabular-nums', colour)}>{value.toLocaleString()}</div>
        <div className="text-center text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return iso
  }
}
