'use client'

import { useEffect, useState, useRef } from 'react'
import {
  Lock, Loader2, ArrowLeft, BarChart3, Users, Trophy, Settings as SettingsIcon,
  ScrollText, Eye, Plus, Trash2, Pencil, CheckCircle2, AlertCircle, Upload,
  ShieldCheck, Play, Pause, BadgeCheck, RotateCcw, Search, Building2, Download,
  KeyRound, ShieldAlert, Bell, Fingerprint, Link2, FileCheck2, Activity,
  LogIn, Vote, Flag,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useApp } from '@/lib/store'
import { api } from '@/lib/api'
import { useTerminology } from '@/lib/terminology'
import { toast } from 'sonner'
import { StatusBadge } from '@/components/votewise/shared'
import { cn } from '@/lib/utils'

// Legacy role labels (Chapter 1 — these map the deprecated ElectionOfficial
// roles to friendly names. Chapter 2+ will use the six OrganizationMember
// roles: PLATFORM_SUPER_ADMIN, ORG_OWNER, ORG_ADMIN, OBSERVER, VOTER, GUEST).
const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Organization Owner',
  ELECTORAL_COMMITTEE: 'Electoral Committee',
  FACULTY_OFFICER: 'Committee Officer',
  DEPARTMENT_OFFICER: 'Committee Officer',
  OBSERVER: 'Observer',
}

export function OfficialLoginView() {
  const { setView, setOfficial } = useApp()
  const [email, setEmail] = useState('admin@votewise.com.ng')
  const [password, setPassword] = useState('admin123')
  const [totp, setTotp] = useState('')
  const [needs2fa, setNeeds2fa] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onLogin() {
    setLoading(true); setError(null)
    try {
      const d = await api.login(email, password, needs2fa ? totp : undefined)
      if ((d as any).needs2fa) { setNeeds2fa(true); setLoading(false); return }
      setOfficial(d.official); setView('official')
      toast.success('Welcome, ' + d.official.name)
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center justify-center px-4 py-16 sm:px-6">
      <Button variant="ghost" size="sm" onClick={() => setView('home')} className="mb-4 self-start gap-1.5">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>
      <Card className="votewise-card-glow w-full">
        <CardHeader className="text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-foreground"><Lock className="h-7 w-7" /></div>
          <CardTitle className="mt-3 font-display">Organization Portal</CardTitle>
          <p className="text-sm text-muted-foreground">Sign in to manage your organization&apos;s elections.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2"><Label htmlFor="aemail">Email</Label><Input id="aemail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="apass">Password</Label><Input id="apass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          {needs2fa && (
            <div className="space-y-2">
              <Label htmlFor="atotp">2FA Code (from your authenticator app)</Label>
              <Input id="atotp" value={totp} onChange={(e) => setTotp(e.target.value)} placeholder="123456" className="font-mono" />
            </div>
          )}
          {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
          <Button onClick={onLogin} disabled={loading} className="w-full gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : needs2fa ? <ShieldCheck className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            {needs2fa ? 'Verify & Sign In' : 'Sign In'}
          </Button>
          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">Demo credentials</p>
            <div className="mt-1 space-y-0.5 font-mono">
              <div>admin@votewise.com.ng / admin123 (Org Owner)</div>
              <div>elcom@votewise.com.ng / elcom123 (Committee)</div>
              <div>eng.faculty@votewise.com.ng / faculty123 (Officer)</div>
              <div>csc.dept@votewise.com.ng / dept123 (Officer)</div>
              <div>observer@votewise.com.ng / observer123 (Observer)</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function OfficialDashboard() {
  const { official, setOfficial, setView, election, setElection } = useApp()
  const t = useTerminology()
  const [tab, setTab] = useState('overview')
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    // Check auth on mount — if not logged in, redirect to login
    api.me().then((d) => {
      if (d.valid) {
        setOfficial(d.official)
      }
      setAuthChecked(true)
    }).catch(() => setAuthChecked(true))
  }, [])

  useEffect(() => { if (official) api.getLegacyElection().then(setElection).catch(() => {}) }, [setElection, official])

  // Show login screen if not authenticated
  if (authChecked && !official) {
    return <OfficialLoginView />
  }
  if (!authChecked || !official) {
    return <div className="grid min-h-[60vh] place-items-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }

  async function logout() {
    try { await api.logout() } catch {}
    setOfficial(null); setView('home')
  }

  // Role-based tab visibility.
  const role = official?.role
  const canManageElection = role === 'SUPER_ADMIN' || role === 'ELECTORAL_COMMITTEE'
  const canManageOfficials = role === 'SUPER_ADMIN'
  const canScreenCandidates = true // all officials except observer can screen; observer can view
  const canViewAudit = role === 'SUPER_ADMIN' || role === 'ELECTORAL_COMMITTEE'
  const canViewSecurity = role === 'SUPER_ADMIN' || role === 'ELECTORAL_COMMITTEE'

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold">Organization Portal</h1>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider text-muted-foreground">{ROLE_LABELS[role] || 'Official'}</Badge>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">{official?.name} · {official?.email}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setView('home')} className="gap-1.5"><Building2 className="h-4 w-4" /> Public View</Button>
          <Button variant="outline" onClick={logout} className="gap-1.5">Sign out</Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="votewise-scroll mb-6 flex w-full max-w-full overflow-x-auto">
          <TabsTrigger value="overview" className="gap-1.5"><BarChart3 className="h-4 w-4" /> Overview</TabsTrigger>
          <TabsTrigger value="candidates" className="gap-1.5"><Trophy className="h-4 w-4" /> Candidates</TabsTrigger>
          {canManageElection && <TabsTrigger value="positions" className="gap-1.5"><Building2 className="h-4 w-4" /> Positions</TabsTrigger>}
          <TabsTrigger value="voters" className="gap-1.5"><Users className="h-4 w-4" /> Voters</TabsTrigger>
          <TabsTrigger value="collation" className="gap-1.5"><FileCheck2 className="h-4 w-4" /> Collation</TabsTrigger>
          <TabsTrigger value="activity" className="gap-1.5"><Activity className="h-4 w-4" /> Activity</TabsTrigger>
          {canManageOfficials && <TabsTrigger value="officials" className="gap-1.5"><ShieldCheck className="h-4 w-4" /> Officials</TabsTrigger>}
          {canManageElection && <TabsTrigger value="settings" className="gap-1.5"><SettingsIcon className="h-4 w-4" /> Settings</TabsTrigger>}
          {canViewAudit && <TabsTrigger value="audit" className="gap-1.5"><ScrollText className="h-4 w-4" /> Audit Log</TabsTrigger>}
          {canViewSecurity && <TabsTrigger value="security" className="gap-1.5"><ShieldAlert className="h-4 w-4" /> Security</TabsTrigger>}
          <TabsTrigger value="account" className="gap-1.5"><KeyRound className="h-4 w-4" /> My Account</TabsTrigger>
        </TabsList>
        <TabsContent value="overview"><OverviewTab election={election} setElection={setElection} role={role} /></TabsContent>
        <TabsContent value="candidates"><CandidatesTab /></TabsContent>
        {canManageElection && <TabsContent value="positions"><PositionsTab /></TabsContent>}
        <TabsContent value="voters"><VotersTab role={role} official={official} /></TabsContent>
        <TabsContent value="collation"><CollationTab role={role} /></TabsContent>
        <TabsContent value="activity"><ActivityTab /></TabsContent>
        {canManageOfficials && <TabsContent value="officials"><OfficialsTab /></TabsContent>}
        {canManageElection && <TabsContent value="settings"><SettingsTab /></TabsContent>}
        {canViewAudit && <TabsContent value="audit"><AuditTab /></TabsContent>}
        {canViewSecurity && <TabsContent value="security"><SecurityTab /></TabsContent>}
        <TabsContent value="account"><AccountTab official={official} /></TabsContent>
      </Tabs>
    </div>
  )
}

