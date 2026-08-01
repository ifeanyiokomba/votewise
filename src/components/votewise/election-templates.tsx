'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutTemplate, Plus, Search, Trash2, Copy, Calendar, Users, Vote,
  FileText, Sparkles, Filter, Loader2, Building2, Clock,
} from 'lucide-react'
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface ElectionTemplateSummary {
  id: string
  name: string
  description: string | null
  category: string | null
  electionType: string | null
  votingMethod: string | null
  visibility: string
  isBuiltIn: boolean
  createdBy: string | null
  positionCount: number
  candidateCount: number
  createdAt: string
  updatedAt: string
}

interface ElectionLite {
  id: string
  name: string
  status: string
  category?: string | null
}

type FilterTab = 'all' | 'builtin' | 'mine'

// Category badge colour mapping (NO indigo, NO blue — emerald/amber/zinc only).
function categoryStyle(category: string | null | undefined): string {
  const c = (category || '').toLowerCase()
  if (c.includes('student')) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
  if (c.includes('executive') || c.includes('board')) return 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
  if (c.includes('committee') || c.includes('church')) return 'bg-accent/15 text-accent-foreground'
  return 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300'
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function ElectionTemplates({ subdomain }: { subdomain?: string }) {
  const [templates, setTemplates] = useState<ElectionTemplateSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterTab>('all')

  // Apply-dialog state
  const [applyTarget, setApplyTarget] = useState<ElectionTemplateSummary | null>(null)
  const [applyName, setApplyName] = useState('')
  const [applyStart, setApplyStart] = useState('')
  const [applyEnd, setApplyEnd] = useState('')
  const [applying, setApplying] = useState(false)

  // Delete-dialog state
  const [deleteTarget, setDeleteTarget] = useState<ElectionTemplateSummary | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Save-current-election-as-template state
  const [elections, setElections] = useState<ElectionLite[]>([])
  const [electionsLoading, setElectionsLoading] = useState(true)
  const [saveElectionId, setSaveElectionId] = useState<string>('')
  const [saveTemplateName, setSaveTemplateName] = useState('')
  const [saveTemplateDesc, setSaveTemplateDesc] = useState('')
  const [saving, setSaving] = useState(false)

  // -----------------------------------------------------------------------
  // Data loading
  // -----------------------------------------------------------------------
  async function loadTemplates() {
    try {
      const d = await api.getElectionTemplates(subdomain)
      setTemplates(Array.isArray(d?.templates) ? d.templates : [])
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load templates')
    } finally {
      setLoading(false)
    }
  }

  async function loadElections() {
    try {
      const d = await api.electionCenter(subdomain)
      const all: ElectionLite[] = [
        ...(d?.running || []),
        ...(d?.upcoming || []),
        ...(d?.completed || []),
        ...(d?.draft || []),
        ...(d?.archived || []),
      ].map((e: any) => ({
        id: e.id,
        name: e.name,
        status: e.status,
        category: e.category,
      }))
      setElections(all)
    } catch {
      // silent — elections list is optional context for the save section
    } finally {
      setElectionsLoading(false)
    }
  }

  useEffect(() => {
    loadTemplates()
    loadElections()
  }, [subdomain])

  // -----------------------------------------------------------------------
  // Filtering
  // -----------------------------------------------------------------------
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return templates.filter((t) => {
      if (filter === 'builtin' && !t.isBuiltIn) return false
      if (filter === 'mine' && t.isBuiltIn) return false
      if (!q) return true
      return (
        t.name.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q) ||
        (t.category || '').toLowerCase().includes(q) ||
        (t.electionType || '').toLowerCase().includes(q)
      )
    })
  }, [templates, query, filter])

  const stats = useMemo(() => ({
    total: templates.length,
    builtin: templates.filter((t) => t.isBuiltIn).length,
    mine: templates.filter((t) => !t.isBuiltIn).length,
  }), [templates])

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------
  function openApply(t: ElectionTemplateSummary) {
    setApplyTarget(t)
    // Pre-fill: append " (from template)" to the template name as a hint.
    setApplyName(`${t.name}`.trim())
    // Default voting window: next 24 hours starting in 1 hour.
    const start = new Date(Date.now() + 60 * 60 * 1000)
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
    const toLocalInput = (d: Date) => {
      // Format as yyyy-MM-ddTHH:mm in local time for <input type="datetime-local">.
      const pad = (n: number) => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    }
    setApplyStart(toLocalInput(start))
    setApplyEnd(toLocalInput(end))
  }

  async function confirmApply() {
    if (!applyTarget) return
    if (!applyName.trim()) { toast.error('Election name is required'); return }
    if (!applyStart || !applyEnd) { toast.error('Start and end times are required'); return }
    setApplying(true)
    try {
      const res = await api.applyElectionTemplate(
        applyTarget.id,
        {
          name: applyName.trim(),
          startTime: new Date(applyStart).toISOString(),
          endTime: new Date(applyEnd).toISOString(),
        },
        subdomain,
      )
      toast.success(`Election created from "${applyTarget.name}" (${res?.stats?.positionsCreated || 0} positions, ${res?.stats?.candidatesCreated || 0} candidates)`)
      setApplyTarget(null)
      // Navigate to the new election workspace.
      if (res?.electionId) {
        setTimeout(() => {
          window.location.href = `/workspace/elections/${res.electionId}?org=${subdomain || ''}`
        }, 600)
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to apply template')
    } finally {
      setApplying(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.deleteElectionTemplate(deleteTarget.id, subdomain)
      toast.success(`Template "${deleteTarget.name}" deleted`)
      setDeleteTarget(null)
      await loadTemplates()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete template')
    } finally {
      setDeleting(false)
    }
  }

  async function saveTemplateFromElection() {
    if (!saveElectionId) { toast.error('Select an election to save as a template'); return }
    if (!saveTemplateName.trim()) { toast.error('Template name is required'); return }
    setSaving(true)
    try {
      const res = await api.saveElectionTemplate(
        {
          electionId: saveElectionId,
          templateName: saveTemplateName.trim(),
          templateDescription: saveTemplateDesc.trim() || undefined,
        },
        subdomain,
      )
      toast.success(`Template "${res?.template?.name || saveTemplateName.trim()}" saved`)
      setSaveTemplateName('')
      setSaveTemplateDesc('')
      setSaveElectionId('')
      await loadTemplates()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save template')
    } finally {
      setSaving(false)
    }
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  if (loading) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header card */}
      <Card className="votewise-card-glow">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <LayoutTemplate className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <h2 className="font-display text-lg font-bold sm:text-xl">Election Templates</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Start from a built-in template or save one of your past elections as a reusable blueprint.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <StatChip icon={Sparkles} label="Built-in" value={stats.builtin} colour="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" />
              <StatChip icon={FileText} label="My Templates" value={stats.mine} colour="bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" />
              <StatChip icon={LayoutTemplate} label="Total" value={stats.total} colour="bg-zinc-100 text-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save-current-election-as-template */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-display text-base">
            <Copy className="h-4 w-4 text-primary" />
            Save Current Election as Template
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-primary/30 bg-primary/5">
            <Sparkles className="h-4 w-4 text-primary" />
            <AlertTitle className="text-sm">Reuse past election structures</AlertTitle>
            <AlertDescription className="text-xs">
              Pick any of your organization&apos;s elections, and we&apos;ll snapshot its positions, candidates, and configuration into a reusable template you can apply later.
            </AlertDescription>
          </Alert>

          {electionsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading elections…
            </div>
          ) : elections.length === 0 ? (
            <Alert>
              <FileText className="h-4 w-4" />
              <AlertTitle className="text-sm">No elections yet</AlertTitle>
              <AlertDescription className="text-xs">
                Create an election first, then come back to save it as a template.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5 lg:col-span-1">
                <Label htmlFor="tpl-source-election" className="text-xs">Source Election</Label>
                <Select value={saveElectionId} onValueChange={setSaveElectionId}>
                  <SelectTrigger id="tpl-source-election" className="w-full">
                    <SelectValue placeholder="Choose election…" />
                  </SelectTrigger>
                  <SelectContent>
                    {elections.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        <span className="truncate">{e.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 lg:col-span-1">
                <Label htmlFor="tpl-name" className="text-xs">Template Name</Label>
                <Input
                  id="tpl-name"
                  value={saveTemplateName}
                  onChange={(e) => setSaveTemplateName(e.target.value)}
                  placeholder="e.g. Annual SUG Elections Template"
                />
              </div>
              <div className="space-y-1.5 lg:col-span-2">
                <Label htmlFor="tpl-desc" className="text-xs">Description (optional)</Label>
                <Input
                  id="tpl-desc"
                  value={saveTemplateDesc}
                  onChange={(e) => setSaveTemplateDesc(e.target.value)}
                  placeholder="Short note about what this template is for…"
                />
              </div>
            </div>
          )}

          {elections.length > 0 && (
            <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Positions, candidates, and election config will be snapshotted — IDs and dates are stripped.
              </p>
              <Button
                onClick={saveTemplateFromElection}
                disabled={saving || !saveElectionId || !saveTemplateName.trim()}
                className="gap-1.5"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Save Template
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filter row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search templates…"
            className="pl-9"
            aria-label="Search templates"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-card p-0.5">
          <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} icon={Filter} label="All" count={stats.total} />
          <FilterChip active={filter === 'builtin'} onClick={() => setFilter('builtin')} icon={Sparkles} label="Built-in" count={stats.builtin} />
          <FilterChip active={filter === 'mine'} onClick={() => setFilter('mine')} icon={FileText} label="My Templates" count={stats.mine} />
        </div>
      </div>

      {/* Template grid */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <LayoutTemplate className="mx-auto h-16 w-16 text-muted-foreground/30" />
            <h3 className="mt-4 font-display text-lg font-bold">
              {filter === 'mine' ? 'No saved templates yet' : 'No templates match your search'}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {filter === 'mine'
                ? 'Save one of your past elections as a template using the form above.'
                : 'Try a different search term or filter.'}
            </p>
            {filter === 'mine' && (
              <Button
                variant="outline"
                className="mt-4 gap-1.5"
                onClick={() => { setFilter('all'); setQuery('') }}
              >
                <Sparkles className="h-4 w-4" /> Browse Built-in Templates
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((t) => (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
              >
                <TemplateCard
                  template={t}
                  onApply={() => openApply(t)}
                  onDelete={() => setDeleteTarget(t)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Apply dialog */}
      <Dialog open={!!applyTarget} onOpenChange={(o) => !o && setApplyTarget(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <LayoutTemplate className="h-5 w-5 text-primary" />
              Create Election from Template
            </DialogTitle>
            <DialogDescription>
              {applyTarget ? (
                <>
                  Apply <span className="font-semibold text-foreground">{applyTarget.name}</span> to spin up a new election with{' '}
                  {applyTarget.positionCount} position{applyTarget.positionCount === 1 ? '' : 's'} and{' '}
                  {applyTarget.candidateCount} candidate{applyTarget.candidateCount === 1 ? '' : 's'}.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="apply-name">New Election Name</Label>
              <Input
                id="apply-name"
                value={applyName}
                onChange={(e) => setApplyName(e.target.value)}
                placeholder="e.g. SUG General Elections 2025/2026"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="apply-start" className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> Voting Opens
                </Label>
                <Input
                  id="apply-start"
                  type="datetime-local"
                  value={applyStart}
                  onChange={(e) => setApplyStart(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="apply-end" className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> Voting Closes
                </Label>
                <Input
                  id="apply-end"
                  type="datetime-local"
                  value={applyEnd}
                  onChange={(e) => setApplyEnd(e.target.value)}
                />
              </div>
            </div>
            <Alert className="border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
              <Sparkles className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-sm">Created as Draft</AlertTitle>
              <AlertDescription className="text-xs">
                The new election will be created in <span className="font-semibold">DRAFT</span> status.
                You can review positions, candidates, and settings before publishing.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyTarget(null)} disabled={applying}>Cancel</Button>
            <Button onClick={confirmApply} disabled={applying || !applyName.trim() || !applyStart || !applyEnd} className="gap-1.5">
              {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Vote className="h-4 w-4" />}
              Create Election
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-600" /> Delete template?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? (
                <>This will permanently delete <span className="font-semibold text-foreground">{deleteTarget.name}</span>. This action cannot be undone.</>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmDelete() }}
              disabled={deleting}
              className="gap-1.5 bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete Template
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function StatChip({ icon: Icon, label, value, colour }: { icon: any; label: string; value: number; colour: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
      <span className={cn('grid h-6 w-6 place-items-center rounded-md', colour)}><Icon className="h-3.5 w-3.5" /></span>
      <div className="leading-tight">
        <div className="font-display text-sm font-bold">{value}</div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      </div>
    </div>
  )
}

function FilterChip({ active, onClick, icon: Icon, label, count }: { active: boolean; onClick: () => void; icon: any; label: string; count: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
        active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{label}</span>
      <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] tabular-nums', active ? 'bg-primary-foreground/20' : 'bg-muted-foreground/15')}>
        {count}
      </span>
    </button>
  )
}

function TemplateCard({
  template, onApply, onDelete,
}: {
  template: ElectionTemplateSummary
  onApply: () => void
  onDelete: () => void
}) {
  return (
    <Card className="group flex h-full flex-col transition-all hover:shadow-md hover:-translate-y-0.5">
      <CardHeader className="gap-2 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <LayoutTemplate className="h-5 w-5" />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {template.isBuiltIn ? (
              <Badge variant="secondary" className="gap-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                <Sparkles className="h-3 w-3" /> Built-in
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                <FileText className="h-3 w-3" /> My Template
              </Badge>
            )}
            {template.category && (
              <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold', categoryStyle(template.category))}>
                {template.category}
              </span>
            )}
          </div>
        </div>
        <CardTitle className="font-display text-base leading-tight">{template.name}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {template.description || 'No description provided.'}
        </p>

        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Vote className="h-3 w-3 text-primary" /> {template.positionCount} position{template.positionCount === 1 ? '' : 's'}
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="h-3 w-3 text-amber-600" /> {template.candidateCount} candidate{template.candidateCount === 1 ? '' : 's'}
          </span>
          {template.electionType && (
            <span className="inline-flex items-center gap-1">
              <Building2 className="h-3 w-3" /> {template.electionType}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Calendar className="h-3 w-3" />
          {new Date(template.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
        </div>

        <Separator />

        <div className="mt-auto flex items-center gap-2">
          <Button size="sm" className="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={onApply}>
            <Plus className="h-3.5 w-3.5" /> Use Template
          </Button>
          {!template.isBuiltIn && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900 dark:hover:bg-red-950/30"
              onClick={onDelete}
              aria-label={`Delete template ${template.name}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:inline">Delete</span>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
