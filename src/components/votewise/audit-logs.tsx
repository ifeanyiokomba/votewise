'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ScrollText, Shield, CheckCircle2, AlertCircle, Search, Hash, Fingerprint,
  Clock, User, Filter, Download, RefreshCw, Loader2, ChevronRight, ChevronDown,
  Globe, Cpu,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface AuditEntry {
  id: string
  actorId: string
  actorRole: string
  actorName: string
  action: string
  resource?: string | null
  resourceId?: string | null
  details?: string | null
  ip?: string | null
  device?: string | null
  browser?: string | null
  prevHash: string
  hash: string
  nonce: string
  createdAt: string
}

interface AuditData {
  logs: AuditEntry[]
  chainIntact: boolean
  totalChecked: number
  brokenAt?: string
  electionId: string
  electionName?: string
}

// Action-type → badge colour. Emerald/gold/amber palette only — never blue/indigo.
const ACTION_STYLES: Record<string, { cls: string; label?: string }> = {
  VOTE_CAST:           { cls: 'bg-emerald-100 text-emerald-700' },
  GO_LIVE:             { cls: 'bg-emerald-100 text-emerald-700' },
  RESULTS_GENERATED:   { cls: 'bg-amber-100 text-amber-700' },
  TALLY_LOCKED:        { cls: 'bg-amber-100 text-amber-700' },
  ELECTION_UPDATED:    { cls: 'bg-primary/10 text-primary' },
  ELECTION_CREATED:    { cls: 'bg-primary/10 text-primary' },
  ELECTION_DUPLICATED: { cls: 'bg-primary/10 text-primary' },
  VOTING_SESSION_STARTED: { cls: 'bg-amber-100 text-amber-700' },
  ACCREDITATION_ISSUED:{ cls: 'bg-amber-100 text-amber-700' },
  VALIDATION_FAILED:   { cls: 'bg-red-100 text-red-700' },
  SECURITY_EVENT:      { cls: 'bg-red-100 text-red-700' },
  CERTIFIED:           { cls: 'bg-accent text-accent-foreground' },
  GENESIS:             { cls: 'bg-accent text-accent-foreground' },
}

// Role → badge colour.
const ROLE_STYLES: Record<string, string> = {
  SUPER_ADMIN:           'bg-red-100 text-red-700',
  ELECTORAL_COMMITTEE:   'bg-primary/10 text-primary',
  FACULTY_OFFICER:       'bg-amber-100 text-amber-700',
  DEPARTMENT_OFFICER:    'bg-amber-100 text-amber-700',
  OBSERVER:              'bg-emerald-100 text-emerald-700',
  VOTER:                 'bg-muted text-muted-foreground',
  SYSTEM:                'bg-muted text-muted-foreground',
}

const DEFAULT_ACTION_FILTERS = [
  'ALL',
  'VOTE_CAST',
  'GO_LIVE',
  'VOTING_SESSION_STARTED',
  'ELECTION_UPDATED',
  'ELECTION_CREATED',
  'RESULTS_GENERATED',
  'TALLY_LOCKED',
  'CERTIFIED',
]

function actionStyle(action: string): string {
  return (ACTION_STYLES[action]?.cls) || 'bg-muted text-muted-foreground'
}
function roleStyle(role: string): string {
  return (ROLE_STYLES[role]) || 'bg-muted text-muted-foreground'
}

function truncateHash(h: string, head = 10, tail = 6): string {
  if (!h) return ''
  if (h.length <= head + tail + 1) return h
  return `${h.slice(0, head)}…${h.slice(-tail)}`
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
  } catch {
    return iso
  }
}

function parseDetails(d?: string | null): Record<string, unknown> | string | null {
  if (!d) return null
  try {
    const parsed = JSON.parse(d)
    return typeof parsed === 'object' && parsed !== null ? parsed : d
  } catch {
    return d
  }
}

