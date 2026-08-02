'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  BarChart3, TrendingUp, Users, Vote, Activity, AlertTriangle, CheckCircle2,
  Award, Calendar, ArrowUp, ArrowDown, Trophy, PieChart as PieIcon, Loader2,
  ChevronUp, ChevronDown, Clock, ShieldCheck, Building2,
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
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { GitCompare } from 'lucide-react'
import { ElectionComparison } from '@/components/votewise/election-comparison'

// ---- Palette (emerald / gold / amber / zinc only — NO indigo/blue) ----
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
const STATUS_COLORS: Record<string, string> = {
  live: CHART_COLORS.emerald,
  upcoming: CHART_COLORS.amber,
  completed: CHART_COLORS.emeraldDark,
  draft: CHART_COLORS.zinc500,
  archived: CHART_COLORS.zinc400,
}
const STATUS_BADGE_CLASS: Record<string, string> = {
  live: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  upcoming: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-600/15 dark:text-emerald-300',
  draft: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-300',
  archived: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-600/15 dark:text-zinc-400',
}

type AnalyticsData = {
  organization: { id: string; name: string; subdomain: string | null; logoUrl: string | null; primaryColour: string }
  overview: {
    totalElections: number
    totalVoters: number
    totalVotesCast: number
    avgTurnout: number
    mostActiveElection: { id: string; name: string; votesCast: number; turnoutPct: number } | null
    openIncidents: number
    verifiedVoters: number
  }
  electionComparison: Array<{
    id: string; name: string; status: string; rawStatus: string
    startTime: string; endTime: string
    eligibleVoters: number; votesCast: number; turnoutPct: number
    positionsCount: number; candidatesCount: number; incidentsCount: number; duration: string
  }>
  turnoutTrend: Array<{ electionId: string; name: string; turnoutPct: number; votesCast: number; eligibleVoters: number; date: string }>
  participationByStatus: { live: number; upcoming: number; completed: number; draft: number; archived: number }
  topElectionsByTurnout: Array<{ id: string; name: string; turnoutPct: number; votesCast: number; eligibleVoters: number; startTime: string }>
  voteTimeline: Array<{ date: string; count: number }>
  incidentSummary: { total: number; open: number; critical: number; resolved: number; resolvedRate: number }
  voterEngagement: { totalVoters: number; verifiedVoters: number; suspendedVoters: number; activeVoters: number; pendingVoters: number }
  generatedAt: string
}

type SortKey = 'name' | 'status' | 'startTime' | 'eligibleVoters' | 'votesCast' | 'turnoutPct' | 'positionsCount' | 'candidatesCount' | 'incidentsCount' | 'duration'