function OverviewTab({ election, setElection, role }: { election: any; setElection: (e: any) => void; role: string }) {
  const [stats, setStats] = useState<any>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [broadcastOpen, setBroadcastOpen] = useState(false)
  const canManage = role === 'SUPER_ADMIN' || role === 'ELECTORAL_COMMITTEE'

  useEffect(() => {
    api.getResults().then((d) => {
      if (!d.hidden) setStats({ turnout: d.turnout, positions: d.positions.length, candidates: d.positions.reduce((a: number, p: any) => a + p.candidates.length, 0) })
    }).catch(() => {})
  }, [])

  async function doAction(action: string, label: string) {
    setBusy(action)
    try {
      await api.adminElectionAction(action)
      const e = await api.getLegacyElection(); setElection(e)
      toast.success(`${label} — election is now ${e.status}`)
    } catch (e: any) { toast.error(e.message) } finally { setBusy(null) }
  }

  async function updateTimes(start: string, end: string) {
    try { await api.adminUpdateElection({ startTime: start, endTime: end }); const e = await api.getLegacyElection(); setElection(e); toast.success('Voting window updated') } catch (e: any) { toast.error(e.message) }
  }

  return (
    <div className="space-y-6">
      {canManage && (
        <Card className="votewise-card-glow">
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
                <Input type="datetime-local" defaultValue={toLocalInput(election?.startTime)} onBlur={(e) => updateTimes(new Date(e.target.value).toISOString(), new Date(election?.endTime).toISOString())} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Voting End</Label>
                <Input type="datetime-local" defaultValue={toLocalInput(election?.endTime)} onBlur={(e) => updateTimes(new Date(election?.startTime).toISOString(), new Date(e.target.value).toISOString())} />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-4">
              <LifecycleBtn action="publish" label="Publish" icon={ShieldCheck} current={election?.status} busy={busy} onClick={doAction} disabled={election?.status !== 'DRAFT'} />
              <LifecycleBtn action="open" label="Open Voting" icon={Play} current={election?.status} busy={busy} onClick={doAction} disabled={election?.status === 'VOTING' || election?.status === 'CERTIFIED'} />
              <LifecycleBtn action="close" label="Close Voting" icon={Pause} current={election?.status} busy={busy} onClick={doAction} disabled={election?.status !== 'VOTING'} />
              <LifecycleBtn action="certify" label="Certify Results" icon={BadgeCheck} current={election?.status} busy={busy} onClick={doAction} disabled={election?.status !== 'CLOSED'} />
            </div>
            {canManage && (
              <div className="flex items-center gap-2 border-t border-dashed border-border pt-3">
                <Button variant="ghost" size="sm" onClick={() => doAction('reset', 'Reset')} disabled={busy !== null} className="gap-1.5 text-destructive">
                  <RotateCcw className="h-4 w-4" /> Reset to draft
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Registered Voters" value={stats?.turnout?.totalVoters ?? '—'} />
        <StatCard icon={CheckCircle2} label="Votes Cast" value={stats?.turnout?.voted ?? '—'} accent />
        <StatCard icon={Trophy} label="Candidates" value={stats?.candidates ?? '—'} />
        <StatCard icon={Building2} label="Positions" value={stats?.positions ?? '—'} />
      </div>

      {/* Turnout by faculty chart */}
      <TurnoutByFacultyChart />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="font-display text-base flex items-center gap-2"><Download className="h-4 w-4" /> Export Results</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => window.open(api.exportResults('csv'))} className="gap-1.5"><Download className="h-4 w-4" /> CSV</Button>
            <Button variant="outline" size="sm" onClick={() => window.open(api.exportResults('json'))} className="gap-1.5"><Download className="h-4 w-4" /> JSON</Button>
            <p className="w-full text-xs text-muted-foreground">Export reflects the current live tally.</p>
          </CardContent>
        </Card>
        {canManage && (
          <Card>
            <CardHeader><CardTitle className="font-display text-base flex items-center gap-2"><Bell className="h-4 w-4" /> Broadcast Notification</CardTitle></CardHeader>
            <CardContent>
              <p className="mb-3 text-xs text-muted-foreground">Send an in-app notification to all registered voters.</p>
              <Button onClick={() => setBroadcastOpen(true)} className="gap-1.5"><Bell className="h-4 w-4" /> Compose Broadcast</Button>
            </CardContent>
          </Card>
        )}
      </div>

      <SystemHealthWidget />

      <BroadcastDialog open={broadcastOpen} onOpenChange={setBroadcastOpen} />
    </div>
  )
}

function SystemHealthWidget() {
  const [health, setHealth] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  async function load() {
    try { const d = await api.adminGetHealth(); setHealth(d) } catch {} finally { setLoading(false) }
  }
  useEffect(() => {
    load()
    const t = setInterval(load, 15000)
    return () => clearInterval(t)
  }, [])
  if (loading) return <Card><CardContent className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></CardContent></Card>
  if (!health) return null
  const statusIcon = (s: string) => s === 'healthy' ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : s === 'degraded' ? <AlertCircle className="h-4 w-4 text-amber-600" /> : <AlertCircle className="h-4 w-4 text-destructive" />
  const statusCls = (s: string) => s === 'healthy' ? 'text-emerald-600' : s === 'degraded' ? 'text-amber-600' : 'text-destructive'
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="font-display text-base flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /> System Health</CardTitle>
          <Badge className={cn('gap-1', health.overall === 'healthy' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
            <span className={cn('h-1.5 w-1.5 rounded-full', health.overall === 'healthy' ? 'bg-emerald-500' : 'bg-amber-500')} />
            {health.overall.toUpperCase()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2">
          {health.checks.map((c: any) => (
            <div key={c.name} className="flex items-center gap-2 rounded-lg border border-border/60 p-2.5">
              {statusIcon(c.status)}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{c.name}</div>
                <div className="text-xs text-muted-foreground">{c.detail}</div>
              </div>
              <span className={cn('text-xs font-semibold capitalize', statusCls(c.status))}>{c.status}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/60 pt-3 text-center text-xs">
          <div><div className="font-bold text-foreground">{health.counts.voters}</div><div className="text-muted-foreground">Voters</div></div>
          <div><div className="font-bold text-foreground">{health.counts.votes}</div><div className="text-muted-foreground">Votes</div></div>
          <div><div className="font-bold text-foreground">{health.counts.auditLogs}</div><div className="text-muted-foreground">Audit Logs</div></div>
        </div>
        <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Uptime: {Math.floor(health.uptime / 60)}m {Math.floor(health.uptime % 60)}s</span>
          {health.memory && <span>Memory: {health.memory.usedMb} MB</span>}
          <span>Updated: {new Date(health.timestamp).toLocaleTimeString()}</span>
        </div>
      </CardContent>
    </Card>
  )
}

// Voter activity monitoring tab — real-time feed of login/verify/accredit/vote events
// Student data collation — dept collects → faculty reviews → committee uploads
function CollationTab({ role }: { role: string }) {
  const term = useTerminology()
  const [collations, setCollations] = useState<any[]>([])
  const [faculties, setFaculties] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [submitOpen, setSubmitOpen] = useState(false)
  const [collationText, setCollationText] = useState('')
  const [selectedFaculty, setSelectedFaculty] = useState('')
  const [selectedDept, setSelectedDept] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const [c, f] = await Promise.all([api.adminGetCollations(), api.getFaculties()])
      setCollations(c.collations); setFaculties(f.faculties)
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  async function submitCollation() {
    const lines = collationText.split('\n').map((l) => l.trim()).filter(Boolean)
    const students = lines.map((line) => {
      const p = line.split(',').map((x) => x.trim())
      return { voterId: p[0], fullName: p[1], email: p[2], phone: p[3], facultyCode: p[4], departmentCode: p[5], level: p[6] || '100' }
    }).filter((s) => s.voterId && s.fullName)
    if (students.length === 0) { toast.error('No valid voter data'); return }
    setBusy(true)
    try {
      const fac = faculties.find((f) => f.id === selectedFaculty)
      const dep = fac?.departments?.find((d) => d.id === selectedDept)
      await api.adminSubmitCollation({
        facultyId: selectedFaculty || undefined,
        departmentId: selectedDept || undefined,
        students: students.map((s) => ({ ...s, facultyCode: s.facultyCode || fac?.code, departmentCode: s.departmentCode || dep?.code })),
      })
      toast.success(`${students.length} students submitted for collation`)
      setSubmitOpen(false); setCollationText(''); load()
    } catch (e: any) { toast.error(e.message) } finally { setBusy(false) }
  }

  async function updateCollation(id: string, action: string) {
    try {
      const d = await api.adminUpdateCollation(id, action)
      toast.success(`Collation ${action.toLowerCase().replace(/_/g, ' ')}`)
      if (d.imported !== undefined) toast.success(`${d.imported} voters imported`)
      load()
    } catch (e: any) { toast.error(e.message) }
  }

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      PENDING: 'bg-amber-100 text-amber-700', FACULTY_APPROVED: 'bg-blue-100 text-blue-700',
      COMMITTEE_APPROVED: 'bg-emerald-100 text-emerald-700', REJECTED: 'bg-red-100 text-red-700', UPLOADED: 'bg-primary/10 text-primary',
    }
    return <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', map[s] || 'bg-muted')}>{s.replace(/_/g, ' ')}</span>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Officers collect voter data → Committee reviews → Electoral Committee uploads as voters</p>
        </div>
        <Button onClick={() => setSubmitOpen(true)} className="gap-1.5"><Upload className="h-4 w-4" /> Submit Voter Data</Button>
      </div>

      <Card><CardContent className="p-0">
        <div className="votewise-scroll max-h-[60vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur"><tr className="text-left">
              <th className="p-3 font-medium">Source</th><th className="p-3 font-medium">Voters</th>
              <th className="p-3 font-medium">Submitted By</th><th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium">Date</th><th className="p-3 text-right font-medium">Actions</th>
            </tr></thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>}
              {!loading && collations.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No collation submissions yet.</td></tr>}
              {collations.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="p-3">
                    <div className="font-medium">{c.department?.name || c.faculty?.name || 'General'}</div>
                    {c.faculty?.name && <div className="text-xs text-muted-foreground">{c.faculty.name}</div>}
                  </td>
                  <td className="p-3 font-mono font-bold">{c.studentCount}</td>
                  <td className="p-3"><div className="text-xs">{c.submittedByName}</div><div className="text-[10px] text-muted-foreground">{c.submittedByRole.replace(/_/g, ' ')}</div></td>
                  <td className="p-3">{statusBadge(c.status)}{c.importedCount > 0 && <div className="text-[10px] text-emerald-600">{c.importedCount} imported</div>}</td>
                  <td className="p-3 text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleDateString()}</td>
                  <td className="p-3 text-right">
                    {c.status === 'PENDING' && <Button size="sm" variant="ghost" onClick={() => updateCollation(c.id, 'APPROVE_FACULTY')} className="text-xs text-blue-600">{term.workspaceLabel} Approve</Button>}
                    {c.status === 'FACULTY_APPROVED' && <Button size="sm" variant="ghost" onClick={() => updateCollation(c.id, 'APPROVE_COMMITTEE')} className="text-xs text-emerald-600">Committee Approve</Button>}
                    {c.status === 'COMMITTEE_APPROVED' && <Button size="sm" variant="ghost" onClick={() => updateCollation(c.id, 'UPLOAD')} className="text-xs text-primary">Upload as Voters</Button>}
                    {(c.status === 'PENDING' || c.status === 'FACULTY_APPROVED') && <Button size="sm" variant="ghost" onClick={() => updateCollation(c.id, 'REJECT')} className="text-xs text-destructive">Reject</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent></Card>

      {/* Submit dialog */}
      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Upload className="h-5 w-5 text-primary" /> Submit Voter Data</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Paste voter data (one per line, comma-separated). Voter groups collate voter data before submission to the electoral committee.</p>
            <pre className="rounded bg-muted p-3 text-xs">voterId,fullName,email,phone,facultyCode,departmentCode,level</pre>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>{term.workspaceLabel} (optional)</Label>
                <Select value={selectedFaculty} onValueChange={(v) => { setSelectedFaculty(v); setSelectedDept('') }}>
                  <SelectTrigger><SelectValue placeholder="Auto-detect from data" /></SelectTrigger>
                  <SelectContent>{faculties.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>{term.voterGroupLabel} (optional)</Label>
                <Select value={selectedDept} onValueChange={setSelectedDept}>
                  <SelectTrigger><SelectValue placeholder="Auto-detect from data" /></SelectTrigger>
                  <SelectContent>{faculties.find((f: any) => f.id === selectedFaculty)?.departments.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>) || []}</SelectContent>
                </Select>
              </div>
            </div>
            <Textarea rows={8} value={collationText} onChange={(e) => setCollationText(e.target.value)} placeholder="CSC/2022/001,Demo One,demo1@votewise.com.ng,08030000001,SCI,CSC,300" className="font-mono text-xs" />
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setSubmitOpen(false)}>Cancel</Button><Button onClick={submitCollation} disabled={busy || !collationText.trim()} className="gap-1.5">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Submit</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ActivityTab() {
  const [logs, setLogs] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  async function load() {
    try {
      const d = await api.adminGetActivity(filter !== 'all' ? `action=${filter}` : '')
      setLogs(d.logs); setSummary(d.summary)
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => {
    load()
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [filter])

  const actionIcon = (action: string) => {
    if (action === 'LOGIN') return <LogIn className="h-3.5 w-3.5 text-blue-600" />
    if (action === 'VERIFY_MATRIC') return <Search className="h-3.5 w-3.5 text-purple-600" />
    if (action === 'SEND_OTP') return <KeyRound className="h-3.5 w-3.5 text-amber-600" />
    if (action === 'VERIFY_OTP') return <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
    if (action === 'ACCREDIT') return <Fingerprint className="h-3.5 w-3.5 text-primary" />
    if (action === 'VOTE_CAST') return <Vote className="h-3.5 w-3.5 text-emerald-600" />
    if (action === 'FLAG') return <Flag className="h-3.5 w-3.5 text-destructive" />
    if (action === 'UNFLAG') return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
    if (action === 'OTP_RESEND_BY_ADMIN') return <KeyRound className="h-3.5 w-3.5 text-amber-600" />
    return <Activity className="h-3.5 w-3.5 text-muted-foreground" />
  }

  const actionLabel = (action: string) => {
    const map: Record<string, string> = {
      LOGIN: 'Logged in', VERIFY_MATRIC: 'Verified voterId', SEND_OTP: 'Requested OTP',
      VERIFY_OTP: 'OTP verified', ACCREDIT: 'Accredited', VOTE_CAST: 'Cast vote',
      FLAG: 'Flagged', UNFLAG: 'Unflagged', OTP_RESEND_BY_ADMIN: 'Admin resent OTP',
      CHAT_MESSAGE: 'Sent chat message', LOGOUT: 'Logged out',
    }
    return map[action] || action
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-7">
          {[
            { label: 'Logins', value: summary.login, cls: 'bg-blue-100 text-blue-700' },
            { label: 'Voter ID', value: summary.verify_voterId, cls: 'bg-purple-100 text-purple-700' },
            { label: 'OTPs', value: summary.send_otp, cls: 'bg-amber-100 text-amber-700' },
            { label: 'Verified', value: summary.verify_otp, cls: 'bg-emerald-100 text-emerald-700' },
            { label: 'Accredited', value: summary.accredit, cls: 'bg-primary/10 text-primary' },
            { label: 'Voted', value: summary.vote_cast, cls: 'bg-emerald-100 text-emerald-700' },
            { label: 'Flagged', value: summary.flagged, cls: 'bg-red-100 text-red-700' },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-3 text-center">
                <div className={cn('mx-auto grid h-8 w-8 place-items-center rounded-full text-xs font-bold', s.cls)}>{s.value}</div>
                <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Select value={filter} onValueChange={(v) => { setFilter(v); setLoading(true) }}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="LOGIN">Logins</SelectItem>
            <SelectItem value="VERIFY_MATRIC">Voter ID Verifications</SelectItem>
            <SelectItem value="SEND_OTP">OTP Requests</SelectItem>
            <SelectItem value="VERIFY_OTP">OTP Verifications</SelectItem>
            <SelectItem value="ACCREDIT">Accreditations</SelectItem>
            <SelectItem value="VOTE_CAST">Votes Cast</SelectItem>
            <SelectItem value="FLAG">Flags</SelectItem>
            <SelectItem value="OTP_RESEND_BY_ADMIN">Admin OTP Resends</SelectItem>
          </SelectContent>
        </Select>
        <Badge className="votewise-live-dot gap-1 bg-emerald-100 text-emerald-700"><span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live</Badge>
      </div>

      {/* Activity feed */}
      <Card><CardContent className="p-0">
        <div className="votewise-scroll max-h-[60vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur"><tr className="text-left">
              <th className="p-3 font-medium">Time</th>
              <th className="p-3 font-medium">Voter</th>
              <th className="p-3 font-medium">Action</th>
              <th className="hidden p-3 font-medium md:table-cell">IP / Device</th>
              <th className="hidden p-3 font-medium sm:table-cell">By</th>
            </tr></thead>
            <tbody>
              {loading && <tr><td colSpan={5} className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>}
              {!loading && logs.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No activity recorded yet.</td></tr>}
              {logs.map((l) => (
                <tr key={l.id} className="border-t border-border hover:bg-muted/30">
                  <td className="p-3 font-mono text-xs text-muted-foreground">{new Date(l.createdAt).toLocaleTimeString()}</td>
                  <td className="p-3">
                    {l.voter ? (
                      <div>
                        <div className="font-medium">{l.voter.fullName}</div>
                        <div className="font-mono text-xs text-muted-foreground">{l.voter.voterId}</div>
                        {l.voter.flagged && <Badge className="mt-0.5 bg-red-100 text-red-700 text-[9px]">Flagged</Badge>}
                      </div>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="p-3">
                    <span className="flex items-center gap-1.5 text-xs">
                      {actionIcon(l.action)} {actionLabel(l.action)}
                    </span>
                  </td>
                  <td className="hidden p-3 text-xs text-muted-foreground md:table-cell">{l.ipAddress || '—'} {l.deviceLabel && <span className="block text-[10px]">{l.deviceLabel.slice(0, 30)}</span>}</td>
                  <td className="hidden p-3 text-xs text-muted-foreground sm:table-cell">{l.actionBy?.name || 'Voter'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent></Card>
    </div>
  )
}

function TurnoutByFacultyChart() {
  const term = useTerminology()
  const [data, setData] = useState<any>(null)
  useEffect(() => {
    api.observerAnalytics().then((d) => setData(d)).catch(() => {})
    const t = setInterval(() => api.observerAnalytics().then((d) => setData(d)).catch(() => {}), 10000)
    return () => clearInterval(t)
  }, [])
  if (!data) return <Card><CardContent className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></CardContent></Card>
  const max = Math.max(1, ...data.byFaculty.map((f: any) => f.total))
  return (
    <Card>
      <CardHeader><CardTitle className="font-display text-base flex items-center gap-2"><Building2 className="h-4 w-4" /> Turnout by {term.workspaceLabel}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {data.byFaculty.map((f: any) => (
          <div key={f.id} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="truncate">{f.name}</span>
              <span className="font-mono text-xs">{f.voted}/{f.total} <span className="text-muted-foreground">({f.pct}%)</span></span>
            </div>
            <div className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-muted">
              <div className="votewise-bar-anim rounded-l-full bg-primary transition-all" style={{ width: `${(f.voted / max) * 100}%` }} />
              <div className="votewise-bar-anim rounded-r-full bg-muted-foreground/30 transition-all" style={{ width: `${((f.total - f.voted) / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function BroadcastDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const term = useTerminology()
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [type, setType] = useState('INFO')
  const [facultyId, setFacultyId] = useState('')
  const [faculties, setFaculties] = useState<any[]>([])
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<any>(null)
  useEffect(() => { api.getFaculties().then((d) => setFaculties(d.faculties)).catch(() => {}) }, [])
  async function send() {
    setBusy(true)
    try {
      const d = await api.adminBroadcastNotification({ title, message, type, facultyId: facultyId || undefined })
      setResult(d); toast.success(`Notification sent to ${d.recipients} voters`)
    } catch (e: any) { toast.error(e.message) } finally { setBusy(false) }
  }
  function close() { onOpenChange(false); setTitle(''); setMessage(''); setType('INFO'); setFacultyId(''); setResult(null) }
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close(); else onOpenChange(o) }}>
      <DialogContent>
        <DialogHeader><DialogTitle className="flex items-center gap-2 font-display"><Bell className="h-5 w-5 text-primary" /> Broadcast Notification</DialogTitle></DialogHeader>
        {result ? (
          <div className="py-6 text-center">
            <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" />
            <p className="mt-3 font-semibold">Notification delivered</p>
            <p className="mt-1 text-sm text-muted-foreground">Sent to {result.recipients} voters.</p>
            <Button className="mt-4" onClick={close}>Done</Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Voting closes in 2 hours" /></div>
            <div className="space-y-1.5"><Label>Message</Label><Textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Detailed message to voters…" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="INFO">Info</SelectItem><SelectItem value="SUCCESS">Success</SelectItem><SelectItem value="WARNING">Warning</SelectItem><SelectItem value="SECURITY">Security</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Audience</Label>
                <Select value={facultyId || 'all'} onValueChange={(v) => setFacultyId(v === 'all' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder={`All ${term.workspaceLabel.toLowerCase()}s`} /></SelectTrigger>
                  <SelectContent><SelectItem value="all">All {term.workspaceLabel.toLowerCase()}s</SelectItem>{faculties.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}
        {!result && (
          <DialogFooter><Button variant="outline" onClick={close}>Cancel</Button><Button onClick={send} disabled={busy || !title || !message} className="gap-1.5">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />} Send</Button></DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

function LifecycleBtn({ action, label, icon: Icon, current, busy, onClick, disabled }: any) {
  const targetStatus = action === 'publish' ? 'PUBLISHED' : action.toUpperCase()
  const isCurrent = current === targetStatus
  return (
    <Button variant={isCurrent ? 'default' : 'outline'} onClick={() => onClick(action, label)} disabled={disabled || busy !== null} className="gap-1.5">
      {busy === action ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />} {label}
    </Button>
  )
}

function StatCard({ icon: Icon, label, value, accent }: any) {
  return (
    <Card><CardContent className="flex items-center gap-3 py-4">
      <div className={cn('grid h-11 w-11 place-items-center rounded-xl', accent ? 'bg-accent/20 text-accent-foreground' : 'bg-primary/10 text-primary')}><Icon className="h-5 w-5" /></div>
      <div><div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div><div className="font-display text-xl font-bold">{value}</div></div>
    </CardContent></Card>
  )
}

// Reuse the v1 CandidatesTab, VotersTab, PositionsTab, OfficialsTab, SettingsTab, AuditTab
// (they call the same api.* methods, which now use cookie auth).
function CandidatesTab() {
  const [candidates, setCandidates] = useState<any[]>([])
  const [positions, setPositions] = useState<any[]>([])
  const [faculties, setFaculties] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<any | null>(null)
  const [open, setOpen] = useState(false)
  const [screenFilter, setScreenFilter] = useState('all')
  const [screeningCandidate, setScreeningCandidate] = useState<any | null>(null)
  const [screeningOpen, setScreeningOpen] = useState(false)
  const [screeningNotes, setScreeningNotes] = useState('')
  const [screeningStatus, setScreeningStatus] = useState('APPROVED')

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
      setOpen(false); setEditing(null); toast.success(editing?.id ? 'Candidate updated' : 'Candidate created'); load()
    } catch (e: any) { toast.error(e.message) }
  }
  async function remove(id: string) {
    if (!confirm('Delete this candidate? This action is logged.')) return
    try { await api.adminDeleteCandidate(id); toast.success('Deleted'); load() } catch (e: any) { toast.error(e.message) }
  }

  // Quick screening actions
  async function quickScreen(id: string, status: string) {
    try {
      await api.adminUpdateCandidate(id, { screeningStatus: status, status: status === 'APPROVED' ? 'APPROVED' : status === 'DISQUALIFIED' ? 'DISQUALIFIED' : 'WITHDRAWN' })
      toast.success(`Candidate ${status.toLowerCase()}`)
      load()
    } catch (e: any) { toast.error(e.message) }
  }

  function openScreeningDialog(c: any) {
    setScreeningCandidate(c)
    setScreeningNotes(c.screeningNotes || '')
    setScreeningStatus(c.screeningStatus || 'APPROVED')
    setScreeningOpen(true)
  }

  async function submitScreening() {
    if (!screeningCandidate) return
    try {
      await api.adminUpdateCandidate(screeningCandidate.id, {
        screeningStatus,
        screeningNotes,
        status: screeningStatus === 'APPROVED' ? 'APPROVED' : screeningStatus === 'DISQUALIFIED' ? 'DISQUALIFIED' : 'WITHDRAWN',
      })
      toast.success(`Screening updated: ${screeningStatus}`)
      setScreeningOpen(false); setScreeningCandidate(null)
      load()
    } catch (e: any) { toast.error(e.message) }
  }

  // Filter candidates by screening status
  const filteredCandidates = screenFilter === 'all' ? candidates : candidates.filter((c) => c.screeningStatus === screenFilter)
  const screenCounts = {
    pending: candidates.filter((c) => c.screeningStatus === 'PENDING').length,
    approved: candidates.filter((c) => c.screeningStatus === 'APPROVED').length,
    disqualified: candidates.filter((c) => c.screeningStatus === 'DISQUALIFIED').length,
    withdrawn: candidates.filter((c) => c.screeningStatus === 'WITHDRAWN').length,
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Select value={screenFilter} onValueChange={setScreenFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ({candidates.length})</SelectItem>
              <SelectItem value="PENDING">Pending ({screenCounts.pending})</SelectItem>
              <SelectItem value="APPROVED">Approved ({screenCounts.approved})</SelectItem>
              <SelectItem value="DISQUALIFIED">Disqualified ({screenCounts.disqualified})</SelectItem>
              <SelectItem value="WITHDRAWN">Withdrawn ({screenCounts.withdrawn})</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => { setEditing({}); setOpen(true) }} className="gap-1.5"><Plus className="h-4 w-4" /> Add Candidate</Button>
      </div>
      <Card><CardContent className="p-0">
        <div className="votewise-scroll max-h-[60vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur"><tr className="text-left">
              <th className="p-3 font-medium">Candidate</th><th className="p-3 font-medium">Position</th>
              <th className="hidden p-3 font-medium md:table-cell">Screening</th><th className="p-3 text-right font-medium">Actions</th>
            </tr></thead>
            <tbody>
              {loading && <tr><td colSpan={4} className="p-8 text-center text-muted-foreground"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>}
              {!loading && filteredCandidates.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No candidates match this filter.</td></tr>}
              {filteredCandidates.map((c) => (
                <tr key={c.id} className="border-t border-border hover:bg-muted/30">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="min-w-0">
                        <div className="font-medium">{c.fullName}</div>
                        <div className="truncate text-xs text-muted-foreground">{c.slogan}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3"><Badge variant="outline" className="text-[10px]">{c.position?.title}</Badge></td>
                  <td className="hidden p-3 md:table-cell"><ScreenBadge status={c.screeningStatus} /></td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {c.screeningStatus !== 'APPROVED' && (
                        <Button size="sm" variant="ghost" onClick={() => quickScreen(c.id, 'APPROVED')} className="h-7 gap-1 text-xs text-emerald-600 hover:bg-emerald-50">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                        </Button>
                      )}
                      {c.screeningStatus !== 'DISQUALIFIED' && (
                        <Button size="sm" variant="ghost" onClick={() => quickScreen(c.id, 'DISQUALIFIED')} className="h-7 gap-1 text-xs text-destructive hover:bg-destructive/5">
                          <AlertCircle className="h-3.5 w-3.5" /> Reject
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => openScreeningDialog(c)} title="Screening details"><FileCheck2 className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(c); setOpen(true) }}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent></Card>
      <CandidateDialog open={open} onOpenChange={setOpen} candidate={editing} positions={positions} faculties={faculties} onSave={save} />

      {/* Screening dialog */}
      <Dialog open={screeningOpen} onOpenChange={setScreeningOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><FileCheck2 className="h-5 w-5 text-primary" /> Candidate Screening</DialogTitle></DialogHeader>
          {screeningCandidate && (
            <div className="space-y-3">
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="font-medium">{screeningCandidate.fullName}</div>
                <div className="text-xs text-muted-foreground">{screeningCandidate.position?.title}</div>
                {screeningCandidate.cgpa && <div className="mt-1 text-xs">CGPA: <span className="font-mono font-semibold">{screeningCandidate.cgpa.toFixed(2)}</span></div>}
              </div>
              <div className="space-y-1.5">
                <Label>Screening Decision</Label>
                <Select value={screeningStatus} onValueChange={setScreeningStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="APPROVED">Approved</SelectItem>
                    <SelectItem value="DISQUALIFIED">Disqualified</SelectItem>
                    <SelectItem value="WITHDRAWN">Withdrawn</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Screening Notes</Label>
                <Textarea rows={4} value={screeningNotes} onChange={(e) => setScreeningNotes(e.target.value)} placeholder="e.g. Credentials verified, CGPA confirmed above 3.5 threshold. No disciplinary record found." />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setScreeningOpen(false)}>Cancel</Button>
            <Button onClick={submitScreening} className="gap-1.5"><CheckCircle2 className="h-4 w-4" /> Save Screening</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ScreenBadge({ status }: { status: string }) {
  const map: Record<string, string> = { PENDING: 'bg-amber-100 text-amber-700', APPROVED: 'bg-emerald-100 text-emerald-700', DISQUALIFIED: 'bg-red-100 text-red-700', WITHDRAWN: 'bg-muted' }
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
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto votewise-scroll">
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
            <div className="space-y-1.5"><Label>Screening</Label>
              <Select value={form.screeningStatus || 'PENDING'} onValueChange={(v) => set('screeningStatus', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="PENDING">Pending</SelectItem><SelectItem value="APPROVED">Approved</SelectItem><SelectItem value="DISQUALIFIED">Disqualified</SelectItem><SelectItem value="WITHDRAWN">Withdrawn</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Level</Label><Input value={form.level || ''} onChange={(e) => set('level', e.target.value)} placeholder="e.g. 400" /></div>
            <div className="space-y-1.5"><Label>Photo URL</Label><Input value={form.photoUrl || ''} onChange={(e) => set('photoUrl', e.target.value)} placeholder="/candidates/c1.jpg" /></div>
          </div>
          <div className="space-y-1.5"><Label>Slogan</Label><Input value={form.slogan || ''} onChange={(e) => set('slogan', e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Manifesto</Label><Textarea rows={4} value={form.manifesto || ''} onChange={(e) => set('manifesto', e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Campaign Video URL (optional)</Label><Input value={form.campaignVideoUrl || ''} onChange={(e) => set('campaignVideoUrl', e.target.value)} placeholder="https://youtube.com/..." /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={() => onSave(form)} className="gap-1.5"><CheckCircle2 className="h-4 w-4" /> Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PositionsTab() {
  const term = useTerminology()
  const [positions, setPositions] = useState<any[]>([])
  const [faculties, setFaculties] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<any>({ scope: 'UNIVERSITY' })

  async function load() {
    setLoading(true)
    try { const [p, f] = await Promise.all([api.adminGetPositions(), api.getFaculties()]); setPositions(p.positions); setFaculties(f.faculties) } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  async function create() {
    try { await api.adminCreatePosition(form); setOpen(false); setForm({ scope: 'UNIVERSITY' }); toast.success('Position created'); load() } catch (e: any) { toast.error(e.message) }
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
          <Card key={p.id}><CardContent className="p-4">
            <div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">{p.order}</span><h4 className="font-display font-semibold">{p.title}</h4></div>
            <div className="mt-1.5 flex items-center gap-2"><Badge variant="outline" className="text-[10px]">{scopeLabel(p.scope, term)}</Badge>{p.faculty && <span className="text-xs text-muted-foreground">{p.faculty.name}</span>}{p.department && <span className="text-xs text-muted-foreground">{p.department.name}</span>}</div>
            <p className="mt-1 text-xs text-muted-foreground">{p._count?.candidates || 0} candidates</p>
          </CardContent></Card>
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
                  <SelectContent><SelectItem value="UNIVERSITY">{term.organizationLabel}-wide</SelectItem><SelectItem value="FACULTY">{term.workspaceLabel}</SelectItem><SelectItem value="DEPARTMENT">{term.voterGroupLabel}</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Order</Label><Input type="number" value={form.order || ''} onChange={(e) => setForm((f: any) => ({ ...f, order: parseInt(e.target.value) || 0 }))} /></div>
            </div>
            {form.scope === 'FACULTY' && (
              <div className="space-y-1.5"><Label>{term.workspaceLabel}</Label>
                <Select value={form.facultyId} onValueChange={(v) => setForm((f: any) => ({ ...f, facultyId: v }))}>
                  <SelectTrigger><SelectValue placeholder={`Select ${term.workspaceLabel.toLowerCase()}`} /></SelectTrigger>
                  <SelectContent>{faculties.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {form.scope === 'DEPARTMENT' && (
              <div className="space-y-1.5"><Label>{term.workspaceLabel} (for {term.voterGroupLabel.toLowerCase()})</Label>
                <Select value={form.facultyId} onValueChange={(v) => setForm((f: any) => ({ ...f, facultyId: v, departmentId: undefined }))}>
                  <SelectTrigger><SelectValue placeholder={`Select ${term.workspaceLabel.toLowerCase()}`} /></SelectTrigger>
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

function VotersTab({ role, official }: { role: string; official: any }) {
  const term = useTerminology()
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
  const [detailVoter, setDetailVoter] = useState<any | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const scoped = role === 'FACULTY_OFFICER' || role === 'DEPARTMENT_OFFICER'

  async function load() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '50' })
      if (q) params.set('q', q); if (status) params.set('status', status)
      const d = await api.adminGetVoters(params.toString()); setVoters(d.voters); setTotal(d.total)
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { api.getFaculties().then((f) => setFaculties(f.faculties)); load() }, [page, status])
  useEffect(() => { const t = setTimeout(load, 400); return () => clearTimeout(t) }, [q])

  async function create() {
    try { await api.adminCreateVoter(form); setOpen(false); setForm({ level: '100' }); toast.success('Voter added'); load() } catch (e: any) { toast.error(e.message) }
  }

  // Flag/unflag voter
  const [flagVoter, setFlagVoter] = useState<any | null>(null)
  const [flagOpen, setFlagOpen] = useState(false)
  const [flagReason, setFlagReason] = useState('')
  async function onFlag(v: any) {
    if (v.flagged) {
      // Unflag directly
      try { await api.adminFlagVoter(v.id, false); toast.success('Voter unflagged'); load() } catch (e: any) { toast.error(e.message) }
    } else {
      setFlagVoter(v); setFlagReason(''); setFlagOpen(true)
    }
  }
  async function submitFlag() {
    if (!flagVoter) return
    try { await api.adminFlagVoter(flagVoter.id, true, flagReason); toast.success('Voter flagged — their vote will not count'); setFlagOpen(false); load() } catch (e: any) { toast.error(e.message) }
  }

  // Resend OTP
  const [otpVoter, setOtpVoter] = useState<any | null>(null)
  const [otpOpen, setOtpOpen] = useState(false)
  const [otpChannel, setOtpChannel] = useState('EMAIL')
  const [otpResult, setOtpResult] = useState<any>(null)
  async function onResendOtp(v: any) {
    setOtpVoter(v); setOtpChannel('EMAIL'); setOtpResult(null); setOtpOpen(true)
  }
  async function submitResendOtp() {
    if (!otpVoter) return
    try { const d = await api.adminResendOtp(otpVoter.id, otpChannel); setOtpResult(d); toast.success('OTP resent') } catch (e: any) { toast.error(e.message) }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-xs"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder={`Search ${term.voterIdLabel.toLowerCase()}, name, email…`} value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} className="pl-8" /></div>
          <Select value={status || 'all'} onValueChange={(v) => { setStatus(v === 'all' ? '' : v); setPage(1) }}>
            <SelectTrigger className="w-32"><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="voted">Voted</SelectItem><SelectItem value="pending">Pending</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)} className="gap-1.5"><Upload className="h-4 w-4" /> Bulk Import</Button>
          <Button onClick={() => setOpen(true)} className="gap-1.5"><Plus className="h-4 w-4" /> Add Voter</Button>
        </div>
      </div>
      {scoped && <Alert><AlertDescription>You are viewing voters within your {role === 'FACULTY_OFFICER' ? term.workspaceLabel.toLowerCase() : term.voterGroupLabel.toLowerCase()} scope only.</AlertDescription></Alert>}
      <Card><CardContent className="p-0">
        <div className="votewise-scroll max-h-[60vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur"><tr className="text-left"><th className="p-3 font-medium">Voter</th><th className="hidden p-3 font-medium md:table-cell">{term.workspaceLabel} / {term.voterGroupLabel}</th><th className="hidden p-3 font-medium sm:table-cell">Level</th><th className="p-3 font-medium">Status</th><th className="p-3 text-right font-medium">Actions</th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={5} className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>}
              {!loading && voters.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No voters found.</td></tr>}
              {voters.map((v) => (
                <tr key={v.id} className={cn('cursor-pointer border-t border-border hover:bg-muted/30', v.flagged && 'bg-red-50 dark:bg-red-950/20')} onClick={() => { setDetailVoter(v); setDetailOpen(true) }}>
                  <td className="p-3">
                    <div className="flex items-center gap-1.5">
                      {v.flagged && <Flag className="h-3.5 w-3.5 text-destructive" />}
                      <div className="font-medium">{v.fullName}</div>
                    </div>
                    <div className="font-mono text-xs text-muted-foreground">{v.voterId}</div>
                  </td>
                  <td className="hidden p-3 text-xs md:table-cell"><div>{v.faculty?.name}</div><div className="text-muted-foreground">{v.department?.name}</div></td>
                  <td className="hidden p-3 sm:table-cell">{v.level}</td>
                  <td className="p-3">
                    {v.flagged ? <Badge className="bg-red-100 text-red-700">Flagged</Badge> :
                     v.hasVoted ? <Badge className="bg-emerald-100 text-emerald-700">Voted</Badge> :
                     <Badge variant="secondary">Pending</Badge>}
                  </td>
                  <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      {!v.hasVoted && (
                        <Button size="sm" variant="ghost" onClick={() => onResendOtp(v)} title="Resend OTP" className="h-7 gap-1 text-xs">
                          <KeyRound className="h-3.5 w-3.5" /> OTP
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => onFlag(v)} title={v.flagged ? 'Unflag' : 'Flag voter'} className={cn('h-7 gap-1 text-xs', v.flagged ? 'text-emerald-600' : 'text-destructive')}>
                        <Flag className="h-3.5 w-3.5" /> {v.flagged ? 'Unflag' : 'Flag'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent></Card>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{total} voters · page {page}</span>
        <div className="flex gap-2"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button><Button size="sm" variant="outline" disabled={voters.length < 50} onClick={() => setPage((p) => p + 1)}>Next</Button></div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Voter</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label>Voter ID</Label><Input value={form.voterId || ''} onChange={(e) => setForm((f: any) => ({ ...f, voterId: e.target.value.toUpperCase() }))} /></div><div className="space-y-1.5"><Label>Full Name</Label><Input value={form.fullName || ''} onChange={(e) => setForm((f: any) => ({ ...f, fullName: e.target.value }))} /></div></div>
            <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label>Email</Label><Input value={form.institutionEmail || ''} onChange={(e) => setForm((f: any) => ({ ...f, institutionEmail: e.target.value }))} /></div><div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone || ''} onChange={(e) => setForm((f: any) => ({ ...f, phone: e.target.value }))} /></div></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>{term.workspaceLabel}</Label><Select value={form.facultyId} onValueChange={(v) => setForm((f: any) => ({ ...f, facultyId: v, departmentId: undefined }))}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{faculties.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1.5"><Label>{term.voterGroupLabel}</Label><Select value={form.departmentId} onValueChange={(v) => setForm((f: any) => ({ ...f, departmentId: v }))}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{faculties.find((f: any) => f.id === form.facultyId)?.departments.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>) || []}</SelectContent></Select></div>
            </div>
            <div className="space-y-1.5"><Label>Level</Label><Input value={form.level || ''} onChange={(e) => setForm((f: any) => ({ ...f, level: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={create} className="gap-1.5"><Plus className="h-4 w-4" /> Add</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <VoterImportDialog open={importOpen} onOpenChange={setImportOpen} onDone={load} />
      <VoterDetailDrawer voter={detailVoter} open={detailOpen} onOpenChange={setDetailOpen} />

      {/* Flag dialog */}
      <Dialog open={flagOpen} onOpenChange={setFlagOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Flag className="h-5 w-5 text-destructive" /> Flag Voter</DialogTitle></DialogHeader>
          {flagVoter && (
            <div className="space-y-3">
              <div className="rounded-lg bg-destructive/5 p-3 text-sm">
                <div className="font-medium">{flagVoter.fullName}</div>
                <div className="font-mono text-xs text-muted-foreground">{flagVoter.voterId}</div>
                <p className="mt-2 text-xs text-destructive">Flagging this voter will prevent their vote from counting. This action is logged in the audit trail.</p>
              </div>
              <div className="space-y-1.5">
                <Label>Reason for flagging</Label>
                <Textarea rows={3} value={flagReason} onChange={(e) => setFlagReason(e.target.value)} placeholder="e.g. Suspicious login from multiple devices, reported impersonation, etc." />
              </div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setFlagOpen(false)}>Cancel</Button><Button onClick={submitFlag} className="gap-1.5 bg-destructive text-white hover:bg-destructive/90"><Flag className="h-4 w-4" /> Flag Voter</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resend OTP dialog */}
      <Dialog open={otpOpen} onOpenChange={setOtpOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" /> Resend OTP</DialogTitle></DialogHeader>
          {otpVoter && (
            <div className="space-y-3">
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <div className="font-medium">{otpVoter.fullName}</div>
                <div className="font-mono text-xs text-muted-foreground">{otpVoter.voterId}</div>
              </div>
              {!otpResult ? (
                <>
                  <div className="space-y-1.5">
                    <Label>Send via</Label>
                    <Select value={otpChannel} onValueChange={setOtpChannel}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="EMAIL">Email</SelectItem><SelectItem value="SMS">SMS</SelectItem><SelectItem value="WHATSAPP">WhatsApp</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-muted-foreground">This will generate a new OTP and send it to the voter's registered contact. The voter's account will also be unlocked if it was locked.</p>
                </>
              ) : (
                <Alert><CheckCircle2 className="h-4 w-4" /><AlertTitle>OTP Sent</AlertTitle><AlertDescription>OTP resent via {otpResult.channel} to {otpResult.maskedDestination}.{otpResult.devOtp && <span className="mt-1 block font-mono text-xs">Dev: {otpResult.devOtp}</span>}</AlertDescription></Alert>
              )}
            </div>
          )}
          <DialogFooter>
            {!otpResult ? <><Button variant="outline" onClick={() => setOtpOpen(false)}>Cancel</Button><Button onClick={submitResendOtp} className="gap-1.5"><KeyRound className="h-4 w-4" /> Send OTP</Button></> :
            <Button onClick={() => setOtpOpen(false)}>Done</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function VoterDetailDrawer({ voter, open, onOpenChange }: { voter: any; open: boolean; onOpenChange: (o: boolean) => void }) {
  const term = useTerminology()
  const [detail, setDetail] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!open) return
    if (!voter?.id) return
    let active = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    api.adminGetVoter(voter.id).then((d) => { if (active) setDetail(d.voter) }).catch(() => {}).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [open, voter?.id])
  const v = detail || voter
  if (!v) return null
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-hidden p-0">
        <DialogTitle className="sr-only">Voter Details — {v.fullName}</DialogTitle>
        {/* Header */}
        <div className="relative bg-gradient-to-br from-primary to-primary/80 p-6 text-primary-foreground">
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-primary-foreground/15 font-display text-xl font-bold">
              {v.fullName?.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-xl font-bold">{v.fullName}</h2>
              <p className="font-mono text-sm text-primary-foreground/85">{v.voterId}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {v.hasVoted ? <Badge className="bg-emerald-500/30 text-white">Voted</Badge> : <Badge className="bg-amber-500/30 text-white">Pending</Badge>}
                <Badge className="bg-white/20 text-white">{v.faculty?.name || v.faculty}</Badge>
                <Badge className="bg-white/20 text-white">{v.level} Level</Badge>
              </div>
            </div>
          </div>
        </div>
        {/* Body */}
        <div className="votewise-scroll max-h-[55vh] overflow-y-auto p-6">
          {loading ? (
            <div className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="space-y-4">
              {/* Contact info */}
              <div className="grid grid-cols-2 gap-3">
                <InfoCard label="Email" value={v.institutionEmail || '—'} />
                <InfoCard label="Personal Email" value={v.personalEmail || '—'} />
                <InfoCard label="Phone" value={v.phone || '—'} />
                <InfoCard label={term.voterGroupLabel} value={v.department?.name || v.department || '—'} />
              </div>
              {/* Vote info */}
              {v.hasVoted && (
                <div className="rounded-lg bg-emerald-50 p-3 dark:bg-emerald-950/30">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span className="font-medium text-emerald-800 dark:text-emerald-300">Vote cast at {v.votedAt ? new Date(v.votedAt).toLocaleString() : '—'}</span>
                  </div>
                </div>
              )}
              {/* Accreditation */}
              {v.accreditations && v.accreditations.length > 0 && (
                <div>
                  <h3 className="mb-2 flex items-center gap-1.5 font-display text-sm font-semibold"><Fingerprint className="h-4 w-4 text-primary" /> Accreditation</h3>
                  <div className="space-y-1">
                    {v.accreditations.map((a: any) => (
                      <div key={a.id} className="flex items-center justify-between rounded-lg border border-border/60 p-2 text-xs">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">{a.channel}</Badge>
                          <span className="text-muted-foreground">{a.deviceFingerprint?.slice(0, 16)}…</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{a.ipAddress}</span>
                          <Badge className="bg-emerald-100 text-emerald-700">{a.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Devices */}
              {v.devices && v.devices.length > 0 && (
                <div>
                  <h3 className="mb-2 flex items-center gap-1.5 font-display text-sm font-semibold"><Eye className="h-4 w-4 text-primary" /> Devices ({v.devices.length})</h3>
                  <div className="space-y-1">
                    {v.devices.map((d: any) => (
                      <div key={d.id} className="flex items-center justify-between rounded-lg border border-border/60 p-2 text-xs">
                        <div>
                          <div className="font-medium">{d.label}</div>
                          <div className="text-muted-foreground">{d.fingerprint.slice(0, 16)}… · {d.ipAddress}</div>
                        </div>
                        <div className="text-right">
                          {d.trusted && <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">Trusted</Badge>}
                          <div className="mt-0.5 text-[10px] text-muted-foreground">Last: {new Date(d.lastSeen).toLocaleDateString()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Support tickets */}
              {v.supportTickets && v.supportTickets.length > 0 && (
                <div>
                  <h3 className="mb-2 flex items-center gap-1.5 font-display text-sm font-semibold"><FileCheck2 className="h-4 w-4 text-primary" /> Support Tickets ({v.supportTickets.length})</h3>
                  <div className="space-y-1">
                    {v.supportTickets.map((t: any) => (
                      <div key={t.id} className="flex items-center justify-between rounded-lg border border-border/60 p-2 text-xs">
                        <span>{t.issueType.replace(/_/g, ' ')}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{new Date(t.createdAt).toLocaleDateString()}</span>
                          <Badge variant="outline" className="text-[10px]">{t.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Timestamps */}
              <div className="border-t border-border pt-3 text-xs text-muted-foreground">
                <div>Registered: {new Date(v.createdAt).toLocaleString()}</div>
                {v.verifiedAt && <div>Last verified: {new Date(v.verifiedAt).toLocaleString()}</div>}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="truncate text-sm font-medium">{value}</div>
    </div>
  )
}

function VoterImportDialog({ open, onOpenChange, onDone }: any) {
  const [text, setText] = useState('')
  const [result, setResult] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<any[] | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function parseCsv(csvText: string): any[] {
    const lines = csvText.split('\n').map((l) => l.trim()).filter(Boolean)
    // Skip header row if it looks like one
    const startIdx = lines[0]?.toLowerCase().includes('voterId') ? 1 : 0
    return lines.slice(startIdx).map((line) => {
      const p = line.split(',').map((x) => x.trim())
      return { voterId: p[0], fullName: p[1], institutionEmail: p[2], phone: p[3], facultyCode: p[4], departmentCode: p[5], level: p[6] || '100' }
    })
  }

  function parse() {
    return parseCsv(text)
  }

  function onFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const content = String(ev.target?.result || '')
      setText(content)
      const parsed = parseCsv(content)
      setPreview(parsed.slice(0, 5)) // preview first 5
      toast.info(`Loaded ${parsed.length} voters from ${file.name}`)
    }
    reader.readAsText(file)
  }

  async function doImport() {
    const voters = parse()
    if (voters.length === 0) { toast.error('No voters to import'); return }
    setBusy(true)
    try {
      const r = await api.adminImportVoters(voters)
      setResult(r); onDone()
      toast.success(`Imported ${r.created} new, ${r.updated} updated`)
    } catch (e: any) { toast.error(e.message) } finally { setBusy(false) }
  }

  function close() {
    onOpenChange(false); setText(''); setResult(null); setPreview(null)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close(); else onOpenChange(o) }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Upload className="h-5 w-5 text-primary" /> Bulk Import Voters</DialogTitle></DialogHeader>
        {result ? (
          <div className="py-6 text-center">
            <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" />
            <p className="mt-3 font-semibold">Import complete</p>
            <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
              <div className="rounded-lg bg-emerald-50 p-2"><div className="font-bold text-emerald-700">{result.created}</div><div className="text-xs text-muted-foreground">Created</div></div>
              <div className="rounded-lg bg-blue-50 p-2"><div className="font-bold text-blue-700">{result.updated}</div><div className="text-xs text-muted-foreground">Updated</div></div>
              <div className="rounded-lg bg-amber-50 p-2"><div className="font-bold text-amber-700">{result.skipped}</div><div className="text-xs text-muted-foreground">Skipped</div></div>
            </div>
            {result.errors?.length > 0 && (
              <div className="mt-3 max-h-32 overflow-y-auto votewise-scroll rounded-lg bg-destructive/5 p-3 text-left text-xs text-destructive">
                {result.errors.slice(0, 10).map((err: string, i: number) => <div key={i}>{err}</div>)}
              </div>
            )}
            <Button className="mt-4" onClick={close}>Done</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* File upload zone */}
            <div
              className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 p-6 transition-colors hover:border-primary hover:bg-primary/5"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">Click to upload a CSV file</p>
              <p className="text-xs text-muted-foreground">or paste voter data below</p>
              <input ref={fileInputRef} type="file" accept=".csv,.txt" onChange={onFileUpload} className="hidden" />
            </div>
            <p className="text-sm text-muted-foreground">Format: one voter per line, comma-separated:</p>
            <pre className="rounded bg-muted p-3 text-xs">voterId,fullName,email,phone,facultyCode,departmentCode,level</pre>
            <Textarea rows={6} value={text} onChange={(e) => { setText(e.target.value); setPreview(null) }} placeholder="CSC/2022/001,Demo One,demo1@votewise.com.ng,08030000001,SCI,CSC,300" className="font-mono text-xs" />
            {preview && preview.length > 0 && (
              <div className="rounded-lg border border-border p-3">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <FileCheck2 className="h-3.5 w-3.5" /> Preview ({preview.length} of {parse().length} voters)
                </div>
                <div className="space-y-1">
                  {preview.map((v, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <Badge variant="outline" className="font-mono text-[10px]">{v.voterId}</Badge>
                      <span className="font-medium">{v.fullName}</span>
                      <span className="text-muted-foreground">{v.facultyCode}/{v.departmentCode}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {!result && (
          <DialogFooter>
            <Button variant="outline" onClick={close}>Cancel</Button>
            <Button onClick={doImport} disabled={busy || !text.trim()} className="gap-1.5">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Import {text.trim() ? `${parse().length} voters` : ''}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

function OfficialsTab() {
  const [officials, setOfficials] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<any>({ role: 'OBSERVER' })
  async function load() { try { const d = await api.adminGetOfficials(); setOfficials(d.officials) } catch (e: any) { toast.error(e.message) } }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [])
  async function create() { try { await api.adminCreateOfficial(form); setOpen(false); setForm({ role: 'OBSERVER' }); toast.success('Official created'); load() } catch (e: any) { toast.error(e.message) } }
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">{officials.length} officials</p><Button onClick={() => setOpen(true)} className="gap-1.5"><Plus className="h-4 w-4" /> Add Official</Button></div>
      <Card><CardContent className="p-0">
        <div className="votewise-scroll max-h-[60vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur"><tr className="text-left"><th className="p-3 font-medium">Official</th><th className="p-3 font-medium">Role</th><th className="hidden p-3 font-medium md:table-cell">2FA</th><th className="hidden p-3 font-medium sm:table-cell">Last login</th></tr></thead>
            <tbody>
              {officials.map((o) => (
                <tr key={o.id} className="border-t border-border hover:bg-muted/30">
                  <td className="p-3"><div className="font-medium">{o.name}</div><div className="text-xs text-muted-foreground">{o.email}</div></td>
                  <td className="p-3"><Badge variant="outline" className="text-[10px]">{ROLE_LABELS[o.role] || o.role}</Badge></td>
                  <td className="hidden p-3 md:table-cell">{o.totpEnabled ? <Badge className="bg-emerald-100 text-emerald-700 gap-1"><ShieldCheck className="h-3 w-3" /> On</Badge> : <Badge variant="secondary">Off</Badge>}</td>
                  <td className="hidden p-3 text-xs text-muted-foreground sm:table-cell">{o.lastLoginAt ? new Date(o.lastLoginAt).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent></Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Official</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Full Name</Label><Input value={form.name || ''} onChange={(e) => setForm((f: any) => ({ ...f, name: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.email || ''} onChange={(e) => setForm((f: any) => ({ ...f, email: e.target.value.toLowerCase() }))} /></div>
            <div className="space-y-1.5"><Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm((f: any) => ({ ...f, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="ELECTORAL_COMMITTEE">Electoral Committee</SelectItem><SelectItem value="FACULTY_OFFICER">Committee Officer</SelectItem><SelectItem value="DEPARTMENT_OFFICER">Committee Officer</SelectItem><SelectItem value="OBSERVER">Observer</SelectItem></SelectContent>
              </Select>
            </div>
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
  async function toggle(k: string, v: boolean) { const next = { ...s, [k]: v }; setS(next); try { await api.adminUpdateSettings({ [k]: v }); toast.success('Settings updated') } catch (e: any) { toast.error(e.message) } }
  if (!s) return <Loader2 className="h-5 w-5 animate-spin" />
  const items = [
    { k: 'publicLiveResults', label: 'Public Live Results', desc: 'Show real-time tallies on the homepage.' },
    { k: 'showTurnout', label: 'Show Turnout', desc: 'Display live turnout publicly.' },
    { k: 'requireOtp', label: 'Require OTP', desc: 'Voters must verify with a one-time PIN.' },
    { k: 'requireAccreditation', label: 'Require Accreditation', desc: 'Voters must complete accreditation before voting.' },
    { k: 'ballotRandomization', label: 'Ballot Randomization', desc: 'Shuffle candidate order per voter.' },
    { k: 'notaEnabled', label: 'None-of-the-Above', desc: 'Allow explicit abstention per position.' },
    { k: 'singleDeviceEnforcement', label: 'Single Device Enforcement', desc: 'Bind a voter session to one device.' },
  ]
  return (
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
  )
}

function AuditTab() {
  const [logs, setLogs] = useState<any[]>([])
  const [verify, setVerify] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => { api.adminGetAuditLogs(1).then((d) => { setLogs(d.logs); setLoading(false) }).catch(() => setLoading(false)) }, [])
  useEffect(() => { api.adminVerifyAudit().then(setVerify).catch(() => {}) }, [])
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-2"><FileCheck2 className={cn('h-5 w-5', verify?.intact ? 'text-emerald-600' : 'text-destructive')} /><div><div className="font-medium">Audit Chain Integrity</div><div className="text-xs text-muted-foreground">{verify?.intact ? `Intact — ${verify.totalChecked} entries verified` : 'BROKEN — tampering detected'}</div></div></div>
          <Button variant="outline" size="sm" onClick={() => api.adminVerifyAudit().then(setVerify)} className="gap-1.5"><ShieldCheck className="h-4 w-4" /> Re-verify</Button>
        </CardContent>
      </Card>
      <Card><CardContent className="p-0">
        <div className="votewise-scroll max-h-[70vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur"><tr className="text-left"><th className="p-3 font-medium">Time</th><th className="p-3 font-medium">Actor</th><th className="p-3 font-medium">Action</th><th className="hidden p-3 font-medium md:table-cell">Details</th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={4} className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>}
              {logs.map((l) => (
                <tr key={l.id} className="border-t border-border">
                  <td className="p-3 align-top font-mono text-xs text-muted-foreground">{new Date(l.createdAt).toLocaleString()}</td>
                  <td className="p-3 align-top"><div className="font-medium">{l.actorName}</div><div className="text-xs text-muted-foreground">{l.actorRole}</div></td>
                  <td className="p-3 align-top"><Badge variant="outline" className="font-mono text-[10px]">{l.action}</Badge></td>
                  <td className="hidden p-3 align-top text-xs text-muted-foreground md:table-cell">{l.details?.slice(0, 80)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent></Card>
    </div>
  )
}

function SecurityTab() {
  const [events, setEvents] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  async function load() {
    setLoading(true)
    try { const d = await api.adminGetSecurityEvents('?resolved=false'); setEvents(d.events); setSummary(d.summary) } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t) }, [])
  async function resolve(id: string) { try { await api.adminResolveSecurityEvent(id, true); toast.success('Marked resolved'); load() } catch (e: any) { toast.error(e.message) } }
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard icon={ShieldAlert} label="Critical" value={summary?.critical ?? 0} accent={(summary?.critical ?? 0) > 0} />
        <StatCard icon={AlertCircle} label="High" value={summary?.high ?? 0} accent={(summary?.high ?? 0) > 0} />
        <StatCard icon={AlertCircle} label="Medium" value={summary?.medium ?? 0} />
        <StatCard icon={AlertCircle} label="Low" value={summary?.low ?? 0} />
      </div>
      <Card><CardContent className="p-0">
        <div className="votewise-scroll max-h-[60vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur"><tr className="text-left"><th className="p-3 font-medium">Time</th><th className="p-3 font-medium">Severity</th><th className="p-3 font-medium">Category</th><th className="p-3 font-medium">Message</th><th className="p-3 text-right font-medium">Action</th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={5} className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>}
              {!loading && events.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No unresolved security events. 🟢</td></tr>}
              {events.map((e) => (
                <tr key={e.id} className="border-t border-border">
                  <td className="p-3 align-top font-mono text-xs text-muted-foreground">{new Date(e.createdAt).toLocaleString()}</td>
                  <td className="p-3 align-top"><Badge className={cn('text-[10px]', sevClass(e.severity))}>{e.severity}</Badge></td>
                  <td className="p-3 align-top"><Badge variant="outline" className="text-[10px]">{e.category}</Badge></td>
                  <td className="p-3 align-top text-xs">{e.message}</td>
                  <td className="p-3 text-right"><Button size="sm" variant="ghost" onClick={() => resolve(e.id)}>Resolve</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent></Card>
    </div>
  )
}

function AccountTab({ official }: { official: any }) {
  const [qr, setQr] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null)
  const [busy, setBusy] = useState(false)

  async function setup() {
    setBusy(true)
    try { const d = await api.setup2fa(); setQr(d.qr); setSecret(d.secret) } catch (e: any) { toast.error(e.message) } finally { setBusy(false) }
  }
  async function verify2fa() {
    setBusy(true)
    try { const d = await api.verify2fa(code); setBackupCodes(d.backupCodes); setQr(null); setSecret(null); setCode(''); toast.success('2FA enabled!') } catch (e: any) { toast.error(e.message) } finally { setBusy(false) }
  }
  async function disable() {
    if (!confirm('Disable 2FA? This reduces your account security.')) return
    setBusy(true)
    try { await api.disable2fa(); toast.success('2FA disabled') } catch (e: any) { toast.error(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="font-display text-base flex items-center gap-2"><KeyRound className="h-4 w-4" /> Two-Factor Authentication</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div><div className="font-medium">Status</div><div className="text-sm text-muted-foreground">{official?.totpEnabled ? '2FA is enabled on your account.' : '2FA is not yet enabled. Strongly recommended for electoral officials.'}</div></div>
            {official?.totpEnabled ? (
              <Button variant="outline" onClick={disable} disabled={busy}>Disable</Button>
            ) : (
              <Button onClick={setup} disabled={busy} className="gap-1.5">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Enable 2FA</Button>
            )}
          </div>
          {qr && (
            <div className="space-y-3 border-t border-border pt-3">
              <p className="text-sm text-muted-foreground">Scan this QR code with your authenticator app (Google Authenticator, Authy, 1Password), then enter the 6-digit code it shows.</p>
              <div className="flex justify-center"><img src={qr} alt="2FA QR code" className="rounded-lg border border-border" /></div>
              {secret && <p className="text-center text-xs text-muted-foreground">Or enter manually: <span className="font-mono">{secret}</span></p>}
              <div className="flex gap-2">
                <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" className="font-mono" />
                <Button onClick={verify2fa} disabled={busy || code.length < 6} className="gap-1.5"><CheckCircle2 className="h-4 w-4" /> Confirm</Button>
              </div>
            </div>
          )}
          {backupCodes && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Save these backup codes</AlertTitle>
              <AlertDescription>
                <div className="mt-2 grid grid-cols-2 gap-1 font-mono text-xs">{backupCodes.map((c) => <span key={c}>{c}</span>)}</div>
                <p className="mt-2 text-xs">Each code works once. Store them securely — they won&apos;t be shown again.</p>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function sevClass(s: string) {
  if (s === 'CRITICAL') return 'bg-red-600 text-white'
  if (s === 'HIGH') return 'bg-red-100 text-red-700'
  if (s === 'MEDIUM') return 'bg-amber-100 text-amber-700'
  return 'bg-muted text-muted-foreground'
}
function toLocalInput(d: Date | string) { if (!d) return ''; const date = new Date(d); const off = date.getTimezoneOffset(); const local = new Date(date.getTime() - off * 60000); return local.toISOString().slice(0, 16) }
function scopeLabel(s: string, t?: any) {
  if (s === 'UNIVERSITY') return t ? `${t.organizationLabel}-wide` : 'Organization-wide'
  if (s === 'FACULTY') return t ? t.workspaceLabel : 'Workspace'
  if (s === 'DEPARTMENT') return t ? t.voterGroupLabel : 'Voter Group'
  return s
}
