'use client'

import { use } from 'react'
import Link from 'next/link'
import { ArrowLeft, Calendar, FileText } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export default function TimetablePage({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = use(params)
  const phases = [
    { name: 'Nomination', date: 'Aug 1, 2026', status: 'completed', desc: 'Candidates submit nomination forms' },
    { name: 'Screening', date: 'Aug 3, 2026', status: 'completed', desc: 'Electoral committee screens candidates' },
    { name: 'Campaign', date: 'Aug 5–10, 2026', status: 'completed', desc: 'Candidates campaign across campus' },
    { name: 'Accreditation', date: 'Aug 11, 2026', status: 'active', desc: 'Voter accreditation opens' },
    { name: 'Voting', date: 'Aug 12, 10:00', status: 'upcoming', desc: 'Voting opens — cast your ballot' },
    { name: 'Result Announcement', date: 'Aug 12, 18:00', status: 'upcoming', desc: 'Results announced and certified' },
  ]

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border/60 bg-muted/30">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link href={`/o/${subdomain}`}><Button variant="ghost" size="sm" className="gap-1.5"><ArrowLeft className="h-3.5 w-3.5" /> Back</Button></Link>
          <h1 className="font-display text-sm font-bold">Election Timetable</h1>
        </div>
      </header>
      <main className="flex-1 py-8">
        <div className="mx-auto max-w-3xl px-4">
          <Card className="votewise-card-glow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-base"><Calendar className="h-4 w-4 text-primary" /> Election Schedule</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative space-y-6 before:absolute before:left-4 before:top-2 before:h-full before:w-0.5 before:bg-border">
                {phases.map((p, i) => (
                  <div key={i} className="relative flex gap-4 pl-12">
                    <div className={`absolute left-0 grid h-8 w-8 place-items-center rounded-full border-2 ${
                      p.status === 'completed' ? 'border-emerald-500 bg-emerald-500 text-white' :
                      p.status === 'active' ? 'border-amber-500 bg-amber-500 text-white' :
                      'border-border bg-background'
                    }`}>
                      {p.status === 'completed' ? '✓' : i + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-bold">{p.name}</h3>
                        {p.status === 'active' && <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">Active Now</Badge>}
                        {p.status === 'completed' && <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">Completed</Badge>}
                      </div>
                      <p className="text-[11px] text-muted-foreground">{p.date}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{p.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
