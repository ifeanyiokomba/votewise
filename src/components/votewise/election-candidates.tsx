'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Trophy, User, Plus, Search, Edit, Trash2, CheckCircle2, XCircle, Clock,
  Filter, Eye, Camera, Shield, Loader2, RefreshCw, Users,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------
interface Candidate {
  id: string
  fullName: string
  slug: string
  photoUrl: string | null
  slogan: string | null
  manifesto: string | null
  biography: string | null
  campaignVideoUrl: string | null
  screeningStatus: 'PENDING' | 'APPROVED' | 'DISQUALIFIED' | 'WITHDRAWN' | string
  screeningNotes: string | null
  screenedAt: string | null
  status: string
  displayOrder: number
  createdAt: string
  updatedAt: string
  positionId: string
  positionTitle: string
}

interface PositionGroup {
  id: string
  title: string
  slug: string
  scope: string
  maximumVotes: number
  displayOrder: number
  description: string | null
  _count: { candidates: number }
  candidates: Candidate[]
}

interface CandidatesData {
  electionId: string
  electionName: string
  electionStatus: string
  positions: PositionGroup[]
  stats: {
    total: number
    pending: number
    approved: number
    disqualified: number
    withdrawn: number
  }
}

// Screening-status → badge colour. Emerald/gold/amber palette — no indigo/blue.
const SCREENING_STYLES: Record<string, { cls: string; label: string; icon: typeof Clock }> = {
  PENDING:      { cls: 'bg-amber-100 text-amber-700',                    label: 'Pending',      icon: Clock },
  APPROVED:     { cls: 'bg-emerald-100 text-emerald-700',                label: 'Approved',     icon: CheckCircle2 },
  DISQUALIFIED: { cls: 'bg-red-100 text-red-700',                        label: 'Disqualified', icon: XCircle },
  WITHDRAWN:    { cls: 'bg-muted text-muted-foreground',                 label: 'Withdrawn',    icon: XCircle },
}

const FILTER_CHIPS = [
  { key: 'ALL',          label: 'All',          cls: '' },
  { key: 'PENDING',      label: 'Pending',      cls: 'bg-amber-100 text-amber-700' },
  { key: 'APPROVED',     label: 'Approved',     cls: 'bg-emerald-100 text-emerald-700' },
  { key: 'DISQUALIFIED', label: 'Disqualified', cls: 'bg-red-100 text-red-700' },
  { key: 'WITHDRAWN',    label: 'Withdrawn',    cls: 'bg-muted text-muted-foreground' },
] as const

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function screeningStyle(status: string) {
  return SCREENING_STYLES[status] || SCREENING_STYLES.PENDING
}

