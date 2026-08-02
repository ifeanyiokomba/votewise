'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  GitCompare, BarChart3, Users, Vote, Trophy, Shield, Clock, TrendingUp,
  ArrowLeftRight, CheckCircle2, XCircle, AlertTriangle, Lightbulb, Award,
  Loader2, Search, Crown, Scale, ShieldCheck, Activity,
} from 'lucide-react'
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ---- Palette (emerald / gold / amber / zinc — NO indigo/blue) ----
const CHART_COLORS = {
  emerald: '#10b981',
  emeraldDark: '#15803d',
  amber: '#f59e0b',
  amberDark: '#b45309',
  gold: '#d4a017',
  zinc400: '#a1a1aa',
  zinc500: '#71717a',
  zinc600: '#52525b',
}
const STATUS_BADGE_CLASS: Record<string, string> = {
  live: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  upcoming: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-600/15 dark:text-emerald-300',
  draft: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-300',
  archived: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-600/15 dark:text-zinc-400',
}

const tooltipStyle = {
  borderRadius: 8,
  border: '1px solid oklch(0.88 0.004 120)',
  background: 'oklch(1 0 0)',
  fontSize: 12,
  boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
}

const MAX_SELECTION = 5
const MIN_SELECTION = 2

type SelectorElection = {
  id: string
  name: string
  status: string
  startTime: string
  endTime: string
  category: string | null
  electionType: string | null
}

type Winner = {
  positionId: string
  positionTitle: string
  winnerId: string | null
  winnerName: string
  votes: number
  totalVotes: number
  pct: number
}

type Comparison = {
  id: string
  name: string
  status: string
  rawStatus: string
  category: string | null
  electionType: string | null
  votingMethod: string | null
  visibility: string
  startTime: string
  endTime: string
  durationHours: number
  durationLabel: string
  // participation
  eligibleVoters: number
  votesCast: number
  turnoutPct: number
  uniqueVoters: number
  // structure
  positionsCount: number
  candidatesCount: number
  avgCandidatesPerPosition: number
  // integrity
  isCertified: boolean
  hasVerificationPackage: boolean
  auditLogCount: number
  chainIntact: boolean
  // incidents
  totalIncidents: number
  openIncidents: number
  criticalIncidents: number
  // results
  resultsVisible: boolean
  winners: Winner[]
  closestMarginPct: number | null
  // timeline
  firstVoteAt: string | null
  lastVoteAt: string | null
  votingDurationHours: number
}

type ComparisonResult = {
  comparisons: Comparison[]
  summary: {
    totalElections: number
    avgTurnout: number
    totalVotes: number
    totalEligible: number
    bestTurnout: number
    worstTurnout: number
  }
}

type ElectionCenterResponse = {
  running: SelectorElection[]
  upcoming: SelectorElection[]
  completed: SelectorElection[]
  draft: SelectorElection[]
  archived: SelectorElection[]
}

function classifyStatus(e: SelectorElection): string {
  // Election center returns already-classified groups, but we re-derive a
  // canonical status label for the badge here.
  const now = new Date()
  const start = new Date(e.startTime)
  const end = new Date(e.endTime)
  if (e.status === 'ARCHIVED' || e.status === 'CANCELLED') return 'archived'
  if (e.status === 'CERTIFIED' || e.status === 'COMPLETED') return 'completed'
  if (e.status === 'LIVE' || (now >= start && now < end)) return 'live'
  if (now >= end) return 'completed'
  if (now < start) return 'upcoming'
  return 'draft'
}

function turnoutColor(pct: number): string {
  if (pct >= 70) return 'text-emerald-600 dark:text-emerald-400'
  if (pct >= 40) return 'text-amber-600 dark:text-amber-400'
  return 'text-zinc-500 dark:text-zinc-400'
}
function turnoutBarClass(pct: number): string {
  if (pct >= 70) return 'bg-emerald-500'
  if (pct >= 40) return 'bg-amber-500'
  return 'bg-zinc-400'
}
function shortName(name: string, max = 24): string {
  return name.length > max ? name.slice(0, max - 1) + '…' : name
}

