'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Shield, ShieldAlert, ShieldCheck, AlertTriangle, AlertCircle, CheckCircle2,
  XCircle, Clock, User, Fingerprint, FileText, Activity, Loader2, RefreshCw,
  ArrowUpCircle, MessageSquarePlus, XCircle as XMarkCircle, Siren, ChevronRight,
  Tag,
} from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface InvestigationNote {
  note: string
  author: string
  authorId?: string
  timestamp: string
}

interface EvidenceItem {
  type: string
  description: string
  data?: string
  collectedBy: string
  collectedAt: string
}

interface CustodyStep {
  action: string
  actor: string
  actorId?: string
  timestamp: string
  signature?: string
}

interface RelatedEvent {
  id: string
  eventType: string
  category: string
  severity: string
  description: string
  actorName?: string
  detected: boolean
  createdAt: string
}

interface Incident {
  id: string
  incidentNumber: string
  title: string
  description: string
  category: string
  severity: string
  status: string
  riskScore: number
  detectedBy: string
  detectedAt: string
  assignedToId?: string | null
  assignedToName?: string | null
  falsePositive: boolean
  resolution?: string | null
  resolvedAt?: string | null
  resolvedByName?: string | null
  electionId?: string | null
  evidence: EvidenceItem[]
  investigationNotes: InvestigationNote[]
  relatedEventIds: string[]
  chainOfCustody: CustodyStep[]
  createdAt: string
  updatedAt: string
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

const INCIDENT_STATUSES = ['DETECTED', 'OPEN', 'ASSIGNED', 'INVESTIGATING', 'CONTAINMENT', 'RESOLVED', 'CLOSED']

const STATUS_STYLE: Record<string, string> = {
  DETECTED: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300',
  OPEN: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  ASSIGNED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  INVESTIGATING: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
  CONTAINMENT: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  RESOLVED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-600/20 dark:text-emerald-200',
  CLOSED: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-300',
  ARCHIVED: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-500/15 dark:text-zinc-400',
}

const SEVERITY_STYLE: Record<string, { badge: string; bar: string; label: string }> = {
  LOW: {
    badge: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-300',
    bar: 'bg-zinc-400',
    label: 'Low',
  },
  MEDIUM: {
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    bar: 'bg-amber-500',
    label: 'Medium',
  },
  HIGH: {
    badge: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
    bar: 'bg-amber-600',
    label: 'High',
  },
  CRITICAL: {
    badge: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
    bar: 'bg-red-600',
    label: 'Critical',
  },
}

const EVIDENCE_TYPE_STYLE: Record<string, string> = {
  LOG: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  SCREENSHOT: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  FILE: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
  WITNESS: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300',
  SYSTEM_LOG: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function relTime(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  try {
    return d.toLocaleDateString(undefined, { month: 'short', day: '2-digit' })
  } catch {
    return iso
  }
}

function fmtDateTime(iso?: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
  } catch {
    return iso
  }
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function IncidentDetail({
  incidentId,
  subdomain,
  open,
  onClose,
}: {
  incidentId: string
  subdomain?: string
  open: boolean
  onClose: () => void
}) {
  const [incident, setIncident] = useState<Incident | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Action state
  const [newStatus, setNewStatus] = useState('')
  const [note, setNote] = useState('')
  const [fpReason, setFpReason] = useState('')
  const [escSeverity, setEscSeverity] = useState('HIGH')
  const [escReason, setEscReason] = useState('')
  const [acting, setActing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const inc: any = await api.getEifdirsIncident(incidentId, subdomain)
      setIncident(inc)
      setNewStatus(inc?.status || '')
    } catch (e: any) {
      setError(e?.message || 'Failed to load incident')
    } finally {
      setLoading(false)
    }
  }, [incidentId, subdomain])

  useEffect(() => {
    if (open && incidentId) load()
  }, [open, incidentId, load])

