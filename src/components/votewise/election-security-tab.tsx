'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Shield, ShieldAlert, ShieldCheck, Lock, LockOpen, Siren, FileCheck2,
  Clock, AlertCircle, AlertTriangle, CheckCircle2, XCircle, Loader2,
  Activity, Eye, RefreshCw, ChevronRight, Zap, Award, Ban, Fingerprint,
} from 'lucide-react'
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { IncidentDetail } from '@/components/votewise/incident-detail'
import { ForensicReplay } from '@/components/votewise/forensic-replay'

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface ElectionStatus {
  election: { id: string; name: string; status: string; startTime: string; endTime: string }
  integrityScore: number
  riskScore: number
  threatLevel: 'LOW' | 'MODERATE' | 'ELEVATED' | 'HIGH' | 'CRITICAL'
  riskFactors: Array<{ factor: string; points: number; description: string }>
  lock: {
    electionId: string
    lockedAt: string
    lockedByName: string
    candidatesLocked: boolean
    positionsLocked: boolean
    rulesLocked: boolean
    eligibilityLocked: boolean
    ballotLocked: boolean
    settingsLocked: boolean
    emergencyOverrides: number
    lockedDown: boolean
    lockedDownReason?: string
  } | null
}

interface Incident {
  id: string
  incidentNumber: string
  title: string
  severity: string
  status: string
  riskScore: number
  detectedAt: string
}

