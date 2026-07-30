'use client'

import { useEffect, useState } from 'react'
import {
  Calendar, FileText, CheckCircle2, Megaphone, VolumeOff, Vote, BarChart3,
  Gavel, ChevronRight, Activity, Loader2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useApp } from '@/lib/store'

// Election timetable phases (derived from election start/end + Nigerian SUG practice)
const PHASES = [
  { icon: FileText, key: 'nomination', title: 'Nomination', desc: 'Aspirants submit nomination forms, screened by ELCOM.' },
  { icon: CheckCircle2, key: 'screening', title: 'Screening', desc: 'Credentials verified; qualified candidates published.' },
  { icon: Megaphone, key: 'campaign', title: 'Campaign Period', desc: 'Manifesto presentations, debates, and faculty rallies.' },
  { icon: VolumeOff, key: 'silence', title: 'Silence Period', desc: 'No campaigning 24 hours before voting opens.' },
  { icon: Vote, key: 'voting', title: 'Voting', desc: 'Accreditation and ballot casting.' },
  { icon: BarChart3, key: 'collation', title: 'Collation & Results', desc: 'Live tally, certification, and public announcement.' },
  { icon: Gavel, key: 'appeal', title: 'Appeal Window', desc: 'Petitions heard by the Electoral Appeals Committee.' },
]

export function ElectionTimetable({ election }: { election: any }) {
  if (!election) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          <Loader2 className="mx-auto h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    )
  }
  const start = new Date(election.startTime)
  const end = new Date(election.endTime)
  const now = new Date()
  const accStart = election.accreditationStart ? new Date(election.accreditationStart) : new Date(start.getTime() - 2 * 60 * 60 * 1000)

  // Compute phase windows relative to voting start/end.
  const campaignStart = new Date(start.getTime() - 14 * 24 * 60 * 60 * 1000) // 2 weeks before
  const silenceStart = new Date(start.getTime() - 24 * 60 * 60 * 1000) // 24h before
  const collationStart = end
  const appealStart = new Date(end.getTime() + 24 * 60 * 60 * 1000) // 24h after

  const phases = [
    { ...PHASES[0], from: new Date(campaignStart.getTime() - 7 * 24 * 60 * 60 * 1000), to: campaignStart },
    { ...PHASES[1], from: campaignStart, to: new Date(start.getTime() - 7 * 24 * 60 * 60 * 1000) },
    { ...PHASES[2], from: new Date(start.getTime() - 7 * 24 * 60 * 60 * 1000), to: silenceStart },
    { ...PHASES[3], from: silenceStart, to: start },
    { ...PHASES[4], from: start, to: end },
    { ...PHASES[5], from: collationStart, to: appealStart },
    { ...PHASES[6], from: appealStart, to: new Date(appealStart.getTime() + 7 * 24 * 60 * 60 * 1000) },
  ]

  function phaseStatus(p: typeof phases[0]): 'past' | 'active' | 'future' {
    if (now >= p.to) return 'past'
    if (now >= p.from && now < p.to) return 'active'
    return 'future'
  }

  return (
    <Card className="afrivote-card-glow">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <CardTitle className="font-display text-base">Election Timetable</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[19px] top-2 bottom-2 w-0.5 bg-border" />
          <div className="space-y-1">
            {phases.map((p, i) => {
              const status = phaseStatus(p)
              const Icon = p.icon
              return (
                <div key={p.key} className="relative flex items-start gap-4 py-2">
                  <div className={cn(
                    'relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 transition-colors',
                    status === 'active' ? 'border-primary bg-primary text-primary-foreground' :
                    status === 'past' ? 'border-emerald-500 bg-emerald-500 text-white' :
                    'border-border bg-background text-muted-foreground'
                  )}>
                    <Icon className="h-4 w-4" />
                    {status === 'active' && <span className="absolute -inset-1 animate-ping rounded-full border-2 border-primary/40" />}
                  </div>
                  <div className="flex-1 pt-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn('font-medium', status === 'future' && 'text-muted-foreground')}>{p.title}</span>
                      {status === 'active' && <Badge className="gap-1 bg-emerald-100 text-emerald-700"><span className="afrivote-live-dot inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" /> Now</Badge>}
                      {status === 'past' && <Badge variant="secondary" className="text-[10px]">Done</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{p.desc}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                      {p.from.toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })} — {p.to.toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Live activity feed — shows recent votes streaming in
export function LiveActivityFeed() {
  const { live } = useApp()
  const [activities, setActivities] = useState<{ time: string; position: string }[]>([])

  useEffect(() => {
    if (!live?.positions) return
    const recent = (live as any).recentActivity || []
    let next: { time: string; position: string }[] = []
    if (recent.length > 0) {
      next = recent.slice(0, 8).map((a: any) => ({
        time: new Date(a.at).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        position: live.positions.find((p: any) => p.id === a.positionId)?.title || 'a position',
      }))
    } else {
      const total = live.turnout?.voted || 0
      if (total > 0) next = [{ time: 'recently', position: `${total} votes cast so far` }]
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActivities(next)
  }, [live])

  if (activities.length === 0) return null

  return (
    <Card className="afrivote-card-glow">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <CardTitle className="font-display text-base">Live Activity</CardTitle>
          <span className="afrivote-live-dot ml-auto inline-block h-2 w-2 rounded-full bg-emerald-500" />
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="afrivote-scroll max-h-48 overflow-y-auto">
          {activities.map((a, i) => (
            <div key={i} className="flex items-center gap-2 border-b border-border/40 py-1.5 text-xs last:border-0">
              <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-600">
                <Vote className="h-3 w-3" />
              </div>
              <span className="flex-1 text-muted-foreground">Vote cast for <span className="font-medium text-foreground">{a.position}</span></span>
              <span className="font-mono text-[10px] text-muted-foreground">{a.time}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Skeleton loader for results
export function ResultsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="flex items-center gap-5 py-5">
              <div className="h-[140px] w-[140px] animate-pulse rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                <div className="h-6 w-24 animate-pulse rounded bg-muted" />
                <div className="h-3 w-16 animate-pulse rounded bg-muted" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-3">
              <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              <div className="h-3 w-20 animate-pulse rounded bg-muted" />
            </CardHeader>
            <CardContent className="space-y-3">
              {[...Array(3)].map((_, j) => (
                <div key={j} className="flex items-center gap-3">
                  <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3 w-32 animate-pulse rounded bg-muted" />
                    <div className="h-2 w-full animate-pulse rounded-full bg-muted" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
