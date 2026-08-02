'use client'

import { useEffect, useState } from 'react'
import {
  ArrowLeft, Building2, Calendar, Users, Shield, Award, Mail, Phone, MapPin,
  CheckCircle2, Loader2, FileText, Vote, BadgeCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useApp } from '@/lib/store'
import { api } from '@/lib/api'
import { useTerminology } from '@/lib/terminology'
import { StatusBadge, Countdown } from '@/components/votewise/shared'
import { Reveal } from '@/components/votewise/faq'

export function AboutView() {
  const { setView } = useApp()
  const t = useTerminology()
  const [election, setElection] = useState<any>(null)
  const [officials, setOfficials] = useState<any[]>([])
  const [positions, setPositions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.getLegacyElection(),
      api.adminGetOfficials().catch(() => ({ officials: [] })),
      api.getPositions(),
    ]).then(([e, o, p]) => {
      setElection(e)
      setOfficials(o.officials || [])
      setPositions(p.positions || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="mx-auto flex max-w-4xl items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
  }

  const committee = officials.filter((o) => o.role === 'SUPER_ADMIN' || o.role === 'ELECTORAL_COMMITTEE')
  const totalCandidates = positions.reduce((a, p) => a + (p.candidates?.length || 0), 0)

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <Button variant="ghost" size="sm" onClick={() => setView('home')} className="mb-4 gap-1.5">
        <ArrowLeft className="h-4 w-4" /> Back to home
      </Button>

      {/* Header */}
      <Reveal>
        <div className="mb-8 text-center">
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Building2 className="h-3.5 w-3.5" /> About the Election
          </div>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">{election?.name || 'General Elections'}</h1>
          <p className="mx-auto mt-2 max-w-2xl text-muted-foreground">
            {election?.university} · {election?.academicSession} {t.periodLabel}
          </p>
          {election && <div className="mt-4 flex justify-center"><StatusBadge status={election.liveStatus || election.status} /></div>}
        </div>
      </Reveal>

      {/* Election overview cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Reveal delay={0}>
          <Card className="h-full">
            <CardContent className="p-5 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary"><Calendar className="h-6 w-6" /></div>
              <div className="mt-3 text-xs uppercase tracking-wider text-muted-foreground">Voting Window</div>
              <div className="mt-1 text-sm font-medium">{new Date(election?.startTime).toLocaleDateString()} — {new Date(election?.endTime).toLocaleDateString()}</div>
            </CardContent>
          </Card>
        </Reveal>
        <Reveal delay={100}>
          <Card className="h-full">
            <CardContent className="p-5 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary"><Vote className="h-6 w-6" /></div>
              <div className="mt-3 text-xs uppercase tracking-wider text-muted-foreground">Positions</div>
              <div className="mt-1 font-display text-2xl font-bold">{positions.length}</div>
            </CardContent>
          </Card>
        </Reveal>
        <Reveal delay={200}>
          <Card className="h-full">
            <CardContent className="p-5 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary"><Users className="h-6 w-6" /></div>
              <div className="mt-3 text-xs uppercase tracking-wider text-muted-foreground">Candidates</div>
              <div className="mt-1 font-display text-2xl font-bold">{totalCandidates}</div>
            </CardContent>
          </Card>
        </Reveal>
        <Reveal delay={300}>
          <Card className="h-full">
            <CardContent className="p-5 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary"><Shield className="h-6 w-6" /></div>
              <div className="mt-3 text-xs uppercase tracking-wider text-muted-foreground">Security</div>
              <div className="mt-1 text-sm font-medium">AES-256 + Audit Chain</div>
            </CardContent>
          </Card>
        </Reveal>
      </div>

      {/* Countdown */}
      {election && (
        <Reveal>
          <Card className="votewise-card-glow mb-8">
            <CardContent className="p-6">
              <Countdown start={election.startTime} end={election.endTime} status={election.status} />
            </CardContent>
          </Card>
        </Reveal>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Electoral committee */}
        <Reveal>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="font-display text-base flex items-center gap-2"><Award className="h-4 w-4 text-primary" /> Electoral Committee</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {committee.length > 0 ? committee.map((o) => (
                <div key={o.id} className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
                  <Avatar className="h-10 w-10"><AvatarFallback>{o.name?.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{o.name}</div>
                    <div className="text-xs text-muted-foreground">{o.role === 'SUPER_ADMIN' ? 'Committee Chairperson' : 'Committee Member'}</div>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{o.totpEnabled ? '2FA' : 'No 2FA'}</Badge>
                </div>
              )) : <p className="text-sm text-muted-foreground">Committee information not available.</p>}
            </CardContent>
          </Card>
        </Reveal>

        {/* Organization info */}
        <Reveal delay={100}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="font-display text-base flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /> {t.organizationLabel} Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <InfoRow icon={Building2} label={t.organizationLabel} value={election?.university} />
              <InfoRow icon={Calendar} label={t.periodLabel} value={election?.academicSession} />
              <InfoRow icon={FileText} label={`${t.electionLabel} Name`} value={election?.name} />
              <InfoRow icon={MapPin} label="Accreditation" value={election?.settings?.requireAccreditation ? 'Required' : 'Optional'} />
              <InfoRow icon={Shield} label="Ballot Secrecy" value="AES-256-GCM Encrypted" />
              <InfoRow icon={BadgeCheck} label="Audit Trail" value="Hash-Chained + Tamper-Evident" />
            </CardContent>
          </Card>
        </Reveal>
      </div>

      {/* Positions overview */}
      <Reveal>
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="font-display text-base flex items-center gap-2"><Vote className="h-4 w-4 text-primary" /> Contestable {t.positionLabel}s</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2">
              {positions.map((p, i) => (
                <div key={p.id} className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{p.title}</div>
                    <div className="text-xs text-muted-foreground">{p.candidates?.length || 0} {t.candidateLabel.toLowerCase()}s · {scopeLabel(p.scope, t)}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </Reveal>

      {/* Contact CTA */}
      <Reveal>
        <Card className="mt-6 bg-primary text-primary-foreground">
          <CardContent className="flex flex-col items-center justify-between gap-4 p-6 sm:flex-row">
            <div>
              <h3 className="font-display text-lg font-bold">Need Help?</h3>
              <p className="mt-1 text-sm text-primary-foreground/80">Contact the Electoral Committee or use the chatbot for assistance.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setView('guide')} className="gap-1.5"><FileText className="h-4 w-4" /> Voter Guide</Button>
              <Button variant="secondary" size="sm" onClick={() => setView('home')} className="gap-1.5"><Vote className="h-4 w-4" /> Start Voting</Button>
            </div>
          </CardContent>
        </Card>
      </Reveal>
    </div>
  )
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div>
      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="truncate text-sm font-medium">{value || '—'}</div>
      </div>
    </div>
  )
}

function scopeLabel(s: string, t: any) {
  if (s === 'UNIVERSITY') return `${t.organizationLabel}-wide`
  if (s === 'FACULTY') return t.workspaceLabel
  if (s === 'DEPARTMENT') return t.voterGroupLabel
  return s
}
