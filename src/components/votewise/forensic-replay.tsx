'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Loader2, RefreshCw, AlertCircle, Activity, Shield, ShieldAlert, ShieldCheck,
  Vote, AlertTriangle, AlertCircle as AlertCirc, FileText, Clock, User, Siren,
  CheckCircle2, Zap, ScrollText, Flag, Eye,
} from 'lucide-react'
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface TimelineEntry {
  timestamp: string
  type: string
  category: string
  description: string
  actor?: string
  severity?: string
  detected?: boolean
  riskScore?: number
  incidentNumber?: string
}

interface ForensicReplayData {
  election: {
    id: string
    name: string
    status: string
    votingWindow: { start: string; end: string }
  }
  timeline: TimelineEntry[]
  summary: {
    totalEvents: number
    integrityEvents: number
    electionEvents: number
    auditLogs: number
    incidents: number
    votes: number
  }
}

// ----------------------------------------------------------------------------
// Constants — type → icon + colour
// ----------------------------------------------------------------------------

const TYPE_STYLE: Record<string, { icon: any; colour: string; label: string }> = {
  INTEGRITY_EVENT: {
    icon: Activity,
    colour: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    label: 'Integrity',
  },
  ELECTION_EVENT: {
    icon: Vote,
    colour: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    label: 'Election',
  },
  AUDIT_LOG: {
    icon: ScrollText,
    colour: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300',
    label: 'Audit',
  },
  INCIDENT_DETECTED: {
    icon: Siren,
    colour: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
    label: 'Incident',
  },
  INCIDENT_RESOLVED: {
    icon: CheckCircle2,
    colour: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-600/20 dark:text-emerald-200',
    label: 'Resolved',
  },
  FIRST_VOTE: {
    icon: Flag,
    colour: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
    label: 'First Vote',
  },
  LAST_VOTE: {
    icon: Flag,
    colour: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
    label: 'Last Vote',
  },
}

