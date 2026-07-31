'use client'

import { useApp } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { TurnoutRing } from '@/components/votewise/shared'
import { VoteShareDonut } from '@/components/votewise/donut'
import { Users, CheckCircle2, Trophy, MinusCircle, Crown } from 'lucide-react'
import { cn } from '@/lib/utils'

export function LiveResultsPanel({ compact = false }: { compact?: boolean }) {
  const { live } = useApp()

  if (!live) {
    return (
      <Card className="votewise-card-glow">
        <CardContent className="flex items-center justify-center gap-3 py-16 text-muted-foreground">
          <span className="votewise-live-dot inline-block h-3 w-3 rounded-full bg-primary" />
          Connecting to the live results stream…
        </CardContent>
      </Card>
    )
  }

  if (live.hidden) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <Trophy className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">{(live as any).message || 'Live results are currently disabled by the electoral committee.'}</p>
        </CardContent>
      </Card>
    )
  }

  const { turnout, positions, election } = live

  return (
    <div className="space-y-6">
      {/* Turnout summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="votewise-card-glow">
          <CardContent className="flex items-center gap-5 py-5">
            <TurnoutRing voted={turnout.voted} total={turnout.totalVoters} pct={turnout.turnoutPct} />
            <div className="space-y-1">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Voter Turnout</div>
              <div className="font-display text-2xl font-bold">{turnout.voted.toLocaleString()} <span className="text-base font-normal text-muted-foreground">/ {turnout.totalVoters.toLocaleString()}</span></div>
              <div className="text-sm text-muted-foreground">{turnout.remaining.toLocaleString()} yet to vote</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-5">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary"><CheckCircle2 className="h-6 w-6" /></div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Votes Cast</div>
              <div className="font-display text-2xl font-bold">{turnout.voted.toLocaleString()}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-5">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-accent/20 text-accent-foreground"><Users className="h-6 w-6" /></div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Registered Voters</div>
              <div className="font-display text-2xl font-bold">{turnout.totalVoters.toLocaleString()}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-position results */}
      <div className={cn('grid gap-5', compact ? 'md:grid-cols-1' : 'md:grid-cols-2')}>
        {positions.map((p: any) => {
          const leader = p.candidates[0]
          return (
            <Card key={p.id} className="votewise-card-glow overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="font-display text-base">{p.title}</CardTitle>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{scopeLabel(p.scope)}</Badge>
                      <span className="text-xs text-muted-foreground">{p.totalVotes} votes</span>
                    </div>
                  </div>
                  {leader && leader.votes > 0 && (
                    <Badge className="gap-1 bg-accent text-accent-foreground"><Trophy className="h-3 w-3" /> Leading</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {p.candidates.length === 0 && p.notaVotes === 0 && (
                  <p className="text-sm text-muted-foreground">No votes recorded yet for this position.</p>
                )}
                {p.candidates.map((c: any, i: number) => {
                  const isLeader = i === 0 && c.votes > 0
                  return (
                    <div key={c.id} className={cn('space-y-1 rounded-lg p-1.5 transition-colors', isLeader && 'bg-primary/5')}>
                      <div className="flex items-center gap-3">
                        <span className={cn('w-5 text-right font-mono text-xs', isLeader ? 'font-bold text-primary' : 'text-muted-foreground')}>{i + 1}</span>
                        <div className="relative">
                          <Avatar className={cn('h-8 w-8 ring-1', isLeader ? 'ring-primary' : 'ring-border')}>
                            {c.photoUrl ? <AvatarImage src={c.photoUrl} alt={c.fullName} /> : null}
                            <AvatarFallback>{c.fullName?.slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          {isLeader && (
                            <div className="absolute -top-2 -right-1 grid h-4 w-4 place-items-center rounded-full bg-accent text-accent-foreground ring-2 ring-background">
                              <Crown className="h-2.5 w-2.5" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className={cn('truncate text-sm', isLeader ? 'font-bold' : 'font-medium')}>{c.fullName}</span>
                            <span className="shrink-0 font-mono text-xs font-semibold">{c.votes} <span className="text-muted-foreground">({c.pct}%)</span></span>
                          </div>
                          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn('votewise-bar-anim h-full rounded-full', isLeader ? 'bg-primary' : 'bg-primary/40')}
                              style={{ width: `${Math.max(2, c.pct)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
                {p.notaVotes > 0 && (
                  <div className="flex items-center gap-3 border-t border-dashed border-border pt-2">
                    <MinusCircle className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 text-xs text-muted-foreground">None of the Above (NOTA)</span>
                    <span className="font-mono text-xs font-semibold">{p.notaVotes} <span className="text-muted-foreground">({p.totalVotes > 0 ? Math.round((p.notaVotes / p.totalVotes) * 1000) / 10 : 0}%)</span></span>
                  </div>
                )}
                {/* Vote share donut (only when there are votes) */}
                {p.totalVotes > 0 && p.candidates.length > 1 && (
                  <div className="border-t border-border/60 pt-3">
                    <VoteShareDonut candidates={p.candidates} size={100} />
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

function scopeLabel(s: string) {
  if (s === 'UNIVERSITY') return 'University-wide'
  if (s === 'FACULTY') return 'Faculty'
  if (s === 'DEPARTMENT') return 'Department'
  return s
}
