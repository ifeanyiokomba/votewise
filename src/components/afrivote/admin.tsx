'use client'

import { useEffect, useState } from 'react'
import {
  Lock, Loader2, ArrowLeft, BarChart3, Users, Trophy, Settings as SettingsIcon,
  ScrollText, Eye, Plus, Trash2, Pencil, CheckCircle2, AlertCircle, Upload,
  ShieldCheck, Play, Pause, BadgeCheck, RotateCcw, Search, Building2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useApp } from '@/lib/store'
import { api, setAdminToken } from '@/lib/api'
import { toast } from 'sonner'
import { StatusBadge } from '@/components/afrivote/shared'
import { cn } from '@/lib/utils'

export function AdminLoginView() {
  const { setView, setAdmin, setAdminToken } = useApp()
  const [email, setEmail] = useState('admin@afrivote.ng')
  const [password, setPassword] = useState('admin123')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onLogin() {
    setLoading(true); setError(null)
    try {
      const d = await api.adminLogin(email, password)
      setAdminToken(d.token); setAdmin(d.admin)
      setView('admin')
      toast.success('Welcome back, ' + d.admin.name)
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center justify-center px-4 py-16 sm:px-6">
      <Button variant="ghost" size="sm" onClick={() => setView('home')} className="mb-4 self-start gap-1.5">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>
      <Card className="afrivote-card-glow w-full">
        <CardHeader className="text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-foreground"><Lock className="h-7 w-7" /></div>
          <CardTitle className="mt-3 font-display">Electoral Admin Portal</CardTitle>
          <p className="text-sm text-muted-foreground">Sign in to manage the election.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="aemail">Email</Label>
            <Input id="aemail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="apass">Password</Label>
            <Input id="apass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onLogin()} />
          </div>
          {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
          <Button onClick={onLogin} disabled={loading} className="w-full gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} Sign In
          </Button>
          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">Demo credentials</p>
            <p className="mt-1 font-mono">admin@afrivote.ng / admin123</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function AdminDashboard() {
  const { admin, setAdmin, setAdminToken, setView, election, setElection } = useApp()
  const [tab, setTab] = useState('overview')

  useEffect(() => {
    api.getElection().then(setElection).catch(() => {})
  }, [setElection])

  function logout() {
    setAdminToken(null); setAdmin(null); setView('home')
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground">{admin?.name} · {admin?.email} · <Badge variant="secondary">{admin?.role}</Badge></p>
        </div>
        <Button variant="outline" onClick={logout} className="gap-1.5">Sign out</Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="afrivote-scroll mb-6 flex w-full max-w-full overflow-x-auto">
          <TabsTrigger value="overview" className="gap-1.5"><BarChart3 className="h-4 w-4" /> Overview</TabsTrigger>
          <TabsTrigger value="candidates" className="gap-1.5"><Trophy className="h-4 w-4" /> Candidates</TabsTrigger>
          <TabsTrigger value="positions" className="gap-1.5"><Building2 className="h-4 w-4" /> Positions</TabsTrigger>
          <TabsTrigger value="voters" className="gap-1.5"><Users className="h-4 w-4" /> Voters</TabsTrigger>
          <TabsTrigger value="observers" className="gap-1.5"><Eye className="h-4 w-4" /> Observers</TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5"><SettingsIcon className="h-4 w-4" /> Settings</TabsTrigger>
          <TabsTrigger value="audit" className="gap-1.5"><ScrollText className="h-4 w-4" /> Audit Log</TabsTrigger>
        </TabsList>
        <TabsContent value="overview"><OverviewTab election={election} setElection={setElection} /></TabsContent>
        <TabsContent value="candidates"><CandidatesTab /></TabsContent>
        <TabsContent value="positions"><PositionsTab /></TabsContent>
        <TabsContent value="voters"><VotersTab /></TabsContent>
        <TabsContent value="observers"><ObserversTab /></TabsContent>
        <TabsContent value="settings"><SettingsTab /></TabsContent>
        <TabsContent value="audit"><AuditTab /></TabsContent>
      </Tabs>
    </div>
  )
}

function OverviewTab({ election, setElection }: { election: any; setElection: (e: any) => void }) {
  const [stats, setStats] = useState<any>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    api.getResults().then((d) => {
      if (!d.hidden) {
        setStats({
          turnout: d.turnout,
          positions: d.positions.length,
          candidates: d.positions.reduce((a: number, p: any) => a + p.candidates.length, 0),
        })
      }
    }).catch(() => {})
  }, [])

  async function doAction(action: string, label: string) {
    setBusy(action)
    try {
      await api.adminElectionAction(action)
      const e = await api.getElection()
      setElection(e)
      toast.success(`${label} — election is now ${e.status}`)
    } catch (e: any) { toast.error(e.message) } finally { setBusy(null) }
  }

  async function updateTimes(start: string, end: string) {
    try {
      await api.adminUpdateElection({ startTime: start, endTime: end })
      const e = await api.getElection()
      setElection(e)
      toast.success('Voting window updated')
    } catch (e: any) { toast.error(e.message) }
  }

  return (
    <div className="space-y-6">
      <Card className="afrivote-card-glow">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="font-display">Election Lifecycle</CardTitle>
            {election && <StatusBadge status={election.liveStatus || election.status} />}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Voting Start</Label>
              <Input
                type="datetime-local"
                defaultValue={toLocalInput(election?.startTime)}
                onBlur={(e) => updateTimes(new Date(e.target.value).toISOString(), new Date(election?.endTime).toISOString())}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Voting End</Label>
              <Input
                type="datetime-local"
                defaultValue={toLocalInput(election?.endTime)}
                onBlur={(e) => updateTimes(new Date(election?.startTime).toISOString(), new Date(e.target.value).toISOString())}
              />
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-4">
            <LifecycleBtn action="publish" label="Publish" icon={ShieldCheck} current={election?.status} busy={busy} onClick={doAction} disabled={election?.status !== 'setup'} />
            <LifecycleBtn action="open" label="Open Voting" icon={Play} current={election?.status} busy={busy} onClick={doAction} disabled={election?.status === 'open' || election?.status === 'certified'} />
            <LifecycleBtn action="close" label="Close Voting" icon={Pause} current={election?.status} busy={busy} onClick={doAction} disabled={election?.status !== 'open'} />
            <LifecycleBtn action="certify" label="Certify Results" icon={BadgeCheck} current={election?.status} busy={busy} onClick={doAction} disabled={election?.status !== 'closed'} />
          </div>
          <div className="flex items-center gap-2 border-t border-dashed border-border pt-3">
            <Button variant="ghost" size="sm" onClick={() => doAction('reset', 'Reset')} disabled={busy !== null} className="gap-1.5 text-destructive">
              <RotateCcw className="h-4 w-4" /> Reset to setup
            </Button>
            <span className="text-xs text-muted-foreground">Use only if you need to reconfigure the election from scratch.</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Registered Voters" value={stats?.turnout?.totalVoters ?? '—'} />
        <StatCard icon={CheckCircle2} label="Votes Cast" value={stats?.turnout?.voted ?? '—'} accent />
        <StatCard icon={Trophy} label="Candidates" value={stats?.candidates ?? '—'} />
        <StatCard icon={Building2} label="Positions" value={stats?.positions ?? '—'} />
      </div>

      <Card>
        <CardHeader><CardTitle className="font-display text-base">Quick Guide</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>1. <span className="font-medium text-foreground">Publish</span> the election to make it visible to voters.</p>
          <p>2. Voting auto-opens at the start time. You can also force <span className="font-medium text-foreground">Open</span> it.</p>
          <p>3. Voting auto-closes at the end time. Then <span className="font-medium text-foreground">Certify Results</span> to freeze &amp; snapshot.</p>
          <p>4. Every action above is recorded in the Audit Log tab.</p>
        </CardContent>
      </Card>
    </div>
  )
}

function LifecycleBtn({ action, label, icon: Icon, current, busy, onClick, disabled }: any) {
  const isCurrent = current === (action === 'publish' ? 'published' : action)
  return (
    <Button
      variant={isCurrent ? 'default' : 'outline'}
      onClick={() => onClick(action, label)}
      disabled={disabled || busy !== null}
      className="gap-1.5"
    >
      {busy === action ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      {label}
    </Button>
  )
}

function StatCard({ icon: Icon, label, value, accent }: any) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-4">
        <div className={cn('grid h-11 w-11 place-items-center rounded-xl', accent ? 'bg-accent/20 text-accent-foreground' : 'bg-primary/10 text-primary')}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="font-display text-xl font-bold">{value}</div>
        </div>
      </CardContent>
    </Card>
  )
}

function CandidatesTab() {
  const [candidates, setCandidates] = useState<any[]>([])
  const [positions, setPositions] = useState<any[]>([])
  const [faculties, setFaculties] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<any | null>(null)
  const [open, setOpen] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const [c, p, f] = await Promise.all([api.adminGetCandidates(), api.adminGetPositions(), api.getFaculties()])
      setCandidates(c.candidates); setPositions(p.positions); setFaculties(f.faculties)
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  async function save(data: any) {
    try {
      if (editing?.id) await api.adminUpdateCandidate(editing.id, data)
      else await api.adminCreateCandidate(data)
      setOpen(false); setEditing(null)
      toast.success(editing?.id ? 'Candidate updated' : 'Candidate created')
      load()
    } catch (e: any) { toast.error(e.message) }
  }
  async function remove(id: string) {
    if (!confirm('Delete this candidate? This action is logged.')) return
    try { await api.adminDeleteCandidate(id); toast.success('Deleted'); load() } catch (e: any) { toast.error(e.message) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{candidates.length} candidates</p>
        <Button onClick={() => { setEditing({}); setOpen(true) }} className="gap-1.5"><Plus className="h-4 w-4" /> Add Candidate</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="afrivote-scroll max-h-[60vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                <tr className="text-left">
                  <th className="p-3 font-medium">Candidate</th>
                  <th className="p-3 font-medium">Position</th>
                  <th className="hidden p-3 font-medium md:table-cell">Status</th>
                  <th className="p-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={4} className="p-8 text-center text-muted-foreground"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>}
                {!loading && candidates.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No candidates yet.</td></tr>}
                {candidates.map((c) => (
                  <tr key={c.id} className="border-t border-border hover:bg-muted/30">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8"><AvatarImage src={c.photoUrl || undefined} /><AvatarFallback>{c.fullName?.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                        <div>
                          <div className="font-medium">{c.fullName}</div>
                          <div className="text-xs text-muted-foreground">{c.slogan}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3"><Badge variant="outline" className="text-[10px]">{c.position?.title}</Badge></td>
                    <td className="hidden p-3 md:table-cell"><StatusBadgeBadge status={c.status} /></td>
                    <td className="p-3 text-right">
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(c); setOpen(true) }}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      <CandidateDialog open={open} onOpenChange={setOpen} candidate={editing} positions={positions} faculties={faculties} onSave={save} />
    </div>
  )
}

function StatusBadgeBadge({ status }: { status: string }) {
  const map: Record<string, string> = { APPROVED: 'bg-emerald-100 text-emerald-700', DISQUALIFIED: 'bg-red-100 text-red-700', WITHDRAWN: 'bg-amber-100 text-amber-700' }
  return <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', map[status] || 'bg-muted')}>{status}</span>
}

function CandidateDialog({ open, onOpenChange, candidate, positions, faculties, onSave }: any) {
  const [form, setForm] = useState<any>({})
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(candidate || {})
  }, [candidate])
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto afrivote-scroll">
        <DialogHeader><DialogTitle>{candidate?.id ? 'Edit Candidate' : 'Add Candidate'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Full Name</Label><Input value={form.fullName || ''} onChange={(e) => set('fullName', e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Position</Label>
              <Select value={form.positionId} onValueChange={(v) => set('positionId', v)}>
                <SelectTrigger><SelectValue placeholder="Select position" /></SelectTrigger>
                <SelectContent>{positions.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Status</Label>
              <Select value={form.status || 'APPROVED'} onValueChange={(v) => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="APPROVED">Approved</SelectItem><SelectItem value="DISQUALIFIED">Disqualified</SelectItem><SelectItem value="WITHDRAWN">Withdrawn</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Level</Label><Input value={form.level || ''} onChange={(e) => set('level', e.target.value)} placeholder="e.g. 400" /></div>
            <div className="space-y-1.5"><Label>Photo URL</Label><Input value={form.photoUrl || ''} onChange={(e) => set('photoUrl', e.target.value)} placeholder="/candidates/c1.jpg" /></div>
          </div>
          <div className="space-y-1.5"><Label>Slogan</Label><Input value={form.slogan || ''} onChange={(e) => set('slogan', e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Manifesto</Label><Textarea rows={4} value={form.manifesto || ''} onChange={(e) => set('manifesto', e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onSave(form)} className="gap-1.5"><CheckCircle2 className="h-4 w-4" /> Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PositionsTab() {
  const [positions, setPositions] = useState<any[]>([])
  const [faculties, setFaculties] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<any>({ scope: 'UNIVERSITY' })

  async function load() {
    setLoading(true)
    try {
      const [p, f] = await Promise.all([api.adminGetPositions(), api.getFaculties()])
      setPositions(p.positions); setFaculties(f.faculties)
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  async function create() {
    try {
      await api.adminCreatePosition(form)
      setOpen(false); setForm({ scope: 'UNIVERSITY' })
      toast.success('Position created'); load()
    } catch (e: any) { toast.error(e.message) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{positions.length} positions</p>
        <Button onClick={() => setOpen(true)} className="gap-1.5"><Plus className="h-4 w-4" /> Add Position</Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {loading && <Loader2 className="h-5 w-5 animate-spin" />}
        {positions.map((p) => (
          <Card key={p.id}>
            <CardContent className="flex items-start justify-between p-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">{p.order}</span>
                  <h4 className="font-display font-semibold">{p.title}</h4>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{scopeLabel(p.scope)}</Badge>
                  {p.faculty && <span className="text-xs text-muted-foreground">{p.faculty.name}</span>}
                  {p.department && <span className="text-xs text-muted-foreground">{p.department.name}</span>}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{p._count?.candidates || 0} candidates</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Position</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Title</Label><Input value={form.title || ''} onChange={(e) => setForm((f: any) => ({ ...f, title: e.target.value }))} placeholder="e.g. Sports Director" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Scope</Label>
                <Select value={form.scope} onValueChange={(v) => setForm((f: any) => ({ ...f, scope: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="UNIVERSITY">University-wide</SelectItem><SelectItem value="FACULTY">Faculty</SelectItem><SelectItem value="DEPARTMENT">Department</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Order</Label><Input type="number" value={form.order || ''} onChange={(e) => setForm((f: any) => ({ ...f, order: parseInt(e.target.value) || 0 }))} /></div>
            </div>
            {form.scope === 'FACULTY' && (
              <div className="space-y-1.5"><Label>Faculty</Label>
                <Select value={form.facultyId} onValueChange={(v) => setForm((f: any) => ({ ...f, facultyId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select faculty" /></SelectTrigger>
                  <SelectContent>{faculties.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {form.scope === 'DEPARTMENT' && (
              <div className="space-y-1.5"><Label>Department (Faculty)</Label>
                <Select value={form.facultyId} onValueChange={(v) => setForm((f: any) => ({ ...f, facultyId: v, departmentId: undefined }))}>
                  <SelectTrigger><SelectValue placeholder="Select faculty" /></SelectTrigger>
                  <SelectContent>{faculties.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5"><Label>Description</Label><Textarea rows={2} value={form.description || ''} onChange={(e) => setForm((f: any) => ({ ...f, description: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={create} className="gap-1.5"><Plus className="h-4 w-4" /> Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function VotersTab() {
  const [voters, setVoters] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [faculties, setFaculties] = useState<any[]>([])
  const [form, setForm] = useState<any>({ level: '100' })

  async function load() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '50' })
      if (q) params.set('q', q)
      if (status) params.set('status', status)
      const d = await api.adminGetVoters(params.toString())
      setVoters(d.voters); setTotal(d.total)
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { api.getFaculties().then((f) => setFaculties(f.faculties)); load() }, [page, status])
  useEffect(() => { const t = setTimeout(load, 400); return () => clearTimeout(t) }, [q])

  async function create() {
    try {
      await api.adminCreateVoter(form)
      setOpen(false); setForm({ level: '100' }); toast.success('Voter added'); load()
    } catch (e: any) { toast.error(e.message) }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search matric, name, email…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} className="pl-8" />
          </div>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1) }}>
            <SelectTrigger className="w-32"><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent><SelectItem value="">All</SelectItem><SelectItem value="voted">Voted</SelectItem><SelectItem value="pending">Pending</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)} className="gap-1.5"><Upload className="h-4 w-4" /> Bulk Import</Button>
          <Button onClick={() => setOpen(true)} className="gap-1.5"><Plus className="h-4 w-4" /> Add Voter</Button>
        </div>
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="afrivote-scroll max-h-[60vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                <tr className="text-left">
                  <th className="p-3 font-medium">Voter</th>
                  <th className="hidden p-3 font-medium md:table-cell">Faculty / Dept</th>
                  <th className="hidden p-3 font-medium sm:table-cell">Level</th>
                  <th className="p-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={4} className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>}
                {!loading && voters.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No voters found.</td></tr>}
                {voters.map((v) => (
                  <tr key={v.id} className="border-t border-border hover:bg-muted/30">
                    <td className="p-3">
                      <div className="font-medium">{v.fullName}</div>
                      <div className="font-mono text-xs text-muted-foreground">{v.matric}</div>
                    </td>
                    <td className="hidden p-3 text-xs md:table-cell"><div>{v.faculty?.name}</div><div className="text-muted-foreground">{v.department?.name}</div></td>
                    <td className="hidden p-3 sm:table-cell">{v.level}</td>
                    <td className="p-3">{v.hasVoted ? <Badge className="bg-emerald-100 text-emerald-700">Voted</Badge> : <Badge variant="secondary">Pending</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{total} voters · page {page}</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
          <Button size="sm" variant="outline" disabled={voters.length < 50} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Voter</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Matric</Label><Input value={form.matric || ''} onChange={(e) => setForm((f: any) => ({ ...f, matric: e.target.value.toUpperCase() }))} /></div>
              <div className="space-y-1.5"><Label>Full Name</Label><Input value={form.fullName || ''} onChange={(e) => setForm((f: any) => ({ ...f, fullName: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Email</Label><Input value={form.email || ''} onChange={(e) => setForm((f: any) => ({ ...f, email: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone || ''} onChange={(e) => setForm((f: any) => ({ ...f, phone: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Faculty</Label>
                <Select value={form.facultyId} onValueChange={(v) => setForm((f: any) => ({ ...f, facultyId: v, departmentId: undefined }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{faculties.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Department</Label>
                <Select value={form.departmentId} onValueChange={(v) => setForm((f: any) => ({ ...f, departmentId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{faculties.find((f: any) => f.id === form.facultyId)?.departments.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>) || []}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5"><Label>Level</Label><Input value={form.level || ''} onChange={(e) => setForm((f: any) => ({ ...f, level: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={create} className="gap-1.5"><Plus className="h-4 w-4" /> Add</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <VoterImportDialog open={importOpen} onOpenChange={setImportOpen} faculties={faculties} onDone={load} />
    </div>
  )
}

function VoterImportDialog({ open, onOpenChange, faculties, onDone }: any) {
  const [text, setText] = useState('')
  const [result, setResult] = useState<any>(null)
  const [busy, setBusy] = useState(false)

  function parse() {
    // Each line: matric,fullName,email,phone,facultyCode,departmentCode,level
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
    return lines.map((line) => {
      const parts = line.split(',').map((p) => p.trim())
      return { matric: parts[0], fullName: parts[1], email: parts[2], phone: parts[3], facultyCode: parts[4], departmentCode: parts[5], level: parts[6] || '100' }
    })
  }

  async function doImport() {
    setBusy(true)
    try {
      const voters = parse()
      const r = await api.adminImportVoters(voters)
      setResult(r); onDone()
      toast.success(`Imported ${r.created} new, ${r.updated} updated`)
    } catch (e: any) { toast.error(e.message) } finally { setBusy(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Bulk Import Voters</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Paste one voter per line, comma-separated:</p>
          <pre className="rounded bg-muted p-3 text-xs">matric,fullName,email,phone,facultyCode,departmentCode,level</pre>
          <Textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder="CSC/2022/001,Demo One,demo1@afrivote.ng,08030000001,SCI,CSC,300" className="font-mono text-xs" />
          {result && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Import complete</AlertTitle>
              <AlertDescription>Created: {result.created} · Updated: {result.updated} · Skipped: {result.skipped}</AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button><Button onClick={doImport} disabled={busy} className="gap-1.5">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Import</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ObserversTab() {
  const [observers, setObservers] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<any>({})

  async function load() {
    try { const d = await api.adminGetObservers(); setObservers(d.observers) } catch (e: any) { toast.error(e.message) }
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [])

  async function create() {
    try { await api.adminCreateObserver(form); setOpen(false); setForm({}); toast.success('Observer created'); load() } catch (e: any) { toast.error(e.message) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{observers.length} observers</p>
        <Button onClick={() => setOpen(true)} className="gap-1.5"><Plus className="h-4 w-4" /> Add Observer</Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {observers.map((o) => (
          <Card key={o.id}>
            <CardContent className="flex items-center gap-3 p-4">
              <Avatar className="h-10 w-10"><AvatarFallback>{o.name?.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
              <div className="min-w-0">
                <div className="truncate font-medium">{o.name}</div>
                <div className="truncate text-xs text-muted-foreground">{o.email}</div>
                {o.organization && <div className="truncate text-xs text-muted-foreground">{o.organization}</div>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Observer</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Full Name</Label><Input value={form.name || ''} onChange={(e) => setForm((f: any) => ({ ...f, name: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.email || ''} onChange={(e) => setForm((f: any) => ({ ...f, email: e.target.value.toLowerCase() }))} /></div>
            <div className="space-y-1.5"><Label>Organization</Label><Input value={form.organization || ''} onChange={(e) => setForm((f: any) => ({ ...f, organization: e.target.value }))} placeholder="e.g. NANS Monitoring Team" /></div>
            <div className="space-y-1.5"><Label>Temporary Password</Label><Input value={form.password || ''} onChange={(e) => setForm((f: any) => ({ ...f, password: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={create} className="gap-1.5"><Plus className="h-4 w-4" /> Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SettingsTab() {
  const [s, setS] = useState<any>(null)
  useEffect(() => { api.adminGetSettings().then((d) => setS(d.settings)) }, [])
  async function toggle(k: string, v: boolean) {
    const next = { ...s, [k]: v }; setS(next)
    try { await api.adminUpdateSettings({ [k]: v }); toast.success('Settings updated') } catch (e: any) { toast.error(e.message) }
  }
  if (!s) return <Loader2 className="h-5 w-5 animate-spin" />
  const items = [
    { k: 'publicLiveResults', label: 'Public Live Results', desc: 'Show real-time tallies on the homepage.' },
    { k: 'showTurnout', label: 'Show Turnout', desc: 'Display the live turnout percentage publicly.' },
    { k: 'requireOtp', label: 'Require OTP', desc: 'Voters must verify with a one-time PIN before voting.' },
    { k: 'ballotRandomization', label: 'Ballot Randomization', desc: 'Shuffle candidate order per voter to remove bias.' },
    { k: 'notaEnabled', label: 'None-of-the-Above', desc: 'Allow voters to explicitly abstain on each position.' },
  ]
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="font-display text-base">Election Settings</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          {items.map((it) => (
            <div key={it.k} className="flex items-center justify-between border-b border-border/60 py-3 last:border-0">
              <div><div className="font-medium">{it.label}</div><div className="text-xs text-muted-foreground">{it.desc}</div></div>
              <Switch checked={!!s[it.k]} onCheckedChange={(v) => toggle(it.k, v)} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function AuditTab() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { api.adminGetAuditLogs(1).then((d) => { setLogs(d.logs); setLoading(false) }).catch(() => setLoading(false)) }, [])
  return (
    <Card>
      <CardContent className="p-0">
        <div className="afrivote-scroll max-h-[70vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur">
              <tr className="text-left">
                <th className="p-3 font-medium">Time</th>
                <th className="p-3 font-medium">Actor</th>
                <th className="p-3 font-medium">Action</th>
                <th className="hidden p-3 font-medium md:table-cell">Details</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={4} className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>}
              {!loading && logs.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No audit logs yet.</td></tr>}
              {logs.map((l) => (
                <tr key={l.id} className="border-t border-border">
                  <td className="p-3 align-top font-mono text-xs text-muted-foreground">{new Date(l.createdAt).toLocaleString()}</td>
                  <td className="p-3 align-top"><div className="font-medium">{l.actorName}</div><div className="text-xs text-muted-foreground">{l.actorRole}</div></td>
                  <td className="p-3 align-top"><Badge variant="outline" className="font-mono text-[10px]">{l.action}</Badge></td>
                  <td className="hidden p-3 align-top text-xs text-muted-foreground md:table-cell">{l.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

function toLocalInput(d: Date | string) {
  if (!d) return ''
  const date = new Date(d)
  const off = date.getTimezoneOffset()
  const local = new Date(date.getTime() - off * 60000)
  return local.toISOString().slice(0, 16)
}
function scopeLabel(s: string) {
  if (s === 'UNIVERSITY') return 'University-wide'
  if (s === 'FACULTY') return 'Faculty'
  if (s === 'DEPARTMENT') return 'Department'
  return s
}
