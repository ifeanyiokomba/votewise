'use client'

import { useState } from 'react'
import {
  ArrowLeft, Building2, Users, Shield, CheckCircle2, Loader2,
  AlertCircle, Upload, Palette, Sparkles, Heart, Church, Briefcase,
  Landmark, Store, Dumbbell, Home, Award, Users2, Network, PartyPopper,
  GraduationCap, BookOpen, Layers, Globe, Zap,
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
  { value: 'COMMUNITY', icon: Home, label: 'Community' },
  { value: 'CLUB', icon: Users, label: 'Club' },
  { value: 'ASSOCIATION', icon: Network, label: 'Association' },
  { value: 'TRADE_UNION', icon: Users2, label: 'Trade Union' },
  { value: 'MARKET_ASSOCIATION', icon: Store, label: 'Market Association' },
  { value: 'RESIDENT_ASSOCIATION', icon: Home, label: 'Resident Association' },
  { value: 'SPORTS_CLUB', icon: Dumbbell, label: 'Sports Club' },
  { value: 'OTHER', icon: Building2, label: 'Other' },
]

// Preset terminology bundles — selecting a category auto-suggests terminology.
const TERMINOLOGY_PRESETS: Record<string, any> = {
  UNIVERSITY: { organizationLabel: 'University', workspaceLabel: 'Faculty', voterGroupLabel: 'Department', voterLabel: 'Student', candidateLabel: 'Aspirant' },
  POLYTECHNIC: { organizationLabel: 'Polytechnic', workspaceLabel: 'School', voterGroupLabel: 'Department', voterLabel: 'Student', candidateLabel: 'Aspirant' },
  COLLEGE: { organizationLabel: 'College', workspaceLabel: 'School', voterGroupLabel: 'Department', voterLabel: 'Student', candidateLabel: 'Aspirant' },
  STUDENT_UNION: { organizationLabel: 'Student Union', workspaceLabel: 'Faculty', voterGroupLabel: 'Department', voterLabel: 'Student', candidateLabel: 'Aspirant' },
  CHURCH: { organizationLabel: 'Church', workspaceLabel: 'Parish', voterGroupLabel: 'Fellowship', voterLabel: 'Member', candidateLabel: 'Candidate' },
  MOSQUE: { organizationLabel: 'Mosque', workspaceLabel: 'Branch', voterGroupLabel: 'Unit', voterLabel: 'Member', candidateLabel: 'Candidate' },
  NGO: { organizationLabel: 'Organization', workspaceLabel: 'Chapter', voterGroupLabel: 'Branch', voterLabel: 'Member', candidateLabel: 'Candidate' },
  POLITICAL_PARTY: { organizationLabel: 'Party', workspaceLabel: 'State Chapter', voterGroupLabel: 'Ward', voterLabel: 'Member', candidateLabel: 'Candidate' },
  GOVERNMENT: { organizationLabel: 'Agency', workspaceLabel: 'Department', voterGroupLabel: 'Unit', voterLabel: 'Staff', candidateLabel: 'Candidate' },
  COMPANY: { organizationLabel: 'Company', workspaceLabel: 'Division', voterGroupLabel: 'Department', voterLabel: 'Employee', candidateLabel: 'Candidate' },
  COOPERATIVE: { organizationLabel: 'Cooperative', workspaceLabel: 'Branch', voterGroupLabel: 'Unit', voterLabel: 'Member', candidateLabel: 'Candidate' },
  PROFESSIONAL_BODY: { organizationLabel: 'Association', workspaceLabel: 'State Chapter', voterGroupLabel: 'Branch', voterLabel: 'Member', candidateLabel: 'Candidate' },
  COMMUNITY: { organizationLabel: 'Community', workspaceLabel: 'Village', voterGroupLabel: 'Household', voterLabel: 'Member', candidateLabel: 'Candidate' },
  CLUB: { organizationLabel: 'Club', workspaceLabel: 'Chapter', voterGroupLabel: 'Group', voterLabel: 'Member', candidateLabel: 'Candidate' },
  ASSOCIATION: { organizationLabel: 'Association', workspaceLabel: 'Chapter', voterGroupLabel: 'Branch', voterLabel: 'Member', candidateLabel: 'Candidate' },
  TRADE_UNION: { organizationLabel: 'Union', workspaceLabel: 'State Chapter', voterGroupLabel: 'Branch', voterLabel: 'Member', candidateLabel: 'Candidate' },
  MARKET_ASSOCIATION: { organizationLabel: 'Association', workspaceLabel: 'Section', voterGroupLabel: 'Line', voterLabel: 'Trader', candidateLabel: 'Candidate' },
  RESIDENT_ASSOCIATION: { organizationLabel: 'Association', workspaceLabel: 'Estate', voterGroupLabel: 'Street', voterLabel: 'Resident', candidateLabel: 'Candidate' },
  SPORTS_CLUB: { organizationLabel: 'Club', workspaceLabel: 'Team', voterGroupLabel: 'Squad', voterLabel: 'Member', candidateLabel: 'Candidate' },
  ALUMNI_ASSOCIATION: { organizationLabel: 'Association', workspaceLabel: 'Chapter', voterGroupLabel: 'Set', voterLabel: 'Alumnus', candidateLabel: 'Candidate' },
  OTHER: { organizationLabel: 'Organization', workspaceLabel: 'Workspace', voterGroupLabel: 'Voter Group', voterLabel: 'Voter', candidateLabel: 'Candidate' },
}