interface IntegrityEvent {
  id: string
  eventType: string
  category: string
  severity: string
  description: string
  actorName?: string
  detected: boolean
  createdAt: string
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

const THREAT_LEVEL_STYLE: Record<string, { badge: string; dot: string; label: string; pulse?: boolean }> = {
  LOW: {
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    dot: 'bg-emerald-500',
    label: 'Low',
  },
  MODERATE: {
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    dot: 'bg-amber-500',
    label: 'Moderate',
  },
  ELEVATED: {
    badge: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
    dot: 'bg-orange-500',
    label: 'Elevated',
  },
  HIGH: {
    badge: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
    dot: 'bg-red-500',
    label: 'High',
  },
  CRITICAL: {
    badge: 'bg-red-600 text-white dark:bg-red-500 dark:text-white animate-pulse',
    dot: 'bg-red-600',
    label: 'Critical',
    pulse: true,
  },
}

const SEVERITY_STYLE: Record<string, string> = {
  LOW: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-300',
  MEDIUM: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  HIGH: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
  CRITICAL: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  INFO: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-500/15 dark:text-zinc-400',
}

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

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function ElectionSecurityTab({
  electionId,
  subdomain,
}: {
  electionId: string
  subdomain?: string
}) {
  const [status, setStatus] = useState<ElectionStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [events, setEvents] = useState<IntegrityEvent[]>([])
  const [openIncidentId, setOpenIncidentId] = useState<string | null>(null)
  const [forensicOpen, setForensicOpen] = useState(false)
  const [generatingCert, setGeneratingCert] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [s, inc, ev] = await Promise.all([
        api.getEifdirsElectionStatus(electionId, subdomain),
        api.getEifdirsIncidents(`electionId=${encodeURIComponent(electionId)}&limit=20`, subdomain).catch(() => ({ incidents: [] })),
        api.getEifdirsEvents(`electionId=${encodeURIComponent(electionId)}&limit=30`, subdomain).catch(() => ({ events: [] })),
      ])
      setStatus(s as ElectionStatus)
      setIncidents((inc as any)?.incidents || [])
      setEvents((ev as any)?.events || [])
    } catch (e: any) {
      setError(e?.message || 'Failed to load security status')
    } finally {
      setLoading(false)
    }
  }, [electionId, subdomain])

  useEffect(() => {
    load()
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [load])

  async function generateCert() {
    setGeneratingCert(true)
    try {
      await api.generateEifdirsCertificate(electionId, subdomain)
      toast.success('Integrity certificate generated.')
      await load()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to generate certificate')
    } finally {
      setGeneratingCert(false)
    }
  }

  if (loading) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-2 text-sm text-muted-foreground">Loading election security status…</p>
      </div>
    )
  }

  if (error || !status) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-destructive/50" />
          <p className="mt-2 text-sm font-medium">{error || 'Security status unavailable.'}</p>
          <Button onClick={load} variant="outline" size="sm" className="mt-3 gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  const threat = THREAT_LEVEL_STYLE[status.threatLevel] || THREAT_LEVEL_STYLE.LOW
  const integrityColor =
    status.integrityScore > 95
      ? 'text-emerald-600 dark:text-emerald-400'
      : status.integrityScore > 85
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-red-600 dark:text-red-400'
  const integrityBar =
    status.integrityScore > 95
      ? 'bg-emerald-500'
      : status.integrityScore > 85
        ? 'bg-amber-500'
        : 'bg-red-500'
  const lock = status.lock

  return (
    <div className="space-y-4">
      {/* ---------- Header — integrity + threat ---------- */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="votewise-card-glow border-primary/20">
          <CardContent className="p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Shield className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-xl font-bold">Election Security Status</h3>
                    <Badge className={cn('gap-1.5', threat.badge)}>
                      <span className={cn('h-1.5 w-1.5 rounded-full', threat.dot, threat.pulse && 'animate-pulse')} />
                      {threat.label} Threat
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {status.election.name} · {status.election.status}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={generateCert}
                  disabled={generatingCert}
                >
                  {generatingCert ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Award className="h-3.5 w-3.5" />
                  )}
                  Generate Integrity Certificate
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setForensicOpen(true)}
                >
                  <Eye className="h-3.5 w-3.5" />
                  View Forensic Replay
                </Button>
              </div>
            </div>

            <Separator className="my-4" />

            {/* Integrity score + risk */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Integrity Score</div>
                <div className={cn('font-display text-3xl font-bold tabular-nums', integrityColor)}>
                  {status.integrityScore.toFixed(1)}
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${status.integrityScore}%` }}
                    transition={{ duration: 0.7, ease: 'easeOut' }}
                    className={cn('h-full rounded-full', integrityBar)}
                  />
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Risk Score</div>
                <div className="font-display text-3xl font-bold tabular-nums text-foreground">
                  {status.riskScore}
                </div>
                <div className="mt-1 text-[10px] text-muted-foreground">0–100 (lower is better)</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Threat Level</div>
                <div className="mt-1 flex items-center gap-2">
                  <span className={cn('h-2.5 w-2.5 rounded-full', threat.dot, threat.pulse && 'animate-pulse')} />
                  <span className="font-display text-xl font-bold">{threat.label}</span>
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Lockdown Status</div>
                <div className="mt-1 flex items-center gap-2">
                  {lock?.lockedDown ? (
                    <>
                      <Lock className="h-5 w-5 text-red-600" />
                      <span className="font-display text-xl font-bold text-red-700 dark:text-red-400">Active</span>
                    </>
                  ) : (
                    <>
                      <LockOpen className="h-5 w-5 text-emerald-600" />
                      <span className="font-display text-xl font-bold text-emerald-700 dark:text-emerald-400">None</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Risk factors */}
            {status.riskFactors && status.riskFactors.length > 0 && (
              <>
                <Separator className="my-4" />
                <div>
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Active Risk Factors
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {status.riskFactors.slice(0, 6).map((f, i) => (
                      <div key={i} className="flex items-start gap-2 rounded-md border border-border/60 bg-muted/30 p-2">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                        <div className="min-w-0">
                          <div className="text-xs font-medium">{f.factor}</div>
                          <div className="text-[10px] text-muted-foreground">{f.description}</div>
                        </div>
                        <Badge variant="outline" className="ml-auto text-[9px]">
                          +{f.points}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ---------- Lock status ---------- */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="font-display text-base flex items-center gap-2">
              <Lock className="h-4 w-4 text-primary" />
              Election Lock Status
            </CardTitle>
            {lock?.lockedDown && (
              <Badge className="bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300 gap-1">
                <Siren className="h-3 w-3" /> LOCKDOWN ACTIVE
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!lock ? (
            <Alert>
              <LockOpen className="h-4 w-4" />
              <AlertTitle>Not locked</AlertTitle>
              <AlertDescription>
                This election is not yet locked. Configuration locks automatically when the election goes live.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              {lock.lockedDown && (
                <Alert variant="destructive" className="border-red-300 bg-red-50/60 dark:border-red-900/60 dark:bg-red-950/20">
                  <Siren className="h-4 w-4" />
                  <AlertTitle className="text-red-800 dark:text-red-300">Emergency lockdown in effect</AlertTitle>
                  <AlertDescription className="text-red-700 dark:text-red-400 text-xs">
                    {lock.lockedDownReason || 'Lockdown initiated.'}
                  </AlertDescription>
                </Alert>
              )}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Locked {relTime(lock.lockedAt)}
                </span>
                <span className="flex items-center gap-1.5">
                  <Fingerprint className="h-3.5 w-3.5" />
                  by {lock.lockedByName || 'SYSTEM'}
                </span>
                <span className="flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-amber-600" />
                  Emergency overrides: <span className="font-semibold text-foreground">{lock.emergencyOverrides}</span>
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                <LockBadge label="Candidates" locked={lock.candidatesLocked} />
                <LockBadge label="Positions" locked={lock.positionsLocked} />
                <LockBadge label="Rules" locked={lock.rulesLocked} />
                <LockBadge label="Eligibility" locked={lock.eligibilityLocked} />
                <LockBadge label="Ballot" locked={lock.ballotLocked} />
                <LockBadge label="Settings" locked={lock.settingsLocked} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---------- Incidents + events for this election ---------- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="font-display text-base flex items-center gap-2">
                <Siren className="h-4 w-4 text-primary" />
                Incidents
              </CardTitle>
              <Badge variant="outline" className="text-[10px]">{incidents.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="votewise-scroll max-h-80 overflow-y-auto px-4 pb-4">
              {incidents.length === 0 ? (
                <div className="py-10 text-center">
                  <ShieldCheck className="mx-auto h-10 w-10 text-emerald-600/40" />
                  <p className="mt-2 text-sm font-medium">No incidents for this election.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {incidents.map((inc, i) => (
                    <motion.button
                      key={inc.id}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2, delay: i * 0.03 }}
                      onClick={() => setOpenIncidentId(inc.id)}
                      className="flex w-full items-center gap-3 rounded-lg border border-transparent p-2.5 text-left transition-colors hover:border-border hover:bg-muted/40"
                    >
                      <div className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-lg', SEVERITY_STYLE[inc.severity] || SEVERITY_STYLE.INFO)}>
                        {inc.severity === 'CRITICAL' ? <AlertCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] font-semibold text-muted-foreground">{inc.incidentNumber}</span>
                          <Badge className={cn('text-[9px] px-1.5 py-0', SEVERITY_STYLE[inc.severity] || SEVERITY_STYLE.INFO)}>
                            {inc.severity}
                          </Badge>
                          <Badge variant="outline" className={cn('text-[9px] px-1.5 py-0', STATUS_STYLE[inc.status] || '')}>
                            {inc.status}
                          </Badge>
                        </div>
                        <div className="truncate text-sm font-medium">{inc.title}</div>
                        <div className="text-[10px] text-muted-foreground">
                          detected {relTime(inc.detectedAt)} · risk {inc.riskScore}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </motion.button>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="font-display text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Integrity Event Stream
              </CardTitle>
              <Badge variant="outline" className="text-[10px]">{events.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="votewise-scroll max-h-80 overflow-y-auto px-4 pb-4">
              {events.length === 0 ? (
                <div className="py-10 text-center">
                  <Activity className="mx-auto h-10 w-10 text-muted-foreground/40" />
                  <p className="mt-2 text-sm font-medium">No events recorded.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {events.map((ev, i) => (
                    <motion.div
                      key={ev.id}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2, delay: i * 0.025 }}
                      className={cn(
                        'flex items-start gap-3 rounded-lg border border-transparent p-2.5',
                        ev.detected && 'border-red-200 bg-red-50/50 dark:border-red-900/40 dark:bg-red-950/20',
                      )}
                    >
                      <div className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-lg', ev.detected ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300' : SEVERITY_STYLE[ev.severity] || SEVERITY_STYLE.INFO)}>
                        {ev.detected ? <Zap className="h-4 w-4" /> : <Activity className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[10px] font-semibold text-muted-foreground">
                            {ev.eventType.replace(/_/g, ' ')}
                          </span>
                          <Badge className={cn('text-[9px] px-1.5 py-0', SEVERITY_STYLE[ev.severity] || SEVERITY_STYLE.INFO)}>
                            {ev.severity}
                          </Badge>
                        </div>
                        <div className="line-clamp-2 text-xs">{ev.description}</div>
                        <div className="mt-0.5 text-[10px] text-muted-foreground">
                          {ev.actorName && <span>{ev.actorName} · </span>}
                          {relTime(ev.createdAt)}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ---------- Incident detail dialog ---------- */}
      {openIncidentId && (
        <IncidentDetail
          incidentId={openIncidentId}
          subdomain={subdomain}
          open={!!openIncidentId}
          onClose={() => setOpenIncidentId(null)}
        />
      )}

      {/* ---------- Forensic replay dialog ---------- */}
      <Dialog open={forensicOpen} onOpenChange={setForensicOpen}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-hidden p-0 sm:max-w-5xl">
          <DialogHeader className="border-b border-border px-5 py-4 text-left">
            <DialogTitle className="flex items-center gap-2 font-display">
              <Eye className="h-5 w-5 text-primary" />
              Forensic Replay
            </DialogTitle>
            <DialogDescription>
              Chronological reconstruction of every significant event for forensic analysis.
            </DialogDescription>
          </DialogHeader>
          <div className="votewise-scroll max-h-[calc(92vh-5rem)] overflow-y-auto p-5">
            <ForensicReplay electionId={electionId} subdomain={subdomain} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ----------------------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------------------

function LockBadge({ label, locked }: { label: string; locked: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md border p-2',
        locked
          ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20'
          : 'border-zinc-200 bg-zinc-50/60 dark:border-zinc-700 dark:bg-zinc-900/30',
      )}
    >
      {locked ? (
        <Lock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <LockOpen className="h-3.5 w-3.5 text-zinc-400" />
      )}
      <div>
        <div className="text-xs font-medium">{label}</div>
        <div className={cn('text-[10px]', locked ? 'text-emerald-700 dark:text-emerald-300' : 'text-muted-foreground')}>
          {locked ? 'Locked' : 'Unlocked'}
        </div>
      </div>
    </div>
  )
}
