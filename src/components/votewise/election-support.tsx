'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Headphones, Plus, Search, Filter, AlertCircle, CheckCircle2, Clock,
  User, MessageSquare, Flag, ArrowUpCircle, Loader2, RefreshCw, Inbox, X,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface SupportTicket {
  id: string
  electionId: string | null
  voterId: string | null
  voterName: string | null
  voterMatric: string | null
  issueType: string
  description: string
  status: string
  priority: string
  assignedTo: string | null
  assignedToName: string | null
  openedBy: string | null
  category: string | null
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
  resolution: string | null
}

interface SupportData {
  tickets: SupportTicket[]
  electionId: string
  electionName?: string
  counts: {
    total: number
    open: number
    inProgress: number
    resolved: number
    escalated: number
  }
}

const STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'ESCALATED', 'CLOSED'] as const
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const

const STATUS_STYLES: Record<string, { cls: string; label: string }> = {
  OPEN:        { cls: 'bg-amber-100 text-amber-700', label: 'Open' },
  IN_PROGRESS: { cls: 'bg-primary/10 text-primary', label: 'In Progress' },
  RESOLVED:    { cls: 'bg-emerald-100 text-emerald-700', label: 'Resolved' },
  ESCALATED:   { cls: 'bg-red-100 text-red-700', label: 'Escalated' },
  CLOSED:      { cls: 'bg-muted text-muted-foreground', label: 'Closed' },
}

const PRIORITY_STYLES: Record<string, { cls: string; icon: any }> = {
  LOW:    { cls: 'bg-emerald-100 text-emerald-700', icon: ArrowUpCircle },
  MEDIUM: { cls: 'bg-amber-100 text-amber-700', icon: Flag },
  HIGH:   { cls: 'bg-orange-100 text-orange-700', icon: Flag },
  URGENT: { cls: 'bg-red-100 text-red-700', icon: AlertCircle },
}

