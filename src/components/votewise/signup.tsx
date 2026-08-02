'use client'

import { useState, useEffect } from 'react'
import {
  ArrowLeft, ArrowRight, Building2, Shield, CheckCircle2, Loader2,
  AlertCircle, Upload, Palette, Sparkles, Heart, Church, Briefcase,
  Landmark, Store, Dumbbell, Home as HomeIcon, Award, Users, Users2, Network, PartyPopper,
  GraduationCap, BookOpen, Globe, Zap, User, Mail, Phone, Lock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useApp } from '@/lib/store'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// The 20+ organization categories. Purely informational — never gates features.
const ORG_CATEGORIES = [
  { value: 'UNIVERSITY', icon: GraduationCap, label: 'University' },
  { value: 'POLYTECHNIC', icon: BookOpen, label: 'Polytechnic' },
  { value: 'COLLEGE', icon: BookOpen, label: 'College' },
  { value: 'STUDENT_UNION', icon: Users2, label: 'Student Union' },
  { value: 'ALUMNI_ASSOCIATION', icon: Users, label: 'Alumni Association' },
  { value: 'CHURCH', icon: Church, label: 'Church' },
  { value: 'MOSQUE', icon: Landmark, label: 'Mosque' },
  { value: 'NGO', icon: Heart, label: 'NGO' },
  { value: 'POLITICAL_PARTY', icon: PartyPopper, label: 'Political Party' },
  { value: 'GOVERNMENT', icon: Landmark, label: 'Government Agency' },
  { value: 'COMPANY', icon: Briefcase, label: 'Company' },
  { value: 'COOPERATIVE', icon: Users2, label: 'Cooperative' },
  { value: 'PROFESSIONAL_BODY', icon: Award, label: 'Professional Body' },
  { value: 'COMMUNITY', icon: HomeIcon, label: 'Community' },
  { value: 'CLUB', icon: Users, label: 'Club' },
  { value: 'ASSOCIATION', icon: Network, label: 'Association' },
  { value: 'TRADE_UNION', icon: Users2, label: 'Trade Union' },
  { value: 'MARKET_ASSOCIATION', icon: Store, label: 'Market Association' },
  { value: 'RESIDENT_ASSOCIATION', icon: HomeIcon, label: 'Resident Association' },
  { value: 'SPORTS_CLUB', icon: Dumbbell, label: 'Sports Club' },
  { value: 'OTHER', icon: Building2, label: 'Other' },
]

const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue',
  'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu',
  'FCT (Abuja)', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina',
  'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo',
  'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
]

const TIMEZONES = [
  'Africa/Lagos', 'Africa/Abidjan', 'Africa/Accra', 'Africa/Addis_Ababa',
  'Africa/Cairo', 'Africa/Casablanca', 'Africa/Johannesburg', 'Africa/Nairobi',
  'UTC',
]

