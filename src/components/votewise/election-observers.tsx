'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Eye, UserPlus, UserCheck, Search, Trash2, Activity, Shield, Mail,
  Clock, Headphones, Loader2, RefreshCw, ChevronRight, ChevronDown,
  AlertCircle, BadgeCheck, Inbox,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
interface ObserverActivityEntry { label: string; value: string; ts?: string }

interface Observer {
  id: string
  memberId?: string | null
  name: string
  email: string
  title?: string | null
  avatarUrl?: string | null
  accountStatus?: string
  assignedAt: string
  assignedBy?: string | null
  scope: 'election' | 'unit'
  scopeLabel: string
  ticketsHandled: number
  searchesPerformed: number
  lastActive?: string | null
  activity?: ObserverActivityEntry[]
}

interface ObserversData {
  observers: Observer[]
  stats: { total: number; activeToday: number; ticketsHandled: number }
  election?: { id: string; name: string; status: string }
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------
function initials(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function formatTime(iso?: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return iso }
}

function relativeTime(iso?: string | null): string {
  if (!iso) return 'Never'
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return 'Just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  return formatTime(iso)
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------
export function ElectionObservers({ electionId, subdomain }: { electionId: string; subdomain?: string }) {
  const [data, setData] = useState<ObserversData | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [assignOpen, setAssignOpen] = useState(false)
  const [activityFor, setActivityFor] = useState<Observer | null>(null)
  const [removing, setRemoving] = useState<Observer | null>(null)
  const [removeBusy, setRemoveBusy] = useState(false)
  const [assignEmail, setAssignEmail] = useState('')
  const [assignName, setAssignName] = useState('')
  const [assignBusy, setAssignBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await api.getElectionObservers(electionId, subdomain)
      setData(d as ObserversData)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load observers')
    } finally {
      setLoading(false)
    }
  }, [electionId, subdomain])

  useEffect(() => { load() }, [load])

  async function handleAssign() {
    if (!assignEmail.trim()) {
      toast.error('Enter the observer email')
      return
    }
    setAssignBusy(true)
    try {
      const payload: any = { memberEmail: assignEmail.trim() }
      if (assignName.trim()) payload.memberName = assignName.trim()
      // If the email doesn't match any existing member, request an invitation.
      payload.invite = true
      const res = await api.assignElectionObserver(electionId, payload, subdomain)
      toast.success(res?.message || 'Observer assigned')
      setAssignOpen(false)
      setAssignEmail('')
      setAssignName('')
      await load()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to assign observer')
    } finally {
      setAssignBusy(false)
    }
  }

  async function handleRemove() {
    if (!removing) return
    setRemoveBusy(true)
    try {
      await api.removeElectionObserver(electionId, removing.id, subdomain)
      toast.success(`${removing.name} removed from this election`)
      setRemoving(null)
      await load()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to remove observer')
    } finally {
      setRemoveBusy(false)
    }
  }

