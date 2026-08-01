'use client'

import { useEffect, useState, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import {
  Users, Vote, TrendingUp, Activity, Clock, Shield, AlertCircle,
  Server, Zap, Eye, Radio,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

interface LiveStats {
  electionId: string
  electionName: string
  status: string
  eligibleVoters: number
  votesCast: number
  turnoutPct: number
  invalidVotes: number
  blankVotes: number
  lastVoteAt?: string
  votesByPosition: Array<{ positionId: string; title: string; count: number }>
  votesByCandidate: Array<{ positionId: string; candidateId: string; candidateName: string; photo?: string; count: number }>
  recentActivity: Array<{ type: string; timestamp: string; description: string; actor?: string }>
  systemHealth: { activeSessions: number; ballotsGenerated: number; errorsToday: number }
  showCandidateResults: boolean
  votingWindow: { start: string; end: string }
}

export function LiveVoteMonitor({ electionId, subdomain }: { electionId: string; subdomain?: string }) {
  const [stats, setStats] = useState<LiveStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pulse, setPulse] = useState(false)
  const socketRef = useRef<Socket | null>(null)

  // Initial load + polling fallback.
  async function load() {
    try {
      const d = await api.getElectionLive(electionId, subdomain)
      setStats(d)
      setError(null)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 5000)

    // WebSocket for real-time updates.
    const socket = io('/?XTransformPort=3030', { path: '/', transports: ['websocket', 'polling'], reconnection: true })
    socketRef.current = socket
    socket.on('connect', () => socket.emit('subscribe', { electionId }))
    socket.on('sve:live', (data: any) => {
      if (data.electionId === electionId) {
        setStats(data)
        setPulse(true)
        setTimeout(() => setPulse(false), 600)
      }
    })
    socket.on('sve:vote-cast', () => {
      setPulse(true)
      setTimeout(() => setPulse(false), 600)
    })
    return () => { clearInterval(interval); socket.disconnect() }
  }, [electionId, subdomain])

  if (loading) {
    return <div className="grid min-h-[40vh] place-items-center"><div className="text-sm text-muted-foreground">Loading live monitor…</div></div>
  }
  if (error && !stats) {
    return <Card><CardContent className="py-8 text-center text-sm text-destructive">{error}</CardContent></Card>
  }
  if (!stats) return null

  const timeRemaining = new Date(stats.votingWindow.end).getTime() - Date.now()

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className={cn('votewise-card-glow transition-all', pulse && 'ring-2 ring-emerald-500/40')}>
        <CardContent className="p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Badge variant="secondary" className="mb-1 gap-1">
                <Radio className="h-3 w-3" />
                <span className="votewise-live-dot inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                Live Monitor
              </Badge>
              <h2 className="font-display text-xl font-bold">{stats.electionName}</h2>
              <p className="text-xs text-muted-foreground">Status: {stats.status} · {stats.showCandidateResults ? 'Results visible' : 'Results hidden until close'}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-primary">
                <Clock className="h-4 w-4" />
                <span className="font-mono tabular-nums">{formatDuration(timeRemaining)}</span>
              </div>
              <p className="text-[10px] text-muted-foreground">Time remaining</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stat grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Users} label="Eligible Voters" value={stats.eligibleVoters.toLocaleString()} color="text-blue-600" bg="bg-blue-100" />
        <StatCard icon={Vote} label="Votes Cast" value={stats.votesCast.toLocaleString()} color="text-emerald-600" bg="bg-emerald-100" pulse={pulse} />
        <StatCard icon={TrendingUp} label="Turnout" value={`${stats.turnoutPct}%`} color="text-amber-600" bg="bg-amber-100" />
        <StatCard icon={Activity} label="Active Sessions" value={stats.systemHealth.activeSessions.toLocaleString()} color="text-purple-600" bg="bg-purple-100" />
      </div>

      {/* Turnout progress */}
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Turnout Progress</CardTitle></CardHeader>
        <CardContent>
          <Progress value={stats.turnoutPct} className="h-3" />
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span>{stats.votesCast.toLocaleString()} of {stats.eligibleVoters.toLocaleString()} voters</span>
            <span>{(stats.eligibleVoters - stats.votesCast).toLocaleString()} remaining</span>
          </div>
          {stats.lastVoteAt && (
            <p className="mt-2 text-xs text-muted-foreground">Last vote: {timeAgo(stats.lastVoteAt)}</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Per-position counts */}
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Vote className="h-4 w-4 text-primary" /> Votes by Position</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-80 overflow-y-auto">
            {stats.votesByPosition.length === 0 ? (
              <p className="text-sm text-muted-foreground">No positions yet.</p>
            ) : stats.votesByPosition.map((p) => {
              const max = Math.max(...stats.votesByPosition.map((x) => x.count), 1)
              return (
                <div key={p.positionId} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{p.title}</span>
                    <span className="text-muted-foreground">{p.count.toLocaleString()}</span>
                  </div>
                  <Progress value={(p.count / max) * 100} className="h-1.5" />
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /> Recent Activity</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-80 overflow-y-auto">
            {stats.recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <AnimatePresence>
                {stats.recentActivity.slice(0, 15).map((a, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-start gap-2 rounded-lg border border-border/40 p-2 text-xs"
                  >
                    <div className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                      <Zap className="h-3 w-3" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{a.description}</div>
                      <div className="text-muted-foreground">{a.actor && <span>{a.actor} · </span>}{timeAgo(a.timestamp)}</div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Candidate results (if visible) */}
      {stats.showCandidateResults && stats.votesByCandidate.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Eye className="h-4 w-4 text-primary" /> Live Candidate Results</CardTitle></CardHeader>
          <CardContent className="space-y-3 max-h-96 overflow-y-auto">
            {Object.entries(
              stats.votesByCandidate.reduce((acc: Record<string, typeof stats.votesByCandidate>, c) => {
                (acc[c.positionId] = acc[c.positionId] || []).push(c)
                return acc
              }, {})
            ).map(([posId, candidates]) => {
              const pos = stats.votesByPosition.find((p) => p.positionId === posId)
              const max = Math.max(...candidates.map((c) => c.count), 0)
              return (
                <div key={posId}>
                  <div className="mb-1 text-sm font-medium">{pos?.title || 'Position'}</div>
                  <div className="space-y-1">
                    {candidates.sort((a, b) => b.count - a.count).map((c) => (
                      <div key={c.candidateId} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className={cn('font-medium', c.count === max && c.count > 0 && 'text-emerald-600')}>{c.candidateName}</span>
                          <span className="text-muted-foreground">{c.count}</span>
                        </div>
                        <Progress value={max > 0 ? (c.count / max) * 100 : 0} className="h-1.5" />
                      </div>
                    ))}
                  </div>
                  <Separator className="my-2" />
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* System health */}
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Server className="h-4 w-4 text-primary" /> System Health</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-2xl font-bold text-emerald-600">{stats.systemHealth.ballotsGenerated.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Ballots Generated</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">{stats.systemHealth.activeSessions.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Active Sessions</div>
            </div>
            <div>
              <div className={cn('text-2xl font-bold', stats.systemHealth.errorsToday === 0 ? 'text-emerald-600' : 'text-destructive')}>{stats.systemHealth.errorsToday}</div>
              <div className="text-xs text-muted-foreground">Errors Today</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
        <Shield className="h-4 w-4 shrink-0 text-primary" />
        <span>Observers see aggregate transparency metrics only. No individual ballots or voter choices are ever exposed.</span>
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color, bg, pulse }: { icon: any; label: string; value: string; color: string; bg: string; pulse?: boolean }) {
  return (
    <Card className={cn('transition-all', pulse && 'ring-2 ring-emerald-500/30')}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className={cn('grid h-9 w-9 place-items-center rounded-lg', bg)}>
            <Icon className={cn('h-4 w-4', color)} />
          </div>
        </div>
        <div className="mt-2 text-2xl font-bold tabular-nums">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  )
}

function formatDuration(ms: number): string {
  if (ms <= 0) return 'Closed'
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  return `${Math.floor(hr / 24)}d ago`
}
