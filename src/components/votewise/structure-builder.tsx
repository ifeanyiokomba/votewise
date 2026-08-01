'use client'

import { useEffect, useState } from 'react'
import {
  Building2, Plus, ChevronRight, ChevronDown, Trash2, Loader2, X,
  FolderTree, ArrowLeft,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Unit {
  id: string
  name: string
  slug: string
  code: string | null
  description: string | null
  parentWorkspaceId: string | null
  status: string
  _count?: { elections: number; observerAssignments: number; voterGroups: number }
  children?: Unit[]
}

export function StructureBuilder({ subdomain }: { subdomain?: string }) {
  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [showForm, setShowForm] = useState(false)
  const [formParent, setFormParent] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', code: '', description: '' })

  function buildTree(flat: Unit[]): Unit[] {
    const map = new Map<string, Unit>()
    flat.forEach((u) => map.set(u.id, { ...u, children: [] }))
    const roots: Unit[] = []
    flat.forEach((u) => {
      if (u.parentWorkspaceId && map.has(u.parentWorkspaceId)) {
        map.get(u.parentWorkspaceId)!.children!.push(map.get(u.id)!)
      } else {
        roots.push(map.get(u.id)!)
      }
    })
    return roots
  }

  useEffect(() => {
    let active = true
    api.workspaceUnits(subdomain).then((d) => { if (active) setUnits(buildTree(d.units || [])) }).catch(() => {}).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [subdomain])

  async function reload() {
    try { const d = await api.workspaceUnits(subdomain); setUnits(buildTree(d.units || [])) } catch {}
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function create() {
    if (!form.name) { toast.error('Name is required'); return }
    try {
      await api.workspaceCreateUnit({
        name: form.name,
        code: form.code || undefined,
        description: form.description || undefined,
        parentWorkspaceId: formParent || undefined,
      }, subdomain)
      toast.success('Organization unit created')
      setForm({ name: '', code: '', description: '' })
      setShowForm(false)
      setFormParent(null)
      reload()
    } catch (e: any) { toast.error(e.message) }
  }

  function openForm(parentId: string | null) {
    setFormParent(parentId)
    setForm({ name: '', code: '', description: '' })
    setShowForm(true)
    if (parentId) setExpanded((prev) => new Set(prev).add(parentId))
  }

  function renderUnit(unit: Unit, depth: number = 0): React.ReactNode {
    const isExpanded = expanded.has(unit.id)
    const hasChildren = unit.children && unit.children.length > 0
    return (
      <div key={unit.id}>
        <div
          className={cn('flex items-center gap-2 rounded-lg border border-border/60 p-2.5 transition-colors hover:bg-muted/30', depth > 0 && 'ml-6')}
          style={{ marginLeft: depth > 0 ? `${depth * 24}px` : 0 }}
        >
          <button
            onClick={() => hasChildren && toggleExpand(unit.id)}
            className={cn('shrink-0', !hasChildren && 'invisible')}
          >
            {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </button>
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <Building2 className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium">{unit.name}</span>
              {unit.code && <Badge variant="outline" className="text-[10px]">{unit.code}</Badge>}
              {unit.status === 'ARCHIVED' && <Badge variant="secondary" className="text-[10px]">Archived</Badge>}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {unit._count?.elections || 0} elections · {unit._count?.observerAssignments || 0} observers · {unit._count?.voterGroups || 0} groups
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={() => openForm(unit.id)} className="gap-1 text-xs">
            <Plus className="h-3 w-3" /> Add Child
          </Button>
        </div>
        {isExpanded && hasChildren && (
          <div className="mt-1 space-y-1">
            {unit.children!.map((child) => renderUnit(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <FolderTree className="h-6 w-6 text-primary" />
          <h1 className="font-display text-2xl font-bold">Organization Structure</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Build your organization&apos;s hierarchy. Units can represent faculties, departments, regions, branches, parishes, chapters — anything. Units can be nested infinitely.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="font-display text-base">Organization Units</CardTitle>
            <Button size="sm" onClick={() => openForm(null)} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add Unit
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {showForm && (
            <div className="mb-4 rounded-lg border border-border/60 bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-semibold">
                  {formParent ? 'Add Child Unit' : 'Add Root Unit'}
                </h3>
                <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); setFormParent(null) }}><X className="h-4 w-4" /></Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px]">Unit Name *</Label>
                  <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Faculty of Engineering" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Code (optional)</Label>
                  <Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="ENG" className="font-mono" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Description (optional)</Label>
                <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="All engineering departments" />
              </div>
              <Button size="sm" onClick={create} className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Create Unit</Button>
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : units.length === 0 ? (
            <div className="py-12 text-center">
              <Building2 className="mx-auto h-12 w-12 text-muted-foreground/40" />
              <p className="mt-3 text-sm text-muted-foreground">No organization units yet. Create your first unit to start organizing elections.</p>
              <Button onClick={() => openForm(null)} className="mt-4 gap-2"><Plus className="h-4 w-4" /> Create First Unit</Button>
            </div>
          ) : (
            <div className="space-y-1">
              {units.map((unit) => renderUnit(unit))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
        <p className="text-xs text-blue-700 dark:text-blue-400">
          <strong>Tip:</strong> Organization units are optional. You can run an election for the entire organization without creating any units. Create units only when you need to run multiple independent elections simultaneously (e.g. faculty elections, regional elections, parish elections).
        </p>
      </div>
    </div>
  )
}