const ISSUE_TYPE_STYLES: Record<string, { cls: string; icon: any }> = {
  TECHNICAL:    { cls: 'bg-amber-100 text-amber-700', icon: AlertCircle },
  OTP:          { cls: 'bg-primary/10 text-primary', icon: MessageSquare },
  VERIFICATION: { cls: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  BILLING:      { cls: 'bg-orange-100 text-orange-700', icon: Flag },
  ACCREDITATION:{ cls: 'bg-primary/10 text-primary', icon: User },
  BALLOT:       { cls: 'bg-amber-100 text-amber-700', icon: MessageSquare },
  LOGIN:        { cls: 'bg-emerald-100 text-emerald-700', icon: User },
  RESULTS:      { cls: 'bg-orange-100 text-orange-700', icon: Flag },
  OTHER:        { cls: 'bg-muted text-muted-foreground', icon: MessageSquare },
}

const ISSUE_TYPES = [
  'TECHNICAL', 'OTP', 'VERIFICATION', 'BILLING',
  'ACCREDITATION', 'BALLOT', 'LOGIN', 'RESULTS', 'OTHER',
]

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function timeAgo(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime()
    if (diff < 60_000) return 'just now'
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
    if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`
    return formatTime(iso)
  } catch {
    return iso
  }
}

function statusStyle(s: string) {
  return STATUS_STYLES[s] || { cls: 'bg-muted text-muted-foreground', label: s }
}
function priorityStyle(p: string) {
  return PRIORITY_STYLES[p] || PRIORITY_STYLES.MEDIUM
}
function issueStyle(t: string) {
  return ISSUE_TYPE_STYLES[t] || ISSUE_TYPE_STYLES.OTHER
}

export function ElectionSupport({ electionId, subdomain }: { electionId: string; subdomain?: string }) {
  const [data, setData] = useState<SupportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')

  // New-ticket dialog
  const [newOpen, setNewOpen] = useState(false)
  const [newIssueType, setNewIssueType] = useState('TECHNICAL')
  const [newPriority, setNewPriority] = useState('MEDIUM')
  const [newVoterName, setNewVoterName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [creating, setCreating] = useState(false)

  // Per-ticket action state — keyed by ticket id.
  const [pendingTicketId, setPendingTicketId] = useState<string | null>(null)
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null)

  async function load(showSpinner = true) {
    if (showSpinner) setLoading(true); else setRefreshing(true)
    try {
      const d = (await api.getElectionSupport(electionId, subdomain)) as SupportData
      setData(d)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load support tickets')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [electionId, subdomain])

  const filtered = useMemo(() => {
    if (!data) return []
    const q = search.trim().toLowerCase()
    return data.tickets.filter((t) => {
      if (statusFilter !== 'ALL' && t.status !== statusFilter) return false
      if (!q) return true
      return (
        (t.voterName || '').toLowerCase().includes(q) ||
        (t.voterMatric || '').toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.issueType.toLowerCase().includes(q) ||
        (t.assignedToName || '').toLowerCase().includes(q)
      )
    })
  }, [data, search, statusFilter])

  async function createTicket() {
    if (!newDescription.trim()) {
      toast.error('Please describe the issue.')
      return
    }
    setCreating(true)
    try {
      const res: any = await api.createElectionSupport(electionId, subdomain, {
        issueType: newIssueType,
        description: newDescription.trim(),
        priority: newPriority,
        voterName: newVoterName.trim() || undefined,
      })
      if (res?.ticket) {
        // Prepend to the local list for immediate UI feedback.
        setData((prev) => prev ? {
          ...prev,
          tickets: [res.ticket, ...prev.tickets],
          counts: {
            ...prev.counts,
            total: prev.counts.total + 1,
            open: prev.counts.open + 1,
          },
        } : prev)
      }
      toast.success('Support ticket created.')
      setNewOpen(false)
      setNewDescription('')
      setNewVoterName('')
      setNewIssueType('TECHNICAL')
      setNewPriority('MEDIUM')
    } catch (e: any) {
      toast.error(e?.message || 'Failed to create ticket')
    } finally {
      setCreating(false)
    }
  }

  async function updateTicket(ticketId: string, payload: Record<string, any>) {
    setPendingTicketId(ticketId)
    try {
      const res: any = await api.updateElectionSupport(electionId, ticketId, payload, subdomain)
      if (res?.ticket) {
        // Update the local ticket + the counts (in case status changed).
        setData((prev) => {
          if (!prev) return prev
          const updatedTickets = prev.tickets.map((t) => t.id === ticketId ? { ...t, ...res.ticket } : t)
          const counts = {
            total: updatedTickets.length,
            open: updatedTickets.filter((t) => t.status === 'OPEN').length,
            inProgress: updatedTickets.filter((t) => t.status === 'IN_PROGRESS').length,
            resolved: updatedTickets.filter((t) => t.status === 'RESOLVED' || t.status === 'CLOSED').length,
            escalated: updatedTickets.filter((t) => t.status === 'ESCALATED').length,
          }
          return { ...prev, tickets: updatedTickets, counts }
        })
        toast.success('Ticket updated.')
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update ticket')
    } finally {
      setPendingTicketId(null)
    }
  }

  if (loading) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    )
  }

  const counts = data?.counts || { total: 0, open: 0, inProgress: 0, resolved: 0, escalated: 0 }

  return (
    <div className="space-y-6">
      {/* Header + stats */}
      <Card className="votewise-card-glow">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <Headphones className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold">Support Tickets</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Triage voter issues, escalate blockers, and resolve tickets for this election.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button variant="outline" size="sm" onClick={() => load(false)} disabled={refreshing} className="gap-1.5">
              {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Refresh
            </Button>
            <Button size="sm" onClick={() => setNewOpen(true)} className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="h-3.5 w-3.5" /> New Ticket
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Inbox} label="Total" value={counts.total} colour="bg-muted text-foreground" />
        <StatCard icon={AlertCircle} label="Open" value={counts.open} colour="bg-amber-100 text-amber-700" />
        <StatCard icon={Clock} label="In Progress" value={counts.inProgress} colour="bg-primary/10 text-primary" />
        <StatCard icon={CheckCircle2} label="Resolved" value={counts.resolved} colour="bg-emerald-100 text-emerald-700" />
      </div>

      {/* Toolbar — search + status filter */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by voter name, matric, description, or assignee…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{statusStyle(s).label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Ticket list */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
              <Headphones className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium">No support tickets {search || statusFilter !== 'ALL' ? 'match your filters' : 'yet'}</p>
            <p className="text-xs text-muted-foreground">
              {search || statusFilter !== 'ALL'
                ? 'Try adjusting your search or status filter.'
                : 'When voters raise issues for this election, they will appear here.'}
            </p>
            {(search || statusFilter !== 'ALL') && (
              <Button variant="outline" size="sm" onClick={() => { setSearch(''); setStatusFilter('ALL') }} className="mt-2 gap-1.5">
                <X /> Clear filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="max-h-[600px] space-y-3 overflow-y-auto pr-1">
          <AnimatePresence mode="popLayout">
            {filtered.map((t, idx) => {
              const sSt = statusStyle(t.status)
              const pSt = priorityStyle(t.priority)
              const iSt = issueStyle(t.issueType)
              const IssueIcon = iSt.icon
              const PriorityIcon = pSt.icon
              const isExpanded = expandedTicketId === t.id
              const isPending = pendingTicketId === t.id
              return (
                <motion.div
                  key={t.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18, delay: Math.min(idx * 0.02, 0.15) }}
                >
                  <Card className={cn(
                    'transition-colors',
                    t.status === 'ESCALATED' && 'border-red-200 dark:border-red-900/40',
                    t.status === 'RESOLVED' && 'border-emerald-200 dark:border-emerald-900/40',
                  )}>
                    <CardContent className="p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        {/* Left — issue + meta */}
                        <div className="flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className={cn('gap-1', iSt.cls)} variant="secondary">
                              <IssueIcon className="h-3 w-3" />
                              {t.issueType}
                            </Badge>
                            <Badge className={cn('gap-1', pSt.cls)} variant="secondary">
                              <PriorityIcon className="h-3 w-3" />
                              {t.priority}
                            </Badge>
                            <Badge className={cn('gap-1', sSt.cls)} variant="secondary">
                              {sSt.label}
                            </Badge>
                            <span className="text-xs text-muted-foreground">{timeAgo(t.createdAt)}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-medium">{t.voterName || 'Anonymous'}</span>
                            {t.voterMatric && t.voterMatric !== 'N/A' && (
                              <span className="text-xs text-muted-foreground">· {t.voterMatric}</span>
                            )}
                          </div>
                          <p className={cn('text-sm text-foreground/90', !isExpanded && 'line-clamp-2')}>
                            {t.description}
                          </p>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" /> Opened {formatTime(t.createdAt)}
                            </span>
                            {t.assignedToName && (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" /> Assigned to <span className="font-medium text-foreground">{t.assignedToName}</span>
                              </span>
                            )}
                            {t.resolvedAt && (
                              <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                                <CheckCircle2 className="h-3 w-3" /> Resolved {formatTime(t.resolvedAt)}
                              </span>
                            )}
                          </div>
                          {isExpanded && t.resolution && (
                            <div className="rounded-md bg-emerald-50 p-2 text-xs text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
                              <span className="font-semibold">Resolution:</span> {t.resolution}
                            </div>
                          )}
                        </div>

                        {/* Right — actions */}
                        <div className="flex flex-col gap-2 sm:w-[180px]">
                          <Select
                            value={t.status}
                            onValueChange={(v) => updateTicket(t.id, { status: v })}
                            disabled={isPending}
                          >
                            <SelectTrigger className="w-full" size="sm">
                              <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUSES.map((s) => (
                                <SelectItem key={s} value={s}>{statusStyle(s).label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select
                            value={t.priority}
                            onValueChange={(v) => updateTicket(t.id, { priority: v })}
                            disabled={isPending}
                          >
                            <SelectTrigger className="w-full" size="sm">
                              <SelectValue placeholder="Priority" />
                            </SelectTrigger>
                            <SelectContent>
                              {PRIORITIES.map((p) => (
                                <SelectItem key={p} value={p}>{p}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setExpandedTicketId(isExpanded ? null : t.id)}
                            className="w-full gap-1.5"
                          >
                            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />}
                            {isExpanded ? 'Hide' : 'Details'}
                          </Button>
                        </div>
                      </div>

                      {isExpanded && (
                        <>
                          <Separator className="my-3" />
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                              <Label className="text-xs">Assign To (Display Name)</Label>
                              <Input
                                defaultValue={t.assignedToName || ''}
                                placeholder="e.g. Mrs. Adamu"
                                onBlur={(e) => {
                                  const v = e.target.value.trim()
                                  if (v !== (t.assignedToName || '')) {
                                    updateTicket(t.id, { assignedToName: v || null, assignedToId: v ? 'manual-assign' : null })
                                  }
                                }}
                                disabled={isPending}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">Resolution Note (optional)</Label>
                              <Input
                                defaultValue={t.resolution || ''}
                                placeholder="What was done to resolve this ticket?"
                                onBlur={(e) => {
                                  const v = e.target.value.trim()
                                  if (v !== (t.resolution || '')) {
                                    updateTicket(t.id, { resolution: v || null })
                                  }
                                }}
                                disabled={isPending}
                              />
                            </div>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      {/* New Ticket Dialog */}
      <Dialog open={newOpen} onOpenChange={(o) => !creating && setNewOpen(o)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Headphones className="h-4 w-4 text-primary" /> New Support Ticket
            </DialogTitle>
            <DialogDescription>
              Open a support ticket for this election. Voters and officials can both raise issues here.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="new-issue-type">Issue Type</Label>
                <Select value={newIssueType} onValueChange={setNewIssueType}>
                  <SelectTrigger id="new-issue-type" className="w-full">
                    <SelectValue placeholder="Select issue type" />
                  </SelectTrigger>
                  <SelectContent>
                    {ISSUE_TYPES.map((it) => (
                      <SelectItem key={it} value={it}>{it}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-priority">Priority</Label>
                <Select value={newPriority} onValueChange={setNewPriority}>
                  <SelectTrigger id="new-priority" className="w-full">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-voter-name">Voter Name (optional)</Label>
              <Input
                id="new-voter-name"
                value={newVoterName}
                onChange={(e) => setNewVoterName(e.target.value)}
                placeholder="The voter this ticket is about (leave blank for Anonymous)"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-description">Description</Label>
              <Textarea
                id="new-description"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Describe the issue in detail. What happened? What did the voter expect? What did they see instead?"
                rows={4}
              />
              <p className="text-[10px] text-muted-foreground">{newDescription.length}/5000 characters</p>
            </div>
            <Alert className="border-primary/30 bg-primary/5">
              <MessageSquare className="h-4 w-4 text-primary" />
              <AlertTitle>Tip</AlertTitle>
              <AlertDescription>
                Include any error messages, screenshots references, or voter identifiers in the description — the more detail you provide, the faster the team can triage.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setNewOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button
              onClick={createTicket}
              disabled={creating || !newDescription.trim()}
              className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Create Ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, colour }: { icon: any; label: string; value: number; colour: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-lg', colour)}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <div className="font-display text-xl font-bold leading-none">{value.toLocaleString()}</div>
          <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  )
}
