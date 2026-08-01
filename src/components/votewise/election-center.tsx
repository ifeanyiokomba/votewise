'use client'

import { useEffect, useState } from 'react'
import {
  Vote, Plus, Loader2, ArrowLeft, Copy, CheckCircle2, Clock, Archive,
  Activity, FileText, Calendar, ChevronRight, Building2, Eye, Zap,
  List as ListIcon, LayoutTemplate,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { api } from '@/lib/api'
import { StatusBadge } from '@/components/votewise/shared'
import { ElectionCalendar } from '@/components/votewise/election-calendar'
import { ElectionTemplates } from '@/components/votewise/election-templates'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export function ElectionCenter({ subdomain }: { subdomain?: string }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [templatesOpen, setTemplatesOpen] = useState(false)

  useEffect(() => {
    let active = true
    api.electionCenter(subdomain).then((d) => { if (active) setData(d) }).catch(() => {}).finally(() => { if (active) setLoading(false) })
    const t = setInterval(() => api.electionCenter(subdomain).then((d) => { if (active) setData(d) }).catch(() => {}), 15000)
    return () => { active = false; clearInterval(t) }
  }, [subdomain])

  async function duplicate(id: string) {
    try {
      await api.duplicateElection(id, subdomain)
      toast.success('Election duplicated!')
      const d = await api.electionCenter(subdomain); setData(d)
    } catch (e: any) { toast.error(e.message) }
  }

  if (loading) return <div className="grid min-h-[60vh] place-items-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  if (!data) return <div className="py-16 text-center text-muted-foreground">Failed to load elections.</div>

  const stats = data.stats
  // Flatten all status groups into a single array for the calendar view.
  const allElections: any[] = [
    ...(data.running || []),
    ...(data.upcoming || []),
    ...(data.completed || []),
    ...(data.draft || []),
    ...(data.archived || []),
  ]

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Election Center</h1>
          <p className="text-sm text-muted-foreground">Manage all your elections in one place.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setTemplatesOpen(true)}>
            <LayoutTemplate className="h-4 w-4" /> Templates
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5"><Copy className="h-4 w-4" /> Duplicate</Button>
          <Button size="sm" className="gap-1.5" onClick={() => { window.location.href = `/workspace/elections/create?org=${subdomain || ''}` }}><Plus className="h-4 w-4" /> Create Election</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatBox icon={Activity} label="Running" value={stats.running} colour="bg-emerald-100 text-emerald-700" />
        <StatBox icon={Clock} label="Upcoming" value={stats.upcoming} colour="bg-amber-100 text-amber-700" />
        <StatBox icon={CheckCircle2} label="Completed" value={stats.completed} colour="bg-zinc-100 text-zinc-700" />
        <StatBox icon={FileText} label="Draft" value={stats.draft} colour="bg-muted text-muted-foreground" />
        <StatBox icon={Archive} label="Archived" value={stats.archived} colour="bg-muted text-muted-foreground" />
      </div>

      {/* View toggle */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="inline-flex items-center rounded-lg border border-border bg-card p-0.5 shadow-sm">
          <ViewToggleBtn active={view === 'list'} onClick={() => setView('list')} icon={ListIcon} label="List View" />
          <ViewToggleBtn active={view === 'calendar'} onClick={() => setView('calendar')} icon={Calendar} label="Calendar View" />
        </div>
        {view === 'calendar' && (
          <p className="hidden text-xs text-muted-foreground sm:block">
            Tip: tap a chip to open an election.
          </p>
        )}
      </div>

      {view === 'calendar' ? (
        <ElectionCalendar elections={allElections} subdomain={subdomain} />
      ) : (
        <>
          {/* Running Elections */}
          {data.running.length > 0 && (
            <ElectionGroup title="Running Elections" icon={Activity} colour="text-emerald-600" elections={data.running} subdomain={subdomain} onDuplicate={duplicate} />
          )}

          {/* Upcoming Elections */}
          {data.upcoming.length > 0 && (
            <ElectionGroup title="Upcoming Elections" icon={Clock} colour="text-amber-600" elections={data.upcoming} subdomain={subdomain} onDuplicate={duplicate} />
          )}

          {/* Draft Elections */}
          {data.draft.length > 0 && (
            <ElectionGroup title="Draft Elections" icon={FileText} colour="text-muted-foreground" elections={data.draft} subdomain={subdomain} onDuplicate={duplicate} />
          )}

          {/* Completed Elections */}
          {data.completed.length > 0 && (
            <ElectionGroup title="Completed Elections" icon={CheckCircle2} colour="text-zinc-600" elections={data.completed} subdomain={subdomain} onDuplicate={duplicate} />
          )}

          {/* Archived Elections */}
          {data.archived.length > 0 && (
            <ElectionGroup title="Archived Elections" icon={Archive} colour="text-muted-foreground" elections={data.archived} subdomain={subdomain} onDuplicate={duplicate} />
          )}

          {/* Empty state */}
          {stats.total === 0 && (
            <Card><CardContent className="py-16 text-center">
              <Vote className="mx-auto h-16 w-16 text-muted-foreground/30" />
              <h3 className="mt-4 font-display text-lg font-bold">No elections yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">Create your first election in less than 5 minutes — or start from a ready-made template.</p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <Button className="gap-2" onClick={() => { window.location.href = `/workspace/elections/create?org=${subdomain || ''}` }}>
                  <Plus className="h-4 w-4" /> Create Your First Election
                </Button>
                <Button variant="outline" className="gap-2" onClick={() => setTemplatesOpen(true)}>
                  <LayoutTemplate className="h-4 w-4" /> Browse Templates
                </Button>
              </div>
            </CardContent></Card>
          )}
        </>
      )}

      {/* Templates dialog */}
      <Dialog open={templatesOpen} onOpenChange={setTemplatesOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-xl">
              <LayoutTemplate className="h-5 w-5 text-primary" /> Election Templates
            </DialogTitle>
            <DialogDescription>
              Save past elections as reusable templates, or spin up a new election from a built-in blueprint in seconds.
            </DialogDescription>
          </DialogHeader>
          <ElectionTemplates subdomain={subdomain} />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ElectionGroup({ title, icon: Icon, colour, elections, subdomain, onDuplicate }: any) {
  return (
    <div className="mb-6">
      <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
        <Icon className={cn('h-5 w-5', colour)} /> {title}
        <Badge variant="outline" className="text-[10px]">{elections.length}</Badge>
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {elections.map((e: any) => (
          <Card key={e.id} className="transition-all hover:shadow-md">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-display text-sm font-semibold">{e.name}</h3>
                  {e.workspace && <p className="text-xs text-muted-foreground">{e.workspace.name}</p>}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {e._count.voters} voters · {e._count.candidates} candidates · {e._count.positions} positions
                  </p>
                </div>
                <StatusBadge status={e.status} />
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {new Date(e.startTime).toLocaleDateString()} → {new Date(e.endTime).toLocaleDateString()}
              </div>
              <div className="mt-3 flex gap-1.5">
                <Button size="sm" variant="outline" className="flex-1 gap-1 text-xs" onClick={() => { window.location.href = `/workspace/elections/${e.id}?org=${subdomain || ''}` }}>
                  Open <ChevronRight className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="ghost" className="gap-1 text-xs" onClick={() => onDuplicate(e.id)}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
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

function ViewToggleBtn({
  active, onClick, icon: Icon, label,
}: {
  active: boolean
  onClick: () => void
  icon: any
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
        active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}