function fmtDateTime(s: string | null): string {
  if (!s) return '—'
  return new Date(s).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export function ElectionComparison({ subdomain }: { subdomain?: string }) {
  const [elections, setElections] = useState<SelectorElection[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [result, setResult] = useState<ComparisonResult | null>(null)
  const [comparing, setComparing] = useState(false)
  const [compareError, setCompareError] = useState<string | null>(null)

  // Load the list of org elections for the selector.
  useEffect(() => {
    let active = true
    setLoadingList(true)
    api.electionCenter(subdomain)
      .then((d: any) => {
        if (!active) return
        const data = d as ElectionCenterResponse
        const all = [
          ...(data.running || []),
          ...(data.upcoming || []),
          ...(data.completed || []),
          ...(data.draft || []),
          ...(data.archived || []),
        ]
        setElections(all)
        setListError(null)
      })
      .catch((e) => {
        if (!active) return
        setListError(e.message || 'Failed to load elections')
        toast.error(e.message || 'Failed to load elections')
      })
      .finally(() => { if (active) setLoadingList(false) })
    return () => { active = false }
  }, [subdomain])

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        if (next.size >= MAX_SELECTION) {
          toast.error(`You can compare at most ${MAX_SELECTION} elections at once.`)
          return prev
        }
        next.add(id)
      }
      return next
    })
    // Clear previous results when selection changes.
    setResult(null)
    setCompareError(null)
  }

  async function runCompare() {
    if (selected.size < MIN_SELECTION) {
      toast.error(`Select at least ${MIN_SELECTION} elections to compare.`)
      return
    }
    setComparing(true)
    setCompareError(null)
    try {
      const ids = Array.from(selected)
      const r = await api.compareElections(ids, subdomain) as ComparisonResult
      setResult(r)
    } catch (e: any) {
      setCompareError(e.message || 'Comparison failed')
      toast.error(e.message || 'Comparison failed')
    } finally {
      setComparing(false)
    }
  }

  function clearAll() {
    setSelected(new Set())
    setResult(null)
    setCompareError(null)
  }

  const filteredElections = useMemo(() => {
    const q = search.trim().toLowerCase()
    const base = q
      ? elections.filter((e) => e.name.toLowerCase().includes(q) || (e.category || '').toLowerCase().includes(q))
      : elections
    // Sort: completed/live first (most useful to compare), then upcoming, draft, archived.
    const order: Record<string, number> = { completed: 0, live: 1, upcoming: 2, draft: 3, archived: 4 }
    return base.slice().sort((a, b) => {
      const sa = order[classifyStatus(a)] ?? 9
      const sb = order[classifyStatus(b)] ?? 9
      if (sa !== sb) return sa - sb
      return new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    })
  }, [elections, search])

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
      {/* ---- Header ---- */}
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
                <GitCompare className="h-6 w-6" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-bold sm:text-3xl">Election Comparison</h1>
                <p className="text-sm text-muted-foreground">
                  Compare metrics, turnout, and results across multiple elections side-by-side.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1.5">
                <ArrowLeftRight className="h-3.5 w-3.5" />
                {selected.size}/{MAX_SELECTION} selected
              </Badge>
              {selected.size > 0 && (
                <Button variant="ghost" size="sm" onClick={clearAll} className="gap-1.5">
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ---- Election selector ---- */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="font-display text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Select Elections to Compare
            </CardTitle>
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search elections…"
                className="pl-9"
                aria-label="Search elections"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Pick {MIN_SELECTION}–{MAX_SELECTION} elections. Results, turnout, integrity and incidents are compared side-by-side.
          </p>
        </CardHeader>
        <CardContent>
          {loadingList ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading elections…
            </div>
          ) : listError ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Could not load elections</AlertTitle>
              <AlertDescription>{listError}</AlertDescription>
            </Alert>
          ) : filteredElections.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <Vote className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                {elections.length === 0 ? 'No elections in this workspace yet.' : 'No elections match your search.'}
              </p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto rounded-lg border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow className="sticky top-0 bg-card">
                    <TableHead className="w-10" />
                    <TableHead className="text-xs uppercase tracking-wider">Election</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider">Status</TableHead>
                    <TableHead className="hidden text-xs uppercase tracking-wider md:table-cell">Category</TableHead>
                    <TableHead className="hidden text-xs uppercase tracking-wider sm:table-cell">Window</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredElections.map((e) => {
                    const status = classifyStatus(e)
                    const isSelected = selected.has(e.id)
                    return (
                      <TableRow
                        key={e.id}
                        data-state={isSelected ? 'selected' : undefined}
                        className={cn(
                          'cursor-pointer transition-colors',
                          isSelected ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/50',
                        )}
                        onClick={() => toggle(e.id)}
                      >
                        <TableCell className="align-middle">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggle(e.id)}
                            onClick={(ev) => ev.stopPropagation()}
                            aria-label={`Select ${e.name}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="line-clamp-1">{e.name}</div>
                          <div className="text-[11px] text-muted-foreground md:hidden">
                            {e.category || e.electionType || '—'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn('gap-1 text-xs capitalize', STATUS_BADGE_CLASS[status] || '')}>
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
                            {status}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                          {e.category || e.electionType || '—'}
                        </TableCell>
                        <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                          {new Date(e.startTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {elections.length > 0 && (
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                {selected.size < MIN_SELECTION
                  ? `Select at least ${MIN_SELECTION - selected.size} more to compare.`
                  : `Ready to compare ${selected.size} election${selected.size === 1 ? '' : 's'}.`}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearAll}
                  disabled={selected.size === 0 || comparing}
                  className="gap-1.5"
                >
                  <XCircle className="h-4 w-4" /> Clear
                </Button>
                <Button
                  size="sm"
                  onClick={runCompare}
                  disabled={selected.size < MIN_SELECTION || comparing}
                  className="gap-1.5"
                >
                  {comparing ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Comparing…</>
                  ) : (
                    <><GitCompare className="h-4 w-4" /> Compare Elections</>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---- Comparison results ---- */}
      {compareError && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Comparison failed</AlertTitle>
          <AlertDescription>{compareError}</AlertDescription>
        </Alert>
      )}

      {result && result.comparisons.length > 0 && (
        <ComparisonView result={result} />
      )}
    </div>
  )
}

// ============================================================================
// Comparison View — cards, table, charts, winners, insights
// ============================================================================

function ComparisonView({ result }: { result: ComparisonResult }) {
  const { comparisons, summary } = result

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* ---- Summary strip ---- */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <SummaryStat icon={Activity} label="Elections" value={String(summary.totalElections)} />
        <SummaryStat icon={TrendingUp} label="Avg Turnout" value={`${summary.avgTurnout}%`} />
        <SummaryStat icon={Vote} label="Total Votes" value={summary.totalVotes.toLocaleString()} />
        <SummaryStat icon={Users} label="Total Eligible" value={summary.totalEligible.toLocaleString()} />
        <SummaryStat icon={Award} label="Best Turnout" value={`${summary.bestTurnout}%`} accent="emerald" />
        <SummaryStat icon={TrendingUp} label="Worst Turnout" value={`${summary.worstTurnout}%`} accent="amber" />
      </div>

      {/* ---- Side-by-side cards ---- */}
      <section aria-label="Election cards">
        <SectionTitle icon={GitCompare} title="Side-by-Side Overview" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {comparisons.map((c, i) => (
            <ComparisonCard key={c.id} c={c} delay={i * 0.05} />
          ))}
        </div>
      </section>

      {/* ---- Comparison table ---- */}
      <section aria-label="Comparison table">
        <SectionTitle icon={ArrowLeftRight} title="Detailed Comparison Table" />
        <Card>
          <CardContent className="p-0">
            <ComparisonTable comparisons={comparisons} />
          </CardContent>
        </Card>
      </section>

      {/* ---- Charts ---- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" /> Turnout Comparison
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisons.map((c) => ({ name: shortName(c.name, 16), turnout: c.turnoutPct }))} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.004 120)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: CHART_COLORS.zinc500 }} tickLine={false} axisLine={{ stroke: 'oklch(0.88 0.004 120)' }} />
                  <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: CHART_COLORS.zinc500 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [`${v}%`, 'Turnout']} />
                  <Bar dataKey="turnout" name="Turnout" radius={[6, 6, 0, 0]}>
                    {comparisons.map((c, idx) => (
                      <Cell key={idx} fill={c.turnoutPct >= 70 ? CHART_COLORS.emerald : c.turnoutPct >= 40 ? CHART_COLORS.amber : CHART_COLORS.zinc400} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Eligible vs Voted
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisons.map((c) => ({ name: shortName(c.name, 16), eligible: c.eligibleVoters, voted: c.uniqueVoters }))} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.004 120)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: CHART_COLORS.zinc500 }} tickLine={false} axisLine={{ stroke: 'oklch(0.88 0.004 120)' }} />
                  <YAxis tick={{ fontSize: 11, fill: CHART_COLORS.zinc500 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="eligible" name="Eligible" fill={CHART_COLORS.amber} radius={[6, 6, 0, 0]} />
                  <Bar dataKey="voted" name="Voted" fill={CHART_COLORS.emerald} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ---- Winners comparison ---- */}
      <WinnersComparison comparisons={comparisons} />

      {/* ---- Insights ---- */}
      <InsightsCard comparisons={comparisons} summary={summary} />
    </motion.div>
  )
}

// Need to import Cell from recharts for per-bar coloring. — moved to top imports.


function SectionTitle({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Icon className="h-4 w-4 text-primary" />
      <h2 className="font-display text-lg font-semibold">{title}</h2>
    </div>
  )
}

function SummaryStat({
  icon: Icon, label, value, accent,
}: {
  icon: any; label: string; value: string; accent?: 'emerald' | 'amber'
}) {
  const accentClass =
    accent === 'emerald' ? 'text-emerald-600 dark:text-emerald-400'
      : accent === 'amber' ? 'text-amber-600 dark:text-amber-400'
        : ''
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-3">
          <div className={cn('font-display text-2xl font-bold leading-tight', accentClass)}>{value}</div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  )
}

function ComparisonCard({ c, delay = 0 }: { c: Comparison; delay?: number }) {
  const statusBadge = STATUS_BADGE_CLASS[c.status] || ''
  const integrityOk = c.isCertified && c.chainIntact
  const integrityWarn = !integrityOk && (c.chainIntact || c.isCertified)
  const integrityBad = !c.chainIntact && !c.isCertified && c.auditLogCount > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
    >
      <Card className="h-full overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="font-display text-base leading-tight line-clamp-2">{c.name}</CardTitle>
            <Badge variant="outline" className={cn('gap-1 text-xs capitalize shrink-0', statusBadge)}>
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
              {c.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Big turnout number */}
          <div className="flex items-end justify-between gap-2">
            <div>
              <div className={cn('font-display text-4xl font-bold', turnoutColor(c.turnoutPct))}>
                {c.turnoutPct}%
              </div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Voter Turnout</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium">{c.uniqueVoters.toLocaleString()}</div>
              <div className="text-[11px] text-muted-foreground">of {c.eligibleVoters.toLocaleString()} eligible</div>
            </div>
          </div>
          {/* Turnout bar (custom — shadcn Progress hard-codes bg-primary) */}
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn('h-full rounded-full transition-all', turnoutBarClass(c.turnoutPct))}
              style={{ width: `${Math.min(100, c.turnoutPct)}%` }}
              role="progressbar"
              aria-valuenow={c.turnoutPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Voter turnout"
            />
          </div>

          {/* Mini stats */}
          <div className="grid grid-cols-2 gap-3">
            <MiniStat icon={Users} label="Eligible" value={c.eligibleVoters.toLocaleString()} />
            <MiniStat icon={Vote} label="Voted" value={c.uniqueVoters.toLocaleString()} />
            <MiniStat icon={ArrowLeftRight} label="Positions" value={String(c.positionsCount)} />
            <MiniStat icon={Award} label="Candidates" value={String(c.candidatesCount)} />
          </div>

          <Separator />

          {/* Duration */}
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Window:</span>
            <span className="font-medium">{c.durationLabel}</span>
          </div>

          {/* Integrity */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn(
              'gap-1 text-xs',
              integrityOk
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                : integrityBad
                  ? 'border-red-200 bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300'
                  : 'border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
            )}>
              <Shield className="h-3 w-3" />
              {integrityOk ? 'Certified · Chain Intact' : integrityBad ? 'Integrity Issues' : 'Pending Certification'}
            </Badge>
            {c.totalIncidents > 0 && (
              <Badge variant="outline" className={cn(
                'gap-1 text-xs',
                c.criticalIncidents > 0
                  ? 'border-red-200 bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300'
                  : 'border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
              )}>
                <AlertTriangle className="h-3 w-3" />
                {c.totalIncidents} incident{c.totalIncidents === 1 ? '' : 's'}
                {c.criticalIncidents > 0 && ` · ${c.criticalIncidents} critical`}
              </Badge>
            )}
          </div>

          {/* Results summary */}
          {c.resultsVisible && c.winners.length > 0 && (
            <div className="rounded-lg bg-muted/40 p-3">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Trophy className="h-3 w-3" /> Winners
              </div>
              <ul className="space-y-1">
                {c.winners.slice(0, 3).map((w) => (
                  <li key={w.positionId} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate text-muted-foreground">{w.positionTitle}</span>
                    <span className="truncate font-medium">{w.winnerName}</span>
                  </li>
                ))}
                {c.winners.length > 3 && (
                  <li className="text-xs text-muted-foreground">+{c.winners.length - 3} more position{c.winners.length - 3 === 1 ? '' : 's'}</li>
                )}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

function MiniStat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 p-2.5">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-0.5 font-display text-lg font-bold leading-tight">{value}</div>
    </div>
  )
}

// ---- Comparison Table ----
function ComparisonTable({ comparisons }: { comparisons: Comparison[] }) {
  // Build the rows. Each row is { label, icon, cells: [{value, tone?}] }
  const rows: Array<{
    label: string
    icon: any
    render: (c: Comparison) => React.ReactNode
  }[]> = [
    [
      {
        label: 'Turnout %',
        icon: TrendingUp,
        render: (c) => (
          <div className="flex items-center gap-2">
            <span className={cn('font-semibold', turnoutColor(c.turnoutPct))}>{c.turnoutPct}%</span>
            <div className="hidden h-2 w-16 overflow-hidden rounded-full bg-muted sm:block">
              <div className={cn('h-full', turnoutBarClass(c.turnoutPct))} style={{ width: `${Math.min(100, c.turnoutPct)}%` }} />
            </div>
          </div>
        ),
      },
    ],
    [
      { label: 'Eligible Voters', icon: Users, render: (c) => c.eligibleVoters.toLocaleString() },
    ],
    [
      { label: 'Votes Cast', icon: Vote, render: (c) => c.votesCast.toLocaleString() },
    ],
    [
      { label: 'Unique Voters', icon: Users, render: (c) => c.uniqueVoters.toLocaleString() },
    ],
    [
      { label: 'Positions', icon: ArrowLeftRight, render: (c) => String(c.positionsCount) },
    ],
    [
      { label: 'Candidates', icon: Award, render: (c) => String(c.candidatesCount) },
    ],
    [
      {
        label: 'Avg Candidates/Position',
        icon: Award,
        render: (c) => c.avgCandidatesPerPosition.toFixed(1),
      },
    ],
    [
      {
        label: 'Voting Window',
        icon: Clock,
        render: (c) => (
          <div className="text-xs">
            <div className="font-medium">{c.durationLabel}</div>
            <div className="text-muted-foreground">{fmtDateTime(c.startTime)} → {fmtDateTime(c.endTime)}</div>
          </div>
        ),
      },
    ],
    [
      {
        label: 'First Vote → Last Vote',
        icon: Activity,
        render: (c) => (
          <div className="text-xs">
            <div className="font-medium">
              {c.firstVoteAt && c.lastVoteAt ? `${c.votingDurationHours}h` : '—'}
            </div>
            <div className="text-muted-foreground">{fmtDateTime(c.firstVoteAt)} → {fmtDateTime(c.lastVoteAt)}</div>
          </div>
        ),
      },
    ],
    [
      {
        label: 'Incidents',
        icon: AlertTriangle,
        render: (c) => (
          <div className="text-xs">
            <span className={cn('font-medium', c.criticalIncidents > 0 ? 'text-red-600 dark:text-red-400' : c.totalIncidents > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground')}>
              {c.totalIncidents}
            </span>
            {c.criticalIncidents > 0 && (
              <span className="text-red-600 dark:text-red-400"> · {c.criticalIncidents} crit</span>
            )}
            {c.openIncidents > 0 && (
              <span className="text-muted-foreground"> · {c.openIncidents} open</span>
            )}
          </div>
        ),
      },
    ],
    [
      {
        label: 'Certified',
        icon: ShieldCheck,
        render: (c) => c.isCertified
          ? <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          : <XCircle className="h-4 w-4 text-zinc-400" />,
      },
    ],
    [
      {
        label: 'Audit Chain',
        icon: Shield,
        render: (c) => c.chainIntact
          ? <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          : <XCircle className="h-4 w-4 text-red-500" />,
      },
    ],
    [
      {
        label: 'Verification Package',
        icon: ShieldCheck,
        render: (c) => c.hasVerificationPackage
          ? <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          : <XCircle className="h-4 w-4 text-zinc-400" />,
      },
    ],
    [
      {
        label: 'Closest Margin',
        icon: Scale,
        render: (c) => c.closestMarginPct === null ? '—' : `${c.closestMarginPct} pts`,
      },
    ],
  ].flat()

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead className="sticky left-0 z-10 bg-card text-xs uppercase tracking-wider">Metric</TableHead>
            {comparisons.map((c) => (
              <TableHead key={c.id} className="min-w-[160px] text-xs uppercase tracking-wider">
                <div className="flex items-center gap-1.5">
                  <span className="line-clamp-1 font-semibold text-foreground">{shortName(c.name, 28)}</span>
                </div>
                <Badge variant="outline" className={cn('mt-1 gap-1 text-[10px] capitalize', STATUS_BADGE_CLASS[c.status] || '')}>
                  {c.status}
                </Badge>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, ri) => (
            <TableRow key={row.label} className={ri % 2 === 0 ? 'bg-card' : 'bg-muted/10'}>
              <TableCell className="sticky left-0 z-10 bg-inherit font-medium text-muted-foreground">
                <div className="flex items-center gap-2">
                  <row.icon className="h-3.5 w-3.5 text-muted-foreground/70" />
                  <span className="text-xs">{row.label}</span>
                </div>
              </TableCell>
              {comparisons.map((c) => (
                <TableCell key={c.id} className="align-middle">
                  {row.render(c)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// ---- Winners Comparison ----
function WinnersComparison({ comparisons }: { comparisons: Comparison[] }) {
  // Only show this section if at least 2 elections have visible results.
  const withResults = comparisons.filter((c) => c.resultsVisible && c.winners.length > 0)
  if (withResults.length < 2) return null

  // Collect the union of position titles across all elections that have results.
  const positionTitles = Array.from(new Set(withResults.flatMap((c) => c.winners.map((w) => w.positionTitle))))

  // For each position title, gather the winner from each election (if it has that position).
  const rows = positionTitles.map((title) => ({
    title,
    cells: comparisons.map((c) => {
      if (!c.resultsVisible) return { status: 'hidden' as const }
      const w = c.winners.find((x) => x.positionTitle === title)
      if (!w) return { status: 'missing' as const }
      return { status: 'ok' as const, winner: w }
    }),
  }))

  return (
    <section aria-label="Winners comparison">
      <SectionTitle icon={Crown} title="Winners Comparison" />
      <Card>
        <CardHeader className="pb-2">
          <p className="text-xs text-muted-foreground">
            Winners per position across the selected elections. Positions are matched by title — useful when comparing recurring elections (e.g. two annual SUG votes).
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="sticky left-0 z-10 bg-card text-xs uppercase tracking-wider">Position</TableHead>
                  {comparisons.map((c) => (
                    <TableHead key={c.id} className="min-w-[180px] text-xs uppercase tracking-wider">
                      <span className="line-clamp-1 font-semibold text-foreground">{shortName(c.name, 28)}</span>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, ri) => (
                  <TableRow key={row.title} className={ri % 2 === 0 ? 'bg-card' : 'bg-muted/10'}>
                    <TableCell className="sticky left-0 z-10 bg-inherit font-medium">
                      <span className="text-xs">{row.title}</span>
                    </TableCell>
                    {row.cells.map((cell, ci) => (
                      <TableCell key={ci} className="align-middle">
                        {cell.status === 'hidden' && <span className="text-xs text-muted-foreground">Hidden</span>}
                        {cell.status === 'missing' && <span className="text-xs text-muted-foreground">—</span>}
                        {cell.status === 'ok' && (
                          <div className="flex items-center gap-2">
                            <Crown className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium">{cell.winner.winnerName}</div>
                              <div className="text-[11px] text-muted-foreground">
                                {cell.winner.votes} votes · {cell.winner.pct}%
                              </div>
                            </div>
                          </div>
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}

// ---- Insights ----
function InsightsCard({
  comparisons, summary,
}: {
  comparisons: Comparison[]
  summary: ComparisonResult['summary']
}) {
  const insights = useMemo(() => buildInsights(comparisons, summary), [comparisons, summary])
  if (insights.length === 0) return null

  return (
    <section aria-label="Insights">
      <SectionTitle icon={Lightbulb} title="Auto-Generated Insights" />
      <Card>
        <CardContent className="p-4 sm:p-6">
          <ul className="space-y-3">
            {insights.map((ins, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: i * 0.04 }}
                className="flex items-start gap-3"
              >
                <span className={cn(
                  'mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full',
                  ins.tone === 'success' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                    : ins.tone === 'warning' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                      : ins.tone === 'danger' ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300'
                        : 'bg-primary/10 text-primary',
                )}>
                  <ins.icon className="h-4 w-4" />
                </span>
                <span className="text-sm text-foreground/90">{ins.text}</span>
              </motion.li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </section>
  )
}

type Insight = { icon: any; text: string; tone: 'success' | 'warning' | 'danger' | 'info' }

function buildInsights(comparisons: Comparison[], summary: ComparisonResult['summary']): Insight[] {
  const out: Insight[] = []
  if (comparisons.length === 0) return out

  // Highest turnout
  const withTurnout = comparisons.filter((c) => c.turnoutPct > 0)
  if (withTurnout.length >= 2) {
    const sorted = [...withTurnout].sort((a, b) => b.turnoutPct - a.turnoutPct)
    const top = sorted[0]
    const second = sorted[1]
    const diff = Math.round((top.turnoutPct - second.turnoutPct) * 10) / 10
    if (diff > 0) {
      out.push({
        icon: TrendingUp,
        tone: 'success',
        text: `"${top.name}" had the highest turnout (${top.turnoutPct}%) — ${diff}% higher than "${second.name}".`,
      })
    }
  }

  // Worst turnout
  if (withTurnout.length >= 2) {
    const sorted = [...withTurnout].sort((a, b) => a.turnoutPct - b.turnoutPct)
    const bottom = sorted[0]
    if (bottom.turnoutPct < 40) {
      out.push({
        icon: AlertTriangle,
        tone: 'warning',
        text: `"${bottom.name}" had the lowest turnout (${bottom.turnoutPct}%). Consider reviewing voter outreach or accreditation friction.`,
      })
    }
  }

  // Most candidates
  const byCandidates = [...comparisons].sort((a, b) => b.candidatesCount - a.candidatesCount)
  if (byCandidates[0].candidatesCount > 0 && byCandidates.length >= 2 && byCandidates[0].candidatesCount !== byCandidates[byCandidates.length - 1].candidatesCount) {
    const top = byCandidates[0]
    out.push({
      icon: Award,
      tone: 'info',
      text: `"${top.name}" had the most candidates (${top.candidatesCount}) across ${top.positionsCount} position${top.positionsCount === 1 ? '' : 's'} — avg ${top.avgCandidatesPerPosition.toFixed(1)} per position.`,
    })
  }

  // All certified with intact chains
  const allCertified = comparisons.every((c) => c.isCertified && c.chainIntact)
  if (allCertified && comparisons.length >= 2) {
    out.push({
      icon: ShieldCheck,
      tone: 'success',
      text: `All ${comparisons.length} selected elections are certified with intact audit chains.`,
    })
  } else {
    // Find any with integrity issues
    const issues = comparisons.filter((c) => !c.chainIntact || (!c.isCertified && c.auditLogCount > 0 && c.status === 'completed'))
    if (issues.length > 0) {
      out.push({
        icon: Shield,
        tone: 'danger',
        text: `${issues.length} election${issues.length === 1 ? '' : 's'} (${issues.map((c) => `"${c.name}"`).join(', ')}) ${issues.length === 1 ? 'has' : 'have'} integrity concerns — review the audit chain before certifying.`,
      })
    }
  }

  // Critical incidents
  const withCritical = comparisons.filter((c) => c.criticalIncidents > 0)
  if (withCritical.length > 0) {
    out.push({
      icon: AlertTriangle,
      tone: withCritical[0].criticalIncidents >= 3 ? 'danger' : 'warning',
      text: `"${withCritical[0].name}" had ${withCritical[0].criticalIncidents} critical incident${withCritical[0].criticalIncidents === 1 ? '' : 's'} — investigate before certifying.`,
    })
  }

  // Closest margin
  const withMargin = comparisons.filter((c) => c.closestMarginPct !== null && c.resultsVisible)
  if (withMargin.length >= 2) {
    const sorted = [...withMargin].sort((a, b) => (a.closestMarginPct || 0) - (b.closestMarginPct || 0))
    const closest = sorted[0]
    if ((closest.closestMarginPct || 0) < 5) {
      out.push({
        icon: Scale,
        tone: 'warning',
        text: `"${closest.name}" had the closest race — a margin of just ${closest.closestMarginPct} percentage points in its tightest position.`,
      })
    }
  }

  // Average turnout
  if (summary.avgTurnout > 0) {
    out.push({
      icon: Activity,
      tone: summary.avgTurnout >= 50 ? 'success' : 'warning',
      text: `Average turnout across the ${summary.totalElections} selected elections is ${summary.avgTurnout}% — ${summary.totalVotes.toLocaleString()} votes from ${summary.totalEligible.toLocaleString()} eligible voters.`,
    })
  }

  return out
}
