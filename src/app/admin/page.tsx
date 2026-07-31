'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import {
  Building2, Users, Vote, Shield, Lock, Loader2, CheckCircle2, AlertCircle,
  TrendingUp, DollarSign, Globe, Activity, Server,
  Settings as SettingsIcon, ScrollText, ShieldAlert, Zap,
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
  const [loginForm, setLoginForm] = useState({ email: 'admin@votewise.ng', password: 'admin123' })
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
            <CardTitle className="mt-3 font-display">VoteWise Platform Admin</CardTitle>
            <p className="text-sm text-muted-foreground">Centralized management for all organizations</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={loginForm.email} onChange={(e) => setLoginForm((f) => ({ ...f, email: e.target.value }))} placeholder="admin@votewise.ng" /></div>
            <div className="space-y-1.5"><Label>Password</Label><Input type="password" value={loginForm.password} onChange={(e) => setLoginForm((f) => ({ ...f, password: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && login()} /></div>
            {loginError && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{loginError}</div>}
            <Button onClick={login} className="w-full gap-2"><Lock className="h-4 w-4" /> Sign In</Button>
            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground"><p className="font-semibold text-foreground">Demo credentials</p><p className="mt-1 font-mono">admin@votewise.ng / admin123</p></div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <AdminDashboard official={official} onLogout={() => { api.logout(); setAuthed(false); setOfficial(null) }} />
}

function AdminDashboard({ official, onLogout }: { official: any; onLogout: () => void }) {
  const [tab, setTab] = useState('overview')
  return (
    <div className="min-h-screen bg-secondary/20">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Image src="/logo-votewise.png" alt="VoteWise" width={32} height={32} className="h-8 w-8 rounded-lg" />
            <div><h1 className="font-display text-lg font-bold">VoteWise Admin</h1><p className="text-[10px] text-muted-foreground">Platform Control Center</p></div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary">{official.name}</Badge>
            <Button variant="outline" size="sm" onClick={onLogout} className="gap-1.5">Sign out</Button>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="votewise-scroll mb-6 flex w-full max-w-full overflow-x-auto">
            <TabsTrigger value="overview" className="gap-1.5"><TrendingUp className="h-4 w-4" /> Overview</TabsTrigger>
            <TabsTrigger value="tenants" className="gap-1.5"><Building2 className="h-4 w-4" /> Organizations</TabsTrigger>
            <TabsTrigger value="payments" className="gap-1.5"><DollarSign className="h-4 w-4" /> Payments</TabsTrigger>
            <TabsTrigger value="paystack" className="gap-1.5"><Zap className="h-4 w-4" /> Paystack</TabsTrigger>
            <TabsTrigger value="security" className="gap-1.5"><ShieldAlert className="h-4 w-4" /> Security</TabsTrigger>
            <TabsTrigger value="audit" className="gap-1.5"><ScrollText className="h-4 w-4" /> Audit Log</TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5"><SettingsIcon className="h-4 w-4" /> Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="overview"><OverviewTab /></TabsContent>
          <TabsContent value="tenants"><TenantsTab /></TabsContent>
          <TabsContent value="payments"><PaymentsTab /></TabsContent>
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
        const tenants = await api.platformGetTenants()
        const totalVoters = (tenants.tenants || []).reduce((a: number, t: any) => a + (t._count?.voters || 0), 0)
        const totalOrgs = (tenants.tenants || []).length
        const activeOrgs = (tenants.tenants || []).filter((t: any) => t.status === 'ACTIVE').length
        const paidOrgs = (tenants.tenants || []).filter((t: any) => t.paid).length
        setStats({ totalOrgs, activeOrgs, paidOrgs, totalVoters, tenants: tenants.tenants || [] })
      } catch { setStats({ totalOrgs: 0, activeOrgs: 0, paidOrgs: 0, totalVoters: 0, tenants: [] }) }
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
        <StatCard icon={Users} label="Total Voters" value={stats.totalVoters.toLocaleString()} />
        <StatCard icon={CheckCircle2} label="Active" value={stats.activeOrgs} />
        <StatCard icon={DollarSign} label="Paid" value={stats.paidOrgs} />
      </div>
      <Card>
        <CardHeader><CardTitle className="font-display text-base">Recent Organizations</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {stats.tenants?.slice(0, 5).map((t: any) => (
            <div key={t.id} className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary"><Building2 className="h-4 w-4" /></div>
              <div className="flex-1 min-w-0"><div className="font-medium truncate">{t.displayName}</div><div className="text-xs text-muted-foreground">{t.type} · {t._count?.voters || 0} voters</div></div>
              <Badge className={cn(t.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')}>{t.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function TenantsTab() {
  const [tenants, setTenants] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  async function load() { try { const d = await api.platformGetTenants(); setTenants(d.tenants || []) } catch {} finally { setLoading(false) } }
  useEffect(() => { load() }, [])
  async function toggleStatus(id: string, current: string) { try { await api.platformUpdateTenant(id, current === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'); toast.success('Updated'); load() } catch (e: any) { toast.error(e.message) } }
  return (
    <Card><CardContent className="p-0">
      <div className="votewise-scroll max-h-[70vh] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted/80 backdrop-blur"><tr className="text-left"><th className="p-3">Organization</th><th className="p-3">Type</th><th className="p-3">Voters</th><th className="p-3">Status</th><th className="p-3 text-right">Action</th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan={5} className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>}
            {tenants.map((t) => (
              <tr key={t.id} className="border-t border-border"><td className="p-3"><div className="font-medium">{t.displayName}</div><div className="text-xs text-muted-foreground">{t.adminEmail}</div></td><td className="p-3"><Badge variant="outline" className="text-[10px]">{t.type}</Badge></td><td className="p-3 font-mono">{t._count?.voters || 0}</td><td className="p-3"><Badge className={cn(t.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')}>{t.status}</Badge></td><td className="p-3 text-right"><Button size="sm" variant="ghost" onClick={() => toggleStatus(t.id, t.status)} className="text-xs">{t.status === 'ACTIVE' ? 'Suspend' : 'Activate'}</Button></td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </CardContent></Card>
  )
}

function PaymentsTab() {
  return <Card><CardContent className="py-16 text-center"><DollarSign className="mx-auto h-10 w-10 text-muted-foreground/40" /><p className="mt-3 text-sm text-muted-foreground">Payment management coming soon.</p></CardContent></Card>
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
    <div className="rounded-lg bg-muted/50 p-3"><div className="font-medium">Default Domain</div><div className="text-sm text-muted-foreground font-mono">votewise.ng</div></div>
    <div className="rounded-lg bg-muted/50 p-3"><div className="font-medium">Custom Domain Policy</div><div className="text-sm text-muted-foreground">48 hours per connection, auto-reverts to subdomain</div></div>
  </CardContent></Card>
}
function StatCard({ icon: Icon, label, value, accent }: any) {
  return <Card><CardContent className="flex items-center gap-3 py-4"><div className={cn('grid h-11 w-11 place-items-center rounded-xl', accent ? 'bg-accent/20 text-accent-foreground' : 'bg-primary/10 text-primary')}><Icon className="h-5 w-5" /></div><div><div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div><div className="font-display text-xl font-bold">{value}</div></div></CardContent></Card>
}