export function SignupView() {
  const { setView, setOfficial } = useApp()
  const [step, setStep] = useState(1)
  const [category, setCategory] = useState('UNIVERSITY')
  const [form, setForm] = useState<any>({
    primaryColour: '#15803d',
    accentColour: '#b45309',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))

  function selectCategory(cat: string) {
    setCategory(cat)
    // Auto-apply terminology preset (user can still override in step 3)
    const preset = TERMINOLOGY_PRESETS[cat]
    if (preset) {
      setForm((f: any) => ({ ...f, ...preset }))
    }
  }

  function onLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 1024 * 1024) { toast.error('Logo must be under 1MB'); return }
    const reader = new FileReader()
    reader.onload = (ev) => set('logoUrl', ev.target?.result)
    reader.readAsDataURL(file)
  }

  async function submit() {
    setBusy(true); setError(null)
    try {
      const d = await api.registerOrganization({
        name: form.name,
        category,
        description: form.description,
        primaryColour: form.primaryColour,
        accentColour: form.accentColour,
        logoUrl: form.logoUrl,
        ownerName: form.ownerName,
        ownerEmail: form.ownerEmail,
        ownerPassword: form.ownerPassword,
        terminology: {
          organizationLabel: form.organizationLabel,
          workspaceLabel: form.workspaceLabel,
          voterGroupLabel: form.voterGroupLabel,
          voterLabel: form.voterLabel,
          candidateLabel: form.candidateLabel,
        },
      })
      setOfficial(d.official)
      toast.success(`${d.organization.name} created! Welcome, ${d.member.name}.`)
      setView('official')
    } catch (e: any) { setError(e.message) } finally { setBusy(false) }
  }

  const canProceedStep1 = form.name && form.name.trim().length >= 2
  const canProceedStep2 = form.ownerName && form.ownerEmail && form.ownerPassword?.length >= 8

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <Button variant="ghost" size="sm" onClick={() => setView('home')} className="mb-4 gap-1.5">
        <ArrowLeft className="h-4 w-4" /> Back to home
      </Button>

      <div className="mb-6 text-center">
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          <Sparkles className="h-3.5 w-3.5" /> Simple Onboarding · Under 5 Minutes
        </div>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Register Your Organization</h1>
        <p className="mx-auto mt-2 max-w-md text-muted-foreground">
          Any organization. University, company, church, NGO, cooperative, association — VoteWise works for all of them.
        </p>
      </div>

      {/* Step indicator */}
      <div className="mb-6 flex items-center justify-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className={cn('flex items-center gap-2', s < step && 'text-emerald-600')}>
            <div className={cn('grid h-8 w-8 place-items-center rounded-full text-sm font-bold', s === step ? 'bg-primary text-primary-foreground' : s < step ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground')}>
              {s < step ? <CheckCircle2 className="h-4 w-4" /> : s}
            </div>
            <span className={cn('hidden text-xs sm:inline', s === step ? 'font-medium' : 'text-muted-foreground')}>
              {s === 1 ? 'Organization' : s === 2 ? 'Owner Account' : 'Branding & Terms'}
            </span>
            {s < 3 && <div className={cn('h-0.5 w-8', s < step ? 'bg-emerald-500' : 'bg-muted')} />}
          </div>
        ))}
      </div>

      {error && <Alert variant="destructive" className="mb-4"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}

      {/* Step 1: Organization details */}
      {step === 1 && (
        <Card className="votewise-card-glow">
          <CardHeader><CardTitle className="font-display">Organization Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Organization Name <span className="text-destructive">*</span></Label>
              <Input value={form.name || ''} onChange={(e) => set('name', e.target.value)} placeholder="e.g. University of Lagos, MTN Nigeria, Red Cross Nigeria" />
              <p className="text-xs text-muted-foreground">This is your organization&apos;s public name on VoteWise.</p>
            </div>

            <div className="space-y-1.5">
              <Label>Description (optional)</Label>
              <Input value={form.description || ''} onChange={(e) => set('description', e.target.value)} placeholder="A short description of your organization" />
            </div>

            {/* Organization category selector */}
            <div>
              <Label className="mb-2 block">Organization Category</Label>
              <p className="mb-2 text-xs text-muted-foreground">
                Purely informational — VoteWise treats every organization the same regardless of category. This just helps us suggest the right terminology.
              </p>
              <div className="votewise-scroll grid max-h-64 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
                {ORG_CATEGORIES.map((c) => (
                  <button key={c.value} onClick={() => selectCategory(c.value)}
                    className={cn('flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-all', category === c.value ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-muted/50')}>
                    <c.icon className={cn('h-5 w-5', category === c.value ? 'text-primary' : 'text-muted-foreground')} />
                    <span className="text-[11px] font-medium leading-tight">{c.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <Button onClick={() => setStep(2)} disabled={!canProceedStep1} className="w-full gap-2">Continue <Shield className="h-4 w-4" /></Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Owner account */}
      {step === 2 && (
        <Card className="votewise-card-glow">
          <CardHeader><CardTitle className="font-display">Owner Account</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              You will be the <strong className="text-foreground">Organization Owner</strong> with full control: create elections, invite admins, manage billing, configure branding, and connect a custom domain.
            </p>
            <div className="space-y-1.5">
              <Label>Your Full Name <span className="text-destructive">*</span></Label>
              <Input value={form.ownerName || ''} onChange={(e) => set('ownerName', e.target.value)} placeholder="e.g. Dr. Okon Edu" />
            </div>
            <div className="space-y-1.5">
              <Label>Email <span className="text-destructive">*</span></Label>
              <Input type="email" value={form.ownerEmail || ''} onChange={(e) => set('ownerEmail', e.target.value.toLowerCase())} placeholder="you@yourorganization.org" />
            </div>
            <div className="space-y-1.5">
              <Label>Password <span className="text-destructive">*</span></Label>
              <Input type="password" value={form.ownerPassword || ''} onChange={(e) => set('ownerPassword', e.target.value)} placeholder="At least 8 characters" />
            </div>
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertTitle>Owner privileges</AlertTitle>
              <AlertDescription>
                Full control of your organization. You can enable 2FA from your account settings after sign-up. Ownership can be transferred later.
              </AlertDescription>
            </Alert>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)} className="gap-1.5"><ArrowLeft className="h-4 w-4" /> Back</Button>
              <Button onClick={() => setStep(3)} disabled={!canProceedStep2} className="flex-1 gap-2">Continue <Palette className="h-4 w-4" /></Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Branding + terminology */}
      {step === 3 && (
        <Card className="votewise-card-glow">
          <CardHeader><CardTitle className="font-display">Branding &amp; Terminology</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {/* Logo upload */}
            <div className="space-y-1.5">
              <Label>Organization Logo</Label>
              <div className="flex items-center gap-4 rounded-lg border-2 border-dashed border-border p-4">
                {form.logoUrl ? (
                  <img src={form.logoUrl} alt="Logo" className="h-16 w-16 rounded-lg object-contain" />
                ) : (
                  <div className="grid h-16 w-16 place-items-center rounded-lg text-white" style={{ backgroundColor: form.primaryColour }}>
                    <Building2 className="h-8 w-8" />
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Upload your organization&apos;s logo (optional, under 1MB).</p>
                  <Button size="sm" variant="outline" onClick={() => document.getElementById('logo-upload')?.click()} className="mt-2 gap-1.5">
                    <Upload className="h-3.5 w-3.5" /> Upload Logo
                  </Button>
                  <input id="logo-upload" type="file" accept="image/*" className="hidden" onChange={onLogoUpload} />
                </div>
              </div>
            </div>

            {/* Colour pickers */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Primary Colour</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={form.primaryColour} onChange={(e) => set('primaryColour', e.target.value)} className="h-10 w-14 cursor-pointer rounded border border-border" />
                  <Input value={form.primaryColour} onChange={(e) => set('primaryColour', e.target.value)} className="font-mono text-sm" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Accent Colour</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={form.accentColour} onChange={(e) => set('accentColour', e.target.value)} className="h-10 w-14 cursor-pointer rounded border border-border" />
                  <Input value={form.accentColour} onChange={(e) => set('accentColour', e.target.value)} className="font-mono text-sm" />
                </div>
              </div>
            </div>

            {/* Terminology configuration (Principle 4) */}
            <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
              <div className="mb-2 flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-primary" />
                <h4 className="font-display text-sm font-semibold">Your Terminology</h4>
                <Badge variant="secondary" className="ml-auto text-[10px]">Principle 4</Badge>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">
                Configure your own terms instead of VoteWise hardcoding &ldquo;University&rdquo;, &ldquo;Faculty&rdquo;, &ldquo;Department&rdquo;. Pre-filled based on your category — override as needed.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px]">Organization →</Label>
                  <Input value={form.organizationLabel || 'Organization'} onChange={(e) => set('organizationLabel', e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Workspace →</Label>
                  <Input value={form.workspaceLabel || 'Workspace'} onChange={(e) => set('workspaceLabel', e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Voter Group →</Label>
                  <Input value={form.voterGroupLabel || 'Voter Group'} onChange={(e) => set('voterGroupLabel', e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Voter →</Label>
                  <Input value={form.voterLabel || 'Voter'} onChange={(e) => set('voterLabel', e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Candidate →</Label>
                  <Input value={form.candidateLabel || 'Candidate'} onChange={(e) => set('candidateLabel', e.target.value)} className="h-8 text-sm" />
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="rounded-lg border border-border p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Preview</div>
              <div className="mt-2 flex items-center gap-3">
                {form.logoUrl ? (
                  <img src={form.logoUrl} alt="Logo" className="h-12 w-12 rounded-xl object-contain" />
                ) : (
                  <div className="grid h-12 w-12 place-items-center rounded-xl text-white" style={{ backgroundColor: form.primaryColour }}>
                    <Building2 className="h-6 w-6" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-display text-lg font-bold truncate">{form.name || 'Your Organization'}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {form.organizationLabel || 'Organization'} · {form.workspaceLabel || 'Workspace'} · {form.voterGroupLabel || 'Voter Group'}
                  </div>
                </div>
                <Badge className="ml-auto shrink-0" style={{ backgroundColor: form.accentColour, color: '#fff' }}>
                  {form.voterLabel || 'Voter'} Election
                </Badge>
              </div>
              <div className="mt-2 flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
                <Globe className="h-3 w-3" />
                {form.name ? form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) : 'your-org'}.votewise.ng
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)} className="gap-1.5"><ArrowLeft className="h-4 w-4" /> Back</Button>
              <Button onClick={submit} disabled={busy} className="flex-1 gap-2">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {busy ? 'Creating…' : 'Create Organization'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
