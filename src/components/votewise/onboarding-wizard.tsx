'use client'

import { useState, useEffect } from 'react'
import {
  ArrowLeft, ArrowRight, CheckCircle2, Loader2, Building2, Users, Vote,
  Upload, Trophy, Sparkles, Shield, Clock, Plus, SkipForward, Eye,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useApp } from '@/lib/store'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const WIZARD_STEPS = [
  { num: 1, title: 'Organization Review', icon: Building2, desc: 'Confirm your organization details' },
  { num: 2, title: 'Invite Team', icon: Users, desc: 'Invite admins and observers (optional)' },
  { num: 3, title: 'Organization Structure', icon: Shield, desc: 'Set up units if needed' },
  { num: 4, title: 'Create First Election', icon: Vote, desc: 'Name, type, date, voting window' },
  { num: 5, title: 'Import Voters', icon: Upload, desc: 'Upload CSV or enter manually' },
  { num: 6, title: 'Candidate Setup', icon: Trophy, desc: 'Add or import candidates' },
  { num: 7, title: 'Review & Save', icon: CheckCircle2, desc: 'Review everything and save' },
]

export function OnboardingWizard({ subdomain, onDone }: { subdomain?: string; onDone?: () => void }) {
  const { setView } = useApp()
  const [step, setStep] = useState(1)
  const [orgData, setOrgData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  // Step 4: election form
  const [electionForm, setElectionForm] = useState({ name: '', type: 'General', date: '', votingStart: '', votingEnd: '' })
  // Step 5: import method
  const [importMethod, setImportMethod] = useState<'csv' | 'manual' | 'later'>('later')
  // Step 6: candidate method
  const [candidateMethod, setCandidateMethod] = useState<'add' | 'import' | 'skip'>('skip')
  // Step 2: invitations
  const [invites, setInvites] = useState<any[]>([])

  useEffect(() => {
    let active = true
    api.workspaceDashboard(subdomain).then((d) => { if (active) setOrgData(d) }).catch(() => {}).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [subdomain])

  if (loading) return <div className="grid min-h-[60vh] place-items-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>

  const org = orgData?.organization
  const progress = ((step - 1) / 7) * 100

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6 text-center">
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          <Sparkles className="h-3.5 w-3.5" /> Setup Wizard
        </div>
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Welcome, {org?.name || 'there'}!</h1>
        <p className="mt-1 text-sm text-muted-foreground">Let&apos;s prepare your first election. Estimated time: 7 minutes.</p>
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Step {step} of 7</span>
          <span className="text-xs font-medium text-primary">{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Step indicator */}
      <div className="mb-6 flex items-center justify-center gap-1">
        {WIZARD_STEPS.map((s) => (
          <div key={s.num} className="flex items-center">
            <div className={cn('grid h-7 w-7 place-items-center rounded-full text-xs font-bold', s.num === step ? 'bg-primary text-primary-foreground' : s.num < step ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground')}>
              {s.num < step ? <CheckCircle2 className="h-3.5 w-3.5" /> : s.num}
            </div>
            {s.num < 7 && <div className={cn('h-0.5 w-3', s.num < step ? 'bg-emerald-500' : 'bg-muted')} />}
          </div>
        ))}
      </div>

      {/* Step content */}
      <Card className="votewise-card-glow">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            {(() => { const Icon = WIZARD_STEPS[step - 1].icon; return <Icon className="h-5 w-5 text-primary" /> })()}
            {WIZARD_STEPS[step - 1].title}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{WIZARD_STEPS[step - 1].desc}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Step 1: Org Review */}
          {step === 1 && org && (
            <div className="space-y-3">
              <div className="flex items-center gap-4 rounded-lg border border-border/60 p-4">
                {org.logoUrl ? <img src={org.logoUrl} alt="Logo" className="h-14 w-14 rounded-xl object-contain" /> : <div className="grid h-14 w-14 place-items-center rounded-xl text-white" style={{ backgroundColor: org.primaryColour }}><Building2 className="h-7 w-7" /></div>}
                <div className="flex-1">
                  <div className="font-display text-lg font-bold">{org.name}</div>
                  <div className="text-xs text-muted-foreground">{org.subdomain}.votewise.ng · {org.category?.replace(/_/g, ' ') || 'Organization'}</div>
                </div>
                <Badge variant="secondary">{org.plan}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-muted/50 p-3"><div className="text-xs text-muted-foreground">Country</div><div>{org.country || '—'}</div></div>
                <div className="rounded-lg bg-muted/50 p-3"><div className="text-xs text-muted-foreground">Timezone</div><div>{org.timezone || '—'}</div></div>
              </div>
              <Alert><CheckCircle2 className="h-4 w-4" /><AlertDescription>Your organization is set up. You can change branding and details anytime in Settings.</AlertDescription></Alert>
            </div>
          )}

          {/* Step 2: Invite Team */}
          {step === 2 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Invite team members to help manage elections. This step is optional — you can skip it and invite later.</p>
              {invites.length === 0 ? (
                <div className="py-6 text-center"><Users className="mx-auto h-10 w-10 text-muted-foreground/40" /><p className="mt-2 text-sm text-muted-foreground">No invitations yet.</p></div>
              ) : (
                invites.map((inv, i) => <div key={i} className="flex items-center gap-2 rounded-lg border border-border/60 p-2 text-sm"><Users className="h-3.5 w-3.5 text-primary" /><span className="flex-1 truncate">{inv.email}</span><Badge variant="outline" className="text-[10px]">{inv.role}</Badge></div>)
              )}
              <div className="flex gap-2">
                <Input placeholder="email@org.com" className="flex-1" onKeyDown={(e) => { if (e.key === 'Enter') { const val = (e.target as HTMLInputElement).value; if (val) { setInvites([...invites, { email: val, role: 'OBSERVER' }]); (e.target as HTMLInputElement).value = '' } } }} />
                <Button size="sm" variant="outline" className="gap-1"><Plus className="h-3.5 w-3.5" /> Invite</Button>
              </div>
              <Button variant="ghost" size="sm" className="gap-1" onClick={() => setStep(3)}><SkipForward className="h-3.5 w-3.5" /> Skip for now</Button>
            </div>
          )}

          {/* Step 3: Structure */}
          {step === 3 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Will your elections happen across different units (faculties, branches, parishes)? You can skip this if you&apos;re running a single organization-wide election.</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {['Entire Organization', 'Faculties / Departments', 'Branches / Regions', 'Parishes / Chapters', 'I\'ll configure later'].map((opt) => (
                  <button key={opt} onClick={() => setStep(4)} className="flex items-center gap-2 rounded-lg border border-border/60 p-3 text-left text-sm transition-all hover:border-primary hover:bg-primary/5">
                    <Shield className="h-4 w-4 text-primary" /> {opt}
                  </button>
                ))}
              </div>
              <Button variant="ghost" size="sm" className="gap-1" onClick={() => setStep(4)}><SkipForward className="h-3.5 w-3.5" /> Skip — single election</Button>
            </div>
          )}

          {/* Step 4: Create Election */}
          {step === 4 && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Election Name *</Label><Input value={electionForm.name} onChange={(e) => setElectionForm((f) => ({ ...f, name: e.target.value }))} placeholder="2027 General Election" /></div>
                <div className="space-y-1.5"><Label>Election Type</Label><Input list="etypes" value={electionForm.type} onChange={(e) => setElectionForm((f) => ({ ...f, type: e.target.value }))} /><datalist id="etypes"><option>General</option><option>Primary</option><option>By-Election</option><option>Referendum</option></datalist></div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5"><Label>Election Date</Label><Input type="date" value={electionForm.date} onChange={(e) => setElectionForm((f) => ({ ...f, date: e.target.value }))} /></div>
                <div className="space-y-1.5"><Label>Voting Starts</Label><Input type="time" value={electionForm.votingStart} onChange={(e) => setElectionForm((f) => ({ ...f, votingStart: e.target.value }))} /></div>
                <div className="space-y-1.5"><Label>Voting Ends</Label><Input type="time" value={electionForm.votingEnd} onChange={(e) => setElectionForm((f) => ({ ...f, votingEnd: e.target.value }))} /></div>
              </div>
              <Alert><Vote className="h-4 w-4" /><AlertDescription>Only basic details needed now. Positions, candidates, and settings can be configured after creation.</AlertDescription></Alert>
            </div>
          )}

          {/* Step 5: Import Voters */}
          {step === 5 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">How would you like to add voters to this election?</p>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { val: 'csv', icon: Upload, label: 'Upload CSV', desc: 'Download a template, fill it, and upload.' },
                  { val: 'manual', icon: Users, label: 'Manual Entry', desc: 'Add voters one by one.' },
                  { val: 'later', icon: SkipForward, label: 'Import Later', desc: 'Skip for now — you can import anytime.' },
                ].map((opt) => (
                  <button key={opt.val} onClick={() => setImportMethod(opt.val as any)} className={cn('flex items-center gap-3 rounded-lg border p-3 text-left transition-all', importMethod === opt.val ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-muted/50')}>
                    <opt.icon className={cn('h-5 w-5', importMethod === opt.val ? 'text-primary' : 'text-muted-foreground')} />
                    <div><div className="text-sm font-medium">{opt.label}</div><div className="text-xs text-muted-foreground">{opt.desc}</div></div>
                  </button>
                ))}
              </div>
              {importMethod === 'csv' && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/30">
                  <p className="text-xs text-blue-700 dark:text-blue-400">A CSV template will be generated from your configured voter fields. You can download it after completing this wizard.</p>
                </div>
              )}
            </div>
          )}

          {/* Step 6: Candidates */}
          {step === 6 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Would you like to add candidates now?</p>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { val: 'add', icon: Plus, label: 'Add Candidates', desc: 'Add candidates one by one.' },
                  { val: 'import', icon: Upload, label: 'Import Candidates', desc: 'Upload a candidate CSV.' },
                  { val: 'skip', icon: SkipForward, label: 'Skip', desc: 'Add candidates later.' },
                ].map((opt) => (
                  <button key={opt.val} onClick={() => setCandidateMethod(opt.val as any)} className={cn('flex items-center gap-3 rounded-lg border p-3 text-left transition-all', candidateMethod === opt.val ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-muted/50')}>
                    <opt.icon className={cn('h-5 w-5', candidateMethod === opt.val ? 'text-primary' : 'text-muted-foreground')} />
                    <div><div className="text-sm font-medium">{opt.label}</div><div className="text-xs text-muted-foreground">{opt.desc}</div></div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 7: Review */}
          {step === 7 && (
            <div className="space-y-3">
              <div className="space-y-2">
                <ReviewRow label="Organization" value={org?.name} done />
                <ReviewRow label="Team Invitations" value={invites.length > 0 ? `${invites.length} invited` : 'Skipped'} done={invites.length > 0} />
                <ReviewRow label="Structure" value={step > 3 ? 'Configured' : 'Skipped'} done={step > 3} />
                <ReviewRow label="Election" value={electionForm.name || 'Not named'} done={!!electionForm.name} />
                <ReviewRow label="Voters" value={importMethod === 'later' ? 'Import later' : importMethod === 'csv' ? 'CSV upload' : 'Manual entry'} done={importMethod !== 'later'} />
                <ReviewRow label="Candidates" value={candidateMethod === 'skip' ? 'Add later' : candidateMethod === 'add' ? 'Add manually' : 'Import CSV'} done={candidateMethod !== 'skip'} />
              </div>
              <Alert><CheckCircle2 className="h-4 w-4" /><AlertTitle>Ready to save!</AlertTitle><AlertDescription>Your election setup will be saved as a draft. You can complete the remaining steps anytime from your dashboard.</AlertDescription></Alert>
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-2 pt-2">
            {step > 1 && <Button variant="outline" onClick={() => setStep(step - 1)} className="gap-1.5"><ArrowLeft className="h-4 w-4" /> Back</Button>}
            {step < 7 ? (
              <Button onClick={() => setStep(step + 1)} className="flex-1 gap-2">Continue <ArrowRight className="h-4 w-4" /></Button>
            ) : (
              <Button onClick={() => { toast.success('Election setup saved as draft!'); if (onDone) onDone(); else setView('workspace') }} className="flex-1 gap-2"><CheckCircle2 className="h-4 w-4" /> Save Draft</Button>
            )}
            {step < 7 && <Button variant="ghost" onClick={() => setStep(7)} className="gap-1"><SkipForward className="h-4 w-4" /> Skip to Review</Button>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ReviewRow({ label, value, done }: { label: string; value: string; done: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/60 p-2.5">
      <div className={cn('grid h-7 w-7 place-items-center rounded-full', done ? 'bg-emerald-100 text-emerald-600' : 'bg-muted text-muted-foreground')}>
        {done ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
      </div>
      <div className="flex-1"><span className="text-sm font-medium">{label}</span></div>
      <span className="text-sm text-muted-foreground">{value}</span>
    </div>
  )
}
