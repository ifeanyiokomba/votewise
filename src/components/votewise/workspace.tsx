'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import {
  Building2, Users, Vote, Trophy, Loader2, CheckCircle2, AlertCircle,
  TrendingUp, Activity, Server, Bell, Shield, Globe, Clock, Plus,
  ArrowRight, Sparkles, FileCheck2, Headphones, Eye, Settings as SettingsIcon,
  ScrollText, ChevronRight, Zap, CreditCard, Mail, Brain, LogIn, ShieldAlert,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useApp } from '@/lib/store'
import { api } from '@/lib/api'
import { StatusBadge } from '@/components/votewise/shared'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { ReadinessChecklist } from '@/components/votewise/readiness-checklist'

interface WorkspaceData {
  organization: any
  stats: any
  elections: any[]
  members: any[]
  admins: any[]
  observers: any[]
  voterGroups: any[]
  workspaces: any[]
  tickets: any[]
  recentActivity: any[]
  notifications: any[]
  domains: any[]
  settings: any
}

export function WorkspaceView({ subdomain }: { subdomain?: string }) {
  const { setView, official } = useApp()
  const [data, setData] = useState<WorkspaceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.workspaceDashboard(subdomain).then((d) => { setData(d as any); setLoading(false) }).catch((e) => {
      setError(e.message || 'Failed to load workspace'); setLoading(false)
    })
    const t = setInterval(() => api.workspaceDashboard(subdomain).then((d) => setData(d as any)).catch(() => {}), 30000)
    return () => clearInterval(t)
  }, [subdomain])

  if (loading) {
    return <div className="grid min-h-[60vh] place-items-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }
  if (error || !data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-destructive/50" />
        <h2 className="mt-4 font-display text-xl font-bold">Workspace Not Found</h2>
        <p className="mt-2 text-sm text-muted-foreground">{error || 'This organization workspace does not exist or has been archived.'}</p>
        <Button onClick={() => setView('home')} className="mt-4 gap-2"><Building2 className="h-4 w-4" /> Back to Home</Button>
      </div>
    )
  }

  const org = data.organization
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="min-h-screen bg-secondary/20">
      {/* Workspace header */}
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
              <p className="text-[10px] text-muted-foreground">{org.subdomain}.votewise.ng · {org.category?.replace(/_/g, ' ') || 'Organization'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={cn(org.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : org.status === 'TRIAL' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700')}>{org.status}</Badge>
            <Badge variant="outline" className="text-[10px]">{org.plan}</Badge>
            {official && <Badge variant="secondary">{official.name}</Badge>}
            <Button variant="outline" size="sm" onClick={() => { window.location.href = `/workspace/command-center?org=${subdomain || ''}` }} className="gap-1.5"><Activity className="h-4 w-4" /> Command Center</Button>
            {official ? (
              <Button variant="outline" size="sm" onClick={() => setView('official')} className="gap-1.5"><SettingsIcon className="h-4 w-4" /> Manage</Button>
            ) : (
              <Button size="sm" onClick={() => setView('official-login')} className="gap-1.5"><LogIn className="h-4 w-4" /> Admin Login</Button>
            )}
          </div>
        </div>
        {!official && (
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
              <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600" />
              <span className="text-amber-700">
                You are viewing in read-only mode. <button onClick={() => setView('official-login')} className="font-semibold underline hover:no-underline">Sign in as admin</button> to manage elections, voters, and settings.
              </span>
            </div>
          </div>
        )}
        {/* Workspace nav */}
        <WorkspaceNav subdomain={subdomain} />
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* Greeting */}
        <div className="mb-6">
          <h2 className="font-display text-2xl font-bold sm:text-3xl">{greeting},</h2>
          <p className="text-muted-foreground">Welcome back, {org.name}. Here&apos;s what&apos;s happening in your workspace.</p>
        </div>

        {/* Stat cards */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={Vote} label="Elections" value={data.stats.totalElections} accent />
          <StatCard icon={Users} label="Total Voters" value={data.stats.totalVoters.toLocaleString()} />
          <StatCard icon={Eye} label="Observers" value={data.stats.observerCount} />
          <StatCard icon={Activity} label="Upcoming" value={data.stats.upcomingElections} />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main column — elections + activity */}
          <div className="space-y-6 lg:col-span-2">
            {/* Elections */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="font-display text-base flex items-center gap-2"><Vote className="h-4 w-4 text-primary" /> Elections</CardTitle>
                  <Button size="sm" variant="outline" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> New Election</Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.elections.length === 0 ? (
                  <div className="py-8 text-center">
                    <Vote className="mx-auto h-10 w-10 text-muted-foreground/40" />
                    <p className="mt-2 text-sm font-medium">You haven&apos;t created an election yet.</p>
                    <p className="mt-1 text-xs text-muted-foreground">Create your first election in less than 5 minutes. Just a name, date, and voting window — that&apos;s it.</p>
                    <Button size="sm" className="mt-3 gap-1.5"><Plus className="h-3.5 w-3.5" /> Create Your First Election</Button>
                  </div>
                ) : (
                  data.elections.map((e) => (
                    <div key={e.id} className="flex items-center gap-3 rounded-lg border border-border/60 p-3 transition-colors hover:bg-muted/30">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Vote className="h-4 w-4" /></div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{e.name}</div>
                        <div className="text-xs text-muted-foreground">{e.voterCount} voters · {e.candidateCount} candidates · {e.positionCount} positions</div>
                      </div>
                      <StatusBadge status={e.status} />
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Recent activity */}
            <Card>
              <CardHeader><CardTitle className="font-display text-base flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /> Recent Activity</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {data.recentActivity.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No recent activity.</p>
                ) : (
                  data.recentActivity.map((a) => (
                    <div key={a.id} className="flex items-center gap-3 text-sm">
                      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-bold text-muted-foreground">{a.actorName?.charAt(0) || '?'}</div>
                      <div className="min-w-0 flex-1">
                        <span className="font-medium">{a.actorName}</span>
                        <span className="text-muted-foreground"> · {a.action.replace(/_/g, ' ').toLowerCase()}</span>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleDateString()}</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Voter groups + workspaces */}
            <div className="grid gap-6 sm:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="font-display text-base flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Voter Groups</CardTitle></CardHeader>
                <CardContent className="space-y-1.5">
                  {data.voterGroups.length === 0 ? <p className="text-sm text-muted-foreground">No voter groups yet.</p> : data.voterGroups.slice(0, 6).map((g) => (
                    <div key={g.id} className="flex items-center justify-between rounded-md bg-muted/40 px-2.5 py-1.5 text-sm">
                      <span className="truncate">{g.name}</span>
                      <Badge variant="outline" className="text-[10px]">{g.voterCount}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="font-display text-base flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /> Workspaces</CardTitle></CardHeader>
                <CardContent className="space-y-1.5">
                  {data.workspaces.length === 0 ? <p className="text-sm text-muted-foreground">No workspaces yet.</p> : data.workspaces.slice(0, 6).map((w) => (
                    <div key={w.id} className="flex items-center justify-between rounded-md bg-muted/40 px-2.5 py-1.5 text-sm">
                      <span className="truncate">{w.name}</span>
                      {w.code && <Badge variant="outline" className="text-[10px]">{w.code}</Badge>}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Sidebar — readiness, subscription, support, notifications, domains */}
          <div className="space-y-6">
            {/* Election Readiness Checklist (Chapter 6) */}
            <ReadinessChecklist data={data} />

            {/* Subscription */}
            <Card>
              <CardHeader><CardTitle className="font-display text-base flex items-center gap-2"><CreditCard className="h-4 w-4 text-primary" /> Subscription</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Plan</span>
                  <Badge>{org.plan}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge className={cn(org.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>{org.status}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Voter Quota</span>
                  <span className="font-mono text-sm font-medium">{org.voterQuota.toLocaleString()}</span>
                </div>
                {org.paidUntil && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Paid Until</span>
                    <span className="text-sm font-medium">{new Date(org.paidUntil).toLocaleDateString()}</span>
                  </div>
                )}
                <Button size="sm" variant="outline" className="w-full gap-1.5"><Zap className="h-3.5 w-3.5" /> Upgrade / Pay to Go Live</Button>
              </CardContent>
            </Card>

            {/* Support tickets */}
            <Card>
              <CardHeader><CardTitle className="font-display text-base flex items-center gap-2"><Headphones className="h-4 w-4 text-primary" /> Support</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {data.tickets.length === 0 ? <p className="text-sm text-muted-foreground">No open tickets.</p> : data.tickets.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 text-sm">
                    <Badge variant="outline" className="text-[10px]">{t.status}</Badge>
                    <span className="truncate text-xs">{t.issueType?.replace(/_/g, ' ')}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleDateString()}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Notifications */}
            <Card>
              <CardHeader><CardTitle className="font-display text-base flex items-center gap-2"><Bell className="h-4 w-4 text-primary" /> Notifications</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {data.notifications.length === 0 ? <p className="text-sm text-muted-foreground">No notifications.</p> : data.notifications.map((n) => (
                  <div key={n.id} className="rounded-md bg-muted/40 p-2 text-xs">
                    <div className="font-medium">{n.title}</div>
                    <div className="text-muted-foreground">{n.message}</div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Domains */}
            <Card>
              <CardHeader><CardTitle className="font-display text-base flex items-center gap-2"><Globe className="h-4 w-4 text-primary" /> Domains</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Subdomain</span>
                  <span className="font-mono text-xs">{org.subdomain}.votewise.ng</span>
                </div>
                {data.domains.length > 0 && data.domains.map((d) => (
                  <div key={d.id} className="flex items-center justify-between text-sm">
                    <span className="font-mono text-xs truncate">{d.domain}</span>
                    <Badge variant="outline" className="text-[10px]">{d.status}</Badge>
                  </div>
                ))}
                <Button size="sm" variant="outline" className="w-full gap-1.5"><Globe className="h-3.5 w-3.5" /> Connect Custom Domain</Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

function WorkspaceNav({ subdomain }: { subdomain?: string }) {
  const items = [
    { label: 'Dashboard', icon: TrendingUp, href: subdomain ? `/workspace?org=${encodeURIComponent(subdomain)}` : '/workspace' },
    { label: 'Command Center', icon: Activity, href: subdomain ? `/workspace/command-center?org=${encodeURIComponent(subdomain)}` : '/workspace/command-center' },
    { label: 'Structure', icon: Building2, href: subdomain ? `/workspace/structure?org=${encodeURIComponent(subdomain)}` : '/workspace/structure' },
    { label: 'Elections', icon: Vote, href: '#' },
    { label: 'Voters', icon: Users, href: '#' },
    { label: 'Candidates', icon: Trophy, href: '#' },
    { label: 'Observers', icon: Eye, href: '#' },
    { label: 'Support', icon: Headphones, href: '#' },
    { label: 'Reports', icon: FileCheck2, href: subdomain ? `/workspace/analytics?org=${encodeURIComponent(subdomain)}` : '/workspace/analytics' },
    { label: 'Security', icon: Shield, href: subdomain ? `/workspace/security?org=${encodeURIComponent(subdomain)}` : '/workspace/security' },
    { label: 'Communication', icon: Mail, href: subdomain ? `/workspace/communication?org=${encodeURIComponent(subdomain)}` : '/workspace/communication' },
    { label: 'Intelligence', icon: Brain, href: subdomain ? `/workspace/intelligence?org=${encodeURIComponent(subdomain)}` : '/workspace/intelligence' },
    { label: 'Audit Logs', icon: ScrollText, href: '#' },
    { label: 'Settings', icon: SettingsIcon, href: subdomain ? `/workspace/settings?org=${encodeURIComponent(subdomain)}` : '/workspace/settings' },
  ]
  return (
    <div className="border-t border-border/60 bg-background">
      <div className="votewise-scroll mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-1.5 sm:px-6">
        {items.map((it, i) => (
          <a key={it.label} href={it.href} className={cn('flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors', i === 0 ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground')}>
            <it.icon className="h-3.5 w-3.5" /> {it.label}
          </a>
        ))}
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, accent }: any) {
  return <Card><CardContent className="flex items-center gap-3 py-4"><div className={cn('grid h-11 w-11 place-items-center rounded-xl', accent ? 'bg-accent/20 text-accent-foreground' : 'bg-primary/10 text-primary')}><Icon className="h-5 w-5" /></div><div><div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div><div className="font-display text-xl font-bold">{value}</div></div></CardContent></Card>
}
