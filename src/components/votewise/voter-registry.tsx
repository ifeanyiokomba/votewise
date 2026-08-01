'use client'

import { useEffect, useState } from 'react'
import {
  Users, Search, Loader2, Plus, CheckCircle2, Clock, Ban, ArrowLeft,
  ChevronRight, Upload, Filter, Trash2, ShieldCheck, Zap,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export function VoterRegistry({ subdomain }: { subdomain?: string }) {
  const [voters, setVoters] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  useEffect(() => {
    let active = true
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    params.set('page', String(page))
    params.set('pageSize', '50')
    api.voterRegistry(params.toString(), subdomain).then((d) => {
      if (!active) return
      setVoters(d.voters || [])
      setTotal(d.total || 0)
    }).catch(() => {}).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [q, page, subdomain])

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function bulkAction(action: string) {
    if (selected.size === 0) { toast.error('Select at least one voter'); return }
    try {
      await api.bulkVoterAction(action, [...selected], subdomain)
      toast.success(`${action.charAt(0).toUpperCase() + action.slice(1)}d ${selected.size} voters`)
      setSelected(new Set())
      // Reload
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      params.set('page', String(page))
      params.set('pageSize', '50')
      const d = await api.voterRegistry(params.toString(), subdomain)
      setVoters(d.voters || []); setTotal(d.total || 0)
    } catch (e: any) { toast.error(e.message) }
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
      <Button variant="ghost" size="sm" onClick={() => { window.location.href = `/workspace?org=${subdomain || ''}` }} className="mb-4 gap-1.5">
        <ArrowLeft className="h-4 w-4" /> Back to Dashboard
      </Button>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Voter Registry</h1>
          <p className="text-sm text-muted-foreground">Master voter directory — one trusted source of truth for all elections.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5"><Upload className="h-4 w-4" /> Import</Button>
          <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> Add Voter</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatBox icon={Users} label="Total Voters" value={total.toLocaleString()} colour="bg-primary/10 text-primary" />
        <StatBox icon={ShieldCheck} label="Verified" value={voters.filter(v => v.verificationStatus === 'VERIFIED').length} colour="bg-emerald-100 text-emerald-700" />
        <StatBox icon={Clock} label="Pending" value={voters.filter(v => v.verificationStatus === 'PENDING').length} colour="bg-amber-100 text-amber-700" />
        <StatBox icon={Ban} label="Suspended" value={voters.filter(v => v.status === 'SUSPENDED').length} colour="bg-red-100 text-red-700" />
      </div>

      {/* Search */}
      <div className="mb-4 flex gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} placeholder="Search by name, email, phone, or any field…" className="pl-9" />
        </div>
        <Button variant="outline" size="sm" className="gap-1.5"><Filter className="h-4 w-4" /> Filter</Button>
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-2">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <div className="ml-auto flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => bulkAction('verify')} className="gap-1 text-xs"><ShieldCheck className="h-3 w-3" /> Verify</Button>
            <Button size="sm" variant="ghost" onClick={() => bulkAction('suspend')} className="gap-1 text-xs text-amber-600"><Ban className="h-3 w-3" /> Suspend</Button>
            <Button size="sm" variant="ghost" onClick={() => bulkAction('reactivate')} className="gap-1 text-xs text-emerald-600"><CheckCircle2 className="h-3 w-3" /> Reactivate</Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} className="text-xs">Clear</Button>
          </div>
        </div>
      )}

      {/* Voter table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : voters.length === 0 ? (
            <div className="py-16 text-center">
              <Users className="mx-auto h-16 w-16 text-muted-foreground/30" />
              <h3 className="mt-4 font-display text-lg font-bold">No voters yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">Your master voter registry is empty. Import voters via CSV or add them manually to get started.</p>
              <div className="mt-4 flex justify-center gap-2">
                <Button size="sm" className="gap-1.5"><Upload className="h-4 w-4" /> Import CSV</Button>
                <Button size="sm" variant="outline" className="gap-1.5"><Plus className="h-4 w-4" /> Add Voter</Button>
              </div>
            </div>
          ) : (
            <div className="votewise-scroll max-h-[70vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                  <tr className="text-left">
                    <th className="p-3 w-8"><input type="checkbox" onChange={(e) => { if (e.target.checked) setSelected(new Set(voters.map(v => v.id))); else setSelected(new Set()) }} checked={selected.size === voters.length && voters.length > 0} /></th>
                    <th className="p-3">Voter</th>
                    <th className="p-3 hidden md:table-cell">Contact</th>
                    <th className="p-3 hidden sm:table-cell">Status</th>
                    <th className="p-3 hidden lg:table-cell">Verification</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {voters.map((v) => (
                    <tr key={v.id} className={cn('border-t border-border hover:bg-muted/30', selected.has(v.id) && 'bg-primary/5')}>
                      <td className="p-3"><input type="checkbox" checked={selected.has(v.id)} onChange={() => toggleSelect(v.id)} /></td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                            {(v.firstName || v.fullName || '?').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium">{v.firstName || ''} {v.lastName || v.fullName || ''}</div>
                            {v.matric && <div className="font-mono text-[10px] text-muted-foreground">{v.matric}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="p-3 hidden md:table-cell">
                        <div className="text-xs text-muted-foreground">{v.email || '—'}</div>
                        <div className="text-xs text-muted-foreground">{v.phone || '—'}</div>
                      </td>
                      <td className="p-3 hidden sm:table-cell">
                        <Badge className={cn(v.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')}>{v.status || 'ACTIVE'}</Badge>
                      </td>
                      <td className="p-3 hidden lg:table-cell">
                        <Badge variant="outline" className={cn(v.verificationStatus === 'VERIFIED' ? 'text-emerald-600' : 'text-amber-600')}>{v.verificationStatus || 'PENDING'}</Badge>
                      </td>
                      <td className="p-3 text-right">
                        <Button size="sm" variant="ghost" onClick={() => { window.location.href = `/workspace/voters/${v.id}?org=${subdomain || ''}` }} className="gap-1 text-xs">
                          Profile <ChevronRight className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {total > 50 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Showing {((page - 1) * 50) + 1}–{Math.min(page * 50, total)} of {total.toLocaleString()}</span>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <Button size="sm" variant="outline" disabled={page * 50 >= total} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  )
}

function StatBox({ icon: Icon, label, value, colour }: any) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className={cn('grid h-8 w-8 place-items-center rounded-lg', colour)}><Icon className="h-4 w-4" /></div>
        <div className="mt-2 font-display text-xl font-bold">{value}</div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  )
}