function formatTime(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

// ----------------------------------------------------------------------------
// Main component
// ----------------------------------------------------------------------------
export function ElectionCandidates({ electionId, subdomain }: { electionId: string; subdomain?: string }) {
  const [data, setData] = useState<CandidatesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')

  // Dialog state — single source of truth.
  // mode: 'add' | 'edit' | 'screen' | 'delete' | null
  const [dialog, setDialog] = useState<{
    mode: 'add' | 'edit' | 'screen' | 'delete' | null
    candidate?: Candidate
    positionId?: string
    positionTitle?: string
  }>({ mode: null })

  async function load(showSpinner = true) {
    if (showSpinner) setLoading(true)
    else setRefreshing(true)
    try {
      const d = await api.getElectionCandidates(electionId, subdomain)
      setData(d as CandidatesData)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load candidates')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [electionId, subdomain])

  // Filtered view: apply search + status filter, but keep the per-position
  // grouping (positions with zero matches after filtering are hidden).
  const filteredPositions = useMemo(() => {
    if (!data) return []
    const q = search.trim().toLowerCase()
    return data.positions
      .map((p) => {
        const candidates = p.candidates.filter((c) => {
          if (statusFilter !== 'ALL' && c.screeningStatus !== statusFilter) return false
          if (!q) return true
          return (
            c.fullName.toLowerCase().includes(q) ||
            (c.slogan || '').toLowerCase().includes(q) ||
            (c.manifesto || '').toLowerCase().includes(q) ||
            (c.biography || '').toLowerCase().includes(q) ||
            p.title.toLowerCase().includes(q)
          )
        })
        return { ...p, candidates }
      })
      // Hide positions with no matches when the user is actively filtering.
      .filter((p) => {
        if (!q && statusFilter === 'ALL') return true
        return p.candidates.length > 0
      })
  }, [data, search, statusFilter])

  const totalFiltered = filteredPositions.reduce((sum, p) => sum + p.candidates.length, 0)

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
          No candidate data available.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={Users}
          label="Total Candidates"
          value={data.stats.total}
          tint="bg-primary/10 text-primary"
        />
        <StatCard
          icon={CheckCircle2}
          label="Approved"
          value={data.stats.approved}
          tint="bg-emerald-100 text-emerald-700"
        />
        <StatCard
          icon={Clock}
          label="Pending Review"
          value={data.stats.pending}
          tint="bg-amber-100 text-amber-700"
        />
        <StatCard
          icon={XCircle}
          label="Disqualified"
          value={data.stats.disqualified}
          tint="bg-red-100 text-red-700"
        />
      </div>

      {/* Toolbar */}
      <Card className="votewise-card-glow">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 font-display text-base">
              <Trophy className="h-4 w-4 text-primary" /> Candidates
              <Badge variant="outline" className="ml-1 text-[10px]">{data.stats.total} total</Badge>
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => load(false)}
                disabled={refreshing}
                size="sm"
                variant="outline"
                className="gap-1.5"
              >
                {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Search */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, slogan, manifesto, or position…"
                className="pl-9"
                aria-label="Search candidates"
              />
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Filter className="h-3.5 w-3.5" /> Filter:
            </div>
          </div>
          {/* Filter chips */}
          <div className="flex flex-wrap gap-1.5">
            {FILTER_CHIPS.map((chip) => {
              const active = statusFilter === chip.key
              return (
                <button
                  key={chip.key}
                  onClick={() => setStatusFilter(chip.key)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    active
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                  )}
                  aria-pressed={active}
                >
                  {chip.label}
                  {chip.key !== 'ALL' && data.stats[chip.key.toLowerCase() as keyof typeof data.stats] !== undefined && (
                    <span className={cn('rounded-full px-1.5 py-0.5 text-[10px]', active ? 'bg-primary-foreground/20' : chip.cls)}>
                      {data.stats[chip.key.toLowerCase() as keyof typeof data.stats]}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Positions + candidates (scrollable) */}
      {filteredPositions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Trophy className="mx-auto h-12 w-12 text-muted-foreground/40" />
            <p className="mt-3 text-sm font-medium">
              {data.positions.length === 0
                ? 'No positions configured for this election.'
                : 'No candidates match your search.'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {data.positions.length === 0
                ? 'Add positions first, then come back to register candidates.'
                : 'Try a different name or clear the filter chips above.'}
            </p>
            {data.positions.length === 0 && (
              <Button asChild variant="outline" size="sm" className="mt-4 gap-1.5">
                <a href={`/workspace/elections/${electionId}/positions?org=${subdomain || ''}`}>
                  <Trophy className="h-3.5 w-3.5" /> Manage Positions
                </a>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="max-h-[600px] overflow-y-auto pr-1">
          <div className="space-y-4">
            {filteredPositions.map((p) => (
              <Card key={p.id}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 font-display text-base">
                      <Trophy className="h-4 w-4 text-primary" /> {p.title}
                      <Badge variant="outline" className="ml-1 text-[10px]">
                        {p.candidates.length} of {p._count.candidates} candidates
                      </Badge>
                      {p.maximumVotes > 1 && (
                        <Badge variant="secondary" className="text-[10px]">
                          {p.maximumVotes} winners
                        </Badge>
                      )}
                    </CardTitle>
                    <Button
                      onClick={() => setDialog({ mode: 'add', positionId: p.id, positionTitle: p.title })}
                      size="sm"
                      className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Candidate
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {p.candidates.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
                      No candidates in this position yet. Click “Add Candidate” to register one.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <AnimatePresence mode="popLayout">
                        {p.candidates.map((c, idx) => (
                          <motion.div
                            key={c.id}
                            layout
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.18, delay: Math.min(idx * 0.03, 0.2) }}
                          >
                            <CandidateRow
                              candidate={c}
                              onEdit={() => setDialog({ mode: 'edit', candidate: c })}
                              onScreen={() => setDialog({ mode: 'screen', candidate: c })}
                              onDelete={() => setDialog({ mode: 'delete', candidate: c })}
                            />
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Result count footer */}
      {(search || statusFilter !== 'ALL') && (
        <div className="text-center text-xs text-muted-foreground">
          Showing {totalFiltered} candidate{totalFiltered === 1 ? '' : 's'}
          {statusFilter !== 'ALL' && ` · ${statusFilter.toLowerCase()}`}
          {search && ` · matching "${search}"`}
        </div>
      )}

      {/* Dialogs */}
      <AddCandidateDialog
        open={dialog.mode === 'add'}
        onOpenChange={(o) => { if (!o) setDialog({ mode: null }) }}
        positionId={dialog.positionId}
        positionTitle={dialog.positionTitle}
        electionId={electionId}
        subdomain={subdomain}
        onCreated={() => { setDialog({ mode: null }); load(false) }}
      />
      <EditCandidateDialog
        open={dialog.mode === 'edit'}
        onOpenChange={(o) => { if (!o) setDialog({ mode: null }) }}
        candidate={dialog.candidate}
        electionId={electionId}
        subdomain={subdomain}
        onSaved={() => { setDialog({ mode: null }); load(false) }}
      />
      <ScreenCandidateDialog
        open={dialog.mode === 'screen'}
        onOpenChange={(o) => { if (!o) setDialog({ mode: null }) }}
        candidate={dialog.candidate}
        electionId={electionId}
        subdomain={subdomain}
        onScreened={() => { setDialog({ mode: null }); load(false) }}
      />
      <DeleteCandidateDialog
        open={dialog.mode === 'delete'}
        onOpenChange={(o) => { if (!o) setDialog({ mode: null }) }}
        candidate={dialog.candidate}
        electionId={electionId}
        subdomain={subdomain}
        onDeleted={() => { setDialog({ mode: null }); load(false) }}
      />
    </div>
  )
}

// ----------------------------------------------------------------------------
// Stat card
// ----------------------------------------------------------------------------
function StatCard({ icon: Icon, label, value, tint }: {
  icon: typeof User
  label: string
  value: number
  tint: string
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={cn('grid h-9 w-9 place-items-center rounded-lg', tint)}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <div className="font-display text-xl font-bold leading-none">{value.toLocaleString()}</div>
            <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ----------------------------------------------------------------------------
// Candidate row
// ----------------------------------------------------------------------------
function CandidateRow({ candidate, onEdit, onScreen, onDelete }: {
  candidate: Candidate
  onEdit: () => void
  onScreen: () => void
  onDelete: () => void
}) {
  const s = screeningStyle(candidate.screeningStatus)
  const ScreeningIcon = s.icon
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/60 p-3 transition-colors hover:border-primary/40 hover:bg-primary/5 sm:flex-row sm:items-center">
      {/* Avatar + identity */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar className="h-10 w-10 border border-border/60">
          {candidate.photoUrl ? <AvatarImage src={candidate.photoUrl} alt={candidate.fullName} /> : null}
          <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
            {initials(candidate.fullName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium">{candidate.fullName}</span>
            <Badge variant="outline" className="text-[10px]">{candidate.positionTitle}</Badge>
          </div>
          {candidate.slogan && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground italic">“{candidate.slogan}”</p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
            <span>Added {formatTime(candidate.createdAt)}</span>
            {candidate.screenedAt && (
              <>
                <span>·</span>
                <span>Screened {formatTime(candidate.screenedAt)}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Screening badge + actions */}
      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <Badge className={cn('gap-1 text-[10px]', s.cls)}>
          <ScreeningIcon className="h-3 w-3" />
          {s.label}
        </Badge>
        <div className="flex items-center gap-1">
          <Button
            onClick={onEdit}
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5 px-2"
            aria-label={`Edit ${candidate.fullName}`}
            title="Edit candidate"
          >
            <Edit className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Edit</span>
          </Button>
          <Button
            onClick={onScreen}
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5 px-2 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-700"
            aria-label={`Screen ${candidate.fullName}`}
            title="Screen candidate"
          >
            <Shield className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Screen</span>
          </Button>
          <Button
            onClick={onDelete}
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5 px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
            aria-label={`Delete ${candidate.fullName}`}
            title="Delete candidate"
          >
            <Trash2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Delete</span>
          </Button>
        </div>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------------------
// Add candidate dialog
// ----------------------------------------------------------------------------
function AddCandidateDialog({ open, onOpenChange, positionId, positionTitle, electionId, subdomain, onCreated }: {
  open: boolean
  onOpenChange: (o: boolean) => void
  positionId?: string
  positionTitle?: string
  electionId: string
  subdomain?: string
  onCreated: () => void
}) {
  const [fullName, setFullName] = useState('')
  const [slogan, setSlogan] = useState('')
  const [manifesto, setManifesto] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [biography, setBiography] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setFullName(''); setSlogan(''); setManifesto(''); setPhotoUrl(''); setBiography('')
    }
  }, [open])

  async function submit() {
    if (!fullName.trim()) { toast.error('Full name is required'); return }
    if (!positionId) { toast.error('No position selected'); return }
    setBusy(true)
    try {
      await api.addElectionCandidate(electionId, {
        fullName: fullName.trim(),
        positionId,
        slogan: slogan.trim() || undefined,
        manifesto: manifesto.trim() || undefined,
        photoUrl: photoUrl.trim() || undefined,
        biography: biography.trim() || undefined,
      }, subdomain)
      toast.success(`Candidate "${fullName.trim()}" added to ${positionTitle || 'position'}`)
      onCreated()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to add candidate')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Plus className="h-4 w-4 text-primary" /> Add Candidate
          </DialogTitle>
          <DialogDescription>
            Register a new candidate for the position <strong className="text-foreground">{positionTitle || '—'}</strong>.
            The candidate starts in PENDING screening status.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="add-fullName">Full name <span className="text-red-600">*</span></Label>
            <Input id="add-fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Adebayo Johnson" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="add-slogan">Slogan</Label>
            <Input id="add-slogan" value={slogan} onChange={(e) => setSlogan(e.target.value)} placeholder="A short campaign tagline" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="add-photoUrl">Photo URL</Label>
            <div className="relative">
              <Camera className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="add-photoUrl" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="https://…" className="pl-9" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="add-biography">Biography</Label>
            <Textarea id="add-biography" value={biography} onChange={(e) => setBiography(e.target.value)} placeholder="Brief background — faculty, department, prior roles…" rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="add-manifesto">Manifesto</Label>
            <Textarea id="add-manifesto" value={manifesto} onChange={(e) => setManifesto(e.target.value)} placeholder="Campaign promises and priorities…" rows={4} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Add Candidate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ----------------------------------------------------------------------------
// Edit candidate dialog
// ----------------------------------------------------------------------------
function EditCandidateDialog({ open, onOpenChange, candidate, electionId, subdomain, onSaved }: {
  open: boolean
  onOpenChange: (o: boolean) => void
  candidate?: Candidate
  electionId: string
  subdomain?: string
  onSaved: () => void
}) {
  const [fullName, setFullName] = useState('')
  const [slogan, setSlogan] = useState('')
  const [manifesto, setManifesto] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [biography, setBiography] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open && candidate) {
      setFullName(candidate.fullName)
      setSlogan(candidate.slogan || '')
      setManifesto(candidate.manifesto || '')
      setPhotoUrl(candidate.photoUrl || '')
      setBiography(candidate.biography || '')
    }
  }, [open, candidate])

  async function submit() {
    if (!candidate) return
    if (!fullName.trim()) { toast.error('Full name cannot be empty'); return }
    setBusy(true)
    try {
      await api.updateElectionCandidate(electionId, candidate.id, {
        fullName: fullName.trim(),
        slogan: slogan.trim() || '',
        manifesto: manifesto.trim() || '',
        photoUrl: photoUrl.trim() || '',
        biography: biography.trim() || '',
      }, subdomain)
      toast.success(`Candidate "${fullName.trim()}" updated`)
      onSaved()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update candidate')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Edit className="h-4 w-4 text-primary" /> Edit Candidate
          </DialogTitle>
          <DialogDescription>
            Update the profile details for <strong className="text-foreground">{candidate?.fullName || '—'}</strong>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="edit-fullName">Full name <span className="text-red-600">*</span></Label>
            <Input id="edit-fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-slogan">Slogan</Label>
            <Input id="edit-slogan" value={slogan} onChange={(e) => setSlogan(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-photoUrl">Photo URL</Label>
            <div className="relative">
              <Camera className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="edit-photoUrl" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="https://…" className="pl-9" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-biography">Biography</Label>
            <Textarea id="edit-biography" value={biography} onChange={(e) => setBiography(e.target.value)} rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-manifesto">Manifesto</Label>
            <Textarea id="edit-manifesto" value={manifesto} onChange={(e) => setManifesto(e.target.value)} rows={4} />
          </div>
          {candidate && (
            <>
              <Separator />
              <div className="text-[10px] text-muted-foreground">
                Last updated {formatTime(candidate.updatedAt)}
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy} className="gap-1.5">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ----------------------------------------------------------------------------
// Screen candidate dialog
// ----------------------------------------------------------------------------
function ScreenCandidateDialog({ open, onOpenChange, candidate, electionId, subdomain, onScreened }: {
  open: boolean
  onOpenChange: (o: boolean) => void
  candidate?: Candidate
  electionId: string
  subdomain?: string
  onScreened: () => void
}) {
  const [status, setStatus] = useState<string>('APPROVED')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open && candidate) {
      // Default to APPROVED unless already screened to a non-pending status.
      setStatus(candidate.screeningStatus === 'PENDING' ? 'APPROVED' : candidate.screeningStatus)
      setNotes(candidate.screeningNotes || '')
    }
  }, [open, candidate])

  async function submit() {
    if (!candidate) return
    setBusy(true)
    try {
      await api.screenElectionCandidate(electionId, candidate.id, {
        screeningStatus: status,
        screeningNotes: notes.trim() || undefined,
      }, subdomain)
      toast.success(`${candidate.fullName} marked as ${status}`)
      onScreened()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to screen candidate')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Shield className="h-4 w-4 text-emerald-600" /> Screen Candidate
          </DialogTitle>
          <DialogDescription>
            Review and set the screening status for <strong className="text-foreground">{candidate?.fullName || '—'}</strong>
            {candidate?.positionTitle && <> · <span className="text-muted-foreground">{candidate.positionTitle}</span></>}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="screen-status">Screening decision</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="screen-status" className="w-full">
                <SelectValue placeholder="Select a status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="APPROVED">
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Approved
                  </span>
                </SelectItem>
                <SelectItem value="DISQUALIFIED">
                  <span className="flex items-center gap-2">
                    <XCircle className="h-3.5 w-3.5 text-red-600" /> Disqualified
                  </span>
                </SelectItem>
                <SelectItem value="WITHDRAWN">
                  <span className="flex items-center gap-2">
                    <XCircle className="h-3.5 w-3.5 text-muted-foreground" /> Withdrawn
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="screen-notes">Screening notes</Label>
            <Textarea
              id="screen-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Document the rationale for this decision (visible to other officials)."
              rows={4}
            />
          </div>
          {status === 'DISQUALIFIED' && (
            <Alert className="border-red-500/40 bg-red-50 dark:bg-red-950/30">
              <XCircle className="h-4 w-4 text-red-600" />
              <AlertTitle className="text-red-700 dark:text-red-400">Disqualification</AlertTitle>
              <AlertDescription className="text-red-700 dark:text-red-300">
                This candidate will be removed from the ballot. Please document the reason clearly —
                it will be auditable in the election timeline.
              </AlertDescription>
            </Alert>
          )}
          {status === 'APPROVED' && (
            <Alert className="border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/30">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <AlertTitle className="text-emerald-700 dark:text-emerald-400">Approval</AlertTitle>
              <AlertDescription className="text-emerald-700 dark:text-emerald-300">
                This candidate will appear on the ballot for their position.
              </AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Shield className="h-3.5 w-3.5" />}
            Apply Decision
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ----------------------------------------------------------------------------
// Delete candidate dialog
// ----------------------------------------------------------------------------
function DeleteCandidateDialog({ open, onOpenChange, candidate, electionId, subdomain, onDeleted }: {
  open: boolean
  onOpenChange: (o: boolean) => void
  candidate?: Candidate
  electionId: string
  subdomain?: string
  onDeleted: () => void
}) {
  const [busy, setBusy] = useState(false)

  async function confirmDelete() {
    if (!candidate) return
    setBusy(true)
    try {
      await api.deleteElectionCandidate(electionId, candidate.id, subdomain)
      toast.success(`Candidate "${candidate.fullName}" removed`)
      onDeleted()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete candidate')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 font-display">
            <Trash2 className="h-4 w-4 text-red-600" /> Delete Candidate
          </AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to permanently delete <strong className="text-foreground">{candidate?.fullName || '—'}</strong>?
            This action cannot be undone. Any votes already cast for this candidate will remain in the audit log
            but the candidate profile will be removed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); confirmDelete() }}
            disabled={busy}
            className="gap-1.5 bg-red-600 hover:bg-red-700"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Delete Permanently
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
