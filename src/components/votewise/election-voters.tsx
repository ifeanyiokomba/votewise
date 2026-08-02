'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, UserPlus, Search, Filter, CheckCircle2, Clock, AlertCircle,
  Upload, Mail, Phone, Shield, Loader2, RefreshCw, ChevronLeft,
  ChevronRight, Ban, ShieldCheck, ShieldAlert, X, Inbox,
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
import { Progress } from '@/components/ui/progress'
import { Checkbox } from '@/components/ui/checkbox'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
interface Voter {
  id: string
  firstName?: string | null
  lastName?: string | null
  fullName: string
  email?: string | null
  institutionEmail?: string | null
  phone?: string | null
  matric: string
  status?: string | null
  verificationStatus?: string | null
  hasVoted: boolean
  votedAt?: string | null
  flagged?: boolean
  flaggedReason?: string | null
  createdAt: string
}

interface VoterStats {
  total: number
  voted: number
  pending: number
  suspended: number
  verified: number
  rejected: number
  turnoutPct: number
}

interface VotersData {
  voters: Voter[]
  stats: VoterStats
  page: number
  pageSize: number
  totalPages: number
  election?: { id: string; name: string; status: string }
}

type FilterKey = 'all' | 'voted' | 'not-voted' | 'verified' | 'pending' | 'suspended'

