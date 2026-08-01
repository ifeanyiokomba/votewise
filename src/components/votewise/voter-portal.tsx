'use client'

import { useEffect, useState } from 'react'
import {
  User, Vote, ShieldCheck, Headphones, Bell, Award, Clock, CheckCircle2,
  Loader2, ArrowLeft,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { api, getVoterToken } from '@/lib/api'
import { useApp } from '@/lib/store'
import { cn } from '@/lib/utils'

export function VoterPortal() {
  const { setView, voterProfile } = useApp()
  const [tab, setTab] = useState('profile')

  const TABS = [
    { label: 'My Profile', icon: User },
    { label: 'My Elections', icon: Vote },
    { label: 'Voting Status', icon: ShieldCheck },
    { label: 'Support', icon: Headphones },
    { label: 'Notifications', icon: Bell },
    { label: 'Past Elections', icon: Award },
  ]

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      <Button variant="ghost" size="sm" onClick={() => setView('home')} className="mb-4 gap-1.5">
        <ArrowLeft className="h-4 w-4" /> Back to Home
      </Button>

      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-2xl font-bold text-primary">
          {voterProfile?.fullName?.charAt(0).toUpperCase() || '?'}
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">{voterProfile?.fullName || 'Voter'}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="font-mono text-[10px]">{voterProfile?.voterId || voterProfile?.matric || '—'}</Badge>
            {voterProfile?.hasVoted ? (
              <Badge className="bg-emerald-100 text-emerald-700 gap-1"><CheckCircle2 className="h-3 w-3" /> Voted</Badge>
            ) : (
              <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Not Voted</Badge>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.label} onClick={() => setTab(t.label)} className={cn('flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors', tab === t.label ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground')}>
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'My Profile' && (
        <Card>
          <CardHeader><CardTitle className="font-display text-base">My Profile</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-muted/50 p-3"><div className="text-xs text-muted-foreground">Name</div><div className="font-medium">{voterProfile?.fullName || '—'}</div></div>
              <div className="rounded-lg bg-muted/50 p-3"><div className="text-xs text-muted-foreground">Voter ID</div><div className="font-mono text-xs">{voterProfile?.voterId || voterProfile?.matric || '—'}</div></div>
              <div className="rounded-lg bg-muted/50 p-3"><div className="text-xs text-muted-foreground">Email</div><div className="font-medium">{voterProfile?.institutionEmail || voterProfile?.personalEmail || '—'}</div></div>
              <div className="rounded-lg bg-muted/50 p-3"><div className="text-xs text-muted-foreground">Phone</div><div className="font-medium">{voterProfile?.phone || '—'}</div></div>
            </div>
            {voterProfile?.faculty && <div className="rounded-lg bg-muted/50 p-3"><div className="text-xs text-muted-foreground">Organization Unit</div><div className="font-medium">{voterProfile.faculty?.name || voterProfile.faculty}</div></div>}
            {voterProfile?.department && <div className="rounded-lg bg-muted/50 p-3"><div className="text-xs text-muted-foreground">Voter Group</div><div className="font-medium">{voterProfile.department?.name || voterProfile.department}</div></div>}
          </CardContent>
        </Card>
      )}

      {tab === 'My Elections' && (
        <Card><CardContent className="py-8 text-center">
          <Vote className="mx-auto h-12 w-12 text-muted-foreground/40" />
          <p className="mt-2 text-sm font-medium">Available Elections</p>
          <p className="mt-1 text-xs text-muted-foreground">Elections you are eligible for will appear here.</p>
          <Button size="sm" className="mt-3 gap-2" onClick={() => setView('verify')}><Vote className="h-4 w-4" /> Start Voting</Button>
        </CardContent></Card>
      )}

      {tab === 'Voting Status' && (
        <Card>
          <CardHeader><CardTitle className="font-display text-base">Voting Status</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
              <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-600" /><span className="text-sm font-medium">Accreditation</span></div>
              <Badge className="bg-emerald-100 text-emerald-700">Accredited</Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
              <div className="flex items-center gap-2"><Vote className="h-5 w-5 text-primary" /><span className="text-sm font-medium">Vote Status</span></div>
              {voterProfile?.hasVoted ? <Badge className="bg-emerald-100 text-emerald-700">Voted</Badge> : <Badge variant="secondary">Not Voted</Badge>}
            </div>
            {voterProfile?.votedAt && <div className="text-xs text-muted-foreground">Voted on {new Date(voterProfile.votedAt).toLocaleString()}</div>}
          </CardContent>
        </Card>
      )}

      {tab === 'Support' && (
        <Card><CardContent className="py-8 text-center">
          <Headphones className="mx-auto h-12 w-12 text-muted-foreground/40" />
          <p className="mt-2 text-sm font-medium">Need Help?</p>
          <p className="mt-1 text-xs text-muted-foreground">Open a support ticket or chat with our AI assistant.</p>
          <Button size="sm" variant="outline" className="mt-3 gap-2"><Headphones className="h-4 w-4" /> Open Ticket</Button>
        </CardContent></Card>
      )}

      {tab === 'Notifications' && (
        <Card><CardContent className="py-8 text-center">
          <Bell className="mx-auto h-12 w-12 text-muted-foreground/40" />
          <p className="mt-2 text-sm text-muted-foreground">No notifications yet.</p>
        </CardContent></Card>
      )}

      {tab === 'Past Elections' && (
        <Card><CardContent className="py-8 text-center">
          <Award className="mx-auto h-12 w-12 text-muted-foreground/40" />
          <p className="mt-2 text-sm font-medium">Past Elections</p>
          <p className="mt-1 text-xs text-muted-foreground">Your voting history and certificates will appear here.</p>
        </CardContent></Card>
      )}
    </div>
  )
}
