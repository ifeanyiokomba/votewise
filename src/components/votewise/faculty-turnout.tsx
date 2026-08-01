'use client'

import { useEffect, useState } from 'react'
import { Building2, Users, CheckCircle2, Loader2, MapPin } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import { useTerminology } from '@/lib/terminology'
import { cn } from '@/lib/utils'
import { Reveal } from '@/components/votewise/faq'

export function FacultyTurnoutMap() {
  const t = useTerminology()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getTurnout().then((d) => { if (!d.hidden) setData(d); setLoading(false) }).catch(() => setLoading(false))
    const t = setInterval(() => api.getTurnout().then((d) => { if (!d.hidden) setData(d) }).catch(() => {}), 5000)
    return () => clearInterval(t)
  }, [])

  if (loading) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (!data || (data as any).hidden) return null

  const maxVoted = Math.max(1, ...data.byFaculty.map((f: any) => f.voted))
  const maxTotal = Math.max(1, ...data.byFaculty.map((f: any) => f.total))

  return (
    <Card className="votewise-card-glow">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="font-display text-base flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" /> Turnout by {t.workspaceLabel}
          </CardTitle>
          <Badge variant="outline" className="gap-1">
            <span className="votewise-live-dot inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {data.summary.turnoutPct}% overall
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.byFaculty.map((f: any, i: number) => {
            const turnoutRatio = f.total > 0 ? f.voted / f.total : 0
            const barWidth = (f.voted / maxVoted) * 100
            const isLeading = f.voted === maxVoted && f.voted > 0
            return (
              <Reveal key={f.id} delay={i * 50}>
                <div className={cn(
                  'rounded-lg border p-3 transition-all hover:shadow-sm',
                  isLeading ? 'border-primary/40 bg-primary/5' : 'border-border/60'
                )}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{f.name}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{f.code}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-display text-lg font-bold text-primary">{f.pct}%</div>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="votewise-bar-anim h-full rounded-full bg-primary transition-all"
                      style={{ width: `${Math.max(2, barWidth)}%` }}
                    />
                  </div>
                  {/* Stats */}
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                      {f.voted} voted
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {f.total} total
                    </span>
                  </div>
                  {/* Mini turnout ring */}
                  <div className="mt-2 flex items-center gap-2">
                    <svg width="20" height="20" viewBox="0 0 20 20" className="-rotate-90">
                      <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted/40" />
                      <circle
                        cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                        className="text-primary transition-all"
                        strokeDasharray={2 * Math.PI * 8}
                        strokeDashoffset={2 * Math.PI * 8 * (1 - turnoutRatio)}
                      />
                    </svg>
                    <span className="text-[10px] text-muted-foreground">{f.total - f.voted} remaining</span>
                  </div>
                </div>
              </Reveal>
            )
          })}
        </div>
        {/* Summary bar */}
        <div className="mt-4 flex items-center justify-between rounded-lg bg-muted/50 p-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-sm">
              <Users className="h-4 w-4 text-primary" />
              <span className="font-semibold">{data.summary.totalVoters}</span>
              <span className="text-muted-foreground">registered</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span className="font-semibold">{data.summary.voted}</span>
              <span className="text-muted-foreground">voted</span>
            </div>
          </div>
          <Badge className="gap-1 bg-primary/10 text-primary">
            {data.summary.turnoutPct}% turnout
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}
