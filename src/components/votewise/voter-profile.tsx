'use client'

import { useEffect, useState } from 'react'
import {
  ArrowLeft, Loader2, Users, Mail, Phone, ShieldCheck, Clock, CheckCircle2,
  Ban, Vote, FileText, Calendar,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

export function VoterProfile({ voterId, subdomain }: { voterId: string; subdomain?: string }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    api.getVoterProfile(voterId, subdomain).then((d) => { if (active) setData(d) }).catch(() => {}).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [voterId, subdomain])

  if (loading) return <div className="grid min-h-[60vh] place-items-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  if (!data) return <div className="py-16 text-center text-muted-foreground">Voter not found.</div>

  const { voter: v, timeline, groups } = data
  const metadata = v.metadata ? (() => { try { return JSON.parse(v.metadata) } catch { return {} } })() : {}

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      <Button variant="ghost" size="sm" onClick={() => { window.location.href = `/workspace/voters?org=${subdomain || ''}` }} className="mb-4 gap-1.5">
        <ArrowLeft className="h-4 w-4" /> Back to Voter Registry
      </Button>

      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-2xl font-bold text-primary">
          {(v.firstName || v.fullName || '?').charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">{v.firstName || ''} {v.lastName || v.fullName || ''}</h1>
          <div className="flex items-center gap-2 mt-1">
            {v.matric && <Badge variant="outline" className="font-mono text-[10px]">{v.matric}</Badge>}
            <Badge className={cn(v.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')}>{v.status || 'ACTIVE'}</Badge>
            <Badge variant="outline" className={cn(v.verificationStatus === 'VERIFIED' ? 'text-emerald-600' : 'text-amber-600')}>{v.verificationStatus || 'PENDING'}</Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column — profile details */}
        <div className="space-y-6 lg:col-span-2">
          {/* Contact */}
          <Card>
            <CardHeader><CardTitle className="font-display text-base">Contact Information</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /> {v.email || '—'}</div>
              <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> {v.phone || '—'}</div>
            </CardContent>
          </Card>

          {/* Dynamic metadata */}
          {Object.keys(metadata).length > 0 && (
            <Card>
              <CardHeader><CardTitle className="font-display text-base">Identity Fields</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-sm">
                {Object.entries(metadata).map(([k, val]: [string, any]) => (
                  <div key={k} className="rounded-lg bg-muted/50 p-2.5">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k.replace(/([A-Z])/g, ' $1').trim()}</div>
                    <div className="font-medium">{String(val)}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Voter groups */}
          <Card>
            <CardHeader><CardTitle className="font-display text-base">Voter Groups</CardTitle></CardHeader>
            <CardContent>
              {groups.length === 0 ? <p className="text-sm text-muted-foreground">No groups assigned.</p> : (
                <div className="flex flex-wrap gap-2">
                  {groups.map((g: any) => <Badge key={g.id} variant="secondary" className="gap-1">{g.isDynamic && <Zap className="h-3 w-3" />}{g.name}</Badge>)}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Voting history */}
          <Card>
            <CardHeader><CardTitle className="font-display text-base">Voting History</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2"><Vote className="h-4 w-4 text-muted-foreground" /> Has Voted</span>
                <Badge className={cn(v.hasVoted ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground')}>{v.hasVoted ? 'Yes' : 'No'}</Badge>
              </div>
              {v.votedAt && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Calendar className="h-3 w-3" /> Voted on {new Date(v.votedAt).toLocaleString()}</div>}
              {v.flagged && <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700"><Ban className="inline h-3 w-3" /> Flagged: {v.flaggedReason || 'No reason provided'}</div>}
            </CardContent>
          </Card>
        </div>

        {/* Right column — timeline */}
        <div>
          <Card>
            <CardHeader><CardTitle className="font-display text-base">Voter Timeline</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {timeline.length === 0 ? <p className="text-sm text-muted-foreground">No events yet.</p> : timeline.map((ev: any) => (
                <div key={ev.id} className="flex items-start gap-2 text-sm">
                  <div className={cn('grid h-6 w-6 shrink-0 place-items-center rounded-full',
                    ev.eventType === 'VOTE_CAST' ? 'bg-emerald-100 text-emerald-600' :
                    ev.eventType === 'ACCREDITED' || ev.eventType === 'EMAIL_VERIFIED' ? 'bg-blue-100 text-blue-600' :
                    ev.eventType === 'SUSPENDED' ? 'bg-red-100 text-red-600' :
                    'bg-muted text-muted-foreground')}>
                    {ev.eventType === 'VOTE_CAST' ? <Vote className="h-3 w-3" /> :
                     ev.eventType === 'SUSPENDED' ? <Ban className="h-3 w-3" /> :
                     <CheckCircle2 className="h-3 w-3" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium">{ev.description || ev.eventType.replace(/_/g, ' ').toLowerCase()}</div>
                    <div className="text-[10px] text-muted-foreground">{new Date(ev.createdAt).toLocaleString()}</div>
                    {ev.actorName && <div className="text-[10px] text-muted-foreground">by {ev.actorName}</div>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

// Import Zap for dynamic group indicator
import { Zap } from 'lucide-react'
