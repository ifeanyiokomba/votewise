'use client'

import { useState } from 'react'
import {
  ArrowLeft, Building2, GraduationCap, Users, Shield, CheckCircle2, Loader2,
  AlertCircle, Upload, Palette, Sparkles,
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

type OrgType = 'UNIVERSITY' | 'FACULTY' | 'DEPARTMENT'

export function SignupView() {
  const { setView, setOfficial } = useApp()
  const [step, setStep] = useState(1)
  const [orgType, setOrgType] = useState<OrgType>('UNIVERSITY')
  const [form, setForm] = useState<any>({
    primaryColour: '#15803d',
    accentColour: '#b45309',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))

  function generateDisplayName() {
    if (orgType === 'UNIVERSITY') return `${form.universityName || 'University'} SUG`
    if (orgType === 'FACULTY') return `${form.facultyName || 'Faculty'} — ${form.universityName || 'University'}`
    return `${form.departmentName || 'Department'} — ${form.facultyName || 'Faculty'}, ${form.universityName || 'University'}`
  }

  function onLogoUpload(e: React.ChangeEvent<HTMLInputElement>, field: string) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 1024 * 1024) { toast.error('Logo must be under 1MB'); return }
    const reader = new FileReader()
    reader.onload = (ev) => set(field, ev.target?.result)
    reader.readAsDataURL(file)
  }

  async function submit() {
    setBusy(true); setError(null)
    try {
      const displayName = form.displayName || generateDisplayName()
      const d = await api.registerTenant({
        type: orgType,
        institutionType: form.institutionType || 'FEDERAL',
        universityName: form.universityName,
        facultyName: orgType !== 'UNIVERSITY' ? form.facultyName : undefined,
        departmentName: orgType === 'DEPARTMENT' ? form.departmentName : undefined,
        displayName,
        primaryColour: form.primaryColour,
        accentColour: form.accentColour,
        logoUrl: form.logoUrl,
        universityLogoUrl: form.universityLogoUrl,
        adminName: form.adminName,
        adminEmail: form.adminEmail,
        adminPassword: form.adminPassword,
      })
      setOfficial(d.official)
      toast.success(`${d.tenant.displayName} created! Welcome, ${d.official.name}.`)
      setView('official')
    } catch (e: any) { setError(e.message) } finally { setBusy(false) }
  }

  const canProceedStep1 = form.universityName && (orgType === 'UNIVERSITY' || form.facultyName) && (orgType !== 'DEPARTMENT' || form.departmentName)
  const canProceedStep2 = form.adminName && form.adminEmail && form.adminPassword?.length >= 8

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <Button variant="ghost" size="sm" onClick={() => setView('home')} className="mb-4 gap-1.5">
        <ArrowLeft className="h-4 w-4" /> Back to home
      </Button>

      <div className="mb-6 text-center">
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          <Sparkles className="h-3.5 w-3.5" /> Get Started
        </div>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Set Up Your Election</h1>
        <p className="mx-auto mt-2 max-w-md text-muted-foreground">
          Register your university, faculty, or department to run a secure SUG election.
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
              {s === 1 ? 'Organization' : s === 2 ? 'Admin Account' : 'Branding'}
            </span>
            {s < 3 && <div className={cn('h-0.5 w-8', s < step ? 'bg-emerald-500' : 'bg-muted')} />}
          </div>
        ))}
      </div>

      {error && <Alert variant="destructive" className="mb-4"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}

      {/* Step 1: Organization type + names */}
      {step === 1 && (
        <Card className="afrivote-card-glow">
          <CardHeader><CardTitle className="font-display">Organization Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {/* Org type selector */}
            <div>
              <Label className="mb-2 block">Organization Type</Label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { type: 'UNIVERSITY', icon: Building2, label: 'University', desc: 'Full SUG election' },
                  { type: 'FACULTY', icon: GraduationCap, label: 'Faculty', desc: 'Faculty-level election' },
                  { type: 'DEPARTMENT', icon: Users, label: 'Department', desc: 'Dept-level election' },
                ] as const).map((o) => (
                  <button key={o.type} onClick={() => setOrgType(o.type)}
                    className={cn('flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-all', orgType === o.type ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-muted/50')}>
                    <o.icon className={cn('h-6 w-6', orgType === o.type ? 'text-primary' : 'text-muted-foreground')} />
                    <div>
                      <div className="text-sm font-medium">{o.label}</div>
                      <div className="text-[10px] text-muted-foreground">{o.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Institution type selector */}
            <div className="space-y-1.5">
              <Label>Institution Type</Label>
              <div className="flex flex-wrap gap-2">
                {(['FEDERAL', 'STATE', 'PRIVATE', 'POLYTECHNIC', 'COLLEGE_OF_EDUCATION'] as const).map((t) => (
                  <button key={t} onClick={() => set('institutionType', t)}
                    className={cn('rounded-full border px-3 py-1 text-xs transition-all', (form.institutionType || 'FEDERAL') === t ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted/50')}>
                    {t.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* University name — always required */}
            <div className="space-y-1.5">
              <Label>University Name <span className="text-destructive">*</span></Label>
              <Input value={form.universityName || ''} onChange={(e) => set('universityName', e.target.value)} placeholder="e.g. University of Lagos" />
            </div>

            {/* Faculty name — required for FACULTY and DEPARTMENT */}
            {orgType !== 'UNIVERSITY' && (
              <div className="space-y-1.5">
                <Label>Faculty Name <span className="text-destructive">*</span></Label>
                <Input value={form.facultyName || ''} onChange={(e) => set('facultyName', e.target.value)} placeholder="e.g. Faculty of Engineering" />
              </div>
            )}

            {/* Department name — required for DEPARTMENT */}
            {orgType === 'DEPARTMENT' && (
              <div className="space-y-1.5">
                <Label>Department Name <span className="text-destructive">*</span></Label>
                <Input value={form.departmentName || ''} onChange={(e) => set('departmentName', e.target.value)} placeholder="e.g. Computer Science" />
              </div>
            )}

            {/* Display name */}
            <div className="space-y-1.5">
              <Label>Display Name (optional)</Label>
              <Input value={form.displayName || ''} onChange={(e) => set('displayName', e.target.value)} placeholder={generateDisplayName()} />
              <p className="text-xs text-muted-foreground">This is how your election will appear across the platform.</p>
            </div>

            <Button onClick={() => setStep(2)} disabled={!canProceedStep1} className="w-full gap-2">Continue <Shield className="h-4 w-4" /></Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Admin account */}
      {step === 2 && (
        <Card className="afrivote-card-glow">
          <CardHeader><CardTitle className="font-display">Admin Account</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">This account will be the Super Admin for your organization's election platform.</p>
            <div className="space-y-1.5">
              <Label>Full Name <span className="text-destructive">*</span></Label>
              <Input value={form.adminName || ''} onChange={(e) => set('adminName', e.target.value)} placeholder="e.g. Dr. Okon Edu" />
            </div>
            <div className="space-y-1.5">
              <Label>Email <span className="text-destructive">*</span></Label>
              <Input type="email" value={form.adminEmail || ''} onChange={(e) => set('adminEmail', e.target.value.toLowerCase())} placeholder="admin@university.edu.ng" />
            </div>
            <div className="space-y-1.5">
              <Label>Password <span className="text-destructive">*</span></Label>
              <Input type="password" value={form.adminPassword || ''} onChange={(e) => set('adminPassword', e.target.value)} placeholder="At least 8 characters" />
            </div>
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertTitle>Admin privileges</AlertTitle>
              <AlertDescription>You'll be able to manage candidates, voters, officials, election settings, and certify results. You can enable 2FA from your account settings after sign-up.</AlertDescription>
            </Alert>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)} className="gap-1.5"><ArrowLeft className="h-4 w-4" /> Back</Button>
              <Button onClick={() => setStep(3)} disabled={!canProceedStep2} className="flex-1 gap-2">Continue <Palette className="h-4 w-4" /></Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Branding */}
      {step === 3 && (
        <Card className="afrivote-card-glow">
          <CardHeader><CardTitle className="font-display">Branding & Logo</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {/* Logo upload */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Organization Logo</Label>
                <div className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border p-4">
                  {form.logoUrl ? (
                    <img src={form.logoUrl} alt="Logo" className="h-16 w-16 rounded-lg object-contain" />
                  ) : (
                    <Building2 className="h-12 w-12 text-muted-foreground/40" />
                  )}
                  <Button size="sm" variant="outline" onClick={() => document.getElementById('logo-upload')?.click()} className="gap-1.5">
                    <Upload className="h-3.5 w-3.5" /> Upload
                  </Button>
                  <input id="logo-upload" type="file" accept="image/*" className="hidden" onChange={(e) => onLogoUpload(e, 'logoUrl')} />
                </div>
              </div>
              {orgType !== 'UNIVERSITY' && (
                <div className="space-y-1.5">
                  <Label>University Logo</Label>
                  <div className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border p-4">
                    {form.universityLogoUrl ? (
                      <img src={form.universityLogoUrl} alt="University logo" className="h-16 w-16 rounded-lg object-contain" />
                    ) : (
                      <GraduationCap className="h-12 w-12 text-muted-foreground/40" />
                    )}
                    <Button size="sm" variant="outline" onClick={() => document.getElementById('uni-logo-upload')?.click()} className="gap-1.5">
                      <Upload className="h-3.5 w-3.5" /> Upload
                    </Button>
                    <input id="uni-logo-upload" type="file" accept="image/*" className="hidden" onChange={(e) => onLogoUpload(e, 'universityLogoUrl')} />
                  </div>
                </div>
              )}
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
                <div>
                  <div className="font-display text-lg font-bold">{form.displayName || generateDisplayName()}</div>
                  <div className="text-xs text-muted-foreground">{form.universityName}{form.facultyName && ` · ${form.facultyName}`}{form.departmentName && ` · ${form.departmentName}`}</div>
                </div>
                <Badge className="ml-auto" style={{ backgroundColor: form.accentColour, color: '#fff' }}>SUG Election</Badge>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)} className="gap-1.5"><ArrowLeft className="h-4 w-4" /> Back</Button>
              <Button onClick={submit} disabled={busy} className="flex-1 gap-2">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {busy ? 'Creating...' : 'Create Organization'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