const FILTERS: { key: FilterKey; label: string; icon: any }[] = [
  { key: 'all',       label: 'All',         icon: Users },
  { key: 'voted',     label: 'Voted',       icon: CheckCircle2 },
  { key: 'not-voted', label: 'Not Voted',   icon: Clock },
  { key: 'verified',  label: 'Verified',    icon: ShieldCheck },
  { key: 'pending',   label: 'Pending',     icon: AlertCircle },
  { key: 'suspended', label: 'Suspended',   icon: Ban },
]

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------
function initials(name?: string | null): string {
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

function buildParams(opts: { search: string; filter: FilterKey; page: number; pageSize?: number }): string {
  const parts: string[] = []
  if (opts.search.trim()) parts.push(`search=${encodeURIComponent(opts.search.trim())}`)
  if (opts.filter !== 'all') parts.push(`status=${opts.filter}`)
  parts.push(`page=${opts.page}`)
  if (opts.pageSize) parts.push(`pageSize=${opts.pageSize}`)
  return parts.join('&')
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------
export function ElectionVoters({ electionId, subdomain }: { electionId: string; subdomain?: string }) {
  const [data, setData] = useState<VotersData | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filter, setFilter] = useState<FilterKey>('all')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [addOpen, setAddOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [bulkBusy, setBulkBusy] = useState(false)

  // Add-voter form state
  const [form, setForm] = useState({ fullName: '', email: '', matric: '', phone: '' })

  // Debounce the search input.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  // Reset selection when filter/search changes.
  useEffect(() => { setSelected(new Set()) }, [filter, debouncedSearch])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = buildParams({ search: debouncedSearch, filter, page, pageSize: 50 })
      const d = await api.getElectionVoters(electionId, params, subdomain)
      setData(d as VotersData)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load voters')
    } finally {
      setLoading(false)
    }
  }, [electionId, subdomain, debouncedSearch, filter, page])

  useEffect(() => { load() }, [load])

  async function handleAddVoter() {
    if (!form.fullName.trim()) { toast.error('Full name is required'); return }
    if (!form.email.trim() && !form.matric.trim()) { toast.error('Email or matric is required'); return }
    setBusy(true)
    try {
      const res = await api.addElectionVoter(electionId, {
        fullName: form.fullName.trim(),
        email: form.email.trim() || undefined,
        matric: form.matric.trim() || undefined,
        phone: form.phone.trim() || undefined,
      }, subdomain)
      toast.success(res?.message || 'Voter added')
      setAddOpen(false)
      setForm({ fullName: '', email: '', matric: '', phone: '' })
      await load()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to add voter')
    } finally {
      setBusy(false)
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (!data) return
    const visibleIds = data.voters.map((v) => v.id)
    if (selected.size === visibleIds.length && visibleIds.length > 0) {
      setSelected(new Set())
    } else {
      setSelected(new Set(visibleIds))
    }
  }

  async function bulkAction(action: 'verify' | 'suspend' | 'reactivate') {
    if (selected.size === 0) return
    setBulkBusy(true)
    try {
      const res = await api.bulkVoterAction(action, Array.from(selected), subdomain)
      toast.success(`${res.updated} voter${res.updated === 1 ? '' : 's'} ${action === 'verify' ? 'verified' : action === 'suspend' ? 'suspended' : 'reactivated'}`)
      setSelected(new Set())
      await load()
    } catch (e: any) {
      toast.error(e?.message || 'Bulk action failed')
    } finally {
      setBulkBusy(false)
    }
  }

  const stats = data?.stats
  const turnoutPct = stats?.turnoutPct ?? 0
  const totalPages = data?.totalPages ?? 1
  const visibleVoters = data?.voters || []
  const allVisibleSelected = visibleVoters.length > 0 && visibleVoters.every((v) => selected.has(v.id))

  return (
    <div className="space-y-4">
      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={Users}
          label="Total Eligible"
          value={stats?.total ?? 0}
          accent="primary"
          sub={stats ? `${stats.total.toLocaleString()} voters` : '—'}
        />
        <StatCard
          icon={CheckCircle2}
          label="Voted"
          value={stats?.voted ?? 0}
          accent="emerald"
          sub={stats && stats.total > 0 ? `${Math.round((stats.voted / stats.total) * 100)}% of total` : '0%'}
        />
        <StatCard
          icon={Clock}
          label="Pending"
          value={stats?.pending ?? 0}
          accent="amber"
          sub={stats && stats.total > 0 ? `${Math.round((stats.pending / stats.total) * 100)}% of total` : '0%'}
        />
        <StatCard
          icon={AlertCircle}
          label="Suspended"
          value={stats?.suspended ?? 0}
          accent="red"
          sub={stats && stats.total > 0 ? `${Math.round((stats.suspended / stats.total) * 100)}% of total` : '0%'}
        />
      </div>

      {/* Turnout progress */}
      <Card className="votewise-card-glow">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-display text-sm font-semibold">Voter Turnout</div>
              <div className="text-xs text-muted-foreground">
                {stats?.voted.toLocaleString() ?? 0} of {stats?.total.toLocaleString() ?? 0} eligible voters have cast their ballot
              </div>
            </div>
            <div className="font-display text-2xl font-bold text-primary tabular-nums">
              {turnoutPct.toFixed(1)}%
            </div>
          </div>
          <Progress value={turnoutPct} className="mt-3 h-2.5" />
        </CardContent>
      </Card>

      {/* Toolbar */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 font-display text-base">
              <Users className="h-4 w-4 text-primary" /> Eligible Voters
              <Badge variant="outline" className="ml-1 text-[10px]">{stats?.total.toLocaleString() ?? 0} total</Badge>
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button onClick={load} size="sm" variant="outline" className="gap-1.5" disabled={loading}>
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Refresh
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => {
                  const q = subdomain ? `?org=${encodeURIComponent(subdomain)}` : ''
                  window.location.href = `/workspace/voters/import${q}`
                }}
              >
                <Upload className="h-3.5 w-3.5" /> Import Voters
              </Button>
              <Button onClick={() => setAddOpen(true)} size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                <UserPlus className="h-3.5 w-3.5" /> Add Voter
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
              placeholder="Search by name, email, matric, or phone…"
              className="pl-9"
              aria-label="Search voters"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filter chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => { setFilter(f.key); setPage(1) }}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                  filter === f.key
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border/60 bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                )}
              >
                <f.icon className="h-3 w-3" /> {f.label}
              </button>
            ))}
          </div>

          <Separator />

          {/* Bulk actions bar */}
          <AnimatePresence initial={false}>
            {selected.size > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 p-2">
                  <div className="flex items-center gap-2 px-1 text-sm">
                    <span className="font-medium text-primary">{selected.size}</span>
                    <span className="text-muted-foreground">voter{selected.size === 1 ? '' : 's'} selected</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => bulkAction('verify')} disabled={bulkBusy} className="gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Verify
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => bulkAction('suspend')} disabled={bulkBusy} className="gap-1.5 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30">
                      <Ban className="h-3.5 w-3.5" /> Suspend
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => bulkAction('reactivate')} disabled={bulkBusy} className="gap-1.5">
                      <ShieldAlert className="h-3.5 w-3.5" /> Reactivate
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} disabled={bulkBusy} className="gap-1.5">
                      <X className="h-3.5 w-3.5" /> Clear
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Voter list */}
          {loading ? (
            <div className="grid min-h-[30vh] place-items-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : visibleVoters.length === 0 ? (
            <div className="py-10 text-center">
              <Users className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <p className="mt-2 text-sm font-medium text-foreground">No voters yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {search || filter !== 'all'
                  ? 'No voters match your filters.'
                  : 'Add voters individually or import a CSV.'}
              </p>
              {!search && filter === 'all' && (
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  <Button onClick={() => setAddOpen(true)} size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                    <UserPlus className="h-3.5 w-3.5" /> Add Voter
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => {
                      const q = subdomain ? `?org=${encodeURIComponent(subdomain)}` : ''
                      window.location.href = `/workspace/voters/import${q}`
                    }}
                  >
                    <Upload className="h-3.5 w-3.5" /> Import CSV
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Select-all row */}
              <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                <Checkbox checked={allVisibleSelected} onCheckedChange={toggleSelectAll} aria-label="Select all visible voters" />
                <span>
                  {allVisibleSelected ? 'All visible voters selected' : 'Select all visible'}
                  {' · '}Showing {visibleVoters.length} of {stats?.total.toLocaleString() ?? 0}
                </span>
              </div>

              <div className="max-h-[600px] overflow-y-auto pr-1 votewise-scroll">
                <AnimatePresence initial={false}>
                  {visibleVoters.map((v, idx) => (
                    <VoterRow
                      key={v.id}
                      voter={v}
                      selected={selected.has(v.id)}
                      onToggle={() => toggleSelect(v.id)}
                      idx={idx}
                    />
                  ))}
                </AnimatePresence>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-3 text-sm">
                  <div className="text-xs text-muted-foreground">
                    Page {page} of {totalPages}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1 || loading}
                      className="gap-1"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" /> Prev
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages || loading}
                      className="gap-1"
                    >
                      Next <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Add voter dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-primary" /> Add Voter to Election
            </DialogTitle>
            <DialogDescription>
              Add an individual voter to this election&apos;s eligible list. For bulk adds, use the
              CSV import wizard.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="v-fullname">Full Name *</Label>
              <Input
                id="v-fullname"
                value={form.fullName}
                onChange={(e) => setForm((s) => ({ ...s, fullName: e.target.value }))}
                placeholder="Chidinma Okafor"
                autoFocus
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="v-email">Email</Label>
                <Input
                  id="v-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
                  placeholder="chidinma@institution.edu.ng"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="v-matric">Matric / Voter ID</Label>
                <Input
                  id="v-matric"
                  value={form.matric}
                  onChange={(e) => setForm((s) => ({ ...s, matric: e.target.value }))}
                  placeholder="CSC/2022/014"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-phone">Phone (optional)</Label>
              <Input
                id="v-phone"
                value={form.phone}
                onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
                placeholder="+234 800 000 0000"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              If a voter with the same matric already exists in your organization, they will be
              linked to this election instead of being duplicated.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={handleAddVoter} disabled={busy} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Add Voter
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
  icon: Icon, label, value, accent, sub,
}: {
  icon: any; label: string; value: number; accent: 'primary' | 'emerald' | 'amber' | 'red'; sub?: string
}) {
  const accentCls = {
    primary: 'bg-primary/10 text-primary',
    emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
    red: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
  }[accent]
  return (
    <Card>
      <CardContent className="p-4">
        <div className={cn('grid h-9 w-9 place-items-center rounded-lg', accentCls)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="mt-2 font-display text-2xl font-bold tabular-nums">{value.toLocaleString()}</div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  )
}

// -----------------------------------------------------------------------------
// VoterRow
// -----------------------------------------------------------------------------
function VoterRow({
  voter: v, selected, onToggle, idx,
}: {
  voter: Voter; selected: boolean; onToggle: () => void; idx: number
}) {
  const isSuspended = v.status === 'SUSPENDED'
  const isVerified = v.verificationStatus === 'VERIFIED'
  const isPending = v.verificationStatus === 'PENDING'
  const isFlagged = !!v.flagged
  const displayName = v.fullName || [v.firstName, v.lastName].filter(Boolean).join(' ') || v.matric
  const displayEmail = v.email || v.institutionEmail

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, delay: Math.min(idx * 0.012, 0.2) }}
      className={cn(
        'rounded-lg border bg-card p-3 transition-colors',
        selected ? 'border-primary/50 bg-primary/5' : 'border-border/60 hover:bg-accent/5',
        idx > 0 && 'mt-2',
        isFlagged && 'border-red-500/40 bg-red-50/40 dark:bg-red-950/10',
      )}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          checked={selected}
          onCheckedChange={onToggle}
          aria-label={`Select ${displayName}`}
          className="mt-1"
        />
        <Avatar className="h-10 w-10 border border-border/60">
          <AvatarFallback className={cn(
            'text-xs font-semibold',
            v.hasVoted
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
              : isSuspended
              ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
          )}>
            {initials(displayName)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-medium text-foreground truncate">{displayName}</span>
            {v.hasVoted ? (
              <Badge className="bg-emerald-100 text-emerald-700 text-[10px] dark:bg-emerald-950/40 dark:text-emerald-400">
                <CheckCircle2 className="h-3 w-3" /> Voted
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-[10px]">
                <Clock className="h-3 w-3" /> Not Voted
              </Badge>
            )}
            {isVerified && (
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-50 text-emerald-700 text-[10px] dark:bg-emerald-950/20 dark:text-emerald-400">
                <ShieldCheck className="h-3 w-3" /> Verified
              </Badge>
            )}
            {isPending && (
              <Badge variant="outline" className="border-amber-500/30 bg-amber-50 text-amber-700 text-[10px] dark:bg-amber-950/20 dark:text-amber-400">
                <AlertCircle className="h-3 w-3" /> Pending
              </Badge>
            )}
            {isSuspended && (
              <Badge variant="outline" className="border-red-500/30 bg-red-50 text-red-700 text-[10px] dark:bg-red-950/20 dark:text-red-400">
                <Ban className="h-3 w-3" /> Suspended
              </Badge>
            )}
            {isFlagged && (
              <Badge variant="outline" className="border-red-500/40 bg-red-50 text-red-700 text-[10px] dark:bg-red-950/20 dark:text-red-400">
                <ShieldAlert className="h-3 w-3" /> Flagged
              </Badge>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            {displayEmail && (
              <span className="flex items-center gap-1 truncate">
                <Mail className="h-3 w-3" /> <span className="truncate">{displayEmail}</span>
              </span>
            )}
            <span className="flex items-center gap-1 font-mono">
              <Shield className="h-3 w-3" /> {v.matric}
            </span>
            {v.phone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" /> {v.phone}
              </span>
            )}
          </div>
          {v.hasVoted && v.votedAt && (
            <div className="mt-1 text-[11px] text-emerald-700 dark:text-emerald-400">
              <Clock className="mr-1 inline h-3 w-3" />
              Voted at {formatTime(v.votedAt)}
            </div>
          )}
          {isFlagged && v.flaggedReason && (
            <div className="mt-1 text-[11px] text-red-700 dark:text-red-400">
              <ShieldAlert className="mr-1 inline h-3 w-3" />
              Flag reason: {v.flaggedReason}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
