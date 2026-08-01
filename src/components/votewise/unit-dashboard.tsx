'use client'

import { useEffect, useState } from 'react'
import {
  Building2, Vote, Eye, Users, Loader2, ArrowLeft, Plus, CheckCircle2,
  Clock, Activity, Trophy, Headphones, ScrollText, FileCheck2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { StatusBadge } from '@/components/votewise/shared'
import { cn } from '@/lib/utils'

export function UnitDashboard({ unitId, subdomain }: { unitId: string; subdomain?: string }) {
  const [unit, setUnit] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    // Fetch unit data from the command center (which includes units with elections).
    api.commandCenter(subdomain).then((d) => {
      if (!active) return
      const found = d.units?.find((u: any) => u.id === unitId)
      setUnit(found || null)
    }).catch(() => {}).finally(() => { if (active) setLoading(false) })
    const t = setInterval(() => api.commandCenter(subdomain).then((d) => {
      if (active) setUnit(d.units?.find((u: any) => u.id === unitId) || null)
    }).catch(() => {}), 15000)
    return () => { active = false; clearInterval(t) }
  }, [unitId, subdomain])

  if (loading) return <div className="grid min-h-[60vh] place-items-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  if (!unit) return <div className="py-16 text-center text-muted-foreground">Unit not found.</div>

  const now = new Date()
  const runningElections = unit.elections?.filter((e: any) => new Date(e.startTime) <= now && new Date(e.endTime) > now) || []
  const upcomingElections = unit.elections?.filter((e: any) => new Date(e.startTime) > now) || []
  const completedElections = unit.elections?.filter((e: any) => new Date(e.endTime) <= now || e.status === 'CERTIFIED') || []

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
      {/* Breadcrumb */}
      <Button variant="ghost" size="sm" onClick={() => { window.location.href = `/workspace/command-center?org=${subdomain || ''}` }} className="mb-4 gap-1.5">
        <ArrowLeft className="h-4 w-4" /> Back to Command Center
      </Button>

      {/* Unit header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
          <Building2 className="h-6 w-6" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">{unit.name}</h1>
          <p className="text-sm text-muted-foreground">
            {unit.code && <span className="font-mono">{unit.code} · </span>}
            {unit.electionCount} elections · {unit.totalVoters} voters · {unit.observerCount} observers
          </p>
        </div>
        {unit.isLive && (
          <Badge className="ml-auto gap-1 bg-emerald-100 text-emerald-700">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> Live
          </Badge>
        )}
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <StatBox icon={Vote} label="Elections" value={unit.electionCount} colour="bg-primary/10 text-primary" />
        <StatBox icon={Activity} label="Running" value={runningElections.length} colour="bg-emerald-100 text-emerald-700" />
        <StatBox icon={Clock} label="Upcoming" value={upcomingElections.length} colour="bg-amber-100 text-amber-700" />
        <StatBox icon={CheckCircle2} label="Completed" value={completedElections.length} colour="bg-blue-100 text-blue-700" />
        <StatBox icon={Eye} label="Observers" value={unit.observerCount} colour="bg-cyan-100 text-cyan-700" />
        <StatBox icon={Users} label="Voters" value={unit.totalVoters.toLocaleString()} colour="bg-purple-100 text-purple-700" />
      </div>

      {/* Turnout progress */}
      {unit.isLive && (
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">Live Turnout</span>
              <span className="font-display text-lg font-bold text-primary">{unit.turnoutPct}%</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500" style={{ width: `${Math.max(2, unit.turnoutPct)}%` }} />
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{unit.votesCast.toLocaleString()} of {unit.totalVoters.toLocaleString()} voters</div>
          </CardContent>
        </Card>
      )}

      {/* Unit navigation tabs */}
      <div className="mb-6 flex gap-1 overflow-x-auto">
        {[
          { label: 'Elections', icon: Vote, active: true },
          { label: 'Candidates', icon: Trophy },
          { label: 'Observers', icon: Eye },
          { label: 'Accreditation', icon: CheckCircle2 },
          { label: 'Support', icon: Headphones },
          { label: 'Audit Logs', icon: ScrollText },
          { label: 'Reports', icon: FileCheck2 },
        ].map((t, i) => (
          <button key={t.label} className={cn('flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors', i === 0 ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground')}>
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {/* Elections */}
      <div className="space-y-6">
        {runningElections.length > 0 && (
          <div>
            <h2 className="mb-3 font-display text-lg font-bold flex items-center gap-2"><Activity className="h-5 w-5 text-emerald-600" /> Running Elections</h2>
            <div className="space-y-2">
              {runningElections.map((e: any) => <ElectionRow key={e.id} e={e} live />)}
            </div>
          </div>
        )}
        {upcomingElections.length > 0 && (
          <div>
            <h2 className="mb-3 font-display text-lg font-bold flex items-center gap-2"><Clock className="h-5 w-5 text-amber-600" /> Upcoming Elections</h2>
            <div className="space-y-2">
              {upcomingElections.map((e: any) => <ElectionRow key={e.id} e={e} />)}
            </div>
          </div>
        )}
        {completedElections.length > 0 && (
          <div>
            <h2 className="mb-3 font-display text-lg font-bold flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-blue-600" /> Completed Elections</h2>
            <div className="space-y-2">
              {completedElections.map((e: any) => <ElectionRow key={e.id} e={e} />)}
            </div>
          </div>
        )}
        {unit.elections?.length === 0 && (
          <Card><CardContent className="py-12 text-center">
            <Vote className="mx-auto h-12 w-12 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">No elections in this unit yet.</p>
            <Button className="mt-4 gap-2"><Plus className="h-4 w-4" /> Create Election</Button>
          </CardContent></Card>
        )}
      </div>
    </div>
  )
}

function ElectionRow({ e, live }: { e: any; live?: boolean }) {
  return (
    <Card className={cn(live && 'border-emerald-300')}>
      <CardContent className="flex items-center gap-3 p-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Vote className="h-4 w-4" /></div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{e.name}</div>
          <div className="text-xs text-muted-foreground">
            {e.voterCount} voters · {e.candidateCount} candidates · {e.positionCount} positions
            {e.startTime && <span> · {new Date(e.startTime).toLocaleDateString()}</span>}
          </div>
        </div>
        <StatusBadge status={e.status} />
      </CardContent>
    </Card>
  )
}

function StatBox({ icon: Icon, label, value, colour }: any) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className={cn('grid h-8 w-8 place-items-center rounded-lg', colour)}><Icon className="h-4 w-4" /></div>
        <div className="mt-2 font-display text-xl font-bold">{value}</div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  )
}
