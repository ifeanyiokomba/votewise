'use client'

import { useEffect, useState } from 'react'
import {
  Building2, Palette, Globe, Shield, CreditCard, Bell, KeyRound,
  FileCheck2, ScrollText, Loader2, CheckCircle2, AlertCircle, Plus,
  Trash2, Upload, Lock,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const SETTINGS_TABS = [
  { value: 'general', label: 'General', icon: Building2 },
  { value: 'branding', label: 'Branding', icon: Palette },
  { value: 'domain', label: 'Domain', icon: Globe },
  { value: 'security', label: 'Security', icon: Shield },
  { value: 'billing', label: 'Billing', icon: CreditCard },
  { value: 'notifications', label: 'Notifications', icon: Bell },
  { value: 'otp', label: 'OTP Preferences', icon: KeyRound },
  { value: 'elections', label: 'Election Defaults', icon: FileCheck2 },
  { value: 'audit', label: 'Audit', icon: ScrollText },
]

export function WorkspaceSettings({ subdomain }: { subdomain?: string }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.workspaceSettings(subdomain).then((d) => { setData(d); setLoading(false) }).catch(() => setLoading(false))
  }, [subdomain])

  async function save(updates: any) {
    setSaving(true)
    try {
      await api.workspaceUpdateSettings(updates, subdomain)
      toast.success('Settings saved')
      // Refresh
      const d = await api.workspaceSettings(subdomain)
      setData(d)
    } catch (e: any) { toast.error(e.message) } finally { setSaving(false) }
  }

  if (loading) return <div className="grid min-h-[40vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  if (!data) return <div className="py-16 text-center text-muted-foreground">Failed to load settings.</div>

  const org = data.organization
  const s = data.settings
  const term = data.terminology
  const sub = data.subscription

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold">Organization Settings</h1>
        <p className="text-sm text-muted-foreground">Everything centralized. Control your workspace from one place.</p>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="votewise-scroll mb-6 flex w-full max-w-full overflow-x-auto">
          {SETTINGS_TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="gap-1.5 whitespace-nowrap"><t.icon className="h-4 w-4" /> {t.label}</TabsTrigger>
          ))}
        </TabsList>

        {/* General */}
        <TabsContent value="general">
          <GeneralTab org={org} term={term} saving={saving} onSave={save} />
        </TabsContent>

        {/* Branding */}
        <TabsContent value="branding">
          <BrandingTab org={org} saving={saving} onSave={save} />
        </TabsContent>

        {/* Domain */}
        <TabsContent value="domain">
          <DomainTab org={org} subdomain={subdomain} />
        </TabsContent>

        {/* Security */}
        <TabsContent value="security">
          <SecurityTab settings={s} saving={saving} onSave={save} />
        </TabsContent>

        {/* Billing */}
        <TabsContent value="billing">
          <BillingTab org={org} sub={sub} />
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications">
          <NotificationsTab settings={s} saving={saving} onSave={save} />
        </TabsContent>

        {/* OTP */}
        <TabsContent value="otp">
          <OTPTab settings={s} saving={saving} onSave={save} />
        </TabsContent>

        {/* Election Defaults */}
        <TabsContent value="elections">
          <ElectionDefaultsTab settings={s} saving={saving} onSave={save} />
        </TabsContent>

        {/* Audit */}
        <TabsContent value="audit">
          <AuditTab subdomain={subdomain} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function GeneralTab({ org, term, saving, onSave }: any) {
  const [form, setForm] = useState({
    name: org.name, description: org.description || '', country: org.country || '',
    state: org.state || '', timezone: org.timezone,
    organizationLabel: term?.organizationLabel || 'Organization',
    workspaceLabel: term?.workspaceLabel || 'Workspace',
    voterGroupLabel: term?.voterGroupLabel || 'Voter Group',
    voterLabel: term?.voterLabel || 'Voter',
    candidateLabel: term?.candidateLabel || 'Candidate',
  })
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))
  return (
    <Card>
      <CardHeader><CardTitle className="font-display text-base">General Information</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>Organization Name</Label><Input value={form.name} onChange={(e) => set('name', e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Country</Label><Input value={form.country} onChange={(e) => set('country', e.target.value)} /></div>
          <div className="space-y-1.5"><Label>State</Label><Input value={form.state} onChange={(e) => set('state', e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Timezone</Label><Input value={form.timezone} onChange={(e) => set('timezone', e.target.value)} /></div>
        </div>
        <div className="space-y-1.5"><Label>Description</Label><Input value={form.description} onChange={(e) => set('description', e.target.value)} /></div>

        {/* Terminology (Principle 4) */}
        <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
          <div className="mb-2 flex items-center gap-1.5"><Building2 className="h-4 w-4 text-primary" /><span className="font-display text-sm font-semibold">Terminology (Principle 4)</span></div>
          <p className="mb-3 text-xs text-muted-foreground">Configure your own terms. Organizations configure their own terminology instead of VoteWise hardcoding &ldquo;University&rdquo;, &ldquo;Faculty&rdquo;, &ldquo;Department&rdquo;.</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="space-y-1"><Label className="text-[11px]">Organization →</Label><Input value={form.organizationLabel} onChange={(e) => set('organizationLabel', e.target.value)} className="h-8 text-sm" /></div>
            <div className="space-y-1"><Label className="text-[11px]">Workspace →</Label><Input value={form.workspaceLabel} onChange={(e) => set('workspaceLabel', e.target.value)} className="h-8 text-sm" /></div>
            <div className="space-y-1"><Label className="text-[11px]">Voter Group →</Label><Input value={form.voterGroupLabel} onChange={(e) => set('voterGroupLabel', e.target.value)} className="h-8 text-sm" /></div>
            <div className="space-y-1"><Label className="text-[11px]">Voter →</Label><Input value={form.voterLabel} onChange={(e) => set('voterLabel', e.target.value)} className="h-8 text-sm" /></div>
            <div className="space-y-1"><Label className="text-[11px]">Candidate →</Label><Input value={form.candidateLabel} onChange={(e) => set('candidateLabel', e.target.value)} className="h-8 text-sm" /></div>
          </div>
        </div>

        <Button onClick={() => onSave({ organization: { name: form.name, description: form.description, country: form.country, state: form.state, timezone: form.timezone }, terminology: { organizationLabel: form.organizationLabel, workspaceLabel: form.workspaceLabel, voterGroupLabel: form.voterGroupLabel, voterLabel: form.voterLabel, candidateLabel: form.candidateLabel } })} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Save Changes
        </Button>
      </CardContent>
    </Card>
  )
}

function BrandingTab({ org, saving, onSave }: any) {
  const [form, setForm] = useState({
    primaryColour: org.primaryColour, accentColour: org.accentColour,
    secondaryColour: org.secondaryColour || '#166534', logoUrl: org.logoUrl || '',
  })
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))
  function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    if (file.size > 1024 * 1024) { toast.error('Logo must be under 1MB'); return }
    const r = new FileReader(); r.onload = (ev) => set('logoUrl', ev.target?.result); r.readAsDataURL(file)
  }
  return (
    <Card>
      <CardHeader><CardTitle className="font-display text-base">Branding</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4 rounded-lg border-2 border-dashed border-border p-4">
          {form.logoUrl ? <img src={form.logoUrl} alt="Logo" className="h-14 w-14 rounded-lg object-contain" /> : <div className="grid h-14 w-14 place-items-center rounded-lg text-white" style={{ backgroundColor: form.primaryColour }}><Building2 className="h-6 w-6" /></div>}
          <div className="flex-1"><p className="text-sm text-muted-foreground">Upload your organization logo (under 1MB).</p><Button size="sm" variant="outline" onClick={() => document.getElementById('set-logo')?.click()} className="mt-2 gap-1"><Upload className="h-3.5 w-3.5" /> Upload Logo</Button><input id="set-logo" type="file" accept="image/*" className="hidden" onChange={onLogo} /></div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[{ key: 'primaryColour', label: 'Primary' }, { key: 'secondaryColour', label: 'Secondary' }, { key: 'accentColour', label: 'Accent' }].map((c) => (
            <div key={c.key} className="space-y-1.5"><Label>{c.label} Colour</Label><div className="flex items-center gap-2"><input type="color" value={form[c.key]} onChange={(e) => set(c.key, e.target.value)} className="h-10 w-12 cursor-pointer rounded border border-border" /><Input value={form[c.key]} onChange={(e) => set(c.key, e.target.value)} className="font-mono text-xs" /></div></div>
          ))}
        </div>
        <Button onClick={() => onSave({ organization: form })} disabled={saving} className="gap-2">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Save Branding</Button>
      </CardContent>
    </Card>
  )
}

