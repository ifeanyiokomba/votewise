'use client'

import { useEffect, useState } from 'react'
import {
  Eye, Loader2, Users, CheckCircle2, Clock, Search, Ticket,
  TrendingUp, Building2, GraduationCap, Download, LogOut, BarChart3, Activity,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useApp } from '@/lib/store'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { TurnoutRing, StatusBadge } from '@/components/votewise/shared'
import { LiveResultsPanel } from '@/components/votewise/live-results'
import { LiveVoteFeed } from '@/components/votewise/live-vote-feed'
import { cn } from '@/lib/utils'

export function ObserverAnalyticsView() {
  const { official, setOfficial, setView } = useApp()
  const [tab, setTab] = useState('analytics')
  function logout() { api.logout().catch(() => {}); setOfficial(null); setView('home') }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-2xl font-bold">Observer Desk</h1>
          <p className="text-sm text-muted-foreground">{official?.name} · {official?.organization} · <Badge variant="secondary">Observer</Badge></p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.open(api.exportResults('csv'))} className="gap-1.5"><Download className="h-4 w-4" /> Export</Button>
          <Button variant="outline" onClick={logout} className="gap-1.5"><LogOut className="h-4 w-4" /> Sign out</Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="votewise-scroll mb-6 flex w-full max-w-full overflow-x-auto">
          <TabsTrigger value="analytics" className="gap-1.5"><TrendingUp className="h-4 w-4" /> Live Analytics</TabsTrigger>
          <TabsTrigger value="feed" className="gap-1.5"><Activity className="h-4 w-4" /> Vote Feed</TabsTrigger>
          <TabsTrigger value="results" className="gap-1.5"><BarChart3 className="h-4 w-4" /> Results</TabsTrigger>
          <TabsTrigger value="voters" className="gap-1.5"><Users className="h-4 w-4" /> Voter Search</TabsTrigger>
          <TabsTrigger value="tickets" className="gap-1.5"><Ticket className="h-4 w-4" /> Support Tickets</TabsTrigger>
        </TabsList>
        <TabsContent value="analytics"><AnalyticsTab /></TabsContent>
        <TabsContent value="feed"><LiveVoteFeed /></TabsContent>
        <TabsContent value="results"><LiveResultsPanel /></TabsContent>
        <TabsContent value="voters"><VoterSearchTab /></TabsContent>
        <TabsContent value="tickets"><TicketsTab /></TabsContent>
      </Tabs>
    </div>
  )
}

