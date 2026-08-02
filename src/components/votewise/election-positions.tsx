'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Vote, Plus, Edit, Trash2, ArrowUp, ArrowDown, GripVertical, Users,
  CheckCircle2, Settings2, Info, Layers, Loader2, RefreshCw, AlertTriangle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
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
type Scope = 'ORGANIZATION' | 'WORKSPACE' | 'VOTER_GROUP' | 'UNIVERSITY' | 'FACULTY' | 'DEPARTMENT'

interface Position {
  id: string
  title: string
  slug: string
  description: string | null
  scope: Scope | string
  maximumVotes: number
  displayOrder: number
  order: number
  facultyId?: string | null
  departmentId?: string | null
  _count: { candidates: number }
  createdAt: string
}

interface PositionsData {
  electionId: string
  electionName: string
  electionStatus: string
  positions: Position[]
  stats: {
    total: number
    candidates: number
    singleChoice: number
    multipleChoice: number
  }
}

// ----------------------------------------------------------------------------
// Scope styling — emerald/gold/amber palette, NO indigo/blue.
// ORGANIZATION → primary (emerald), WORKSPACE → amber, VOTER_GROUP → emerald
// variant, the legacy UNIVERSITY/FACULTY/DEPARTMENT fall back to muted gold.
// ----------------------------------------------------------------------------
const SCOPE_STYLES: Record<string, { cls: string; label: string }> = {
  ORGANIZATION: { cls: 'bg-primary/15 text-primary', label: 'Organization-wide' },
  WORKSPACE:    { cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300', label: 'Specific Unit' },
  VOTER_GROUP:  { cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300', label: 'Voter Group' },
  UNIVERSITY:   { cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300', label: 'University-wide' },
  FACULTY:      { cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300', label: 'Faculty' },
  DEPARTMENT:   { cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300', label: 'Department' },
}

function scopeStyle(scope: string) {
  return SCOPE_STYLES[scope] || { cls: 'bg-muted text-muted-foreground', label: scope }
}

// The three primary scope presets exposed in the Add/Edit dialog.
// (Under the hood we still accept the legacy scopes via the API.)
const SCOPE_PRESETS: { value: Scope; label: string; hint: string }[] = [
  { value: 'ORGANIZATION', label: 'Organization-wide', hint: 'Every voter in the organization can vote on this position.' },
  { value: 'WORKSPACE',    label: 'Specific Unit',     hint: 'Only voters assigned to a specific workspace / unit vote.' },
  { value: 'VOTER_GROUP',  label: 'Voter Group',       hint: 'Restricted to a defined voter group (e.g. a faculty or class).' },
]

// ----------------------------------------------------------------------------
// Main component
// ----------------------------------------------------------------------------
export function ElectionPositions({ electionId, subdomain }: { electionId: string; subdomain?: string }) {
  const [data, setData] = useState<PositionsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [reordering, setReordering] = useState(false)

  // Dialog state — single source of truth.
  // mode: 'add' | 'edit' | 'delete' | null
  const [dialog, setDialog] = useState<{
    mode: 'add' | 'edit' | 'delete' | null
    position?: Position
  }>({ mode: null })

  async function load(showSpinner = true) {
    if (showSpinner) setLoading(true)
    else setRefreshing(true)
    try {
      const d = await api.getElectionPositions(electionId, subdomain)
      setData(d as PositionsData)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load positions')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [electionId, subdomain])

  // Reorder: optimistically reorder the local list, then persist.
  // Falls back to the server's order if the request fails.
  async function move(positionId: string, direction: 'up' | 'down') {
    if (!data || reordering) return
    const positions = [...data.positions]
    const idx = positions.findIndex((p) => p.id === positionId)
    if (idx < 0) return
    const target = direction === 'up' ? idx - 1 : idx + 1
    if (target < 0 || target >= positions.length) return

    // Swap locally.
    const reordered = positions.slice()
    ;[reordered[idx], reordered[target]] = [reordered[target], reordered[idx]]
    // Re-number displayOrder in the new local order.
    const renumbered = reordered.map((p, i) => ({ ...p, displayOrder: i, order: i }))

    // Optimistic update.
    setData({ ...data, positions: renumbered })
    setReordering(true)
    try {
      await api.reorderElectionPositions(
        electionId,
        renumbered.map((p) => p.id),
        subdomain,
      )
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save new order')
      // Roll back to whatever the server has.
      await load(false)
    } finally {
      setReordering(false)
    }
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
          No position data available.
        </CardContent>
      </Card>
    )
  }

  const positions = data.positions

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={Layers}
          label="Total Positions"
          value={data.stats.total}
          tint="bg-primary/10 text-primary"
        />
        <StatCard
          icon={Users}
          label="Total Candidates"
          value={data.stats.candidates}
          tint="bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
        />
        <StatCard
          icon={CheckCircle2}
          label="Single Choice"
          value={data.stats.singleChoice}
          tint="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
        />
        <StatCard
          icon={Settings2}
          label="Multiple Choice"
          value={data.stats.multipleChoice}
          tint="bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
        />
      </div>

      {/* Header card */}
      <Card className="votewise-card-glow">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <CardTitle className="flex items-center gap-2 font-display text-base">
                <Vote className="h-4 w-4 text-primary" /> Positions
                <Badge variant="outline" className="ml-1 text-[10px]">{positions.length} configured</Badge>
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Define what voters are electing. Each position can have multiple candidates and supports
                single or multiple choice voting.
              </p>
            </div>
            <Button
              onClick={() => setDialog({ mode: 'add' })}
              size="sm"
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="h-3.5 w-3.5" /> Add Position
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Info alert */}
          <Alert className="border-primary/30 bg-primary/5">
            <Info className="h-4 w-4 text-primary" />
            <AlertTitle className="text-primary">How positions work</AlertTitle>
            <AlertDescription>
              Positions define the structure of your ballot. Voters will see these positions in the order
              you specify. Each position can have multiple candidates, and you control whether voters
              select one or many.
            </AlertDescription>
          </Alert>
          <div className="mt-3 flex items-center justify-end">
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
        </CardContent>
      </Card>

      {/* Positions list (scrollable when long) */}
      {positions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/10">
              <Vote className="h-7 w-7 text-primary" />
            </div>
            <p className="mt-3 text-sm font-medium">No positions yet.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Add your first position to define what voters are electing.
            </p>
            <Button
              onClick={() => setDialog({ mode: 'add' })}
              size="sm"
              className="mt-4 gap-1.5 bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="h-3.5 w-3.5" /> Add Position
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="max-h-[600px] overflow-y-auto pr-1">
          <div className="space-y-3">
            <AnimatePresence mode="popLayout" initial={false}>
              {positions.map((p, idx) => (
                <motion.div
                  key={p.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18, delay: Math.min(idx * 0.03, 0.18) }}
                >
                  <PositionRow
                    position={p}
                    index={idx}
                    total={positions.length}
                    reordering={reordering}
                    onMoveUp={() => move(p.id, 'up')}
                    onMoveDown={() => move(p.id, 'down')}
                    onEdit={() => setDialog({ mode: 'edit', position: p })}
                    onDelete={() => setDialog({ mode: 'delete', position: p })}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <AddPositionDialog
        open={dialog.mode === 'add'}
        onOpenChange={(o) => { if (!o) setDialog({ mode: null }) }}
        electionId={electionId}
        subdomain={subdomain}
        onCreated={() => { setDialog({ mode: null }); load(false) }}
      />
      <EditPositionDialog
        open={dialog.mode === 'edit'}
        onOpenChange={(o) => { if (!o) setDialog({ mode: null }) }}
        position={dialog.position}
        electionId={electionId}
        subdomain={subdomain}
        onSaved={() => { setDialog({ mode: null }); load(false) }}
      />
      <DeletePositionDialog
        open={dialog.mode === 'delete'}
        onOpenChange={(o) => { if (!o) setDialog({ mode: null }) }}
        position={dialog.position}
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
  icon: typeof Vote
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
// Position row
// ----------------------------------------------------------------------------
function PositionRow({ position, index, total, reordering, onMoveUp, onMoveDown, onEdit, onDelete }: {
  position: Position
  index: number
  total: number
  reordering: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const s = scopeStyle(position.scope)
  const candidateCount = position._count.candidates
  const multiple = position.maximumVotes > 1
  const first = index === 0
  const last = index === total - 1

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          {/* Drag handle + position number */}
          <div className="flex items-center gap-2 sm:flex-col sm:items-center sm:gap-1">
            <GripVertical className="h-4 w-4 text-muted-foreground/50" aria-hidden />
            <div
              className="grid h-7 w-7 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary"
              title={`Position #${index + 1}`}
              aria-label={`Position ${index + 1} of ${total}`}
            >
              {index + 1}
            </div>
          </div>

          {/* Main info */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-base font-semibold leading-tight">{position.title}</h3>
              <Badge className={cn('text-[10px] gap-1', s.cls)} title={`Scope: ${position.scope}`}>
                <Layers className="h-3 w-3" />
                {s.label}
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  'text-[10px] gap-1',
                  multiple
                    ? 'border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-300'
                    : 'border-primary/30 text-primary',
                )}
                title={multiple ? 'Multiple choice' : 'Single choice'}
              >
                <Settings2 className="h-3 w-3" />
                {multiple ? `Choose ${position.maximumVotes}` : 'Choose 1'}
              </Badge>
              <Badge variant="outline" className="text-[10px] gap-1" title="Candidate count">
                <Users className="h-3 w-3" />
                {candidateCount} candidate{candidateCount === 1 ? '' : 's'}
              </Badge>
            </div>
            {position.description ? (
              <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
                {position.description}
              </p>
            ) : (
              <p className="mt-1.5 text-xs italic text-muted-foreground/60">No description provided.</p>
            )}
            <div className="mt-1.5 text-[10px] text-muted-foreground">
              Added {new Date(position.createdAt).toLocaleDateString()}
              {multiple && (
                <span className="ml-2 text-amber-700 dark:text-amber-300">
                  · Voters may select up to {position.maximumVotes} candidates.
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex shrink-0 flex-wrap items-center gap-1 sm:flex-nowrap">
            <Button
              onClick={onMoveUp}
              disabled={first || reordering}
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              aria-label="Move position up"
              title="Move up"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              onClick={onMoveDown}
              disabled={last || reordering}
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              aria-label="Move position down"
              title="Move down"
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </Button>
            <Separator orientation="vertical" className="mx-1 hidden h-6 sm:block" />
            <Button
              onClick={onEdit}
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 px-2"
              aria-label={`Edit ${position.title}`}
              title="Edit position"
            >
              <Edit className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Edit</span>
            </Button>
            <Button
              onClick={onDelete}
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 px-2 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40"
              aria-label={`Delete ${position.title}`}
              title="Delete position"
            >
              <Trash2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Delete</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ----------------------------------------------------------------------------
// Add position dialog
// ----------------------------------------------------------------------------
function AddPositionDialog({ open, onOpenChange, electionId, subdomain, onCreated }: {
  open: boolean
  onOpenChange: (o: boolean) => void
  electionId: string
  subdomain?: string
  onCreated: () => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [scope, setScope] = useState<Scope>('ORGANIZATION')
  const [maximumVotes, setMaximumVotes] = useState(1)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setTitle('')
      setDescription('')
      setScope('ORGANIZATION')
      setMaximumVotes(1)
    }
  }, [open])

  const selectedPreset = SCOPE_PRESETS.find((p) => p.value === scope)

  async function submit() {
    if (!title.trim()) { toast.error('Title is required'); return }
    if (!scope) { toast.error('Please choose a scope'); return }
    if (!Number.isInteger(maximumVotes) || maximumVotes < 1) {
      toast.error('Maximum votes must be a positive whole number (≥ 1)')
      return
    }
    setBusy(true)
    try {
      await api.addElectionPosition(
        electionId,
        {
          title: title.trim(),
          description: description.trim() || undefined,
          scope,
          maximumVotes,
        },
        subdomain,
      )
      toast.success(`Position "${title.trim()}" created`)
      onCreated()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to create position')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Plus className="h-4 w-4 text-primary" /> Add Position
          </DialogTitle>
          <DialogDescription>
            Define a new elected position on this ballot. You can edit these details later.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="add-title">Title <span className="text-red-600">*</span></Label>
            <Input
              id="add-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. President, Secretary General, Faculty Rep"
              autoFocus
            />
            <p className="text-[10px] text-muted-foreground">
              The position title shown on the ballot to voters.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="add-description">Description</Label>
            <Textarea
              id="add-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the role, responsibilities, and eligibility…"
              rows={3}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="add-scope">Scope <span className="text-red-600">*</span></Label>
            <Select value={scope} onValueChange={(v) => setScope(v as Scope)}>
              <SelectTrigger id="add-scope" className="w-full">
                <SelectValue placeholder="Choose a scope" />
              </SelectTrigger>
              <SelectContent>
                {SCOPE_PRESETS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedPreset && (
              <p className="text-[10px] text-muted-foreground">{selectedPreset.hint}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="add-maxVotes">Maximum votes per voter</Label>
            <Input
              id="add-maxVotes"
              type="number"
              min={1}
              step={1}
              value={maximumVotes}
              onChange={(e) => setMaximumVotes(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
            />
            <p className="text-[10px] text-muted-foreground">
              <span className="font-medium">1 = single choice</span> (voter picks one candidate).
              <span className="ml-1 font-medium">2+ = multiple choice</span> (voter may select up to this many).
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Add Position
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ----------------------------------------------------------------------------
// Edit position dialog
// ----------------------------------------------------------------------------
function EditPositionDialog({ open, onOpenChange, position, electionId, subdomain, onSaved }: {
  open: boolean
  onOpenChange: (o: boolean) => void
  position?: Position
  electionId: string
  subdomain?: string
  onSaved: () => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [scope, setScope] = useState<Scope>('ORGANIZATION')
  const [maximumVotes, setMaximumVotes] = useState(1)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open && position) {
      setTitle(position.title)
      setDescription(position.description || '')
      setScope((SCOPE_PRESETS.some((p) => p.value === position.scope) ? position.scope : 'ORGANIZATION') as Scope)
      setMaximumVotes(position.maximumVotes || 1)
    }
  }, [open, position])

  const selectedPreset = SCOPE_PRESETS.find((p) => p.value === scope)

  async function submit() {
    if (!position) return
    if (!title.trim()) { toast.error('Title is required'); return }
    if (!Number.isInteger(maximumVotes) || maximumVotes < 1) {
      toast.error('Maximum votes must be a positive whole number (≥ 1)')
      return
    }
    setBusy(true)
    try {
      await api.updateElectionPosition(
        electionId,
        position.id,
        {
          title: title.trim(),
          description: description.trim() || null,
          scope,
          maximumVotes,
        },
        subdomain,
      )
      toast.success(`Position "${title.trim()}" updated`)
      onSaved()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update position')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Edit className="h-4 w-4 text-primary" /> Edit Position
          </DialogTitle>
          <DialogDescription>
            Update the details of this position. Changes are reflected on the ballot immediately.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="edit-title">Title <span className="text-red-600">*</span></Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-scope">Scope</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as Scope)}>
              <SelectTrigger id="edit-scope" className="w-full">
                <SelectValue placeholder="Choose a scope" />
              </SelectTrigger>
              <SelectContent>
                {SCOPE_PRESETS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedPreset && (
              <p className="text-[10px] text-muted-foreground">{selectedPreset.hint}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-maxVotes">Maximum votes per voter</Label>
            <Input
              id="edit-maxVotes"
              type="number"
              min={1}
              step={1}
              value={maximumVotes}
              onChange={(e) => setMaximumVotes(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
            />
            <p className="text-[10px] text-muted-foreground">
              <span className="font-medium">1 = single choice</span>. <span className="ml-1 font-medium">2+ = multiple choice</span>.
            </p>
          </div>
          {position && position._count.candidates > 0 && (
            <Alert className="border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-700 dark:text-amber-300">This position has candidates</AlertTitle>
              <AlertDescription className="text-amber-700/90 dark:text-amber-300/90">
                Changing the scope or maximum votes will affect {position._count.candidates} existing
                candidate{position._count.candidates === 1 ? '' : 's'} already registered for this position.
              </AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ----------------------------------------------------------------------------
// Delete position dialog
// ----------------------------------------------------------------------------
function DeletePositionDialog({ open, onOpenChange, position, electionId, subdomain, onDeleted }: {
  open: boolean
  onOpenChange: (o: boolean) => void
  position?: Position
  electionId: string
  subdomain?: string
  onDeleted: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setErrorMsg(null)
      setBusy(false)
    }
  }, [open])

  const hasCandidates = (position?._count.candidates ?? 0) > 0

  async function confirm() {
    if (!position) return
    setBusy(true)
    setErrorMsg(null)
    try {
      await api.deleteElectionPosition(electionId, position.id, subdomain)
      toast.success(`Position "${position.title}" removed`)
      onDeleted()
    } catch (e: any) {
      const status = e?.status || 0
      const msg = e?.message || 'Failed to delete position'
      if (status === 409) {
        // The API already returns a helpful message — surface it.
        setErrorMsg(msg)
      } else {
        toast.error(msg)
      }
    } finally {
      setBusy(false)
    }
  }

  if (!position) return null

  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o && !busy) onOpenChange(false) }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 font-display">
            <Trash2 className="h-4 w-4 text-red-600" /> Delete “{position.title}”?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove the position from the ballot. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {hasCandidates && !errorMsg && (
          <Alert className="border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-700 dark:text-amber-300">Cannot delete safely</AlertTitle>
            <AlertDescription className="text-amber-700/90 dark:text-amber-300/90">
              This position currently has <strong>{position._count.candidates}</strong> candidate
              {position._count.candidates === 1 ? '' : 's'}. You must remove or reassign them before
              this position can be deleted. The server will refuse the deletion otherwise.
            </AlertDescription>
          </Alert>
        )}

        {errorMsg && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Deletion blocked</AlertTitle>
            <AlertDescription>{errorMsg}</AlertDescription>
          </Alert>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); confirm() }}
            disabled={busy}
            className="gap-1.5 bg-red-600 text-white hover:bg-red-700"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Delete Position
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