function DomainTab({ org, subdomain }: any) {
  const [domains, setDomains] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [newDomain, setNewDomain] = useState('')
  const [connecting, setConnecting] = useState(false)

  useEffect(() => {
    api.workspaceDomains(subdomain).then((d) => setDomains(d.domains || [])).catch(() => {}).finally(() => setLoading(false))
  }, [subdomain])

  async function connect() {
    if (!newDomain) return
    setConnecting(true)
    try {
      await api.workspaceConnectDomain(newDomain, true, subdomain)
      toast.success(`Domain ${newDomain} connected and verified!`)
      setNewDomain('')
      const d = await api.workspaceDomains(subdomain); setDomains(d.domains || [])
    } catch (e: any) { toast.error(e.message) } finally { setConnecting(false) }
  }
  async function disconnect(domain: string) {
    try {
      await api.workspaceDisconnectDomain(domain, subdomain)
      toast.success(`Domain ${domain} disconnected.`)
      const d = await api.workspaceDomains(subdomain); setDomains(d.domains || [])
    } catch (e: any) { toast.error(e.message) }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="font-display text-base">Custom Domain</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-muted/50 p-3">
          <div className="text-xs text-muted-foreground">Current Subdomain</div>
          <div className="font-mono text-sm font-medium">{org.subdomain}.votewise.ng</div>
        </div>
        <div className="space-y-1.5">
          <Label>Connect a Custom Domain</Label>
          <div className="flex gap-2">
            <Input value={newDomain} onChange={(e) => setNewDomain(e.target.value.toLowerCase())} placeholder="vote.yourorg.org" className="font-mono" />
            <Button onClick={connect} disabled={connecting || !newDomain} className="gap-2 shrink-0">{connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Connect</Button>
          </div>
          <p className="text-xs text-muted-foreground">VoteWise will check DNS. Once verified, the domain points to your organization. Nothing moves — only routing changes.</p>
        </div>
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : domains.length > 0 && (
          <div className="space-y-2">
            <Label>Connected Domains</Label>
            {domains.map((d) => (
              <div key={d.id} className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
                <Globe className="h-4 w-4 text-primary" />
                <div className="flex-1 min-w-0"><div className="font-mono text-sm truncate">{d.domain}</div>{d.isPrimary && <Badge variant="secondary" className="text-[10px]">Primary</Badge>}</div>
                <Badge className={cn(d.status === 'VERIFIED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>{d.status}</Badge>
                <Button size="sm" variant="ghost" onClick={() => disconnect(d.domain)} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            ))}
          </div>
        )}
        <Alert>
          <Globe className="h-4 w-4" />
          <AlertDescription>If your subscription expires, your custom domain is disconnected (not deleted) and automatically returns to the subdomain. All data remains. Reconnect on renewal.</AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
}

function SecurityTab({ settings, saving, onSave }: any) {
  const [form, setForm] = useState({ require2faForAdmins: settings.require2faForAdmins, singleDeviceEnforcement: settings.singleDeviceEnforcement })
  return (
    <Card>
      <CardHeader><CardTitle className="font-display text-base">Security</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <ToggleRow label="Require 2FA for Admins" desc="Organization owners and admins must enable two-factor authentication." value={form.require2faForAdmins} onChange={(v) => setForm((f) => ({ ...f, require2faForAdmins: v }))} />
        <ToggleRow label="Single Device Enforcement" desc="Voters can only vote from one device per election." value={form.singleDeviceEnforcement} onChange={(v) => setForm((f) => ({ ...f, singleDeviceEnforcement: v }))} />
        <Button onClick={() => onSave({ settings: form })} disabled={saving} className="gap-2">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Save Security</Button>
      </CardContent>
    </Card>
  )
}

function BillingTab({ org, sub }: any) {
  return (
    <Card>
      <CardHeader><CardTitle className="font-display text-base">Billing & Subscription</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-muted/50 p-3"><div className="text-xs text-muted-foreground">Plan</div><Badge>{sub?.plan || org.plan}</Badge></div>
          <div className="rounded-lg bg-muted/50 p-3"><div className="text-xs text-muted-foreground">Status</div><Badge className={cn(org.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>{sub?.status || org.status}</Badge></div>
          <div className="rounded-lg bg-muted/50 p-3"><div className="text-xs text-muted-foreground">Voter Quota</div><div className="font-mono text-sm font-medium">{(sub?.voterQuota || org.voterQuota || 0).toLocaleString()}</div></div>
          <div className="rounded-lg bg-muted/50 p-3"><div className="text-xs text-muted-foreground">Voters Used</div><div className="font-mono text-sm font-medium">{(sub?.votersUsed || 0).toLocaleString()}</div></div>
        </div>
        <Alert><CreditCard className="h-4 w-4" /><AlertDescription>Pay ₦500/voter to go live. Payment via Paystack. Your trial is active until you pay.</AlertDescription></Alert>
        <Button className="gap-2"><CreditCard className="h-4 w-4" /> Pay to Go Live</Button>
      </CardContent>
    </Card>
  )
}

function NotificationsTab({ settings, saving, onSave }: any) {
  const [form, setForm] = useState({ notifyEmail: settings.notifyEmail, notifySms: settings.notifySms, notifyWhatsapp: settings.notifyWhatsapp })
  return (
    <Card>
      <CardHeader><CardTitle className="font-display text-base">Notification Channels</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <ToggleRow label="Email Notifications" desc="Send election updates, OTPs, and alerts via email." value={form.notifyEmail} onChange={(v) => setForm((f) => ({ ...f, notifyEmail: v }))} />
        <ToggleRow label="SMS Notifications" desc="Send via SMS (additional charges may apply)." value={form.notifySms} onChange={(v) => setForm((f) => ({ ...f, notifySms: v }))} />
        <ToggleRow label="WhatsApp Notifications" desc="Send via WhatsApp." value={form.notifyWhatsapp} onChange={(v) => setForm((f) => ({ ...f, notifyWhatsapp: v }))} />
        <Button onClick={() => onSave({ settings: form })} disabled={saving} className="gap-2">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Save</Button>
      </CardContent>
    </Card>
  )
}

function OTPTab({ settings, saving, onSave }: any) {
  const [form, setForm] = useState({ defaultOtpChannel: settings.defaultOtpChannel, defaultOtpTtlSeconds: settings.defaultOtpTtlSeconds, defaultMaxOtpAttempts: settings.defaultMaxOtpAttempts })
  return (
    <Card>
      <CardHeader><CardTitle className="font-display text-base">OTP Preferences</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5"><Label>Default OTP Channel</Label><Select value={form.defaultOtpChannel} onValueChange={(v) => setForm((f) => ({ ...f, defaultOtpChannel: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="EMAIL">Email</SelectItem><SelectItem value="SMS">SMS</SelectItem><SelectItem value="WHATSAPP">WhatsApp</SelectItem></SelectContent></Select></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>OTP TTL (seconds)</Label><Input type="number" value={form.defaultOtpTtlSeconds} onChange={(e) => setForm((f) => ({ ...f, defaultOtpTtlSeconds: parseInt(e.target.value) || 600 }))} /></div>
          <div className="space-y-1.5"><Label>Max OTP Attempts</Label><Input type="number" value={form.defaultMaxOtpAttempts} onChange={(e) => setForm((f) => ({ ...f, defaultMaxOtpAttempts: parseInt(e.target.value) || 5 }))} /></div>
        </div>
        <Button onClick={() => onSave({ settings: form })} disabled={saving} className="gap-2">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Save</Button>
      </CardContent>
    </Card>
  )
}

function ElectionDefaultsTab({ settings, saving, onSave }: any) {
  const [form, setForm] = useState({
    defaultRequireAccreditation: settings.defaultRequireAccreditation,
    defaultBallotRandomization: settings.defaultBallotRandomization,
    defaultNotaEnabled: settings.defaultNotaEnabled,
    defaultPublicLiveResults: settings.defaultPublicLiveResults,
  })
  return (
    <Card>
      <CardHeader><CardTitle className="font-display text-base">Election Defaults</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <ToggleRow label="Require Accreditation" desc="Voters must complete accreditation before voting." value={form.defaultRequireAccreditation} onChange={(v) => setForm((f) => ({ ...f, defaultRequireAccreditation: v }))} />
        <ToggleRow label="Ballot Randomization" desc="Shuffle candidate order per voter to remove bias." value={form.defaultBallotRandomization} onChange={(v) => setForm((f) => ({ ...f, defaultBallotRandomization: v }))} />
        <ToggleRow label="NOTA Enabled" desc="Include None-of-the-Above option on every position." value={form.defaultNotaEnabled} onChange={(v) => setForm((f) => ({ ...f, defaultNotaEnabled: v }))} />
        <ToggleRow label="Public Live Results" desc="Show real-time results publicly on the homepage." value={form.defaultPublicLiveResults} onChange={(v) => setForm((f) => ({ ...f, defaultPublicLiveResults: v }))} />
        <Button onClick={() => onSave({ settings: form })} disabled={saving} className="gap-2">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Save</Button>
      </CardContent>
    </Card>
  )
}

function AuditTab({ subdomain }: any) {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    api.workspaceDashboard(subdomain).then((d: any) => { setLogs(d.recentActivity || []) }).catch(() => {}).finally(() => setLoading(false))
  }, [subdomain])
  return (
    <Card>
      <CardHeader><CardTitle className="font-display text-base">Audit Log</CardTitle></CardHeader>
      <CardContent className="p-0">
        <div className="votewise-scroll max-h-[60vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur"><tr className="text-left"><th className="p-3">Time</th><th className="p-3">Actor</th><th className="p-3">Action</th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={3} className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>}
              {!loading && logs.length === 0 && <tr><td colSpan={3} className="p-8 text-center text-muted-foreground">No audit entries.</td></tr>}
              {logs.map((l) => (
                <tr key={l.id} className="border-t border-border"><td className="p-3 font-mono text-xs text-muted-foreground">{new Date(l.createdAt).toLocaleString()}</td><td className="p-3">{l.actorName}</td><td className="p-3"><Badge variant="outline" className="font-mono text-[10px]">{l.action}</Badge></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

function ToggleRow({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
      <div className="flex-1 pr-4"><div className="text-sm font-medium">{label}</div><div className="text-xs text-muted-foreground">{desc}</div></div>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  )
}
