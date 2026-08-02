'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight, Calendar, CalendarClock, Copy, Loader2, Info,
} from 'lucide-react'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type DateMode = 'custom' | 'shift' | 'default'

const DAY_MS = 24 * 60 * 60 * 1000

const MODE_LABELS: Record<DateMode, string> = {
  custom: 'Custom Dates',
  shift: 'Shift by Days',
  default: '1 Week from Now',
}

const MODE_DESCRIPTIONS: Record<DateMode, string> = {
  custom: 'Pick the exact start and end times. Other lifecycle timestamps are shifted by the same delta, preserving their offset to voting-open.',
  shift: 'Move every original timestamp forward by N days. Ideal for cloning an election for next year (365) or next month (30).',
  default: 'Quick clone: voting opens 1 week from now and stays open for 6 hours. Other lifecycle timestamps are cleared.',
}

// Convert a Date to the value expected by <input type="datetime-local">:
// YYYY-MM-DDTHH:mm (in the user's local timezone).
function toLocalInput(d: Date | null | undefined): string {
  if (!d) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Convert a datetime-local input value (local) to an ISO string.
function fromLocalInput(value: string): string | null {
  if (!value) return null
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

function fmt(d: Date | string | null | undefined): string {
  if (!d) return '—'
  const date = typeof d === 'string' ? new Date(d) : d
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export interface DuplicateElectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  election: {
    id: string
    name: string
    startTime: string
    endTime: string
    accreditationStart?: string | null
    accreditationEnd?: string | null
    candidateRegStart?: string | null
    candidateRegEnd?: string | null
    resultsReleaseAt?: string | null
  } | null
  subdomain?: string
  // Called after a successful duplicate. The parent navigates to the new
  // election workspace using the returned id.
  onDuplicated?: (newElectionId: string) => void
}

export function DuplicateElectionDialog({
  open, onOpenChange, election, subdomain, onDuplicated,
}: DuplicateElectionDialogProps) {
  const [name, setName] = useState('')
  const [mode, setMode] = useState<DateMode>('default')
  const [shiftDays, setShiftDays] = useState<number>(365)
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Reset the form whenever the dialog opens for a new election.
  useEffect(() => {
    if (open && election) {
      setName(`${election.name} (Copy)`)
      setMode('default')
      setShiftDays(365)
      setCustomStart(toLocalInput(new Date(election.startTime)))
      setCustomEnd(toLocalInput(new Date(election.endTime)))
    }
  }, [open, election])

  // Compute a preview of the resulting dates based on the current selections.
  // This mirrors the server-side logic so the user sees exactly what will happen.
  const preview = useMemo(() => {
    if (!election) return null
    const origStart = new Date(election.startTime).getTime()
    const origEnd = new Date(election.endTime).getTime()
    if (mode === 'custom') {
      const ns = fromLocalInput(customStart)
      const ne = fromLocalInput(customEnd)
      if (!ns || !ne) return { start: null as Date | null, end: null as Date | null, accStart: null, accEnd: null, candStart: null, candEnd: null, results: null, invalid: !ns || !ne }
      const nsT = new Date(ns).getTime()
      const neT = new Date(ne).getTime()
      if (neT <= nsT) return { start: new Date(ns), end: new Date(ne), accStart: null, accEnd: null, candStart: null, candEnd: null, results: null, invalid: true }
      const delta = nsT - origStart
      return {
        start: new Date(ns),
        end: new Date(ne),
        accStart: election.accreditationStart ? new Date(new Date(election.accreditationStart).getTime() + delta) : null,
        accEnd: election.accreditationEnd ? new Date(new Date(election.accreditationEnd).getTime() + delta) : null,
        candStart: election.candidateRegStart ? new Date(new Date(election.candidateRegStart).getTime() + delta) : null,
        candEnd: election.candidateRegEnd ? new Date(new Date(election.candidateRegEnd).getTime() + delta) : null,
        results: election.resultsReleaseAt ? new Date(new Date(election.resultsReleaseAt).getTime() + delta) : null,
        invalid: false,
      }
    }
    if (mode === 'shift') {
      const delta = shiftDays * DAY_MS
      return {
        start: new Date(origStart + delta),
        end: new Date(origEnd + delta),
        accStart: election.accreditationStart ? new Date(new Date(election.accreditationStart).getTime() + delta) : null,
        accEnd: election.accreditationEnd ? new Date(new Date(election.accreditationEnd).getTime() + delta) : null,
        candStart: election.candidateRegStart ? new Date(new Date(election.candidateRegStart).getTime() + delta) : null,
        candEnd: election.candidateRegEnd ? new Date(new Date(election.candidateRegEnd).getTime() + delta) : null,
        results: election.resultsReleaseAt ? new Date(new Date(election.resultsReleaseAt).getTime() + delta) : null,
        invalid: !Number.isFinite(shiftDays) || shiftDays === 0,
      }
    }
    // default
    return {
      start: new Date(Date.now() + 7 * DAY_MS),
      end: new Date(Date.now() + 7 * DAY_MS + 6 * 60 * 60 * 1000),
      accStart: null, accEnd: null, candStart: null, candEnd: null, results: null,
      invalid: false,
    }
  }, [election, mode, shiftDays, customStart, customEnd])

  const canSubmit = !!election && !submitting && !!preview && !preview.invalid && name.trim().length > 0

  async function submit() {
    if (!election || !preview || preview.invalid) return
    if (!name.trim()) { toast.error('Election name is required'); return }
    setSubmitting(true)
    try {
      const options: { name?: string; startTime?: string; endTime?: string; shiftDays?: number } = {
        name: name.trim(),
      }
      if (mode === 'custom') {
        const s = fromLocalInput(customStart)
        const e = fromLocalInput(customEnd)
        if (!s || !e) { toast.error('Please pick both start and end times'); setSubmitting(false); return }
        options.startTime = s
        options.endTime = e
      } else if (mode === 'shift') {
        if (!Number.isFinite(shiftDays) || shiftDays === 0) {
          toast.error('Shift days must be a non-zero number')
          setSubmitting(false)
          return
        }
        options.shiftDays = shiftDays
      }
      const res = await api.duplicateElection(election.id, options, subdomain)
      const newId = res?.election?.id
      toast.success(`Duplicated as "${res?.election?.name || name.trim()}"`)
      onOpenChange(false)
      if (onDuplicated && newId) onDuplicated(newId)
      else if (newId) window.location.href = `/workspace/elections/${newId}?org=${subdomain || ''}`
    } catch (e: any) {
      toast.error(e?.message || 'Could not duplicate election')
    } finally {
      setSubmitting(false)
    }
  }

  if (!election) return null

  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto votewise-scroll sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Copy className="h-5 w-5 text-primary" /> Duplicate Election
          </DialogTitle>
          <DialogDescription>
            Clone <span className="font-medium text-foreground">{election.name}</span> into a new DRAFT
            election. Positions and candidates are copied; votes, results, and audit logs are not.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* New name */}
          <div className="space-y-1.5">
            <Label htmlFor="dup-name">New Election Name</Label>
            <Input
              id="dup-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. SUG General Elections 2025/2026"
            />
          </div>

          {/* Date mode selector */}
          <div className="space-y-2">
            <Label>When should the new election run?</Label>
            <RadioGroup
              value={mode}
              onValueChange={(v) => setMode(v as DateMode)}
              className="gap-2"
            >
              {(['default', 'shift', 'custom'] as DateMode[]).map((m) => (
                <label
                  key={m}
                  htmlFor={`dup-mode-${m}`}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                    mode === m
                      ? 'border-emerald-300 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/30'
                      : 'border-border hover:bg-muted/40',
                  )}
                >
                  <RadioGroupItem value={m} id={`dup-mode-${m}`} className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {m === 'default' && <Calendar className="h-4 w-4 text-amber-600" />}
                      {m === 'shift' && <CalendarClock className="h-4 w-4 text-emerald-600" />}
                      {m === 'custom' && <Calendar className="h-4 w-4 text-primary" />}
                      {MODE_LABELS[m]}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{MODE_DESCRIPTIONS[m]}</p>
                  </div>
                </label>
              ))}
            </RadioGroup>
          </div>

          {/* Mode-specific inputs */}
          {mode === 'shift' && (
            <div className="space-y-1.5">
              <Label htmlFor="dup-shift-days">Shift by N days</Label>
              <Input
                id="dup-shift-days"
                type="number"
                min={1}
                step={1}
                value={shiftDays}
                onChange={(e) => setShiftDays(parseInt(e.target.value || '0', 10))}
              />
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">365</span> = next year ·{' '}
                <span className="font-medium text-foreground">30</span> = next month ·{' '}
                <span className="font-medium text-foreground">7</span> = next week.
              </p>
            </div>
          )}

          {mode === 'custom' && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="dup-start">Voting Opens</Label>
                <Input
                  id="dup-start"
                  type="datetime-local"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dup-end">Voting Closes</Label>
                <Input
                  id="dup-end"
                  type="datetime-local"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                />
              </div>
              {preview && preview.invalid && (
                <p className="sm:col-span-2 text-xs text-amber-700 dark:text-amber-400">
                  End time must be after start time.
                </p>
              )}
            </div>
          )}

          {/* Preview of computed dates */}
          {preview && !preview.invalid && (
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <CalendarClock className="h-3.5 w-3.5" /> Computed Dates
              </div>
              <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-2">
                <PreviewRow label="Voting Opens" value={fmt(preview.start)} emphasize />
                <PreviewRow label="Voting Closes" value={fmt(preview.end)} emphasize />
                <PreviewRow label="Accreditation Opens" value={fmt(preview.accStart)} />
                <PreviewRow label="Accreditation Closes" value={fmt(preview.accEnd)} />
                <PreviewRow label="Candidate Reg Opens" value={fmt(preview.candStart)} />
                <PreviewRow label="Candidate Reg Closes" value={fmt(preview.candEnd)} />
                <PreviewRow label="Results Release" value={fmt(preview.results)} />
              </dl>
              <div className="mt-2 flex items-center gap-1.5">
                <Badge variant="outline" className="text-[10px]">{MODE_LABELS[mode]}</Badge>
                {mode === 'default' && (
                  <span className="text-[10px] text-muted-foreground">
                    Other timestamps cleared — set them in the duplicate&apos;s Settings tab.
                  </span>
                )}
                {mode !== 'default' && (
                  <span className="text-[10px] text-muted-foreground">
                    Other timestamps shifted proportionally to preserve their original offsets.
                  </span>
                )}
              </div>
            </div>
          )}

          <Alert className="border-amber-200 bg-amber-50/60 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
            <Info className="h-4 w-4" />
            <AlertTitle>What gets copied?</AlertTitle>
            <AlertDescription className="text-xs">
              Positions, candidates, settings, visibility, voting method, and category.
              The new election starts in <span className="font-medium">DRAFT</span> — votes, results,
              accreditations, and audit logs are never copied.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={!canSubmit}
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
            Duplicate Election
            {!submitting && <ArrowRight className="h-3.5 w-3.5" />}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PreviewRow({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn('text-right font-medium tabular-nums', emphasize ? 'text-foreground' : 'text-muted-foreground')}>
        {value}
      </dd>
    </div>
  )
}
