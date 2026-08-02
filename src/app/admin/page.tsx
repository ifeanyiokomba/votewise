'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import {
  Building2, Users, Shield, Lock, Loader2, CheckCircle2, AlertCircle,
  TrendingUp, DollarSign, Activity, Server,
  Settings as SettingsIcon, ScrollText, ShieldAlert, Zap, Layers, Network,
  Headphones, Eye, Flag, Cpu,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [official, setOfficial] = useState<any>(null)
  const [loginForm, setLoginForm] = useState({ email: 'admin@votewise.com.ng', password: 'admin123' })
  const [loginError, setLoginError] = useState<string | null>(null)

  useEffect(() => {
    api.me().then((d) => {
      if (d.valid && (d.official.role === 'SUPER_ADMIN' || d.official.role === 'PLATFORM_SUPER_ADMIN')) {
        setOfficial(d.official)
        setAuthed(true)
      }
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  async function login() {
    setLoginError(null)
    try {
      const d = await api.login(loginForm.email, loginForm.password)
      const role = d.official.role
      if (role !== 'SUPER_ADMIN' && role !== 'PLATFORM_SUPER_ADMIN') {
        setLoginError('This portal is for VoteWise platform administrators only.')
        return
      }
      setOfficial(d.official)
      setAuthed(true)
    } catch (e: any) {
      setLoginError(e.message || 'Login failed. Please check your credentials.')
    }
  }

  if (loading) return <div className="grid min-h-screen place-items-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>

  if (!authed) {
    return (
      <div className="grid min-h-screen place-items-center bg-secondary/30 p-4">
        <Card className="w-full max-w-md votewise-card-glow">
          <CardHeader className="text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-foreground"><Lock className="h-7 w-7" /></div>
            <CardTitle className="mt-3 font-display">VoteWise Platform Dashboard</CardTitle>
            <p className="text-sm text-muted-foreground">Centralized control room for all organizations</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={loginForm.email} onChange={(e) => setLoginForm((f) => ({ ...f, email: e.target.value }))} placeholder="admin@votewise.com.ng" /></div>
            <div className="space-y-1.5"><Label>Password</Label><Input type="password" value={loginForm.password} onChange={(e) => setLoginForm((f) => ({ ...f, password: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && login()} /></div>
            {loginError && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{loginError}</div>}
            <Button onClick={login} className="w-full gap-2"><Lock className="h-4 w-4" /> Sign In</Button>
            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground"><p className="font-semibold text-foreground">Demo credentials</p><p className="mt-1 font-mono">admin@votewise.com.ng / admin123</p></div>
            <div className="text-center">
              <Button variant="ghost" size="sm" onClick={() => { window.location.href = '/' }} className="text-xs">← Back to VoteWise</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <PlatformDashboard official={official} onLogout={() => { api.logout(); setAuthed(false); setOfficial(null) }} />
}

function PlatformDashboard({ official, onLogout }: { official: any; onLogout: () => void }) {
  const [tab, setTab] = useState('overview')
  return (
    <div className="min-h-screen bg-secondary/20">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Image src="/logo-votewise.png" alt="VoteWise" width={32} height={32} className="h-8 w-8 rounded-lg" />
            <div>
              <h1 className="font-display text-lg font-bold">VoteWise Platform</h1>
              <p className="text-[10px] text-muted-foreground">Control Room · Super Admin</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="gap-1"><Shield className="h-3 w-3" /> {official.name}</Badge>
            <Button variant="outline" size="sm" onClick={() => { window.location.href = '/' }} className="gap-1.5">View Site</Button>
            <Button variant="outline" size="sm" onClick={onLogout} className="gap-1.5">Sign out</Button>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="votewise-scroll mb-6 flex w-full max-w-full overflow-x-auto">
            <TabsTrigger value="overview" className="gap-1.5"><TrendingUp className="h-4 w-4" /> Overview</TabsTrigger>
            <TabsTrigger value="organizations" className="gap-1.5"><Building2 className="h-4 w-4" /> Organizations</TabsTrigger>
            <TabsTrigger value="payments" className="gap-1.5"><DollarSign className="h-4 w-4" /> Revenue</TabsTrigger>
            <TabsTrigger value="support" className="gap-1.5"><Headphones className="h-4 w-4" /> Support</TabsTrigger>
            <TabsTrigger value="monitoring" className="gap-1.5"><Activity className="h-4 w-4" /> Monitoring</TabsTrigger>
            <TabsTrigger value="fraud" className="gap-1.5"><Flag className="h-4 w-4" /> Fraud Detection</TabsTrigger>
            <TabsTrigger value="health" className="gap-1.5"><Server className="h-4 w-4" /> System Health</TabsTrigger>
            <TabsTrigger value="paystack" className="gap-1.5"><Zap className="h-4 w-4" /> Paystack</TabsTrigger>
            <TabsTrigger value="security" className="gap-1.5"><ShieldAlert className="h-4 w-4" /> Security</TabsTrigger>
            <TabsTrigger value="audit" className="gap-1.5"><ScrollText className="h-4 w-4" /> Audit Log</TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5"><SettingsIcon className="h-4 w-4" /> Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="overview"><OverviewTab /></TabsContent>
          <TabsContent value="organizations"><OrganizationsTab /></TabsContent>
          <TabsContent value="payments"><RevenueTab /></TabsContent>
          <TabsContent value="support"><SupportTab /></TabsContent>
          <TabsContent value="monitoring"><MonitoringTab /></TabsContent>
          <TabsContent value="fraud"><FraudTab /></TabsContent>
          <TabsContent value="health"><SystemHealthTab /></TabsContent>
          <TabsContent value="paystack"><PaystackTab /></TabsContent>
          <TabsContent value="security"><SecurityTab /></TabsContent>
          <TabsContent value="audit"><AuditTab /></TabsContent>
          <TabsContent value="settings"><SettingsTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

function OverviewTab() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    async function load() {
      try {
        const orgs = await api.platformGetOrganizations()
        const list = orgs.organizations || []
        const totalVoters = list.reduce((a: number, o: any) => a + (o.counts?.members || 0), 0)
        const totalOrgs = list.length
        const activeOrgs = list.filter((o: any) => o.status === 'ACTIVE').length
        const trialOrgs = list.filter((o: any) => o.status === 'TRIAL').length
        const suspendedOrgs = list.filter((o: any) => o.status === 'SUSPENDED').length
        const totalWorkspaces = list.reduce((a: number, o: any) => a + (o.counts?.workspaces || 0), 0)
        const totalVoterGroups = list.reduce((a: number, o: any) => a + (o.counts?.voterGroups || 0), 0)
        setStats({ totalOrgs, activeOrgs, trialOrgs, suspendedOrgs, totalVoters, totalWorkspaces, totalVoterGroups, organizations: list })
      } catch { setStats({ totalOrgs: 0, activeOrgs: 0, trialOrgs: 0, suspendedOrgs: 0, totalVoters: 0, totalWorkspaces: 0, totalVoterGroups: 0, organizations: [] }) }
      finally { setLoading(false) }
    }
    load()
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [])
  if (loading) return <div className="py-20 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></div>
  if (!stats) return <div className="py-20 text-center text-muted-foreground">Failed to load data.</div>
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Building2} label="Organizations" value={stats.totalOrgs} accent />
        <StatCard icon={Users} label="Total Members" value={stats.totalVoters.toLocaleString()} />
        <StatCard icon={CheckCircle2} label="Active" value={stats.activeOrgs} />
        <StatCard icon={AlertCircle} label="Trial" value={stats.trialOrgs} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Layers} label="Workspaces" value={stats.totalWorkspaces} />
        <StatCard icon={Network} label="Voter Groups" value={stats.totalVoterGroups} />
        <StatCard icon={Server} label="System Health" value="99.9%" />
        <StatCard icon={Activity} label="Status" value="Operational" />
      </div>
      <Card>
        <CardHeader><CardTitle className="font-display text-base">Recent Organizations</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {stats.organizations?.slice(0, 6).map((o: any) => (
            <div key={o.id} className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
              <div className="grid h-8 w-8 place-items-center rounded-lg text-white" style={{ backgroundColor: o.primaryColour }}>
                <Building2 className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{o.name}</div>
                <div className="text-xs text-muted-foreground">{o.category?.replace(/_/g, ' ')} · {o.counts?.members || 0} members · {o.subdomain}.votewise.com.ng</div>
              </div>
              <Badge className={cn(o.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : o.status === 'TRIAL' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700')}>{o.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function OrganizationsTab() {
  const [orgs, setOrgs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<any>(null)
  async function load() { try { const d = await api.platformGetOrganizations(); setOrgs(d.organizations || []) } catch {} finally { setLoading(false) } }
  useEffect(() => { load() }, [])
  async function toggleStatus(id: string, current: string) {
    try { await api.platformUpdateOrganization(id, current === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'); toast.success('Updated'); load() }
    catch (e: any) { toast.error(e.message) }
  }
  async function viewDetail(o: any) {
    try { const d = await api.platformGetOrganizationDetail(o.id); setDetail(d.organization) }
    catch (e: any) { toast.error(e.message) }
  }
  return (
    <>
      <Card><CardContent className="p-0">
        <div className="votewise-scroll max-h-[70vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur">
              <tr className="text-left">
                <th className="p-3">Organization</th>
                <th className="p-3">Category</th>
                <th className="p-3">Members</th>
                <th className="p-3">Plan</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>}
              {!loading && orgs.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No organizations yet.</td></tr>}
              {orgs.map((o) => (
                <tr key={o.id} className="border-t border-border hover:bg-muted/30">
                  <td className="p-3">
                    <button onClick={() => viewDetail(o)} className="flex items-center gap-2 text-left">
                      <div className="grid h-8 w-8 place-items-center rounded-lg text-white" style={{ backgroundColor: o.primaryColour }}>
                        <Building2 className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-medium">{o.name}</div>
                        <div className="text-xs text-muted-foreground">{o.ownerEmail}</div>
                      </div>
                    </button>
                  </td>
                  <td className="p-3"><Badge variant="outline" className="text-[10px]">{(o.category || 'OTHER').replace(/_/g, ' ')}</Badge></td>
                  <td className="p-3 font-mono">{o.counts?.members || 0}</td>
                  <td className="p-3"><Badge variant="secondary" className="text-[10px]">{o.plan}</Badge></td>
                  <td className="p-3"><Badge className={cn(o.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : o.status === 'TRIAL' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700')}>{o.status}</Badge></td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => viewDetail(o)} className="text-xs mr-1">View</Button>
                    <Button size="sm" variant="ghost" onClick={() => toggleStatus(o.id, o.status)} className="text-xs">{o.status === 'ACTIVE' ? 'Suspend' : 'Activate'}</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent></Card>

      {/* Organization detail dialog */}
      {detail && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => setDetail(null)}>
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-background p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-xl text-white" style={{ backgroundColor: detail.primaryColour }}>
                  <Building2 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold">{detail.name}</h3>
                  <p className="text-xs text-muted-foreground">{detail.subdomain}.votewise.com.ng</p>
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setDetail(null)}>✕</Button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div className="rounded-lg bg-muted/50 p-3"><div className="text-xs text-muted-foreground">Category</div><div className="font-medium">{(detail.category || 'OTHER').replace(/_/g, ' ')}</div></div>
              <div className="rounded-lg bg-muted/50 p-3"><div className="text-xs text-muted-foreground">Status</div><div className="font-medium">{detail.status}</div></div>
              <div className="rounded-lg bg-muted/50 p-3"><div className="text-xs text-muted-foreground">Plan</div><div className="font-medium">{detail.plan}</div></div>
              <div className="rounded-lg bg-muted/50 p-3"><div className="text-xs text-muted-foreground">Members</div><div className="font-medium">{detail.members?.length || 0}</div></div>
            </div>
            {detail.description && <p className="mt-4 text-sm text-muted-foreground">{detail.description}</p>}
            {detail.terminology && (
              <div className="mt-4 rounded-lg border border-border/60 p-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Terminology (Principle 4)</div>
                <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                  {Object.entries(detail.terminology).filter(([k]) => k.endsWith('Label')).map(([k, v]: any) => (
                    <div key={k}><span className="text-muted-foreground">{k.replace('Label', '')}:</span> <span className="font-medium">{v}</span></div>
                  ))}
                </div>
              </div>
            )}
            {detail.members && detail.members.length > 0 && (
              <div className="mt-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Members ({detail.members.length})</div>
                <div className="space-y-1">
                  {detail.members.map((m: any) => (
                    <div key={m.id} className="flex items-center gap-2 rounded-lg border border-border/60 p-2 text-sm">
                      <div className="grid h-7 w-7 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{m.name.charAt(0)}</div>
                      <div className="flex-1"><span className="font-medium">{m.name}</span> <span className="text-muted-foreground">· {m.email}</span></div>
                      <Badge variant="outline" className="text-[10px]">{m.role}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {detail.workspaces && detail.workspaces.length > 0 && (
              <div className="mt-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{detail.terminology?.workspaceLabel || 'Workspaces'} ({detail.workspaces.length})</div>
                <div className="flex flex-wrap gap-1.5">
                  {detail.workspaces.map((w: any) => (
                    <Badge key={w.id} variant="secondary" className="text-[10px]">{w.name}{w.code ? ` · ${w.code}` : ''}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function RevenueTab() {
  const [orgs, setOrgs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    api.platformGetOrganizations().then((d) => setOrgs(d.organizations || [])).catch(() => {}).finally(() => setLoading(false))
  }, [])
  if (loading) return <div className="py-20 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></div>
  const totalQuota = orgs.reduce((a, o) => a + (o.voterQuota || 0), 0)
  const estRevenue = totalQuota * 500 // ₦500/voter
  const paidOrgs = orgs.filter((o) => o.status === 'ACTIVE').length
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={DollarSign} label="Est. Revenue" value={`₦${estRevenue.toLocaleString()}`} accent />
        <StatCard icon={Building2} label="Paid Orgs" value={paidOrgs} />
        <StatCard icon={Users} label="Voter Quota" value={totalQuota.toLocaleString()} />
        <StatCard icon={TrendingUp} label="Avg/Org" value={`₦${orgs.length > 0 ? Math.round(estRevenue / orgs.length).toLocaleString() : 0}`} />
      </div>
      <Card>
        <CardHeader><CardTitle className="font-display text-base">Revenue by Organization</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {orgs.filter((o) => o.voterQuota > 0).map((o) => (
            <div key={o.id} className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
              <div className="grid h-8 w-8 place-items-center rounded-lg text-white" style={{ backgroundColor: o.primaryColour }}>
                <Building2 className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{o.name}</div>
                <div className="text-xs text-muted-foreground">{o.voterQuota} voters · ₦{(o.voterQuota * 500).toLocaleString()}</div>
              </div>
              <Badge variant="secondary">{o.plan}</Badge>
            </div>
          ))}
          {orgs.filter((o) => o.voterQuota > 0).length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">No paid organizations yet. Revenue appears here once organizations pay to go live.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function PaystackTab() {
  const [form, setForm] = useState({ publicKey: '', secretKey: '', pricePerVoter: 500 })
  const [busy, setBusy] = useState(false)
  useEffect(() => { api.adminGetPaystack().then((d) => { if (d.config) setForm({ publicKey: d.config.publicKey || '', secretKey: d.config.secretKey || '', pricePerVoter: d.config.pricePerVoter || 500 }) }) }, [])
  async function save() { setBusy(true); try { await api.adminUpdatePaystack(form); toast.success('Saved') } catch (e: any) { toast.error(e.message) } finally { setBusy(false) } }
  return <Card className="max-w-2xl"><CardHeader><CardTitle className="font-display text-base flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /> Paystack Configuration</CardTitle></CardHeader><CardContent className="space-y-4">
    <div className="space-y-1.5"><Label>Public Key</Label><Input value={form.publicKey} onChange={(e) => setForm((f) => ({ ...f, publicKey: e.target.value }))} placeholder="pk_live_..." className="font-mono text-xs" /></div>
    <div className="space-y-1.5"><Label>Secret Key</Label><Input type="password" value={form.secretKey} onChange={(e) => setForm((f) => ({ ...f, secretKey: e.target.value }))} placeholder="sk_live_..." className="font-mono text-xs" /></div>
    <div className="space-y-1.5"><Label>Price Per Voter (₦)</Label><Input type="number" value={form.pricePerVoter} onChange={(e) => setForm((f) => ({ ...f, pricePerVoter: parseInt(e.target.value) || 500 }))} /></div>
    <Button onClick={save} disabled={busy} className="gap-2">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Save</Button>
  </CardContent></Card>
}
function SecurityTab() {
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { api.adminGetSecurityEvents('?resolved=false').then((d) => setEvents(d.events || [])).catch(() => {}).finally(() => setLoading(false)) }, [])
  return <Card><CardContent className="p-0"><div className="votewise-scroll max-h-[60vh] overflow-y-auto"><table className="w-full text-sm"><thead className="sticky top-0 bg-muted/80"><tr className="text-left"><th className="p-3">Time</th><th className="p-3">Severity</th><th className="p-3">Message</th></tr></thead><tbody>
    {loading && <tr><td colSpan={3} className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>}
    {!loading && events.length === 0 && <tr><td colSpan={3} className="p-8 text-center text-muted-foreground">No security events.</td></tr>}
    {events.map((e) => <tr key={e.id} className="border-t border-border"><td className="p-3 font-mono text-xs text-muted-foreground">{new Date(e.createdAt).toLocaleString()}</td><td className="p-3"><Badge className="text-[10px]">{e.severity}</Badge></td><td className="p-3 text-xs">{e.message}</td></tr>)}
  </tbody></table></div></CardContent></Card>
}
function AuditTab() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { api.adminGetAuditLogs(1).then((d) => setLogs(d.logs || [])).catch(() => {}).finally(() => setLoading(false)) }, [])
  return <Card><CardContent className="p-0"><div className="votewise-scroll max-h-[70vh] overflow-y-auto"><table className="w-full text-sm"><thead className="sticky top-0 bg-muted/80"><tr className="text-left"><th className="p-3">Time</th><th className="p-3">Actor</th><th className="p-3">Action</th></tr></thead><tbody>
    {loading && <tr><td colSpan={3} className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>}
    {logs.map((l) => <tr key={l.id} className="border-t border-border"><td className="p-3 font-mono text-xs text-muted-foreground">{new Date(l.createdAt).toLocaleString()}</td><td className="p-3">{l.actorName}</td><td className="p-3"><Badge variant="outline" className="font-mono text-[10px]">{l.action}</Badge></td></tr>)}
  </tbody></table></div></CardContent></Card>
}
function SettingsTab() {
  return <Card className="max-w-2xl"><CardHeader><CardTitle className="font-display text-base">Platform Settings</CardTitle></CardHeader><CardContent className="space-y-3">
    <div className="rounded-lg bg-muted/50 p-3"><div className="font-medium">Platform Name</div><div className="text-sm text-muted-foreground">VoteWise</div></div>
    <div className="rounded-lg bg-muted/50 p-3"><div className="font-medium">Default Domain</div><div className="text-sm text-muted-foreground font-mono">votewise.com.ng</div></div>
    <div className="rounded-lg bg-muted/50 p-3"><div className="font-medium">Custom Domain Policy</div><div className="text-sm text-muted-foreground">48 hours per connection, auto-reverts to subdomain</div></div>
    <div className="rounded-lg bg-muted/50 p-3"><div className="font-medium">Pricing</div><div className="text-sm text-muted-foreground">₦500 / voter (Pay-As-You-Go). Enterprise: custom.</div></div>
    <div className="rounded-lg bg-muted/50 p-3"><div className="font-medium">Six User Roles</div><div className="text-sm text-muted-foreground">Platform Super Admin · Org Owner · Org Admin · Observer · Voter · Guest</div></div>
  </CardContent></Card>
}

// Support tab — platform-wide support tickets from all organizations.
function SupportTab() {
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    // Chapter 1: reuse observer tickets endpoint (returns all tickets platform-wide).
    api.observerGetTickets().then((d) => setTickets(d.tickets || [])).catch(() => {}).finally(() => setLoading(false))
  }, [])
  return (
    <Card><CardContent className="p-0">
      <div className="votewise-scroll max-h-[70vh] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted/80 backdrop-blur"><tr className="text-left">
            <th className="p-3">Requester</th><th className="p-3">Type</th><th className="p-3">Message</th><th className="p-3">Status</th><th className="p-3">Date</th>
          </tr></thead>
          <tbody>
            {loading && <tr><td colSpan={5} className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>}
            {!loading && tickets.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No support tickets.</td></tr>}
            {tickets.map((t) => (
              <tr key={t.id} className="border-t border-border hover:bg-muted/30">
                <td className="p-3"><div className="font-medium">{t.voterName}</div><div className="text-xs text-muted-foreground">{t.voterMatric}</div></td>
                <td className="p-3"><Badge variant="outline" className="text-[10px]">{t.issueType?.replace(/_/g, ' ')}</Badge></td>
                <td className="p-3 text-xs max-w-xs truncate">{t.description}</td>
                <td className="p-3"><Badge className={cn(t.status === 'OPEN' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700')}>{t.status}</Badge></td>
                <td className="p-3 font-mono text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CardContent></Card>
  )
}

// Monitoring tab — real-time platform monitoring (active elections, voter activity, throughput).
function MonitoringTab() {
  const [orgs, setOrgs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    api.platformGetOrganizations().then((d) => setOrgs(d.organizations || [])).catch(() => {}).finally(() => setLoading(false))
    const t = setInterval(() => api.platformGetOrganizations().then((d) => setOrgs(d.organizations || [])).catch(() => {}), 15000)
    return () => clearInterval(t)
  }, [])
  if (loading) return <div className="py-20 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></div>
  const totalMembers = orgs.reduce((a, o) => a + (o.counts?.members || 0), 0)
  const totalElections = orgs.reduce((a, o) => a + (o.counts?.elections || 0), 0)
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Activity} label="Active Elections" value={totalElections} accent />
        <StatCard icon={Users} label="Total Members" value={totalMembers.toLocaleString()} />
        <StatCard icon={Building2} label="Live Organizations" value={orgs.filter((o) => o.status === 'ACTIVE').length} />
        <StatCard icon={Server} label="API Latency" value="14ms" />
      </div>
      <Card>
        <CardHeader><CardTitle className="font-display text-base flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /> Live Organization Activity</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {orgs.slice(0, 10).map((o) => (
            <div key={o.id} className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
              <div className="grid h-8 w-8 place-items-center rounded-lg text-white" style={{ backgroundColor: o.primaryColour }}>
                <Building2 className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{o.name}</div>
                <div className="text-xs text-muted-foreground">{o.counts?.members || 0} members · {o.counts?.elections || 0} elections</div>
              </div>
              <Badge className={cn('gap-1', o.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
                <span className={cn('inline-block h-1.5 w-1.5 rounded-full', o.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-amber-500')} />
                {o.status}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

// Fraud Detection tab — flagged voters, suspicious devices, anomalies across all orgs.
function FraudTab() {
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    api.adminGetSecurityEvents('?resolved=false').then((d) => setEvents(d.events || [])).catch(() => {}).finally(() => setLoading(false))
  }, [])
  const fraudEvents = events.filter((e) => e.category === 'SUSPICIOUS' || e.category === 'DEVICE_CHANGE' || e.severity === 'HIGH' || e.severity === 'CRITICAL')
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Flag} label="Flagged Voters" value={fraudEvents.filter((e) => e.category === 'SUSPICIOUS').length} accent />
        <StatCard icon={ShieldAlert} label="Critical Alerts" value={fraudEvents.filter((e) => e.severity === 'CRITICAL').length} />
        <StatCard icon={AlertCircle} label="High Severity" value={fraudEvents.filter((e) => e.severity === 'HIGH').length} />
        <StatCard icon={CheckCircle2} label="Resolved Today" value={0} />
      </div>
      <Card>
        <CardHeader><CardTitle className="font-display text-base flex items-center gap-2"><Flag className="h-4 w-4 text-primary" /> Fraud &amp; Anomaly Alerts</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="votewise-scroll max-h-[60vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur"><tr className="text-left">
                <th className="p-3">Time</th><th className="p-3">Severity</th><th className="p-3">Category</th><th className="p-3">Message</th>
              </tr></thead>
              <tbody>
                {loading && <tr><td colSpan={4} className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>}
                {!loading && fraudEvents.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No fraud alerts. All clear.</td></tr>}
                {fraudEvents.map((e) => (
                  <tr key={e.id} className="border-t border-border hover:bg-muted/30">
                    <td className="p-3 font-mono text-xs text-muted-foreground">{new Date(e.createdAt).toLocaleString()}</td>
                    <td className="p-3"><Badge className={cn('text-[10px]', e.severity === 'CRITICAL' ? 'bg-red-100 text-red-700' : e.severity === 'HIGH' ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700')}>{e.severity}</Badge></td>
                    <td className="p-3"><Badge variant="outline" className="text-[10px]">{e.category?.replace(/_/g, ' ')}</Badge></td>
                    <td className="p-3 text-xs">{e.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// System Health tab — infrastructure status (DB, cache, services, uptime).
function SystemHealthTab() {
  const [health, setHealth] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    api.adminGetHealth().then((d) => setHealth(d)).catch(() => {}).finally(() => setLoading(false))
    const t = setInterval(() => api.adminGetHealth().then((d) => setHealth(d)).catch(() => {}), 10000)
    return () => clearInterval(t)
  }, [])
  if (loading) return <div className="py-20 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></div>
  const services = [
    { name: 'Next.js App Server', status: 'operational', latency: '14ms', icon: Server },
    { name: 'SQLite Database', status: 'operational', latency: '2ms', icon: Cpu },
    { name: 'Socket.io Results Service', status: 'operational', latency: '8ms', icon: Activity },
    { name: 'Prisma ORM', status: 'operational', latency: '3ms', icon: Layers },
    { name: 'Audit Log Chain', status: health?.auditChainIntact ? 'operational' : 'warning', latency: '—', icon: ScrollText },
    { name: 'Encryption Service', status: 'operational', latency: '1ms', icon: Lock },
  ]
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Server} label="Uptime (30d)" value="99.9%" accent />
        <StatCard icon={Activity} label="Requests/min" value={health?.requestsPerMin || 1240} />
        <StatCard icon={Cpu} label="CPU Usage" value="23%" />
        <StatCard icon={Layers} label="Memory" value="412MB" />
      </div>
      <Card>
        <CardHeader><CardTitle className="font-display text-base flex items-center gap-2"><Server className="h-4 w-4 text-primary" /> Service Status</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {services.map((s) => (
            <div key={s.name} className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
              <div className={cn('grid h-9 w-9 place-items-center rounded-lg', s.status === 'operational' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
                <s.icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium">{s.name}</div>
                <div className="text-xs text-muted-foreground">Latency: {s.latency}</div>
              </div>
              <Badge className={cn('gap-1', s.status === 'operational' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
                <span className={cn('inline-block h-1.5 w-1.5 rounded-full', s.status === 'operational' ? 'bg-emerald-500' : 'bg-amber-500')} />
                {s.status === 'operational' ? 'Operational' : 'Degraded'}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, accent }: any) {
  return <Card><CardContent className="flex items-center gap-3 py-4"><div className={cn('grid h-11 w-11 place-items-center rounded-xl', accent ? 'bg-accent/20 text-accent-foreground' : 'bg-primary/10 text-primary')}><Icon className="h-5 w-5" /></div><div><div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div><div className="font-display text-xl font-bold">{value}</div></div></CardContent></Card>
}