export function AnalyticsDashboard({ subdomain }: { subdomain?: string }) {
  const router = useRouter()
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState<'all' | '30d' | '90d'>('all')
  const [sortKey, setSortKey] = useState<SortKey>('startTime')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [tab, setTab] = useState<'overview' | 'compare'>('overview')

  useEffect(() => {
    let active = true
    api.getAnalytics(subdomain)
      .then((d) => { if (active) { setData(d as AnalyticsData); setError(null) } })
      .catch((e) => { if (active) { setError(e.message || 'Failed to load analytics'); toast.error(e.message || 'Failed to load analytics') } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [subdomain])

  // Filter vote timeline by the selected range (all / 30d / 90d)
  const filteredTimeline = useMemo(() => {
    if (!data) return []
    if (range === 'all') return data.voteTimeline
    if (range === '30d') return data.voteTimeline.slice(-30)
    // 90d — we only fetch 30 days from the API, so we just show all of it
    return data.voteTimeline
  }, [data, range])

  // Sorted election comparison rows
  const sortedElections = useMemo(() => {
    if (!data) return []
    const rows = [...data.electionComparison]
    rows.sort((a, b) => {
      let cmp = 0
      const av: any = a[sortKey]; const bv: any = b[sortKey]
      if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv
      else cmp = String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })
    return rows
  }, [data, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('desc') }
  }

  if (loading) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Crunching the numbers…</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-destructive/50" />
        <h2 className="mt-4 font-display text-xl font-bold">Analytics Unavailable</h2>
        <p className="mt-2 text-sm text-muted-foreground">{error || 'Could not load analytics for this workspace.'}</p>
        <Button onClick={() => router.refresh()} className="mt-4 gap-2"><Activity className="h-4 w-4" /> Retry</Button>
      </div>
    )
  }

  const org = data.organization
  const ov = data.overview

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
              {org.logoUrl ? (
                <img src={org.logoUrl} alt={org.name} className="h-12 w-12 rounded-xl object-contain" />
              ) : (
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
                  <BarChart3 className="h-6 w-6" />
                </div>
              )}
              <div>
                <h1 className="font-display text-2xl font-bold sm:text-3xl">Election Analytics</h1>
                <p className="text-sm text-muted-foreground">
                  Cross-election insights, turnout trends &amp; participation metrics for{' '}
                  <span className="font-medium text-foreground">{org.name}</span>.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Select value={range} onValueChange={(v) => setRange(v as any)}>
                <SelectTrigger className="w-[160px]" aria-label="Date range">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="90d">Last 90 Days</SelectItem>
                  <SelectItem value="30d">Last 30 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ---- Tab toggle: Overview / Compare ---- */}
      <div className="mb-6 flex items-center gap-2">
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'overview' | 'compare')} className="w-full">
          <TabsList>
            <TabsTrigger value="overview" className="gap-1.5">
              <BarChart3 className="h-4 w-4" /> Overview
            </TabsTrigger>
            <TabsTrigger value="compare" className="gap-1.5">
              <GitCompare className="h-4 w-4" /> Compare Elections
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {tab === 'compare' ? (
        <ElectionComparison subdomain={subdomain} />
      ) : (
      <>
      {/* ---- Overview stat cards ---- */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <OverviewStat
          icon={Vote} label="Total Elections" value={ov.totalElections}
          hint={data.participationByStatus.live > 0 ? `${data.participationByStatus.live} live now` : undefined}
          trend={data.participationByStatus.live > 0 ? 'up' : undefined}
          delay={0}
        />
        <OverviewStat
          icon={Users} label="Total Voters" value={ov.totalVoters.toLocaleString()}
          hint={`${data.voterEngagement.verifiedVoters} verified`}
          trend={data.voterEngagement.verifiedVoters > 0 ? 'up' : undefined}
          delay={50}
        />
        <OverviewStat
          icon={CheckCircle2} label="Votes Cast" value={ov.totalVotesCast.toLocaleString()}
          hint={ov.mostActiveElection ? `Top: ${ov.mostActiveElection.name}` : undefined}
          trend={ov.totalVotesCast > 0 ? 'up' : undefined}
          delay={100}
        />
        <OverviewStat
          icon={TrendingUp} label="Avg Turnout" value={`${ov.avgTurnout}%`}
          hint={ov.avgTurnout >= 50 ? 'Healthy' : 'Below target'}
          trend={ov.avgTurnout >= 50 ? 'up' : ov.avgTurnout > 0 ? 'down' : undefined}
          delay={150}
        />
        <OverviewStat
          icon={AlertTriangle} label="Open Incidents" value={data.incidentSummary.open}
          hint={data.incidentSummary.critical > 0 ? `${data.incidentSummary.critical} critical` : 'None critical'}
          trend={data.incidentSummary.open > 0 ? 'down' : 'up'}
          delay={200}
        />
        <OverviewStat
          icon={ShieldCheck} label="Verified Voters" value={ov.verifiedVoters.toLocaleString()}
          hint={`${data.voterEngagement.pendingVoters} pending`}
          trend={ov.verifiedVoters > 0 ? 'up' : undefined}
          delay={250}
        />
      </div>

      {/* ---- Charts row: Turnout trend + Participation donut ---- */}
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="lg:col-span-2"
        >
          <Card className="h-full">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="font-display text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" /> Turnout Trend
                </CardTitle>
                <Badge variant="outline" className="gap-1 text-xs">
                  <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: CHART_COLORS.emerald }} />
                  {data.turnoutTrend.length} elections
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {data.turnoutTrend.length === 0 ? (
                <EmptyChart label="No completed or live elections yet." />
              ) : (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.turnoutTrend} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.004 120)" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        tick={{ fontSize: 11, fill: CHART_COLORS.zinc500 }}
                        tickLine={false}
                        axisLine={{ stroke: 'oklch(0.88 0.004 120)' }}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tickFormatter={(v) => `${v}%`}
                        tick={{ fontSize: 11, fill: CHART_COLORS.zinc500 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(value: any, _name, item: any) => [
                          `${value}% turnout`,
                          item?.payload?.name || 'Election',
                        ]}
                        labelFormatter={(d) => new Date(d as string).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                      />
                      <Line
                        type="monotone"
                        dataKey="turnoutPct"
                        stroke={CHART_COLORS.emerald}
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: CHART_COLORS.emerald, strokeWidth: 0 }}
                        activeDot={{ r: 6, fill: CHART_COLORS.emeraldDark }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-base flex items-center gap-2">
                <PieIcon className="h-4 w-4 text-primary" /> Participation by Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ParticipationDonut data={data.participationByStatus} />
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ---- Vote timeline bar chart ---- */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="mb-6"
      >
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="font-display text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" /> Vote Timeline
              </CardTitle>
              <Badge variant="outline" className="text-xs">
                {range === 'all' ? 'Last 30 days' : range === '90d' ? 'Last 30 days' : 'Last 30 days'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {filteredTimeline.every((d) => d.count === 0) ? (
              <EmptyChart label="No votes recorded in this period." />
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={filteredTimeline} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.004 120)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      tick={{ fontSize: 10, fill: CHART_COLORS.zinc500 }}
                      tickLine={false}
                      axisLine={{ stroke: 'oklch(0.88 0.004 120)' }}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: CHART_COLORS.zinc500 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(v: any) => [`${v} votes`, 'Votes']}
                      labelFormatter={(d) => new Date(d as string).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={28}>
                      {filteredTimeline.map((entry, idx) => (
                        <Cell key={idx} fill={entry.count > 0 ? CHART_COLORS.emerald : CHART_COLORS.zinc400} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ---- Election comparison table ---- */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="mb-6"
      >
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" /> Election Comparison
            </CardTitle>
            <p className="text-xs text-muted-foreground">Click a row to open the election workspace. Click column headers to sort.</p>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <div className="votewise-scroll max-h-[28rem] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <SortableHead label="Name" k="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="min-w-[12rem]" />
                    <SortableHead label="Status" k="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortableHead label="Start" k="startTime" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortableHead label="Eligible" k="eligibleVoters" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
                    <SortableHead label="Voted" k="votesCast" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
                    <SortableHead label="Turnout" k="turnoutPct" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
                    <SortableHead label="Pos." k="positionsCount" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
                    <SortableHead label="Cand." k="candidatesCount" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
                    <SortableHead label="Inc." k="incidentsCount" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
                    <SortableHead label="Duration" k="duration" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedElections.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="py-10 text-center text-sm text-muted-foreground">
                        No elections in this workspace yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedElections.map((e) => (
                      <TableRow
                        key={e.id}
                        onClick={() => router.push(subdomain ? `/workspace/elections/${e.id}?org=${encodeURIComponent(subdomain)}` : `/workspace/elections/${e.id}`)}
                        className="cursor-pointer transition-colors hover:bg-muted/40"
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Vote className="h-3.5 w-3.5 shrink-0 text-primary/70" />
                            <span className="truncate">{e.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={cn('capitalize', STATUS_BADGE_CLASS[e.status] || '')}>
                            {e.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {new Date(e.startTime).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">{e.eligibleVoters.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{e.votesCast.toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          <span className={cn('font-mono text-xs font-semibold', e.turnoutPct >= 50 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400')}>
                            {e.turnoutPct}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">{e.positionsCount}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{e.candidatesCount}</TableCell>
                        <TableCell className="text-right">
                          {e.incidentsCount > 0 ? (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">{e.incidentsCount}</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{e.duration}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ---- Bottom row: Top elections + Incident summary + Voter engagement ---- */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Top elections by turnout */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.25 }}>
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-base flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-600" /> Top Elections by Turnout
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.topElectionsByTurnout.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No completed elections yet.</p>
              ) : (
                data.topElectionsByTurnout.map((e, i) => (
                  <div key={e.id} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className={cn(
                          'grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-bold',
                          i === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                            : i === 1 ? 'bg-zinc-200 text-zinc-700 dark:bg-zinc-500/20 dark:text-zinc-300'
                              : i === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300'
                                : 'bg-muted text-muted-foreground',
                        )}>
                          {i + 1}
                        </span>
                        <span className="truncate text-sm font-medium">{e.name}</span>
                      </div>
                      <span className="shrink-0 font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">{e.turnoutPct}%</span>
                    </div>
                    <Progress value={e.turnoutPct} className="h-2 [&_[data-slot=progress-indicator]]:bg-emerald-500" />
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>{e.votesCast.toLocaleString()} of {e.eligibleVoters.toLocaleString()} voters</span>
                      <span>{new Date(e.startTime).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Incident summary */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.3 }}>
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" /> Incident Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <IncidentStat label="Total" value={data.incidentSummary.total} icon={AlertTriangle} tone="zinc" />
                <IncidentStat label="Open" value={data.incidentSummary.open} icon={Clock} tone="amber" />
                <IncidentStat label="Critical" value={data.incidentSummary.critical} icon={AlertTriangle} tone="red" />
                <IncidentStat label="Resolved" value={data.incidentSummary.resolved} icon={CheckCircle2} tone="emerald" />
              </div>
              <Separator />
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Resolved Rate</span>
                  <span className="font-mono font-bold">{data.incidentSummary.resolvedRate}%</span>
                </div>
                <Progress value={data.incidentSummary.resolvedRate} className="h-2 [&_[data-slot=progress-indicator]]:bg-emerald-500" />
              </div>
              {data.incidentSummary.critical > 0 && (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 p-2.5 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{data.incidentSummary.critical} critical incident{data.incidentSummary.critical === 1 ? '' : 's'} need immediate attention.</span>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Voter engagement */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.35 }}>
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" /> Voter Engagement
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <EngagementRow label="Total Voters" value={data.voterEngagement.totalVoters} total={data.voterEngagement.totalVoters} color={CHART_COLORS.zinc500} />
              <EngagementRow label="Verified" value={data.voterEngagement.verifiedVoters} total={data.voterEngagement.totalVoters} color={CHART_COLORS.emerald} />
              <EngagementRow label="Active (voted)" value={data.voterEngagement.activeVoters} total={data.voterEngagement.totalVoters} color={CHART_COLORS.emeraldDark} />
              <EngagementRow label="Pending Verification" value={data.voterEngagement.pendingVoters} total={data.voterEngagement.totalVoters} color={CHART_COLORS.amber} />
              <EngagementRow label="Suspended" value={data.voterEngagement.suspendedVoters} total={data.voterEngagement.totalVoters} color={CHART_COLORS.amberDark} />
              <Separator />
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-2.5 text-xs text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                <Award className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {data.voterEngagement.totalVoters > 0
                    ? `${Math.round((data.voterEngagement.activeVoters / data.voterEngagement.totalVoters) * 100)}% of registered voters have cast at least one vote.`
                    : 'No voters registered yet.'}
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Footer note */}
      <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <Building2 className="h-3 w-3" />
        Generated for {org.name}
        {org.subdomain && <span className="font-mono">· {org.subdomain}.votewise.com.ng</span>}
        {data.generatedAt && <span>· {new Date(data.generatedAt).toLocaleString()}</span>}
      </p>
      </>
      )}
    </div>
  )
}

// ---- Sub-components ----

const tooltipStyle = {
  borderRadius: 8,
  border: '1px solid oklch(0.88 0.004 120)',
  background: 'oklch(1 0 0)',
  fontSize: 12,
  boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
}

function OverviewStat({
  icon: Icon, label, value, hint, trend, delay = 0,
}: {
  icon: any; label: string; value: string | number; hint?: string; trend?: 'up' | 'down'; delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
    >
      <Card className="h-full">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </div>
            {trend === 'up' && <ArrowUp className="h-4 w-4 text-emerald-600" aria-label="up" />}
            {trend === 'down' && <ArrowDown className="h-4 w-4 text-amber-600" aria-label="down" />}
          </div>
          <div className="mt-3">
            <div className="font-display text-2xl font-bold leading-tight">{value}</div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
            {hint && <div className="mt-1 truncate text-[11px] text-muted-foreground/80">{hint}</div>}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function SortableHead({
  label, k, sortKey, sortDir, onSort, align = 'left', className,
}: {
  label: string; k: SortKey; sortKey: SortKey; sortDir: 'asc' | 'desc'
  onSort: (k: SortKey) => void; align?: 'left' | 'right'; className?: string
}) {
  const active = sortKey === k
  return (
    <TableHead className={cn(className)}>
      <button
        type="button"
        onClick={() => onSort(k)}
        className={cn(
          'flex items-center gap-1 text-xs font-semibold uppercase tracking-wider transition-colors hover:text-foreground',
          align === 'right' ? 'ml-auto' : '',
          active ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {label}
        {active ? (
          sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronsUpDownMuted />
        )}
      </button>
    </TableHead>
  )
}

function ChevronsUpDownMuted() {
  return (
    <span className="inline-flex flex-col leading-none text-muted-foreground/40">
      <ChevronUp className="h-2.5 w-2.5" />
      <ChevronDown className="h-2.5 w-2.5" />
    </span>
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

function ParticipationDonut({ data }: { data: { live: number; upcoming: number; completed: number; draft: number; archived: number } }) {
  const segments = [
    { name: 'Live', value: data.live, color: STATUS_COLORS.live },
    { name: 'Upcoming', value: data.upcoming, color: STATUS_COLORS.upcoming },
    { name: 'Completed', value: data.completed, color: STATUS_COLORS.completed },
    { name: 'Draft', value: data.draft, color: STATUS_COLORS.draft },
    { name: 'Archived', value: data.archived, color: STATUS_COLORS.archived },
  ].filter((s) => s.value > 0)

  const total = segments.reduce((a, s) => a + s.value, 0)

  if (total === 0) {
    return <EmptyChart label="No elections yet." />
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="h-48 w-full sm:h-44 sm:w-44 sm:shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={segments}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={48}
              outerRadius={72}
              paddingAngle={2}
              stroke="none"
            >
              {segments.map((s, i) => (
                <Cell key={i} fill={s.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(v: any, n: any) => [`${v} election${v === 1 ? '' : 's'}`, n]}
            />
            <Legend
              iconType="circle"
              wrapperStyle={{ fontSize: 11 }}
              formatter={(value) => <span className="text-muted-foreground">{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="w-full space-y-1.5">
        {segments.map((s) => (
          <div key={s.name} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="text-muted-foreground">{s.name}</span>
            </span>
            <span className="font-mono font-medium">{s.value}</span>
          </div>
        ))}
        <Separator className="my-1" />
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Total</span>
          <span className="font-mono font-bold">{total}</span>
        </div>
      </div>
    </div>
  )
}

function IncidentStat({
  label, value, icon: Icon, tone,
}: {
  label: string; value: number; icon: any; tone: 'zinc' | 'amber' | 'red' | 'emerald'
}) {
  const toneClass = {
    zinc: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-300',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    red: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
    emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  }[tone]
  return (
    <div className="rounded-lg border border-border/60 p-3">
      <div className={cn('grid h-7 w-7 place-items-center rounded-md', toneClass)}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="mt-2 font-display text-xl font-bold leading-none">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  )
}

function EngagementRow({
  label, value, total, color,
}: {
  label: string; value: number; total: number; color: string
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">
          <span className="font-semibold">{value.toLocaleString()}</span>
          <span className="ml-1 text-xs text-muted-foreground">({pct}%)</span>
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.max(1, pct)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}
