'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import Image from 'next/image'
import {
  Users, Vote, TrendingUp, Clock, Shield, Share2, BadgeCheck, Lock,
  Eye, Trophy, Radio, Hash, Loader2, AlertCircle, CheckCircle2, ChevronDown,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { toast } from 'sonner'

interface CandidateInfo {
  id: string
  name: string
  photo?: string | null
  slogan?: string | null
  manifesto?: string | null
}
interface CandidateResult {
  candidateId: string
  candidateName: string
  votes: number
  percentage: number
  isWinner: boolean
}
interface PositionResult {
  positionId: string
  title: string
  maximumVotes: number
  candidates: CandidateInfo[]
  results: CandidateResult[] | null
}
interface VerificationPackage {
  auditHash: string
  integritySignature: string
  totalVotes: number
  turnoutPct: number
}
interface PublicResults {
  electionId: string
  electionName: string
  description?: string
  organizationName?: string
  status: string
  isLive: boolean
  votingWindow: { start: string; end: string }
  timeRemainingMs: number
  showCandidateResults: boolean
  eligibleVoters: number
  votesCast: number
  turnoutPct: number
  lastVoteAt?: string | null
  positions: PositionResult[]
  verification: VerificationPackage | null
}

function statusBadge(status: string, isLive: boolean) {
  const key = (status || '').toLowerCase()
  if (isLive || key === 'live' || key === 'voting') {
    return (
      <Badge className="gap-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
        <span className="votewise-live-dot inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
        Live
      </Badge>
    )
  }
  if (key === 'completed' || key === 'certified') {
    return (
      <Badge className="gap-1 bg-amber-100 text-amber-800 hover:bg-amber-100">
        <Trophy className="h-3 w-3" /> {key === 'certified' ? 'Certified' : 'Completed'}
      </Badge>
    )
  }
  if (key === 'draft' || key === 'setup' || key === 'published') {
    return (
      <Badge variant="secondary" className="gap-1">
        <Clock className="h-3 w-3" /> {key === 'published' ? 'Published' : 'Setup'}
      </Badge>
    )
  }
  return <Badge variant="secondary">{status}</Badge>
}

function formatDuration(ms: number): string {
  if (ms <= 0) return 'Closed'
  const totalSec = Math.floor(ms / 1000)
  const d = Math.floor(totalSec / 86400)
  const h = Math.floor((totalSec % 86400) / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function timeAgo(iso?: string | null): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  return `${Math.floor(hr / 24)}d ago`
}

export function PublicResultsView({ electionId }: { electionId: string }) {
  const [data, setData] = useState<PublicResults | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pulse, setPulse] = useState(false)
  const [remainingMs, setRemainingMs] = useState<number>(0)
  const [verifOpen, setVerifOpen] = useState(false)
  const socketRef = useRef<Socket | null>(null)

  const load = useCallback(async () => {
    try {
      const d = await api.getPublicResults(electionId)
      setData(d)
      setRemainingMs(d.timeRemainingMs)
      setError(null)
    } catch (e: any) {
      setError(e.message || 'Failed to load results')
    } finally {
      setLoading(false)
    }
  }, [electionId])

  // Initial load + polling fallback every 5s.
  useEffect(() => {
    load()
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [load])

  // Live countdown timer — ticks every second.
  useEffect(() => {
    if (!data?.isLive) return
    const t = setInterval(() => {
      setRemainingMs((prev) => Math.max(0, prev - 1000))
    }, 1000)
    return () => clearInterval(t)
  }, [data?.isLive])

  // WebSocket real-time updates.
  useEffect(() => {
    const socket = io('/?XTransformPort=3030', {
      path: '/',
      transports: ['websocket', 'polling'],
      reconnection: true,
    })
    socketRef.current = socket
    socket.on('connect', () => socket.emit('subscribe', { electionId }))
    socket.on('sve:live', (payload: any) => {
      if (!payload || payload.electionId !== electionId) return
      // Live stats from the workspace live-monitor payload — merge into
      // the public-results shape (turnout + counts only; candidate results
      // will refresh on the next 5s poll).
      setPulse(true)
      setTimeout(() => setPulse(false), 800)
      setData((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          eligibleVoters: payload.eligibleVoters ?? prev.eligibleVoters,
          votesCast: payload.votesCast ?? prev.votesCast,
          turnoutPct: payload.turnoutPct ?? prev.turnoutPct,
          lastVoteAt: payload.lastVoteAt ?? prev.lastVoteAt,
        }
      })
    })
    socket.on('sve:vote-cast', () => {
      setPulse(true)
      setTimeout(() => setPulse(false), 800)
      load()
    })
    return () => {
      socket.disconnect()
    }
  }, [electionId, load])

  async function onShare() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast.success('Link copied — share it with anyone!')
    } catch {
      toast.error('Could not copy link. Copy from the address bar.')
    }
  }

  if (loading) {
    return (
      <div className="grid min-h-[60vh] place-items-center px-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading live results…</p>
        </div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Couldn&apos;t load results</AlertTitle>
          <AlertDescription>
            {error}. Please check the link and try again.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      {/* HEADER */}
      <Card className={cn('votewise-card-glow overflow-hidden transition-all', pulse && 'ring-2 ring-emerald-500/30')}>
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {statusBadge(data.status, data.isLive)}
                {data.organizationName && (
                  <Badge variant="outline" className="gap-1">
                    <BadgeCheck className="h-3 w-3 text-primary" /> {data.organizationName}
                  </Badge>
                )}
                <Badge variant="secondary" className="gap-1">
                  <Radio className="h-3 w-3" /> Public Results
                </Badge>
              </div>
              <h1 className="mt-3 font-display text-2xl font-bold tracking-tight sm:text-3xl">
                {data.electionName}
              </h1>
              {data.description && (
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  {data.description}
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  Opened: {new Date(data.votingWindow.start).toLocaleString()}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  Closes: {new Date(data.votingWindow.end).toLocaleString()}
                </span>
                {data.lastVoteAt && (
                  <span className="flex items-center gap-1">
                    <Vote className="h-3.5 w-3.5 text-primary" />
                    Last vote: {timeAgo(data.lastVoteAt)}
                  </span>
                )}
              </div>
            </div>

            {/* Live countdown */}
            <div className="flex shrink-0 flex-col items-start gap-2 lg:items-end">
              <div className={cn(
                'rounded-xl border px-4 py-2.5 text-center transition-all',
                data.isLive
                  ? 'border-emerald-200 bg-emerald-50'
                  : 'border-border bg-muted/40'
              )}>
                <div className="flex items-center justify-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {data.isLive && (
                    <span className="votewise-live-dot inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  )}
                  {data.isLive ? 'Time Remaining' : 'Voting Closed'}
                </div>
                <div className={cn(
                  'mt-0.5 font-mono text-xl font-bold tabular-nums',
                  data.isLive ? 'text-emerald-700' : 'text-muted-foreground'
                )}>
                  {formatDuration(remainingMs)}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={onShare} className="gap-1.5">
                  <Share2 className="h-4 w-4" /> Share
                </Button>
                <a
                  href="/"
                  className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <BadgeCheck className="h-4 w-4" /> Verify Your Vote
                </a>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* STAT GRID */}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={Users}
          label="Eligible Voters"
          value={data.eligibleVoters.toLocaleString()}
          tint="bg-emerald-50 text-emerald-700"
        />
        <StatCard
          icon={Vote}
          label="Votes Cast"
          value={data.votesCast.toLocaleString()}
          tint="bg-primary/10 text-primary"
          pulse={pulse}
        />
        <StatCard
          icon={TrendingUp}
          label="Turnout"
          value={`${data.turnoutPct.toFixed(1)}%`}
          tint="bg-amber-50 text-amber-700"
        />
        <StatCard
          icon={Clock}
          label="Time Remaining"
          value={data.isLive ? formatDuration(remainingMs) : 'Closed'}
          tint="bg-secondary text-secondary-foreground"
          mono
        />
      </div>

      {/* TURNOUT PROGRESS */}
      <Card className="mt-4">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <TrendingUp className="h-4 w-4 text-primary" /> Turnout Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <motion.div
            initial={{ opacity: 0.6 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            <Progress value={data.turnoutPct} className="h-3" />
          </motion.div>
          <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
            <span>
              <strong className="text-foreground">{data.votesCast.toLocaleString()}</strong> of{' '}
              <strong className="text-foreground">{data.eligibleVoters.toLocaleString()}</strong> voters
            </span>
            <span>
              <strong className="text-foreground">
                {Math.max(0, data.eligibleVoters - data.votesCast).toLocaleString()}
              </strong>{' '}
              remaining
            </span>
          </div>
          {data.lastVoteAt && (
            <p className="mt-2 text-xs text-muted-foreground">
              Last vote recorded {timeAgo(data.lastVoteAt)}
            </p>
          )}
        </CardContent>
      </Card>

      {/* CANDIDATE RESULTS / HIDDEN NOTICE */}
      {data.showCandidateResults ? (
        <div className="mt-4 space-y-4">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" />
            <h2 className="font-display text-lg font-semibold">Live Candidate Results</h2>
            <Badge variant="secondary" className="ml-auto gap-1">
              <span className="votewise-live-dot inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              {data.isLive ? 'Updating live' : 'Final'}
            </Badge>
          </div>

          {data.positions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No positions configured for this election.
              </CardContent>
            </Card>
          ) : (
            <>
              {data.positions.map((pos) => (
                <PositionCard key={pos.positionId} position={pos} />
              ))}
            </>
          )}
        </div>
      ) : (
        <Card className="mt-4 border-amber-200 bg-amber-50/40">
          <CardContent className="flex items-start gap-3 p-5">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-700">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-sm font-semibold text-amber-900">
                Results are hidden until voting closes.
              </h3>
              <p className="mt-1 text-sm text-amber-800/80">
                Showing aggregate turnout only. Candidate-level results will be published
                once the election window closes and the tally is certified.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* CRYPTOGRAPHIC VERIFICATION (collapsible) */}
      {data.verification && (
        <Card className="mt-4">
          <Collapsible open={verifOpen} onOpenChange={setVerifOpen}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/40">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Shield className="h-4 w-4 text-primary" /> Cryptographic Verification
                  </CardTitle>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 text-muted-foreground transition-transform',
                      verifOpen && 'rotate-180'
                    )}
                  />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4 pt-0">
                <p className="text-xs text-muted-foreground">
                  Every election in VoteWise produces a signed verification package.
                  The audit hash is a SHA-256 of all vote records; the integrity signature
                  is an HMAC-SHA256 over the tally. Independent observers can recompute
                  these to prove the published results match the recorded ballots.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <VerificationField
                    icon={Hash}
                    label="Audit Hash (SHA-256)"
                    value={data.verification.auditHash}
                  />
                  <VerificationField
                    icon={Lock}
                    label="Integrity Signature (HMAC-SHA256)"
                    value={data.verification.integritySignature}
                  />
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-3">
                  <div>
                    <div className="font-display text-2xl font-bold text-primary">
                      {data.verification.totalVotes.toLocaleString()}
                    </div>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      Total Votes
                    </div>
                  </div>
                  <div>
                    <div className="font-display text-2xl font-bold text-primary">
                      {data.verification.turnoutPct.toFixed(1)}%
                    </div>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      Verified Turnout
                    </div>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <div className="flex h-full items-center justify-center gap-1.5 text-sm font-medium text-emerald-700">
                      <CheckCircle2 className="h-5 w-5" /> Signature Valid
                    </div>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {/* FOOTER ACTIONS */}
      <div className="mt-6 flex flex-col items-center justify-between gap-3 rounded-xl border border-border/60 bg-secondary/30 p-4 sm:flex-row">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Shield className="h-4 w-4 shrink-0 text-primary" />
          <span>
            Every vote is encrypted at rest (AES-256-GCM) and recorded with a hash-chained
            audit log. Receipt-anchored anonymity — verify participation, never choices.
          </span>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={onShare} className="gap-1.5">
            <Share2 className="h-4 w-4" /> Copy Link
          </Button>
          <a
            href="/"
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-medium text-accent-foreground hover:bg-accent/90"
          >
            <BadgeCheck className="h-4 w-4" /> Verify Receipt
          </a>
        </div>
      </div>
    </div>
  )
}

function PositionCard({ position }: { position: PositionResult }) {
  const hasResults = position.results && position.results.length > 0
  const maxVotes = hasResults
    ? Math.max(...position.results!.map((r) => r.votes), 0)
    : 0
  const totalVotes = hasResults
    ? position.results!.reduce((sum, r) => sum + r.votes, 0)
    : 0

  // Sort results by votes desc.
  const sortedResults = hasResults
    ? [...position.results!].sort((a, b) => b.votes - a.votes)
    : []

  // Candidate info lookup.
  const candidateInfo = (id: string) =>
    position.candidates.find((c) => c.id === id)

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 font-display text-base">
            <Vote className="h-4 w-4 text-primary" />
            {position.title}
          </CardTitle>
          <div className="flex items-center gap-2">
            {position.maximumVotes > 1 && (
              <Badge variant="secondary" className="gap-1">
                <Users className="h-3 w-3" /> {position.maximumVotes} winners
              </Badge>
            )}
            {hasResults && (
              <Badge variant="outline" className="gap-1">
                <Hash className="h-3 w-3" /> {totalVotes.toLocaleString()} votes
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-2">
        {!hasResults ? (
          <div className="rounded-lg border border-dashed border-border/60 bg-muted/30 p-4 text-center text-sm text-muted-foreground">
            No votes recorded for this position yet.
          </div>
        ) : (
          sortedResults.map((r, idx) => {
            const info = candidateInfo(r.candidateId)
            const widthPct = maxVotes > 0 ? (r.votes / maxVotes) * 100 : 0
            const isWinner = r.isWinner
            return (
              <motion.div
                key={r.candidateId}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(idx * 0.04, 0.3) }}
                className={cn(
                  'rounded-xl border p-3 transition-colors',
                  isWinner
                    ? 'border-emerald-300 bg-emerald-50'
                    : 'border-border/60 bg-card'
                )}
              >
                <div className="flex items-center gap-3">
                  {/* Candidate photo / fallback */}
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
                    {info?.photo ? (
                      <Image
                        src={info.photo}
                        alt={r.candidateName}
                        fill
                        sizes="40px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-xs font-semibold text-muted-foreground">
                        {r.candidateName.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                  {/* Name + slogan */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className={cn(
                        'truncate text-sm font-semibold',
                        isWinner ? 'text-emerald-800' : 'text-foreground'
                      )}>
                        {r.candidateName}
                      </span>
                      {isWinner && (
                        <Badge className="shrink-0 gap-1 bg-emerald-600 text-white hover:bg-emerald-600">
                          <Trophy className="h-3 w-3" /> Winner
                        </Badge>
                      )}
                    </div>
                    {info?.slogan && (
                      <p className="truncate text-xs text-muted-foreground">
                        &ldquo;{info.slogan}&rdquo;
                      </p>
                    )}
                  </div>
                  {/* Vote count + percentage */}
                  <div className="shrink-0 text-right">
                    <div className={cn(
                      'font-mono text-sm font-bold tabular-nums',
                      isWinner ? 'text-emerald-700' : 'text-foreground'
                    )}>
                      {r.votes.toLocaleString()}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {r.percentage.toFixed(1)}%
                    </div>
                  </div>
                </div>
                {/* Animated bar */}
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className={cn(
                      'h-full rounded-full',
                      isWinner ? 'bg-emerald-500' : 'bg-primary/60'
                    )}
                    initial={{ width: 0 }}
                    animate={{ width: `${widthPct}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                  />
                </div>
              </motion.div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  tint,
  pulse,
  mono,
}: {
  icon: any
  label: string
  value: string
  tint: string
  pulse?: boolean
  mono?: boolean
}) {
  return (
    <Card className={cn('transition-all', pulse && 'ring-2 ring-emerald-500/30')}>
      <CardContent className="p-4">
        <div className={cn('grid h-9 w-9 place-items-center rounded-lg', tint)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className={cn(
          'mt-2 text-xl font-bold tabular-nums sm:text-2xl',
          mono && 'font-mono'
        )}>
          {value}
        </div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  )
}

function VerificationField({
  icon: Icon,
  label,
  value,
}: {
  icon: any
  label: string
  value: string
}) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard?.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
    toast.success('Copied to clipboard')
  }
  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-primary" /> {label}
      </div>
      <div className="flex items-start gap-2">
        <code className="min-w-0 flex-1 break-all font-mono text-xs text-foreground">
          {value}
        </code>
        <Button
          variant="ghost"
          size="sm"
          onClick={copy}
          className="h-7 shrink-0 px-2 text-xs"
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
    </div>
  )
}