const SEVERITY_STYLE: Record<string, string> = {
  LOW: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-300',
  MEDIUM: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  HIGH: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
  CRITICAL: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  INFO: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-500/15 dark:text-zinc-400',
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function ForensicReplay({
  electionId,
  subdomain,
}: {
  electionId: string
  subdomain?: string
}) {
  const [data, setData] = useState<ForensicReplayData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'incidents' | 'detected'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const d: any = await api.getEifdirsForensicReplay(electionId, subdomain)
      setData(d)
    } catch (e: any) {
      setError(e?.message || 'Failed to load forensic replay')
    } finally {
      setLoading(false)
    }
  }, [electionId, subdomain])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <Card>
        <CardContent className="grid place-items-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="mt-2 text-sm text-muted-foreground">Reconstructing forensic timeline…</p>
        </CardContent>
      </Card>
    )
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-destructive/50" />
          <p className="mt-2 text-sm font-medium">{error || 'Forensic replay unavailable.'}</p>
          <Button onClick={load} variant="outline" size="sm" className="mt-3 gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  const timeline = data.timeline || []
  const filtered = timeline.filter((e) => {
    if (filter === 'incidents') return e.type === 'INCIDENT_DETECTED' || e.type === 'INCIDENT_RESOLVED'
    if (filter === 'detected') return e.detected || e.type === 'INCIDENT_DETECTED'
    return true
  })

  const s = data.summary
  const detectedCount = timeline.filter((e) => e.detected).length

  return (
    <div className="space-y-4">
      {/* ---------- Header ---------- */}
      <Card className="votewise-card-glow border-primary/20">
        <CardContent className="p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-lg font-bold">Forensic Replay</h3>
                  <Badge variant="outline" className="text-[10px]">
                    {data.election.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {data.election.name} · {timeline.length} timeline events
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {(['all', 'detected', 'incidents'] as const).map((f) => (
                <Button
                  key={f}
                  size="sm"
                  variant={filter === f ? 'default' : 'outline'}
                  className="gap-1.5 text-xs"
                  onClick={() => setFilter(f)}
                >
                  {f === 'all' && <Eye className="h-3.5 w-3.5" />}
                  {f === 'detected' && <Zap className="h-3.5 w-3.5" />}
                  {f === 'incidents' && <Siren className="h-3.5 w-3.5" />}
                  {f === 'all' ? 'All' : f === 'detected' ? `Detected (${detectedCount})` : `Incidents (${s.incidents})`}
                </Button>
              ))}
              <Button onClick={load} variant="ghost" size="sm" className="gap-1.5" aria-label="Refresh timeline">
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <Separator className="my-3" />

          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            <SummaryStat label="Integrity" value={s.integrityEvents} icon={Activity} colour="text-emerald-600 dark:text-emerald-400" />
            <SummaryStat label="Election" value={s.electionEvents} icon={Vote} colour="text-amber-600 dark:text-amber-400" />
            <SummaryStat label="Audit" value={s.auditLogs} icon={ScrollText} colour="text-zinc-600 dark:text-zinc-400" />
            <SummaryStat label="Incidents" value={s.incidents} icon={Siren} colour="text-red-600 dark:text-red-400" />
            <SummaryStat label="Detected" value={detectedCount} icon={Zap} colour="text-orange-600 dark:text-orange-400" />
            <SummaryStat label="Votes" value={s.votes} icon={Flag} colour="text-emerald-700 dark:text-emerald-300" />
          </div>
        </CardContent>
      </Card>

      {/* ---------- Timeline ---------- */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Chronological Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="py-10 text-center">
              <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <p className="mt-2 text-sm font-medium">No events to display.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {filter !== 'all'
                  ? `No ${filter} events recorded for this election.`
                  : 'This election has no recorded activity yet.'}
              </p>
            </div>
          ) : (
            <div className="votewise-scroll max-h-[600px] overflow-y-auto pr-2">
              <ol className="relative ml-3 border-l-2 border-border">
                {filtered.map((entry, i) => {
                  const style = TYPE_STYLE[entry.type] || TYPE_STYLE.AUDIT_LOG
                  const Icon = style.icon
                  const isDetected = entry.detected || entry.type === 'INCIDENT_DETECTED'
                  const sev = entry.severity || 'INFO'
                  return (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: Math.min(i * 0.025, 0.6) }}
                      className="ml-5 pb-4"
                    >
                      {/* Timeline marker */}
                      <span
                        className={cn(
                          'absolute -left-[9px] mt-1 grid h-4 w-4 place-items-center rounded-full border-2 border-background',
                          isDetected
                            ? 'bg-red-500'
                            : entry.type === 'INCIDENT_RESOLVED'
                              ? 'bg-emerald-600'
                              : entry.type === 'FIRST_VOTE' || entry.type === 'LAST_VOTE'
                                ? 'bg-amber-500'
                                : 'bg-primary',
                        )}
                      >
                        {isDetected && (
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-60" />
                        )}
                      </span>

                      {/* Entry card */}
                      <div
                        className={cn(
                          'rounded-lg border p-3 transition-colors',
                          isDetected
                            ? 'border-red-200 bg-red-50/40 dark:border-red-900/40 dark:bg-red-950/20'
                            : 'border-border bg-card',
                        )}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <div className={cn('grid h-6 w-6 place-items-center rounded-md', style.colour)}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <Badge variant="outline" className="text-[9px] uppercase tracking-wider">
                            {style.label}
                          </Badge>
                          {entry.incidentNumber && (
                            <Badge className="bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300 text-[9px] font-mono">
                              {entry.incidentNumber}
                            </Badge>
                          )}
                          {entry.severity && (
                            <Badge className={cn('text-[9px]', SEVERITY_STYLE[sev] || SEVERITY_STYLE.INFO)}>
                              {sev}
                            </Badge>
                          )}
                          {isDetected && (
                            <Badge className="bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300 text-[9px] gap-1">
                              <Zap className="h-3 w-3" /> Detected
                            </Badge>
                          )}
                          <span className="ml-auto flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {formatTimestamp(entry.timestamp)}
                          </span>
                        </div>
                        <p className="mt-1.5 text-sm leading-relaxed">{entry.description}</p>
                        {(entry.actor || entry.riskScore !== undefined) && (
                          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
                            {entry.actor && (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" /> {entry.actor}
                              </span>
                            )}
                            {entry.riskScore !== undefined && entry.riskScore > 0 && (
                              <span className="flex items-center gap-1">
                                <ShieldAlert className="h-3 w-3" /> risk {entry.riskScore}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <FileText className="h-3 w-3" /> {entry.category}
                            </span>
                          </div>
                        )}
                      </div>
                    </motion.li>
                  )
                })}
              </ol>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return iso
  }
}

function SummaryStat({
  label,
  value,
  icon: Icon,
  colour,
}: {
  label: string
  value: number
  icon: any
  colour: string
}) {
  return (
    <div className="text-center">
      <Icon className={cn('mx-auto h-4 w-4', colour)} />
      <div className={cn('mt-1 font-display text-lg font-bold tabular-nums', colour)}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  )
}
