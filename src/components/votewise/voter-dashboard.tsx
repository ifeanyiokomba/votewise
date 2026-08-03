'use client'

import { useEffect, useState } from 'react'
import {
  Shield, KeyRound, BadgeCheck, Vote, ArrowRight, ArrowLeft, CheckCircle2,
  Loader2, AlertCircle, Clock, Users, Eye, Bell, FileText, Fingerprint,
  Award, ChevronRight, LogOut, Lock, ShieldCheck, TrendingUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useApp } from '@/lib/store'
import { api, getVoterToken } from '@/lib/api'
import { useTerminology } from '@/lib/terminology'
import { toast } from 'sonner'
import { StatusBadge, Countdown } from '@/components/votewise/shared'
import { cn } from '@/lib/utils'

export function VoterDashboard() {
  const { setView, voterProfile, voterToken, setVoterToken, setVoterProfile, election, setElection, accredited } = useApp()
  const t = useTerminology()
  const [ballot, setBallot] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [notifications, setNotifications] = useState<any[]>([])

  useEffect(() => {
    api.getLegacyElection().then(setElection).catch(() => {})
    if (voterToken) {
      api.getBallot().then((d) => { setBallot(d); setLoading(false) }).catch(() => setLoading(false))
      api.getNotifications().then((d) => setNotifications(d.notifications || [])).catch(() => {})
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false)
    }
  }, [voterToken, setElection])

  async function logout() {
    try { await api.voterLogout() } catch {}
    setVoterToken(null); setVoterProfile(null); setView('home')
  }

  if (!voterProfile) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Session expired</AlertTitle>
          <AlertDescription>Please verify your voterIdulation number to access your dashboard.</AlertDescription>
        </Alert>
        <Button onClick={() => setView('verify')} className="mt-4 gap-2"><Shield className="h-4 w-4" /> Verify Now</Button>
      </div>
    )
  }

  const hasVoted = voterProfile?.hasVoted || ballot?.election?.votingOpen === false && voterProfile?.hasVoted

  return (
    <div className="mx-auto w-full max-w-[1152px] px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-8 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <div className="vw-eyebrow mb-2"><Vote className="h-3.5 w-3.5" /> Voter Dashboard</div>
          <h1 className="font-display text-3xl font-medium tracking-[-0.025em] sm:text-4xl">
            Welcome, {voterProfile.fullName.split(' ')[0]}<span className="vw-dot">.</span>
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {voterProfile.voterId} · {voterProfile.faculty} · {voterProfile.level} Level
          </p>
        </div>
        <Button variant="outline" onClick={logout} className="gap-1.5"><LogOut className="h-4 w-4" /> Sign out</Button>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_320px]">
        {/* Main column */}
        <div className="space-y-6">
          {/* Election status */}
          {election && (
            <Card className="vw-lift">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-lg font-medium">{election.name}</h2>
                    <p className="text-sm text-muted-foreground">{election.university}</p>
                  </div>
                  <StatusBadge status={election.liveStatus || election.status} />
                </div>
                <div className="mt-4"><Countdown start={election.startTime} end={election.endTime} status={election.status} /></div>
              </CardContent>
            </Card>
          )}

          {/* Voting status / action */}
          <Card className={cn('vw-lift', !hasVoted && 'ring-2 ring-primary/20')}>
            <CardHeader className="pb-3">
              <CardTitle className="font-display flex items-center gap-2 text-base font-medium">
                {hasVoted ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Vote className="h-4 w-4 text-primary" />}
                Voting Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {hasVoted ? (
                <div className="space-y-3">
                  <Alert className="border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <AlertTitle className="text-emerald-800 dark:text-emerald-200">Vote cast successfully</AlertTitle>
                    <AlertDescription className="text-emerald-700 dark:text-emerald-300">Your ballot has been encrypted and recorded. Thank you for participating in the election.</AlertDescription>
                  </Alert>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => setView('verify-receipt')} className="gap-1.5"><BadgeCheck className="h-4 w-4" /> Verify My Receipt</Button>
                    <Button variant="outline" onClick={() => setView('home')} className="gap-1.5"><Eye className="h-4 w-4" /> View Live Results</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-3">
                    <div className={cn('grid h-10 w-10 place-items-center rounded-full ring-1', accredited ? 'bg-emerald-100 text-emerald-600 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-900/40' : 'bg-amber-100 text-amber-600 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:ring-amber-900/40')}>
                      {accredited ? <Fingerprint className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                    </div>
                    <div>
                      <div className="font-medium">{accredited ? 'Accredited' : 'Accreditation required'}</div>
                      <div className="text-xs text-muted-foreground">{accredited ? 'You are cleared to vote.' : 'Complete accreditation to unlock your ballot.'}</div>
                    </div>
                  </div>
                  <Button size="lg" onClick={() => setView(accredited ? 'vote' : 'verify')} className="w-full gap-2">
                    {accredited ? <><Vote className="h-4 w-4" /> Open My Ballot <ArrowRight className="h-4 w-4" /></> : <><Fingerprint className="h-4 w-4" /> Complete Accreditation <ArrowRight className="h-4 w-4" /></>}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Eligible positions */}
          {!loading && ballot && (
            <Card className="vw-lift">
              <CardHeader className="pb-3">
                <CardTitle className="font-display text-base font-medium flex items-center gap-2"><Award className="h-4 w-4 text-primary" /> Your Eligible Positions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {ballot.positions?.map((p: any, i: number) => (
                  <div key={p.id} className="vw-lift flex items-center gap-3 rounded-lg border border-border p-3">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/8 text-xs font-medium text-primary ring-1 ring-primary/10">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{p.title}</div>
                      <div className="text-xs text-muted-foreground">{p.candidates.length} candidates · {scopeLabel(p.scope, t)}</div>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{p.candidates.length} choices</Badge>
                  </div>
                ))}
                {ballot.positions?.length === 0 && <p className="text-sm text-muted-foreground">No positions available for your constituency.</p>}
              </CardContent>
            </Card>
          )}
          {loading && (
            <Card>
              <CardContent className="py-10 text-center">
                <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                <p className="mt-2 text-xs text-muted-foreground">Loading your ballot…</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Security status card */}
          <Card className="vw-lift bg-primary/[0.03]">
            <CardContent className="p-5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Security Status</span>
              </div>
              <div className="mt-3 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-muted-foreground"><Lock className="h-3 w-3" /> Encrypted</span>
                  <span className="flex items-center gap-1 font-medium text-emerald-600"><CheckCircle2 className="h-3 w-3" /> Active</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-muted-foreground"><Fingerprint className="h-3 w-3" /> Identity</span>
                  <span className="flex items-center gap-1 font-medium text-emerald-600"><CheckCircle2 className="h-3 w-3" /> Verified</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-muted-foreground"><BadgeCheck className="h-3 w-3" /> Receipt</span>
                  <span className="font-medium text-muted-foreground">{hasVoted ? 'Issued' : 'Pending'}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick stats */}
          <Card className="vw-lift">
            <CardHeader className="pb-3"><CardTitle className="font-display text-sm font-medium">At a Glance</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Stat icon={Users} label="Registered Voters" value={ballot ? '12' : '—'} />
              <Stat icon={Vote} label="Your Positions" value={ballot?.positions?.length ?? '—'} />
              <Stat icon={CheckCircle2} label="Status" value={hasVoted ? 'Voted' : 'Pending'} accent={!hasVoted} />
            </CardContent>
          </Card>

          {/* Notifications */}
          {notifications.length > 0 && (
            <Card className="vw-lift">
              <CardHeader className="pb-3"><CardTitle className="font-display text-sm font-medium flex items-center gap-2"><Bell className="h-4 w-4 text-primary" /> Notifications</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {notifications.slice(0, 3).map((n: any) => (
                  <div key={n.id} className="rounded-lg border border-border bg-muted/30 p-2.5">
                    <div className="text-sm font-medium">{n.title}</div>
                    <div className="text-xs text-muted-foreground line-clamp-2">{n.message}</div>
                    <div className="mt-1 text-[10px] text-muted-foreground">{new Date(n.createdAt).toLocaleString()}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Help */}
          <Card className="vw-lift">
            <CardHeader className="pb-3"><CardTitle className="font-display text-sm font-medium flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Need Help?</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" size="sm" className="w-full justify-start gap-1.5" onClick={() => setView('home')}>
                <ChevronRight className="h-4 w-4" /> How voting works
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start gap-1.5" onClick={() => setView('verify-receipt')}>
                <BadgeCheck className="h-4 w-4" /> Verify a receipt
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Stat({ icon: Icon, label, value, accent }: any) {
  return (
    <div className="flex items-center gap-3">
      <div className={cn('grid h-9 w-9 place-items-center rounded-lg ring-1', accent ? 'bg-amber-100 text-amber-600 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:ring-amber-900/40' : 'bg-primary/8 text-primary ring-primary/10')}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="vw-stat text-sm text-foreground">{value}</div>
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
