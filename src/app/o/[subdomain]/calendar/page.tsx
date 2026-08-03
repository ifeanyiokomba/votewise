'use client'

import { use } from 'react'
import Link from 'next/link'
import { ArrowLeft, Calendar, ChevronRight, Vote, Trophy, FileText } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export default function CalendarPage({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = use(params)
  const events = [
    { date: 'Aug 12', month: '2026', title: 'SUG General Elections — Voting Day', type: 'voting', status: 'LIVE' },
    { date: 'Aug 11', month: '2026', title: 'Accreditation Opens', type: 'accreditation', status: 'DONE' },
    { date: 'Aug 5-10', month: '2026', title: 'Campaign Period', type: 'campaign', status: 'DONE' },
    { date: 'Aug 3', month: '2026', title: 'Candidate Screening', type: 'screening', status: 'DONE' },
    { date: 'Aug 1', month: '2026', title: 'Nomination Closes', type: 'nomination', status: 'DONE' },
    { date: 'Aug 12', month: '2026', title: 'Results Announcement (6:00 PM)', type: 'results', status: 'UPCOMING' },
    { date: 'Sep 15', month: '2026', title: 'Faculty of Engineering Election', type: 'voting', status: 'SCHEDULED' },
    { date: 'Oct 10', month: '2026', title: 'Faculty of Science Election', type: 'voting', status: 'SCHEDULED' },
  ]

  const typeColors: Record<string, string> = {
    voting: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    accreditation: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    campaign: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300',
    screening: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300',
    nomination: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300',
    results: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border/60 bg-muted/30">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link href={`/o/${subdomain}`}><Button variant="ghost" size="sm" className="gap-1.5"><ArrowLeft className="h-3.5 w-3.5" /> Back</Button></Link>
          <h1 className="font-display text-sm font-bold">Election Calendar</h1>
        </div>
      </header>
      <main className="flex-1 py-8">
        <div className="mx-auto max-w-3xl px-4">
          <div className="mb-6">
            <h2 className="font-display text-2xl font-bold">Election Schedule</h2>
            <p className="text-sm text-muted-foreground">All key dates for the current and upcoming elections.</p>
          </div>
          <div className="relative space-y-3 before:absolute before:left-[27px] before:top-2 before:h-full before:w-0.5 before:bg-border">
            {events.map((e, i) => (
              <div key={i} className="relative flex gap-4 pl-0">
                <div className={`grid h-14 w-14 shrink-0 place-items-center rounded-xl border-2 ${e.status === 'LIVE' ? 'border-emerald-500 bg-emerald-500 text-white' : e.status === 'DONE' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'border-border bg-background'}`}>
                  <div className="text-center">
                    <div className="text-[9px] font-bold uppercase leading-none">{e.date.split(' ')[0]}</div>
                    <div className="text-xs font-bold leading-tight">{e.date.split(' ')[1] || ''}</div>
                  </div>
                </div>
                <Card className="flex-1">
                  <CardContent className="flex items-center justify-between gap-3 p-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold">{e.title}</h3>
                        {e.status === 'LIVE' && <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 votewise-live-dot" />LIVE</Badge>}
                        {e.status === 'UPCOMING' && <Badge variant="outline" className="text-[9px]">Upcoming</Badge>}
                        {e.status === 'SCHEDULED' && <Badge variant="outline" className="text-[9px]">Scheduled</Badge>}
                      </div>
                      <Badge className={`mt-1 text-[9px] ${typeColors[e.type] || typeColors.campaign}`}>{e.type}</Badge>
                    </div>
                    {e.type === 'voting' && e.status === 'LIVE' && (
                      <Link href={`/workspace/elections/demo-election/vote?org=${subdomain}`}>
                        <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"><Vote className="h-3.5 w-3.5" /> Vote</Button>
                      </Link>
                    )}
                    {e.type === 'results' && (
                      <Button variant="ghost" size="sm" className="gap-1 text-xs"><Trophy className="h-3.5 w-3.5" /> Results</Button>
                    )}
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
