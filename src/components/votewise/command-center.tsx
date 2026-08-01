'use client'

import { useEffect, useState } from 'react'
import {
  Building2, Vote, Users, Eye, Activity, Server, TrendingUp, Loader2,
  CheckCircle2, Clock, Plus, ChevronRight, Zap, Shield, Headphones,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { StatusBadge } from '@/components/votewise/shared'
import { cn } from '@/lib/utils'

export function CommandCenter({ subdomain }: { subdomain?: string }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    api.commandCenter(subdomain).then((d) => { if (active) setData(d) }).catch(() => {}).finally(() => { if (active) setLoading(false) })
    const t = setInterval(() => api.commandCenter(subdomain).then((d) => { if (active) setData(d) }).catch(() => {}), 15000)
    return () => { active = false; clearInterval(t) }
  }, [subdomain])

  if (loading) return <div className="grid min-h-[60vh] place-items-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  if (!data) return <div className="py-16 text-center text-muted-foreground">Failed to load command center.</div>

  const org = data.organization
  const stats = data.stats

  return (
    <div className="min-h-screen bg-secondary/20">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            {org.logoUrl ? (
              <img src={org.logoUrl} alt={org.name} className="h-9 w-9 rounded-xl object-contain" />
            ) : (
              <div className="grid h-9 w-9 place-items-center rounded-xl text-white" style={{ backgroundColor: org.primaryColour }}>
                <Building2 className="h-5 w-5" />
              </div>
            )}
            <div>
              <h1 className="font-display text-lg font-bold leading-tight">{org.name}</h1>
              <p className="text-[10px] text-muted-foreground">Election Command Center · {org.subdomain}.votewise.ng</p>
            </div>
          </div>
          <Button size="sm" variant="outline" className="gap-1.5"><Plus className="h-4 w-4" /> New Unit</Button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* Command Center Stats */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          <StatBox icon={Vote} label="Running" value={stats.runningElections} colour="bg-emerald-100 text-emerald-700" />
          <StatBox icon={CheckCircle2} label="Completed" value={stats.completedElections} colour="bg-blue-100 text-blue-700" />
          <StatBox icon={Clock} label="Upcoming" value={stats.upcomingElections} colour="bg-amber-100 text-amber-700" />
          <StatBox icon={Building2} label="Units" value={stats.totalUnits} colour="bg-purple-100 text-purple-700" />
          <StatBox icon={Eye} label="Observers" value={stats.totalObservers} colour="bg-cyan-100 text-cyan-700" />
          <StatBox icon={Users} label="Accredited" value={stats.totalVoters.toLocaleString()} colour="bg-primary/10 text-primary" />
          <StatBox icon={TrendingUp} label="Votes Cast" value={stats.votesCast.toLocaleString()} colour="bg-accent/20 text-accent-foreground" />
          <StatBox icon={Server} label="Health" value={stats.systemHealth} colour="bg-emerald-100 text-emerald-700" />
        </div>

        {/* OTP Success Rate banner */}
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
          <Zap className="h-4 w-4 text-emerald-600" />
          <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">OTP Success Rate: {stats.otpSuccessRate}</span>
          <span className="ml-auto text-xs text-muted-foreground">Turnout: {stats.turnoutPct}%</span>
        </div>

        {/* Organization Units with live progress */}
        <h2 className="mb-4 font-display text-xl font-bold">Organization Units</h2>
        {data.units.length === 0 ? (
          <Card><CardContent className="py-12 text-center">
            <Building2 className="mx-auto h-12 w-12 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">No organization units yet. Create units like &ldquo;Faculty of Engineering&rdquo;, &ldquo;Lagos Region&rdquo;, or &ldquo;Youth Church&rdquo; to organize your elections.</p>
            <Button className="mt-4 gap-2"><Plus className="h-4 w-4" /> Create Unit</Button>
          </CardContent></Card>
        ) : (
          <div className="space-y-3">
            {data.units.map((unit: any) => (
              <Card key={unit.id} className={cn('transition-all hover:shadow-md', unit.isLive && 'border-emerald-300')}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate font-display text-sm font-semibold">{unit.name}</h3>
                        {unit.code && <Badge variant="outline" className="text-[10px]">{unit.code}</Badge>}
                        {unit.isLive && (
                          <Badge className="gap-1 bg-emerald-100 text-emerald-700">
                            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> Live
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {unit.electionCount} elections · {unit.totalVoters} voters · {unit.observerCount} observers
                      </p>
                    </div>
                    <div className="hidden text-right sm:block">
                      <div className="font-display text-lg font-bold text-primary">{unit.turnoutPct}%</div>
                      <div className="text-[10px] text-muted-foreground">{unit.votesCast.toLocaleString()} votes</div>
                    </div>
                    <Button size="sm" variant="ghost" className="gap-1"><ChevronRight className="h-4 w-4" /></Button>
                  </div>
                  {/* Live progress bar */}
                  {unit.isLive && (
                    <div className="mt-3">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
                          style={{ width: `${Math.max(2, unit.turnoutPct)}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {/* Running elections within this unit */}
                  {unit.elections.filter((e: any) => new Date(e.startTime) <= new Date() && new Date(e.endTime) > new Date()).length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {unit.elections.filter((e: any) => new Date(e.startTime) <= new Date() && new Date(e.endTime) > new Date()).map((e: any) => (
                        <Badge key={e.id} variant="secondary" className="gap-1 text-[10px]">
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          {e.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Running / Completed / Upcoming sections */}
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <ElectionList title="Running Elections" icon={Activity} elections={data.runningElections} colour="text-emerald-600" />
          <ElectionList title="Upcoming Elections" icon={Clock} elections={data.upcomingElections} colour="text-amber-600" />
          <ElectionList title="Completed Elections" icon={CheckCircle2} elections={data.completedElections} colour="text-blue-600" />
        </div>
      </div>
    </div>
  )
}

function StatBox({ icon: Icon, label, value, colour }: any) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className={cn('grid h-8 w-8 place-items-center rounded-lg', colour)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="mt-2 font-display text-xl font-bold">{value}</div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  )
}

function ElectionList({ title, icon: Icon, elections, colour }: any) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-sm flex items-center gap-2">
          <Icon className={cn('h-4 w-4', colour)} /> {title}
          <Badge variant="outline" className="ml-auto text-[10px]">{elections.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {elections.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">None.</p>
        ) : (
          elections.slice(0, 8).map((e: any) => (
            <div key={e.id} className="flex items-center gap-2 rounded-lg border border-border/60 p-2 text-sm">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-xs">{e.name}</div>
                <div className="text-[10px] text-muted-foreground">{e._count.voters} voters · {e._count.candidates} candidates</div>
              </div>
              <StatusBadge status={e.status} />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