export function AuditLogs({ electionId, subdomain }: { electionId: string; subdomain?: string }) {
  const [data, setData] = useState<AuditData | null>(null)
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState<string>('ALL')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  async function load(showToast = false) {
    setLoading(true)
    try {
      const d = await api.getElectionAudit(electionId, subdomain)
      setData(d as AuditData)
      if (showToast) toast.success(`Verified ${d.totalChecked} entries`)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load audit log')
    } finally {
      setLoading(false)
    }
  }

  async function verifyChain() {
    setVerifying(true)
    try {
      const d = await api.getElectionAudit(electionId, subdomain)
      setData(d as AuditData)
      if (d.chainIntact) {
        toast.success(`Audit chain intact — ${d.totalChecked} entries verified`)
      } else {
        toast.error(`Audit chain broken at entry ${d.brokenAt?.slice(-6) ?? 'unknown'}`)
      }
    } catch (e: any) {
      toast.error(e?.message || 'Verification failed')
    } finally {
      setVerifying(false)
    }
  }

  useEffect(() => { load() }, [electionId])

  // Discover additional action types present in the data (so the filter list
  // includes everything that actually exists, not just the defaults).
  const availableActions = useMemo(() => {
    if (!data) return DEFAULT_ACTION_FILTERS
    const found = new Set(data.logs.map((l) => l.action))
    const merged = [...DEFAULT_ACTION_FILTERS]
    for (const a of found) {
      if (!merged.includes(a)) merged.push(a)
    }
    return merged
  }, [data])

  const filtered = useMemo(() => {
    if (!data) return []
    const q = search.trim().toLowerCase()
    return data.logs.filter((l) => {
      if (actionFilter !== 'ALL' && l.action !== actionFilter) return false
      if (!q) return true
      return (
        l.action.toLowerCase().includes(q) ||
        l.actorName.toLowerCase().includes(q) ||
        l.actorRole.toLowerCase().includes(q) ||
        (l.details || '').toLowerCase().includes(q) ||
        (l.ip || '').toLowerCase().includes(q) ||
        l.hash.toLowerCase().includes(q)
      )
    })
  }, [data, search, actionFilter])

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function exportJson() {
    if (!data) return
    const payload = {
      electionId: data.electionId,
      electionName: data.electionName,
      exportedAt: new Date().toISOString(),
      chainIntact: data.chainIntact,
      totalChecked: data.totalChecked,
      brokenAt: data.brokenAt ?? null,
      entries: data.logs,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `votewise-audit-${data.electionId}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Audit log exported')
  }

  if (loading) {
    return (
      <div className="grid min-h-[30vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No audit data available.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Chain integrity banner */}
      {data.chainIntact ? (
        <Alert className="border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/30">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <AlertTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
            Audit Chain Intact
          </AlertTitle>
          <AlertDescription className="text-emerald-700 dark:text-emerald-300">
            {data.totalChecked.toLocaleString()} {data.totalChecked === 1 ? 'entry' : 'entries'} verified — every hash links correctly to the previous record. The audit trail has not been tampered with.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert variant="destructive" className="border-red-500/40">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="flex items-center gap-2">Chain Broken</AlertTitle>
          <AlertDescription>
            The audit chain is broken at entry <code className="rounded bg-red-100 px-1 font-mono text-xs dark:bg-red-950/60">{data.brokenAt?.slice(-8) ?? 'unknown'}</code>. One or more records have been modified, deleted, or reordered. Investigate immediately.
          </AlertDescription>
        </Alert>
      )}

      {/* Toolbar */}
      <Card className="votewise-card-glow">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 font-display text-base">
              <ScrollText className="h-4 w-4 text-primary" /> Hash-Chained Audit Log
              <Badge variant="outline" className="ml-1 text-[10px]">{data.totalChecked} entries</Badge>
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button onClick={verifyChain} disabled={verifying} size="sm" variant="outline" className="gap-1.5">
                {verifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Shield className="h-3.5 w-3.5 text-emerald-600" />}
                Verify Chain
              </Button>
              <Button onClick={() => load(true)} size="sm" variant="outline" className="gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </Button>
              <Button onClick={exportJson} size="sm" variant="outline" className="gap-1.5">
                <Download className="h-3.5 w-3.5" /> Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Search + filter row */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by action, actor, details, IP, or hash…"
                className="pl-9"
                aria-label="Search audit log"
              />
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Filter className="h-3.5 w-3.5" /> Filter:
            </div>
          </div>
          {/* Action filter chips */}
          <div className="flex flex-wrap gap-1.5">
            {availableActions.map((a) => (
              <button
                key={a}
                onClick={() => setActionFilter(a)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                  actionFilter === a
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border/60 bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                )}
              >
                {a === 'ALL' ? 'All' : a.replace(/_/g, ' ')}
              </button>
            ))}
          </div>

          <Separator />

          {/* List */}
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <ScrollText className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <p className="mt-2">No audit entries match your filters.</p>
              {data.logs.length === 0 && (
                <p className="mt-1 text-xs">This election has no audit activity yet.</p>
              )}
            </div>
          ) : (
            <div className="max-h-[600px] overflow-y-auto pr-1">
              <AnimatePresence initial={false}>
                {filtered.map((entry, idx) => {
                  const isOpen = expanded.has(entry.id)
                  const details = parseDetails(entry.details)
                  return (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.18, delay: Math.min(idx * 0.012, 0.2) }}
                      className={cn(
                        'rounded-lg border border-border/60 bg-card p-3 transition-colors hover:bg-accent/5',
                        data.brokenAt === entry.id && 'ring-1 ring-red-500/60',
                        idx > 0 && 'mt-2',
                      )}
                    >
                      {/* Row 1: timestamp + actor + action */}
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="gap-1 font-mono text-[10px]">
                            <Clock className="h-3 w-3" /> {formatTime(entry.createdAt)}
                          </Badge>
                          <Badge className={cn('gap-1 text-[10px]', actionStyle(entry.action))}>
                            {entry.action.replace(/_/g, ' ')}
                          </Badge>
                          {entry.actorRole && (
                            <Badge variant="outline" className={cn('gap-1 text-[10px]', roleStyle(entry.actorRole))}>
                              <User className="h-3 w-3" /> {entry.actorName || 'System'}
                              <span className="opacity-70">· {entry.actorRole.replace(/_/g, ' ')}</span>
                            </Badge>
                          )}
                        </div>
                        <button
                          onClick={() => toggleExpand(entry.id)}
                          className="flex items-center gap-1 rounded px-1 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
                          aria-label={isOpen ? 'Collapse entry' : 'Expand entry'}
                        >
                          {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                          {isOpen ? 'Less' : 'More'}
                        </button>
                      </div>

                      {/* Row 2: hash + ip (always visible, compact) */}
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1" title={entry.hash}>
                          <Hash className="h-3 w-3 text-primary/70" />
                          <code className="font-mono">{truncateHash(entry.hash)}</code>
                        </span>
                        {entry.ip && (
                          <span className="flex items-center gap-1">
                            <Globe className="h-3 w-3" /> {entry.ip}
                          </span>
                        )}
                        {entry.device && (
                          <span className="flex items-center gap-1">
                            <Cpu className="h-3 w-3" /> {entry.device}
                          </span>
                        )}
                        {entry.resource && (
                          <span className="flex items-center gap-1">
                            <Fingerprint className="h-3 w-3" /> {entry.resource}
                            {entry.resourceId && <code className="font-mono opacity-70">#{entry.resourceId.slice(-6)}</code>}
                          </span>
                        )}
                      </div>

                      {/* Expanded details */}
                      <AnimatePresence initial={false}>
                        {isOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-3 space-y-2 border-t border-border/60 pt-3 text-xs">
                              <div>
                                <div className="mb-1 flex items-center gap-1 text-muted-foreground">
                                  <Hash className="h-3 w-3" /> Full Hash (SHA-256)
                                </div>
                                <code className="block break-all rounded bg-muted p-2 font-mono text-[10px]">{entry.hash}</code>
                              </div>
                              <div>
                                <div className="mb-1 flex items-center gap-1 text-muted-foreground">
                                  <Shield className="h-3 w-3" /> Previous Hash
                                </div>
                                <code className="block break-all rounded bg-muted p-2 font-mono text-[10px]">{entry.prevHash}</code>
                              </div>
                              <div>
                                <div className="mb-1 flex items-center gap-1 text-muted-foreground">
                                  <Fingerprint className="h-3 w-3" /> Nonce
                                </div>
                                <code className="block break-all rounded bg-muted p-2 font-mono text-[10px]">{entry.nonce}</code>
                              </div>
                              {entry.browser && (
                                <div>
                                  <div className="mb-1 text-muted-foreground">User Agent</div>
                                  <code className="block break-all rounded bg-muted p-2 font-mono text-[10px]">{entry.browser}</code>
                                </div>
                              )}
                              {details !== null && (
                                <div>
                                  <div className="mb-1 text-muted-foreground">Details</div>
                                  {typeof details === 'string' ? (
                                    <div className="rounded bg-muted p-2 text-foreground">{details}</div>
                                  ) : (
                                    <pre className="overflow-x-auto rounded bg-muted p-2 text-[10px] text-foreground">
                                      {JSON.stringify(details, null, 2)}
                                    </pre>
                                  )}
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