  async function doAction(action: string, body: any = {}, successMsg: string, resetFn?: () => void) {
    setActing(true)
    try {
      await api.updateEifdirsIncident(incidentId, { action, ...body }, subdomain)
      toast.success(successMsg)
      resetFn?.()
      await load()
    } catch (e: any) {
      toast.error(e?.message || `Failed to ${action}`)
    } finally {
      setActing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="border-b border-border px-5 py-4 text-left">
          <DialogTitle className="flex items-center gap-2 font-display">
            <ShieldAlert className="h-5 w-5 text-primary" />
            Incident Investigation
          </DialogTitle>
          <DialogDescription>
            Full forensic record · all actions are logged in the chain of custody.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="grid place-items-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="mt-2 text-sm text-muted-foreground">Loading incident…</p>
          </div>
        ) : error || !incident ? (
          <div className="px-5 py-10 text-center">
            <AlertCircle className="mx-auto h-10 w-10 text-destructive/50" />
            <p className="mt-2 text-sm font-medium">{error || 'Incident not found.'}</p>
            <Button onClick={load} variant="outline" size="sm" className="mt-3 gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </Button>
          </div>
        ) : (
          <div className="votewise-scroll max-h-[calc(92vh-7rem)] overflow-y-auto px-5 py-4">
            {/* ---------- Header ---------- */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="mb-5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-semibold text-muted-foreground">
                  {incident.incidentNumber}
                </span>
                <Badge className={cn('text-[10px]', (SEVERITY_STYLE[incident.severity] || SEVERITY_STYLE.LOW).badge)}>
                  {(SEVERITY_STYLE[incident.severity] || SEVERITY_STYLE.LOW).label}
                </Badge>
                <Badge variant="outline" className={cn('text-[10px]', STATUS_STYLE[incident.status] || '')}>
                  {incident.status}
                </Badge>
                {incident.falsePositive && (
                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 text-[10px]">
                    False Positive
                  </Badge>
                )}
              </div>
              <h2 className="mt-1.5 font-display text-xl font-bold leading-tight">{incident.title}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Tag className="h-3.5 w-3.5" />
                  {incident.category?.replace(/_/g, ' ').toLowerCase()}
                </span>
                <span className="flex items-center gap-1">
                  <Siren className="h-3.5 w-3.5" />
                  Risk score: <span className="font-mono font-semibold text-foreground">{incident.riskScore}</span>
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  detected {relTime(incident.detectedAt)}
                </span>
              </div>
            </motion.div>

            {/* ---------- Description ---------- */}
            <Card className="mb-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Description
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm leading-relaxed">{incident.description}</p>
              </CardContent>
            </Card>

            {/* ---------- Detection + assignment grid ---------- */}
            <div className="mb-4 grid gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Detection
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5 pt-0 text-sm">
                  <Row label="Detected by" value={incident.detectedBy || 'SYSTEM'} />
                  <Row label="Detected at" value={fmtDateTime(incident.detectedAt)} />
                  <Row label="Incident ID" value={<span className="font-mono text-[10px]">{incident.id}</span>} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Assignment
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5 pt-0 text-sm">
                  <Row
                    label="Assigned to"
                    value={
                      incident.assignedToName ? (
                        <span className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          {incident.assignedToName}
                        </span>
                      ) : (
                        <span className="text-muted-foreground italic">Unassigned</span>
                      )
                    }
                  />
                  {incident.resolvedAt && (
                    <Row label="Resolved at" value={fmtDateTime(incident.resolvedAt)} />
                  )}
                  {incident.resolvedByName && (
                    <Row label="Resolved by" value={incident.resolvedByName} />
                  )}
                </CardContent>
              </Card>
            </div>

            {/* ---------- Investigation actions ---------- */}
            <Card className="mb-4 border-primary/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  Investigation Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                {/* Assign + status update row */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Take ownership</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-1.5"
                      disabled={acting || !!incident.assignedToId}
                      onClick={() => doAction('assign', {}, 'Incident assigned to you')}
                    >
                      <User className="h-3.5 w-3.5" />
                      {incident.assignedToId ? 'Already assigned' : 'Assign to me'}
                    </Button>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Update status</Label>
                    <div className="flex gap-2">
                      <Select value={newStatus} onValueChange={setNewStatus}>
                        <SelectTrigger className="h-8 flex-1" size="sm">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          {INCIDENT_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s.charAt(0) + s.slice(1).toLowerCase()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        className="gap-1.5"
                        disabled={acting || !newStatus || newStatus === incident.status}
                        onClick={() =>
                          doAction('updateStatus', { status: newStatus }, `Status updated to ${newStatus}`)
                        }
                      >
                        <ArrowUpCircle className="h-3.5 w-3.5" />
                        Set
                      </Button>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Add note */}
                <div className="space-y-1.5">
                  <Label htmlFor="note-input" className="text-xs">
                    Add investigation note
                  </Label>
                  <Textarea
                    id="note-input"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Document findings, hypotheses, evidence references…"
                    rows={2}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={acting || !note.trim()}
                    onClick={() =>
                      doAction('addNote', { note: note.trim() }, 'Note added', () => setNote(''))
                    }
                  >
                    <MessageSquarePlus className="h-3.5 w-3.5" />
                    Add Note
                  </Button>
                </div>

                <Separator />

                {/* Mark false positive */}
                <div className="space-y-1.5">
                  <Label htmlFor="fp-reason-input" className="text-xs">
                    Mark as false positive
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="fp-reason-input"
                      value={fpReason}
                      onChange={(e) => setFpReason(e.target.value)}
                      placeholder="Reason this incident is not a real threat…"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                      disabled={acting || !fpReason.trim() || incident.falsePositive}
                      onClick={() =>
                        doAction('markFalsePositive', { reason: fpReason.trim() }, 'Marked as false positive', () => setFpReason(''))
                      }
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Confirm
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* Escalate */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Escalate incident</Label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Select value={escSeverity} onValueChange={setEscSeverity}>
                      <SelectTrigger className="h-9 sm:w-32" size="sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((s) => (
                          <SelectItem key={s} value={s}>
                            {s.charAt(0) + s.slice(1).toLowerCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={escReason}
                      onChange={(e) => setEscReason(e.target.value)}
                      placeholder="Reason for escalation…"
                      className="flex-1"
                    />
                    <Button
                      variant="destructive"
                      size="sm"
                      className="gap-1.5 bg-orange-600 hover:bg-orange-700"
                      disabled={acting || !escReason.trim()}
                      onClick={() =>
                        doAction(
                          'escalate',
                          { severity: escSeverity, reason: escReason.trim() },
                          `Escalated to ${escSeverity}`,
                          () => setEscReason(''),
                        )
                      }
                    >
                      <Siren className="h-3.5 w-3.5" />
                      Escalate
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ---------- Notes + Evidence + Custody grid ---------- */}
            <div className="mb-4 grid gap-4 lg:grid-cols-2">
              {/* Investigation notes */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    Investigation Notes
                    <Badge variant="outline" className="ml-auto text-[10px]">
                      {incident.investigationNotes.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {incident.investigationNotes.length === 0 ? (
                    <p className="py-6 text-center text-xs text-muted-foreground">No notes yet.</p>
                  ) : (
                    <div className="votewise-scroll max-h-72 space-y-3 overflow-y-auto pr-1">
                      {incident.investigationNotes.map((n, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2, delay: i * 0.04 }}
                          className="rounded-md border border-border/60 bg-muted/30 p-2.5"
                        >
                          <div className="mb-1 flex items-center gap-2 text-xs">
                            <div className="grid h-5 w-5 place-items-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                              {n.author?.charAt(0) || '?'}
                            </div>
                            <span className="font-medium">{n.author}</span>
                            <span className="text-muted-foreground">· {relTime(n.timestamp)}</span>
                          </div>
                          <p className="text-xs leading-relaxed">{n.note}</p>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Evidence */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Fingerprint className="h-4 w-4 text-primary" />
                    Evidence
                    <Badge variant="outline" className="ml-auto text-[10px]">
                      {incident.evidence.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {incident.evidence.length === 0 ? (
                    <p className="py-6 text-center text-xs text-muted-foreground">No evidence collected.</p>
                  ) : (
                    <div className="votewise-scroll max-h-72 space-y-2 overflow-y-auto pr-1">
                      {incident.evidence.map((ev, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2, delay: i * 0.04 }}
                          className="rounded-md border border-border/60 p-2.5"
                        >
                          <div className="mb-1 flex items-center gap-2">
                            <Badge className={cn('text-[9px] px-1.5 py-0', EVIDENCE_TYPE_STYLE[ev.type] || 'bg-zinc-100 text-zinc-600')}>
                              {ev.type.replace(/_/g, ' ')}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {relTime(ev.collectedAt)} · {ev.collectedBy}
                            </span>
                          </div>
                          <p className="text-xs leading-relaxed">{ev.description}</p>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* ---------- Chain of custody ---------- */}
            <Card className="mb-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  Chain of Custody
                  <Badge variant="outline" className="ml-auto text-[10px]">
                    {incident.chainOfCustody.length} steps
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="votewise-scroll max-h-72 overflow-y-auto pr-1">
                  <ol className="relative ml-3 border-l-2 border-border">
                    {incident.chainOfCustody.map((step, i) => (
                      <motion.li
                        key={i}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.25, delay: i * 0.04 }}
                        className="ml-4 pb-3"
                      >
                        <span
                          className={cn(
                            'absolute -left-[7px] mt-1 grid h-3 w-3 place-items-center rounded-full border-2 border-background',
                            i === 0
                              ? 'bg-emerald-500'
                              : i === incident.chainOfCustody.length - 1
                                ? 'bg-primary'
                                : 'bg-muted-foreground/60',
                          )}
                        />
                        <div className="text-xs font-medium">{step.action}</div>
                        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                          <User className="h-3 w-3" />
                          {step.actor}
                          <span>·</span>
                          <Clock className="h-3 w-3" />
                          {fmtDateTime(step.timestamp)}
                        </div>
                      </motion.li>
                    ))}
                  </ol>
                </div>
              </CardContent>
            </Card>

            {/* ---------- Related events ---------- */}
            <RelatedEvents incidentId={incident.id} subdomain={subdomain} />

            {incident.resolution && (
              <Alert className="mt-4 border-emerald-300 bg-emerald-50/60 dark:border-emerald-900/60 dark:bg-emerald-950/20">
                <CheckCircle2 className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                <AlertTitle className="text-emerald-800 dark:text-emerald-300">Resolution</AlertTitle>
                <AlertDescription className="text-emerald-700 dark:text-emerald-400 text-xs">
                  {incident.resolution}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ----------------------------------------------------------------------------
// Related events (loads on demand)
// ----------------------------------------------------------------------------

function RelatedEvents({ incidentId, subdomain }: { incidentId: string; subdomain?: string }) {
  const [events, setEvents] = useState<RelatedEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      try {
        // Pull recent events for this incident — we filter to ones whose
        // incidentId matches, since the API doesn't yet support filtering
        // directly by incidentId.
        const res: any = await api.getEifdirsEvents(`limit=200`, subdomain)
        const all: RelatedEvent[] = res?.events || []
        // Show only those linked to this incident OR detected events of the same org.
        const linked = all.filter((e: any) => e.incidentId === incidentId)
        setEvents(linked.length > 0 ? linked : all.filter((e: any) => e.detected).slice(0, 8))
      } catch {
        setEvents([])
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [incidentId, subdomain])

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Related Integrity Events
          <Badge variant="outline" className="ml-auto text-[10px]">
            {events.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <div className="py-4 text-center">
            <Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : events.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">No related events.</p>
        ) : (
          <div className="votewise-scroll max-h-60 space-y-1.5 overflow-y-auto pr-1">
            {events.map((ev, i) => {
              const st = SEVERITY_STYLE[ev.severity] || SEVERITY_STYLE.LOW
              return (
                <motion.div
                  key={ev.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: i * 0.03 }}
                  className={cn(
                    'flex items-start gap-2 rounded-md border border-border/60 p-2',
                    ev.detected && 'border-red-200 bg-red-50/40 dark:border-red-900/40 dark:bg-red-950/20',
                  )}
                >
                  <div className={cn('mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md', st.badge)}>
                    {ev.detected ? <AlertCircle className="h-3.5 w-3.5" /> : <Activity className="h-3.5 w-3.5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] font-semibold text-muted-foreground">
                        {ev.eventType.replace(/_/g, ' ')}
                      </span>
                      <Badge className={cn('text-[9px] px-1.5 py-0', st.badge)}>{st.label}</Badge>
                    </div>
                    <p className="line-clamp-2 text-xs leading-relaxed">{ev.description}</p>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">
                      {ev.actorName && <span>{ev.actorName} · </span>}
                      {relTime(ev.createdAt)}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ----------------------------------------------------------------------------
// Row helper
// ----------------------------------------------------------------------------

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  )
}