export function SignupView() {
  const { setView, setOfficial } = useApp()
  const [step, setStep] = useState(1)
  const [category, setCategory] = useState('UNIVERSITY')
  const [form, setForm] = useState<any>({
    primaryColour: '#15803d',
    accentColour: '#b45309',
    secondaryColour: '#166534',
    timezone: 'Africa/Lagos',
    country: 'Nigeria',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Subdomain check state (Step 4)
  const [subdomain, setSubdomain] = useState('')
  const [subCheck, setSubCheck] = useState<any>(null)
  const [checking, setChecking] = useState(false)
  // Creation result (Step 5)
  const [created, setCreated] = useState<any>(null)

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))

  // --- Step 4: live subdomain availability check ---
  useEffect(() => {
    if (step !== 4 || !subdomain) { setSubCheck(null); return }
    const sub = subdomain.toLowerCase().trim()
    if (!/^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(sub)) {
      setSubCheck({ available: false, error: 'Must be 3-30 chars: lowercase letters, numbers, hyphens.' })
      return
    }
    setChecking(true)
    const t = setTimeout(() => {
      api.checkSubdomain(sub).then((d) => { setSubCheck(d); setChecking(false) }).catch(() => { setChecking(false) })
    }, 400) // debounce
    return () => clearTimeout(t)
  }, [subdomain, step])

  function onLogoUpload(e: React.ChangeEvent<HTMLInputElement>, field: string) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 1024 * 1024) { toast.error('Logo must be under 1MB'); return }
    const reader = new FileReader()
    reader.onload = (ev) => set(field, ev.target?.result)
    reader.readAsDataURL(file)
  }

  // --- Step 5: create the workspace ---
  async function createWorkspace() {
    setBusy(true); setError(null)
    try {
      const d = await api.registerOrganization({
        name: form.orgName,
        category,
        description: form.description,
        primaryColour: form.primaryColour,
        secondaryColour: form.secondaryColour,
        accentColour: form.accentColour,
        logoUrl: form.logoUrl,
        ownerName: form.fullName,
        ownerEmail: form.email,
        ownerPassword: form.password,
        ownerPhone: form.phone,
        country: form.country,
        state: form.state,
        timezone: form.timezone,
        subdomain,
        template: form.template || category.toLowerCase(),
      })
      setOfficial(d.official)
      setCreated(d)
      setStep(5)
      toast.success(`${d.organization.name} workspace created!`)
    } catch (e: any) { setError(e.message) } finally { setBusy(false) }
  }

  // Validation per step
  const canStep1 = form.fullName && form.email && form.phone && form.password?.length >= 12 && /[A-Z]/.test(form.password) && /[a-z]/.test(form.password) && /[0-9]/.test(form.password) && /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(form.password) && form.password === form.confirmPassword
  const canStep2 = form.orgName && form.country && form.state && form.timezone
  const canStep4 = subCheck?.available === true

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <Button variant="ghost" size="sm" onClick={() => step === 1 ? setView('home') : setStep(step - 1)} className="mb-4 gap-1.5">
        <ArrowLeft className="h-4 w-4" /> {step === 1 ? 'Back to home' : 'Back'}
      </Button>

      <div className="mb-6 text-center">
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          <Sparkles className="h-3.5 w-3.5" /> Simple Onboarding · Under 5 Minutes
        </div>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Register Your Organization</h1>
        <p className="mx-auto mt-2 max-w-md text-muted-foreground">
          Any organization. University, company, church, NGO, cooperative — VoteWise works for all of them.
        </p>
      </div>

      {/* Step indicator */}
      <div className="mb-6 flex items-center justify-center gap-1.5">
        {[1, 2, 3, 4, 5].map((s) => (
          <div key={s} className={cn('flex items-center gap-1.5', s < step && 'text-emerald-600')}>
            <div className={cn('grid h-7 w-7 place-items-center rounded-full text-xs font-bold', s === step ? 'bg-primary text-primary-foreground' : s < step ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground')}>
              {s < step ? <CheckCircle2 className="h-3.5 w-3.5" /> : s}
            </div>
            <span className={cn('hidden text-xs sm:inline', s === step ? 'font-medium' : 'text-muted-foreground')}>
              {s === 1 ? 'Personal' : s === 2 ? 'Organization' : s === 3 ? 'Branding' : s === 4 ? 'Subdomain' : 'Done'}
            </span>
            {s < 5 && <div className={cn('h-0.5 w-4', s < step ? 'bg-emerald-500' : 'bg-muted')} />}
          </div>
        ))}
      </div>

      {error && <Alert variant="destructive" className="mb-4"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}

      {/* === Step 1: Personal Information === */}
      {step === 1 && (
        <Card className="votewise-card-glow">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2"><User className="h-5 w-5 text-primary" /> Personal Information</CardTitle>
            <p className="text-sm text-muted-foreground">You will become the <strong className="text-foreground">Organization Owner</strong> with full control.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Full Name <span className="text-destructive">*</span></Label>
                <Input value={form.fullName || ''} onChange={(e) => set('fullName', e.target.value)} placeholder="Jane Doe" />
              </div>
              <div className="space-y-1.5">
                <Label>Email <span className="text-destructive">*</span></Label>
                <Input type="email" value={form.email || ''} onChange={(e) => set('email', e.target.value.toLowerCase())} placeholder="you@yourorg.org" />
              </div>
              <div className="space-y-1.5">
                <Label>Phone Number <span className="text-destructive">*</span></Label>
                <Input value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} placeholder="+234 801 234 5678" />
              </div>
              <div className="space-y-1.5">
                <Label>Password <span className="text-destructive">*</span></Label>
                <Input type="password" value={form.password || ''} onChange={(e) => set('password', e.target.value)} placeholder="Min 12 chars, 1 upper, 1 lower, 1 number, 1 special" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Confirm Password <span className="text-destructive">*</span></Label>
                <Input type="password" value={form.confirmPassword || ''} onChange={(e) => set('confirmPassword', e.target.value)} placeholder="Re-enter password" />
                {form.password && form.confirmPassword && form.password !== form.confirmPassword && (
                  <p className="text-xs text-destructive">Passwords do not match.</p>
                )}
              </div>
            </div>
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertTitle>Owner privileges</AlertTitle>
              <AlertDescription>Full control: create elections, invite admins, manage billing, configure branding, connect domains. Ownership can be transferred later.</AlertDescription>
            </Alert>
            <Button onClick={() => setStep(2)} disabled={!canStep1} className="w-full gap-2">Continue <ArrowRight className="h-4 w-4" /></Button>
          </CardContent>
        </Card>
      )}

      {/* === Step 2: Organization Information === */}
      {step === 2 && (
        <Card className="votewise-card-glow">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" /> Organization Information</CardTitle>
            <p className="text-sm text-muted-foreground">Tell us about your organization. Nothing university-specific.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Organization Name <span className="text-destructive">*</span></Label>
              <Input value={form.orgName || ''} onChange={(e) => set('orgName', e.target.value)} placeholder="e.g. Lagos Medical Association" />
            </div>
            <div>
              <Label className="mb-2 block">Organization Type</Label>
              <div className="votewise-scroll grid max-h-48 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
                {ORG_CATEGORIES.map((c) => (
                  <button key={c.value} onClick={() => { setCategory(c.value); set('template', c.value.toLowerCase()) }}
                    className={cn('flex flex-col items-center gap-1 rounded-lg border p-2.5 text-center transition-all', category === c.value ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-muted/50')}>
                    <c.icon className={cn('h-4 w-4', category === c.value ? 'text-primary' : 'text-muted-foreground')} />
                    <span className="text-[10px] font-medium leading-tight">{c.label}</span>
                  </button>
                ))}
              </div>
            </div>
            {/* Chapter 6: Workspace Template selection */}
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/30">
              <Label className="mb-1 block text-xs font-semibold text-blue-700 dark:text-blue-400">Workspace Template</Label>
              <p className="mb-2 text-xs text-muted-foreground">Preconfigures voter fields, org units, and terminology based on your type. You can change everything later.</p>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="gap-1"><Sparkles className="h-3 w-3" /> {category === 'UNIVERSITY' ? 'University template' : category === 'COMPANY' ? 'Company template' : category === 'CHURCH' ? 'Church template' : category === 'NGO' ? 'NGO template' : category === 'MARKET_ASSOCIATION' ? 'Market template' : category === 'GOVERNMENT' ? 'Government template' : category === 'OTHER' ? 'Blank workspace' : 'Auto-selected'}</Badge>
                <Button size="sm" variant="ghost" onClick={() => set('template', 'blank')} className="text-xs">Use Blank Instead</Button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Country</Label>
                <Input value={form.country || 'Nigeria'} onChange={(e) => set('country', e.target.value)} placeholder="Nigeria" />
              </div>
              <div className="space-y-1.5">
                <Label>State <span className="text-destructive">*</span></Label>
                <Input list="states" value={form.state || ''} onChange={(e) => set('state', e.target.value)} placeholder="Lagos" />
                <datalist id="states">{NIGERIAN_STATES.map((s) => <option key={s} value={s} />)}</datalist>
              </div>
              <div className="space-y-1.5">
                <Label>Timezone <span className="text-destructive">*</span></Label>
                <Input list="tzs" value={form.timezone || 'Africa/Lagos'} onChange={(e) => set('timezone', e.target.value)} />
                <datalist id="tzs">{TIMEZONES.map((t) => <option key={t} value={t} />)}</datalist>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description (optional)</Label>
              <Input value={form.description || ''} onChange={(e) => set('description', e.target.value)} placeholder="A short description of your organization" />
            </div>
            <Button onClick={() => setStep(3)} disabled={!canStep2} className="w-full gap-2">Continue <ArrowRight className="h-4 w-4" /></Button>
          </CardContent>
        </Card>
      )}

      {/* === Step 3: Branding (optional) === */}
      {step === 3 && (
        <Card className="votewise-card-glow">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2"><Palette className="h-5 w-5 text-primary" /> Branding</CardTitle>
            <p className="text-sm text-muted-foreground">Optional — you can change this later in Settings.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Logo uploads */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Logo</Label>
                <div className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border p-3">
                  {form.logoUrl ? <img src={form.logoUrl} alt="Logo" className="h-14 w-14 rounded-lg object-contain" /> : <Building2 className="h-10 w-10 text-muted-foreground/40" />}
                  <Button size="sm" variant="outline" onClick={() => document.getElementById('logo-upload')?.click()} className="gap-1 text-xs"><Upload className="h-3 w-3" /> Upload</Button>
                  <input id="logo-upload" type="file" accept="image/*" className="hidden" onChange={(e) => onLogoUpload(e, 'logoUrl')} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Dark Mode Logo</Label>
                <div className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border p-3">
                  {form.darkModeLogoUrl ? <img src={form.darkModeLogoUrl} alt="Dark logo" className="h-14 w-14 rounded-lg object-contain" /> : <Building2 className="h-10 w-10 text-muted-foreground/40" />}
                  <Button size="sm" variant="outline" onClick={() => document.getElementById('dark-logo-upload')?.click()} className="gap-1 text-xs"><Upload className="h-3 w-3" /> Upload</Button>
                  <input id="dark-logo-upload" type="file" accept="image/*" className="hidden" onChange={(e) => onLogoUpload(e, 'darkModeLogoUrl')} />
                </div>
              </div>
            </div>
            {/* Colour pickers */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                { key: 'primaryColour', label: 'Primary' },
                { key: 'secondaryColour', label: 'Secondary' },
                { key: 'accentColour', label: 'Accent' },
              ].map((c) => (
                <div key={c.key} className="space-y-1.5">
                  <Label>{c.label} Colour</Label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={form[c.key]} onChange={(e) => set(c.key, e.target.value)} className="h-10 w-12 cursor-pointer rounded border border-border" />
                    <Input value={form[c.key]} onChange={(e) => set(c.key, e.target.value)} className="font-mono text-xs" />
                  </div>
                </div>
              ))}
            </div>
            {/* Preview */}
            <div className="rounded-lg border border-border p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Preview</div>
              <div className="mt-2 flex items-center gap-3">
                {form.logoUrl ? <img src={form.logoUrl} alt="Logo" className="h-11 w-11 rounded-xl object-contain" /> : <div className="grid h-11 w-11 place-items-center rounded-xl text-white" style={{ backgroundColor: form.primaryColour }}><Building2 className="h-5 w-5" /></div>}
                <div className="min-w-0 flex-1">
                  <div className="font-display text-base font-bold truncate">{form.orgName || 'Your Organization'}</div>
                  <div className="text-xs text-muted-foreground">{form.country} · {form.state}</div>
                </div>
                <Badge style={{ backgroundColor: form.accentColour, color: '#fff' }}>Election Platform</Badge>
              </div>
            </div>
            <Button onClick={() => setStep(4)} className="w-full gap-2">Continue <ArrowRight className="h-4 w-4" /></Button>
          </CardContent>
        </Card>
      )}

      {/* === Step 4: Choose Subdomain === */}
      {step === 4 && (
        <Card className="votewise-card-glow">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2"><Globe className="h-5 w-5 text-primary" /> Choose Your Subdomain</CardTitle>
            <p className="text-sm text-muted-foreground">This is your workspace URL. You can connect a custom domain later.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Subdomain</Label>
              <div className="flex items-center gap-2">
                <Input value={subdomain} onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} placeholder="marketunion" className="font-mono" />
                <span className="shrink-0 font-mono text-sm text-muted-foreground">.votewise.com.ng</span>
              </div>
              {subdomain && (
                <div className="mt-2">
                  {checking ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Checking availability…</div>
                  ) : subCheck?.error ? (
                    <div className="flex items-center gap-2 text-sm text-destructive"><AlertCircle className="h-4 w-4" /> {subCheck.error}</div>
                  ) : subCheck?.available ? (
                    <div className="flex items-center gap-2 text-sm text-emerald-600"><CheckCircle2 className="h-4 w-4" /> <strong>{subdomain}.votewise.com.ng</strong> is available!</div>
                  ) : subCheck && !subCheck.available ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-destructive"><AlertCircle className="h-4 w-4" /> <strong>{subdomain}.votewise.com.ng</strong> is already taken.</div>
                      {subCheck.suggestions?.length > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground">Try one of these:</p>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {subCheck.suggestions.map((s: any) => (
                              <button key={s.subdomain} onClick={() => setSubdomain(s.subdomain)} className="rounded-full border border-border bg-card px-3 py-1 text-xs font-mono transition-colors hover:border-primary hover:bg-primary/5">
                                {s.url}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
            <Alert>
              <Globe className="h-4 w-4" />
              <AlertTitle>Your workspace URL</AlertTitle>
              <AlertDescription>This is where your organization will access VoteWise. You can connect a custom domain (e.g. vote.yourorg.org) later from Settings → Domain.</AlertDescription>
            </Alert>
            <Button onClick={createWorkspace} disabled={!canStep4 || busy} className="w-full gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {busy ? 'Creating workspace…' : 'Create Workspace'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* === Step 5: Workspace Created === */}
      {step === 5 && created && (
        <Card className="votewise-card-glow">
          <CardContent className="p-8 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-100 text-emerald-600"><CheckCircle2 className="h-8 w-8" /></div>
            <h2 className="mt-4 font-display text-2xl font-bold">Workspace Created!</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              <strong className="text-foreground">{created.organization.name}</strong> is ready. Your workspace URL is{' '}
              <span className="font-mono text-primary">{created.organization.subdomain}.votewise.com.ng</span>
            </p>
            <div className="mx-auto mt-6 grid max-w-md grid-cols-2 gap-3 text-left">
              <div className="rounded-lg bg-muted/50 p-3"><div className="text-xs text-muted-foreground">Organization</div><div className="text-sm font-medium">{created.organization.name}</div></div>
              <div className="rounded-lg bg-muted/50 p-3"><div className="text-xs text-muted-foreground">Subdomain</div><div className="font-mono text-sm font-medium">{created.organization.subdomain}.votewise.com.ng</div></div>
              <div className="rounded-lg bg-muted/50 p-3"><div className="text-xs text-muted-foreground">Your Role</div><div className="text-sm font-medium">Organization Owner</div></div>
              <div className="rounded-lg bg-muted/50 p-3"><div className="text-xs text-muted-foreground">Plan</div><div className="text-sm font-medium">{created.organization.plan} (Trial)</div></div>
            </div>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button onClick={() => { window.location.href = `/workspace?org=${created.organization.subdomain}&onboard=1` }} className="gap-2">
                <Sparkles className="h-4 w-4" /> Start Setup Wizard
              </Button>
              <Button variant="outline" onClick={() => { window.location.href = `/workspace?org=${created.organization.subdomain}` }} className="gap-2">
                <Building2 className="h-4 w-4" /> Skip to Workspace
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">Your trial is active. Pay to go live when you&apos;re ready.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
