'use client'

import { useEffect, useState } from 'react'
import {
  Shield, KeyRound, BadgeCheck, Vote, ArrowRight, ArrowLeft, CheckCircle2,
  Loader2, AlertCircle, Clock, Users, Eye, Bell, FileText, Fingerprint,
  Award, ChevronRight, LogOut,
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
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Welcome, {voterProfile.fullName.split(' ')[0]}</h1>
          <p className="text-sm text-muted-foreground">{voterProfile.voterId} · {voterProfile.faculty} · {voterProfile.level} Level</p>
        </div>
        <Button variant="outline" onClick={logout} className="gap-1.5"><LogOut className="h-4 w-4" /> Sign out</Button>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_300px]">
        {/* Main column */}
        <div className="space-y-6">
          {/* Election status */}
          {election && (
            <Card className="votewise-card-glow">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-lg font-bold">{election.name}</h2>
                    <p className="text-sm text-muted-foreground">{election.university}</p>
                  </div>
                  <StatusBadge status={election.liveStatus || election.status} />
                </div>
                <div className="mt-4"><Countdown start={election.startTime} end={election.endTime} status={election.status} /></div>
              </CardContent>
            </Card>
          )}

          {/* Voting status / action */}
          <Card className={cn('votewise-card-glow', !hasVoted && 'ring-2 ring-primary/30')}>
            <CardHeader>
              <CardTitle className="font-display flex items-center gap-2">
                {hasVoted ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <Vote className="h-5 w-5 text-primary" />}
                Voting Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {hasVoted ? (
                <div className="space-y-3">
                  <Alert className="border-emerald-200 bg-emerald-50">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <AlertTitle className="text-emerald-800">Vote cast successfully</AlertTitle>
                    <AlertDescription className="text-emerald-700">Your ballot has been encrypted and recorded. Thank you for participating in the election.</AlertDescription>
                  </Alert>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => setView('verify-receipt')} className="gap-1.5"><BadgeCheck className="h-4 w-4" /> Verify My Receipt</Button>
                    <Button variant="outline" onClick={() => setView('home')} className="gap-1.5"><Eye className="h-4 w-4" /> View Live Results</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
                    <div className={cn('grid h-10 w-10 place-items-center rounded-full', accredited ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600')}>
                      {accredited ? <Fingerprint className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                    </div>
                    <div>
                      <div className="font-medium">{accredited ? 'Accredited' : 'Accreditation required'}</div>
                      <div className="text-xs text-muted-foreground">{accredited ? 'You are cleared to vote.' : 'Complete accreditation to unlock your ballot.'}</div>
                    </div>
                  </div>
                  <Button size="lg" onClick={() => setView(accredited ? 'vote' : 'verify')} className="w-full gap-2">
                    {accredited ? <><Vote className="h-5 w-5" /> Open My Ballot <ArrowRight className="h-4 w-4" /></> : <><Fingerprint className="h-5 w-5" /> Complete Accreditation <ArrowRight className="h-4 w-4" /></>}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Eligible positions */}
          {!loading && ballot && (
            <Card>
              <CardHeader>
                <CardTitle className="font-display text-base flex items-center gap-2"><Award className="h-4 w-4 text-primary" /> Your Eligible Positions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {ballot.positions?.map((p: any, i: number) => (
                  <div key={p.id} className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
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
          {loading && <Card><CardContent className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></CardContent></Card>}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Quick stats */}
          <Card>
            <CardHeader><CardTitle className="font-display text-sm">At a Glance</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Stat icon={Users} label="Registered Voters" value={ballot ? '12' : '—'} />
              <Stat icon={Vote} label="Your Positions" value={ballot?.positions?.length ?? '—'} />
              <Stat icon={CheckCircle2} label="Status" value={hasVoted ? 'Voted' : 'Pending'} accent={!hasVoted} />
            </CardContent>
          </Card>

          {/* Notifications */}
          {notifications.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="font-display text-sm flex items-center gap-2"><Bell className="h-4 w-4 text-primary" /> Notifications</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {notifications.slice(0, 3).map((n: any) => (
                  <div key={n.id} className="rounded-lg bg-muted/50 p-2.5">
                    <div className="text-sm font-medium">{n.title}</div>
                    <div className="text-xs text-muted-foreground line-clamp-2">{n.message}</div>
                    <div className="mt-1 text-[10px] text-muted-foreground">{new Date(n.createdAt).toLocaleString()}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Help */}
          <Card>
            <CardHeader><CardTitle className="font-display text-sm flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Need Help?</CardTitle></CardHeader>
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
      <div className={cn('grid h-9 w-9 place-items-center rounded-lg', accent ? 'bg-amber-100 text-amber-600' : 'bg-primary/10 text-primary')}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-display text-sm font-bold">{value}</div>
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