  const filtered = data?.observers.filter((o) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      o.name.toLowerCase().includes(q) ||
      o.email.toLowerCase().includes(q) ||
      (o.title || '').toLowerCase().includes(q)
    )
  }) || []

  const stats = data?.stats || { total: 0, activeToday: 0, ticketsHandled: 0 }

  return (
    <div className="space-y-4">
      {/* Capabilities alert */}
      <Alert className="border-amber-500/40 bg-amber-50 dark:bg-amber-950/20">
        <Shield className="h-4 w-4 text-amber-600" />
        <AlertTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
          Observer Capabilities
        </AlertTitle>
        <AlertDescription className="text-amber-800 dark:text-amber-300">
          Observers can view live turnout, handle support tickets, search voter status, and monitor
          the audit timeline — but they can never see ballots or vote choices.
        </AlertDescription>
      </Alert>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3">
        <StatCard
          icon={Eye}
          label="Total Observers"
          value={stats.total}
          accent="primary"
        />
        <StatCard
          icon={UserCheck}
          label="Active Today"
          value={stats.activeToday}
          accent="emerald"
        />
        <StatCard
          icon={Headphones}
          label="Tickets Handled"
          value={stats.ticketsHandled}
          accent="amber"
        />
      </div>

      {/* Toolbar + observer list */}
      <Card className="votewise-card-glow">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 font-display text-base">
              <Eye className="h-4 w-4 text-primary" /> Assigned Observers
              <Badge variant="outline" className="ml-1 text-[10px]">{stats.total} {stats.total === 1 ? 'observer' : 'observers'}</Badge>
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button onClick={load} size="sm" variant="outline" className="gap-1.5" disabled={loading}>
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Refresh
              </Button>
              <Button onClick={() => setAssignOpen(true)} size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                <UserPlus className="h-3.5 w-3.5" /> Assign Observer
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search observers by name or email…"
              className="pl-9"
              aria-label="Search observers"
            />
          </div>

          <Separator />

          {/* List */}
          {loading ? (
            <div className="grid min-h-[30vh] place-items-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center">
              <Eye className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <p className="mt-2 text-sm font-medium text-foreground">No observers assigned</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {search ? 'No observers match your search.' : 'Assign observers to monitor this election in real time.'}
              </p>
              {!search && (
                <Button onClick={() => setAssignOpen(true)} size="sm" className="mt-3 gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                  <UserPlus className="h-3.5 w-3.5" /> Assign First Observer
                </Button>
              )}
            </div>
          ) : (
            <div className="max-h-[600px] overflow-y-auto pr-1 votewise-scroll">
              <AnimatePresence initial={false}>
                {filtered.map((o, idx) => (
                  <ObserverRow
                    key={o.id}
                    observer={o}
                    onRemove={() => setRemoving(o)}
                    onViewActivity={() => setActivityFor(o)}
                    idx={idx}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assign dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-primary" /> Assign Observer
            </DialogTitle>
            <DialogDescription>
              Assign an existing organization observer (role: OBSERVER) to this election, or invite
              a new observer by email. They will be able to monitor live turnout, search voters, and
              handle support tickets — but never see ballots.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="obs-email">Observer Email</Label>
              <Input
                id="obs-email"
                type="email"
                value={assignEmail}
                onChange={(e) => setAssignEmail(e.target.value)}
                placeholder="observer@institution.edu.ng"
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground">
                If the email matches an existing organization member, they will be assigned
                immediately. Otherwise, an invitation will be sent.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="obs-name">Display Name (optional)</Label>
              <Input
                id="obs-name"
                value={assignName}
                onChange={(e) => setAssignName(e.target.value)}
                placeholder="Dr. Adaeze Okonkwo"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)} disabled={assignBusy}>Cancel</Button>
            <Button onClick={handleAssign} disabled={assignBusy} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
              {assignBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
              Assign to Election
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Activity log dialog */}
      <Dialog open={!!activityFor} onOpenChange={(o) => !o && setActivityFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> Observer Activity
            </DialogTitle>
            <DialogDescription>
              Recent activity recorded for{' '}
              <span className="font-medium text-foreground">{activityFor?.name}</span>
              {' '}({activityFor?.email}).
            </DialogDescription>
          </DialogHeader>
          {activityFor && (
            <div className="space-y-3">
              {/* Quick stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Headphones className="h-3.5 w-3.5" /> Tickets Handled
                  </div>
                  <div className="mt-1 font-display text-xl font-bold text-foreground">
                    {activityFor.ticketsHandled}
                  </div>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Search className="h-3.5 w-3.5" /> Voter Searches
                  </div>
                  <div className="mt-1 font-display text-xl font-bold text-foreground">
                    {activityFor.searchesPerformed}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Timeline */}
              <div className="max-h-[280px] overflow-y-auto pr-1 votewise-scroll">
                {(activityFor.activity || []).length === 0 ? (
                  <div className="py-6 text-center">
                    <Inbox className="mx-auto h-8 w-8 text-muted-foreground/40" />
                    <p className="mt-2 text-xs text-muted-foreground">No recorded activity yet.</p>
                  </div>
                ) : (
                  <ol className="space-y-2">
                    {activityFor.activity!.map((a, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <div className="mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                          <Clock className="h-3 w-3" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-foreground">{a.label}</div>
                          <div className="text-xs text-muted-foreground">
                            {a.value}{a.ts ? ` · ${formatTime(a.ts)}` : ''}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActivityFor(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove confirmation dialog */}
      <Dialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertCircle className="h-4 w-4" /> Remove Observer
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to remove{' '}
              <span className="font-medium text-foreground">{removing?.name}</span>{' '}
              ({removing?.email}) from this election? They will immediately lose access to live
              turnout, voter search, and the audit timeline for this election. This action is
              recorded in the audit log.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoving(null)} disabled={removeBusy}>Cancel</Button>
            <Button onClick={handleRemove} disabled={removeBusy} className="gap-1.5 bg-red-600 hover:bg-red-700">
              {removeBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Remove Observer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// -----------------------------------------------------------------------------
// StatCard
// -----------------------------------------------------------------------------
function StatCard({
  icon: Icon, label, value, accent,
}: {
  icon: any; label: string; value: number; accent: 'primary' | 'emerald' | 'amber'
}) {
  const accentCls = {
    primary: 'bg-primary/10 text-primary',
    emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
  }[accent]
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div className={cn('grid h-9 w-9 place-items-center rounded-lg', accentCls)}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-2 font-display text-2xl font-bold tabular-nums">{value.toLocaleString()}</div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  )
}

// -----------------------------------------------------------------------------
// ObserverRow
// -----------------------------------------------------------------------------
function ObserverRow({
  observer: o, onRemove, onViewActivity, idx,
}: {
  observer: Observer; onRemove: () => void; onViewActivity: () => void; idx: number
}) {
  const isElectionWide = o.scope === 'election'
  const isActive = o.accountStatus === 'ACTIVE' || !o.accountStatus
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, delay: Math.min(idx * 0.012, 0.2) }}
      className={cn(
        'rounded-lg border border-border/60 bg-card p-3 transition-colors hover:bg-accent/5',
        idx > 0 && 'mt-2',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        {/* Left: avatar + identity */}
        <div className="flex min-w-0 items-start gap-3">
          <Avatar className="h-10 w-10 border border-border/60">
            <AvatarFallback className={cn(
              'text-xs font-semibold',
              isElectionWide
                ? 'bg-primary/10 text-primary'
                : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
            )}>
              {initials(o.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-medium text-foreground">{o.name}</span>
              {isActive ? (
                <Badge className="bg-emerald-100 text-emerald-700 text-[10px] dark:bg-emerald-950/40 dark:text-emerald-400">
                  <BadgeCheck className="h-3 w-3" /> Active
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px]">{o.accountStatus || 'Pending'}</Badge>
              )}
              <Badge variant="outline" className={cn(
                'text-[10px]',
                isElectionWide
                  ? 'border-primary/30 bg-primary/5 text-primary'
                  : 'border-amber-500/30 bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400',
              )}>
                {isElectionWide ? <Eye className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
                {o.scopeLabel}
              </Badge>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1 truncate">
                <Mail className="h-3 w-3" /> <span className="truncate">{o.email || '—'}</span>
              </span>
              {o.title && (
                <span className="flex items-center gap-1">
                  <BadgeCheck className="h-3 w-3" /> {o.title}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex shrink-0 items-center gap-1.5">
          <Button size="sm" variant="outline" onClick={onViewActivity} className="gap-1.5">
            <Activity className="h-3.5 w-3.5" /> Activity
          </Button>
          <Button size="sm" variant="outline" onClick={onRemove} className="gap-1.5 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30">
            <Trash2 className="h-3.5 w-3.5" /> Remove
          </Button>
        </div>
      </div>

      {/* Footer: assigned + activity summary */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Assigned {relativeTime(o.assignedAt)}
          {o.assignedBy ? ` by ${o.assignedBy}` : ''}
        </span>
        <span className="flex items-center gap-1">
          <Headphones className="h-3 w-3" /> {o.ticketsHandled} ticket{o.ticketsHandled === 1 ? '' : 's'} handled
        </span>
        <span className="flex items-center gap-1">
          <Search className="h-3 w-3" /> {o.searchesPerformed} search{o.searchesPerformed === 1 ? '' : 'es'}
        </span>
        <span className="flex items-center gap-1">
          <Activity className="h-3 w-3" /> Last active {relativeTime(o.lastActive)}
        </span>
      </div>
    </motion.div>
  )
}
