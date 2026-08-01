'use client'

import { useState, useEffect } from 'react'
import {
  ArrowLeft, ArrowRight, CheckCircle2, Loader2, Vote, Building2, Shield,
  Clock, Eye, Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useApp } from '@/lib/store'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const STEPS = [
  { num: 1, title: 'Basic Information', icon: Vote, desc: 'Name, description, category' },
  { num: 2, title: 'Scope', icon: Building2, desc: 'Where will this election take place?' },
  { num: 3, title: 'Election Type', icon: Shield, desc: 'General, referendum, poll, etc.' },
  { num: 4, title: 'Voting Method', icon: CheckCircle2, desc: 'Single choice, multiple, ranked' },
  { num: 5, title: 'Timeline', icon: Clock, desc: 'All key dates and times' },
  { num: 6, title: 'Visibility', icon: Eye, desc: 'Public, private, or invite only' },
]

export function ElectionCreateWizard({ subdomain }: { subdomain?: string }) {
  const { setView } = useApp()
  const [step, setStep] = useState(1)
  const [busy, setBusy] = useState(false)
  const [units, setUnits] = useState<any[]>([])
  const [form, setForm] = useState<any>({
    name: '', description: '', category: 'General',
    electionType: 'General', votingMethod: 'Single Choice', visibility: 'PRIVATE',
    scope: 'entire_org', workspaceId: '',
    startTime: '', endTime: '',
    candidateRegStart: '', candidateRegEnd: '',
    accreditationStart: '', accreditationEnd: '',
    resultsReleaseAt: '',
    settings: {
      requireAccreditation: true, requireOTVP: true, allowCandidatePhotos: true,
      showLiveTurnout: true, showLiveResults: true, hideResultsUntilEnd: false,
      allowResultDownload: true, requireObserverApproval: false, enableAuditMode: true,
    },
  })

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))

  useEffect(() => {
    api.workspaceUnits(subdomain).then((d) => setUnits(d.units || [])).catch(() => {})
  }, [subdomain])

  async function create() {
    setBusy(true)
    try {
      const d = await api.createElection({
        ...form,
        workspaceId: form.scope === 'specific_unit' ? form.workspaceId : null,
      }, subdomain)
      toast.success(`Election "${d.election.name}" created!`)
      window.location.href = `/workspace/elections/${d.election.id}?org=${subdomain || ''}`
    } catch (e: any) { toast.error(e.message) } finally { setBusy(false) }
  }

  const canProceed = step === 1 ? !!form.name : step === 2 ? true : step === 5 ? !!form.startTime && !!form.endTime : true
  const progress = ((step - 1) / 6) * 100

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <Button variant="ghost" size="sm" onClick={() => { window.location.href = `/workspace/elections?org=${subdomain || ''}` }} className="mb-4 gap-1.5">
        <ArrowLeft className="h-4 w-4" /> Back to Election Center
      </Button>

      <div className="mb-6 text-center">
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          <Sparkles className="h-3.5 w-3.5" /> Election Creation Wizard
        </div>
        <h1 className="font-display text-2xl font-bold">Create a New Election</h1>
      </div>

      {/* Progress */}
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Step {step} of 6</span>
          <span className="text-xs font-medium text-primary">{Math.round(progress)}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Step indicator */}
      <div className="mb-6 flex items-center justify-center gap-1">
        {STEPS.map((s) => (
          <div key={s.num} className="flex items-center">
            <div className={cn('grid h-7 w-7 place-items-center rounded-full text-xs font-bold', s.num === step ? 'bg-primary text-primary-foreground' : s.num < step ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground')}>
              {s.num < step ? <CheckCircle2 className="h-3.5 w-3.5" /> : s.num}
            </div>
            {s.num < 6 && <div className={cn('h-0.5 w-3', s.num < step ? 'bg-emerald-500' : 'bg-muted')} />}
          </div>
        ))}
      </div>

      <Card className="votewise-card-glow">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            {(() => { const Icon = STEPS[step - 1].icon; return <Icon className="h-5 w-5 text-primary" /> })()}
            {STEPS[step - 1].title}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{STEPS[step - 1].desc}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Step 1: Basic Info */}
          {step === 1 && (
            <div className="space-y-3">
              <div className="space-y-1.5"><Label>Election Name *</Label><Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="2027 General Election" /></div>
              <div className="space-y-1.5"><Label>Description</Label><Input value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Annual general election for all positions" /></div>
              <div className="space-y-1.5">
                <Label>Election Category</Label>
                <div className="flex flex-wrap gap-2">
                  {['Student Union', 'Executive', 'Board', 'Primary', 'Referendum', 'By-Election'].map((c) => (
                    <button key={c} onClick={() => set('category', c)} className={cn('rounded-full border px-3 py-1 text-xs', form.category === c ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted/50')}>{c}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Scope */}
          {step === 2 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Where will this election take place?</p>
              <div className="space-y-2">
                {[
                  { val: 'entire_org', label: 'Entire Organization', desc: 'All members are eligible' },
                  { val: 'specific_unit', label: 'Specific Organization Unit', desc: 'Only voters in a specific unit (e.g. Faculty of Engineering)' },
                ].map((opt) => (
                  <button key={opt.val} onClick={() => set('scope', opt.val)} className={cn('flex items-center gap-3 rounded-lg border p-3 text-left transition-all', form.scope === opt.val ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-muted/50')}>
                    <Building2 className={cn('h-5 w-5', form.scope === opt.val ? 'text-primary' : 'text-muted-foreground')} />
                    <div><div className="text-sm font-medium">{opt.label}</div><div className="text-xs text-muted-foreground">{opt.desc}</div></div>
                  </button>
                ))}
              </div>
              {form.scope === 'specific_unit' && units.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Select Unit</Label>
                  <div className="flex flex-wrap gap-2">
                    {units.map((u) => (
                      <button key={u.id} onClick={() => set('workspaceId', u.id)} className={cn('rounded-full border px-3 py-1 text-xs', form.workspaceId === u.id ? 'border-primary bg-primary/10 text-primary' : 'border-border')}>{u.name}</button>
                    ))}
                  </div>
                </div>
              )}
              {form.scope === 'specific_unit' && units.length === 0 && (
                <p className="text-xs text-muted-foreground">No organization units created yet. You can create units in Settings → Structure.</p>
              )}
            </div>
          )}

          {/* Step 3: Election Type */}
          {step === 3 && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {['General', 'Single Position', 'Referendum', 'Poll', 'Multiple Positions', 'Runoff', 'Custom'].map((t) => (
                  <button key={t} onClick={() => set('electionType', t)} className={cn('rounded-lg border p-3 text-left text-sm transition-all', form.electionType === t ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-muted/50')}>
                    <div className="font-medium">{t}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Voting Method */}
          {step === 4 && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-2">
                {[
                  { val: 'Single Choice', desc: 'Voter selects one candidate per position' },
                  { val: 'Multiple Choice', desc: 'Voter can select multiple candidates (up to maximum)' },
                  { val: 'Ranked Choice', desc: 'Voter ranks candidates by preference (future)' },
                  { val: 'Approval Voting', desc: 'Voter approves any number of candidates (future)' },
                  { val: 'Weighted Voting', desc: 'Votes have different weights (future)' },
                ].map((m) => (
                  <button key={m.val} onClick={() => set('votingMethod', m.val)} className={cn('flex items-center gap-3 rounded-lg border p-3 text-left transition-all', form.votingMethod === m.val ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-muted/50')}>
                    <CheckCircle2 className={cn('h-5 w-5', form.votingMethod === m.val ? 'text-primary' : 'text-muted-foreground')} />
                    <div><div className="text-sm font-medium">{m.val}</div><div className="text-xs text-muted-foreground">{m.desc}</div></div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 5: Timeline */}
          {step === 5 && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Voting Opens *</Label><Input type="datetime-local" value={form.startTime} onChange={(e) => set('startTime', e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Voting Closes *</Label><Input type="datetime-local" value={form.endTime} onChange={(e) => set('endTime', e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Candidate Registration Opens</Label><Input type="datetime-local" value={form.candidateRegStart} onChange={(e) => set('candidateRegStart', e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Candidate Registration Closes</Label><Input type="datetime-local" value={form.candidateRegEnd} onChange={(e) => set('candidateRegEnd', e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Accreditation Opens</Label><Input type="datetime-local" value={form.accreditationStart} onChange={(e) => set('accreditationStart', e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Accreditation Closes</Label><Input type="datetime-local" value={form.accreditationEnd} onChange={(e) => set('accreditationEnd', e.target.value)} /></div>
              </div>
              <div className="space-y-1.5"><Label>Results Release Date</Label><Input type="datetime-local" value={form.resultsReleaseAt} onChange={(e) => set('resultsReleaseAt', e.target.value)} /></div>
            </div>
          )}

          {/* Step 6: Visibility */}
          {step === 6 && (
            <div className="space-y-3">
              <div className="space-y-2">
                {[
                  { val: 'PUBLIC', label: 'Public', desc: 'Anyone can see election information' },
                  { val: 'PRIVATE', label: 'Private', desc: 'Only authenticated users can see election details' },
                  { val: 'INVITE_ONLY', label: 'Invite Only', desc: 'Only eligible voters can access this election' },
                ].map((v) => (
                  <button key={v.val} onClick={() => set('visibility', v.val)} className={cn('flex items-center gap-3 rounded-lg border p-3 text-left transition-all', form.visibility === v.val ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-muted/50')}>
                    <Eye className={cn('h-5 w-5', form.visibility === v.val ? 'text-primary' : 'text-muted-foreground')} />
                    <div><div className="text-sm font-medium">{v.label}</div><div className="text-xs text-muted-foreground">{v.desc}</div></div>
                  </button>
                ))}
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                <Label className="mb-2 block text-xs font-semibold">Election Settings</Label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {Object.entries(form.settings).map(([k, v]) => (
                    <button key={k} onClick={() => set('settings', { ...form.settings, [k]: !v })} className={cn('flex items-center gap-1.5 rounded px-2 py-1', v ? 'text-emerald-600' : 'text-muted-foreground')}>
                      <CheckCircle2 className="h-3 w-3" /> {k.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-2 pt-2">
            {step > 1 && <Button variant="outline" onClick={() => setStep(step - 1)} className="gap-1.5"><ArrowLeft className="h-4 w-4" /> Back</Button>}
            {step < 6 ? (
              <Button onClick={() => setStep(step + 1)} disabled={!canProceed} className="flex-1 gap-2">Continue <ArrowRight className="h-4 w-4" /></Button>
            ) : (
              <Button onClick={create} disabled={busy} className="flex-1 gap-2">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {busy ? 'Creating…' : 'Create Election'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