function AnalyticsTab() {
  const [data, setData] = useState<any>(null)
  useEffect(() => {
    let active = true
    async function load() { try { const d = await api.observerAnalytics(); if (active) setData(d) } catch (e: any) { toast.error(e.message) } }
    load(); const t = setInterval(load, 5000); return () => { active = false; clearInterval(t) }
  }, [])
  if (!data) return <Loader2 className="h-6 w-6 animate-spin text-primary" />
  const { summary, byFaculty, byLevel, election, recentVotes } = data
  const now = Date.now()
  const buckets = new Array(12).fill(0)
  recentVotes.forEach((t: string) => { const idx = 11 - Math.floor((now - new Date(t).getTime()) / (5 * 60 * 1000)); if (idx >= 0 && idx < 12) buckets[idx]++ })
  const maxBucket = Math.max(1, ...buckets)
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="votewise-card-glow"><CardContent className="flex items-center gap-4 py-4"><TurnoutRing voted={summary.voted} total={summary.totalVoters} pct={summary.turnoutPct} /><div><div className="text-xs uppercase tracking-wider text-muted-foreground">Turnout</div><div className="font-display text-xl font-bold">{summary.turnoutPct}%</div></div></CardContent></Card>
        <StatCard icon={CheckCircle2} label="Votes Cast" value={summary.voted} accent />
        <StatCard icon={Clock} label="Pending" value={summary.pending} />
        <StatCard icon={Ticket} label="Open Tickets" value={summary.ticketsOpen} />
      </div>
      <Card>
        <CardHeader><CardTitle className="font-display text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Votes in the last hour</CardTitle></CardHeader>
        <CardContent>
          <div className="flex h-32 items-end gap-1.5">
            {buckets.map((v, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1"><div className="w-full rounded-t bg-primary transition-all" style={{ height: `${(v / maxBucket) * 100}%`, minHeight: 2 }} /><span className="text-[9px] text-muted-foreground">-{(12 - i) * 5}m</span></div>
            ))}
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="font-display text-base flex items-center gap-2"><Building2 className="h-4 w-4" /> Turnout by Faculty</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {byFaculty.map((f: any) => (
              <div key={f.id} className="space-y-1">
                <div className="flex items-center justify-between text-sm"><span className="truncate">{f.name}</span><span className="font-mono text-xs">{f.voted}/{f.total} <span className="text-muted-foreground">({f.pct}%)</span></span></div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted"><div className="votewise-bar-anim h-full rounded-full bg-primary" style={{ width: `${Math.max(2, f.pct)}%` }} /></div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="font-display text-base flex items-center gap-2"><GraduationCap className="h-4 w-4" /> Turnout by Level</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {byLevel.map((l: any) => (
              <div key={l.level} className="space-y-1">
                <div className="flex items-center justify-between text-sm"><span>{l.level} Level</span><span className="font-mono text-xs">{l.voted}/{l.total}</span></div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted"><div className="votewise-bar-anim h-full rounded-full bg-accent" style={{ width: `${l.total > 0 ? (l.voted / l.total) * 100 : 0}%` }} /></div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      {election && <Card><CardContent className="flex items-center justify-between p-4"><div><div className="text-xs uppercase tracking-wider text-muted-foreground">Election</div><div className="font-display font-semibold">{election.name}</div></div><StatusBadge status={election.status} /></CardContent></Card>}
    </div>
  )
}

function StatCard({ icon: Icon, label, value, accent }: any) {
  return <Card><CardContent className="flex items-center gap-3 py-4"><div className={cn('grid h-11 w-11 place-items-center rounded-xl', accent ? 'bg-accent/20 text-accent-foreground' : 'bg-primary/10 text-primary')}><Icon className="h-5 w-5" /></div><div><div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div><div className="font-display text-xl font-bold">{value}</div></div></CardContent></Card>
}

function VoterSearchTab() {
  const [q, setQ] = useState('')
  const [voters, setVoters] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!q) { setVoters([]); return }
    setLoading(true)
    const t = setTimeout(async () => { try { const d = await api.observerSearchVoters(q); setVoters(d.voters) } catch (e: any) { toast.error(e.message) } finally { setLoading(false) } }, 350)
    return () => clearTimeout(t)
  }, [q])
  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4"><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input placeholder="Search by voterId, name, email or phone…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" /></div></CardContent></Card>
      <Card><CardContent className="p-0"><div className="votewise-scroll max-h-[60vh] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted/80 backdrop-blur"><tr className="text-left"><th className="p-3 font-medium">Voter</th><th className="hidden p-3 font-medium md:table-cell">Faculty / Dept</th><th className="p-3 font-medium">Status</th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan={3} className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>}
            {!loading && q && voters.length === 0 && <tr><td colSpan={3} className="p-8 text-center text-muted-foreground">No voters match &ldquo;{q}&rdquo;.</td></tr>}
            {voters.map((v) => (
              <tr key={v.id} className="border-t border-border hover:bg-muted/30">
                <td className="p-3"><div className="font-medium">{v.fullName}</div><div className="font-mono text-xs text-muted-foreground">{v.voterId}</div></td>
                <td className="hidden p-3 text-xs md:table-cell"><div>{v.faculty?.name}</div><div className="text-muted-foreground">{v.department?.name}</div></td>
                <td className="p-3">{v.hasVoted ? <Badge className="bg-emerald-100 text-emerald-700">Voted {v.votedAt ? new Date(v.votedAt).toLocaleTimeString() : ''}</Badge> : <Badge variant="secondary">Pending</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div></CardContent></Card>
    </div>
  )
}

function TicketsTab() {
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState<any | null>(null)
  const [resolution, setResolution] = useState('')
  async function load() { setLoading(true); try { const d = await api.observerGetTickets(); setTickets(d.tickets) } catch (e: any) { toast.error(e.message) } finally { setLoading(false) } }
  useEffect(() => { load() }, [])
  async function update(id: string, status: string) { try { await api.observerUpdateTicket(id, { status, resolution }); toast.success(`Ticket marked ${status}`); setActive(null); setResolution(''); load() } catch (e: any) { toast.error(e.message) } }
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        {loading && <Loader2 className="h-5 w-5 animate-spin" />}
        {!loading && tickets.length === 0 && <p className="text-sm text-muted-foreground">No support tickets.</p>}
        {tickets.map((t) => (
          <Card key={t.id} className={cn('cursor-pointer transition-shadow hover:shadow-md', active?.id === t.id && 'ring-2 ring-primary')} onClick={() => { setActive(t); setResolution(t.resolution || '') }}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2"><div className="flex items-center gap-2"><Ticket className="h-4 w-4 text-primary" /><Badge variant="outline" className="text-[10px]">{t.issueType.replace(/_/g, ' ')}</Badge></div><TicketStatusBadge status={t.status} /></div>
              <div className="mt-2 font-medium">{t.voterName}</div><div className="font-mono text-xs text-muted-foreground">{t.voterId}</div>
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{t.description}</p>
              <div className="mt-2 text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleString()}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      {active && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => setActive(null)}>
          <Card className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <CardHeader><CardTitle className="font-display text-base flex items-center gap-2"><Ticket className="h-4 w-4" /> Ticket from {active.voterName}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm"><div><span className="text-muted-foreground">Voter ID:</span> <span className="font-mono">{active.voterVoterId}</span></div><div><span className="text-muted-foreground">Type:</span> {active.issueType.replace(/_/g, ' ')}</div><div><span className="text-muted-foreground">Priority:</span> <Badge variant="outline" className="text-[10px]">{active.priority}</Badge></div><div><span className="text-muted-foreground">Status:</span> <TicketStatusBadge status={active.status} /></div></div>
              <div><p className="mt-1 rounded-lg bg-muted/50 p-3 text-sm">{active.description}</p></div>
              <div><Input value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="e.g. OTP resent, voter verified manually" /></div>
              <div className="flex flex-wrap gap-2 pt-2"><Button variant="outline" size="sm" onClick={() => update(active.id, 'IN_PROGRESS')}>Mark In Progress</Button><Button size="sm" onClick={() => update(active.id, 'RESOLVED')} className="gap-1.5"><CheckCircle2 className="h-4 w-4" /> Resolve</Button><Button variant="ghost" size="sm" onClick={() => update(active.id, 'CLOSED')}>Close</Button></div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

function TicketStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = { OPEN: 'bg-amber-100 text-amber-700', IN_PROGRESS: 'bg-blue-100 text-blue-700', RESOLVED: 'bg-emerald-100 text-emerald-700', CLOSED: 'bg-muted text-muted-foreground' }
  return <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', map[status] || 'bg-muted')}>{status.replace(/_/g, ' ')}</span>
}
