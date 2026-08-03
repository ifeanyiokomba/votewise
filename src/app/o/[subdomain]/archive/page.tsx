'use client'

import { use } from 'react'
import Link from 'next/link'
import { ArrowLeft, Award, Trophy, Users, TrendingUp, Calendar, FileText } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export default function ArchivePage({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = use(params)
  const archives = [
    { id: '2024-sug', name: '2024 SUG General Elections', date: 'Jun 2024', turnout: 89.2, voters: 38421, certified: true, winner: 'Sarah Adeyemi' },
    { id: '2024-eng', name: '2024 Faculty of Engineering Election', date: 'Apr 2024', turnout: 76.5, voters: 4200, certified: true, winner: 'Michael Okafor' },
    { id: '2023-sug', name: '2023 SUG General Elections', date: 'Jun 2023', turnout: 82.1, voters: 35102, certified: true, winner: 'David Bello' },
    { id: '2023-sci', name: '2023 Faculty of Science Election', date: 'Apr 2023', turnout: 71.8, voters: 5600, certified: true, winner: 'Grace Johnson' },
  ]

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border/60 bg-muted/30">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link href={`/o/${subdomain}`}><Button variant="ghost" size="sm" className="gap-1.5"><ArrowLeft className="h-3.5 w-3.5" /> Back</Button></Link>
          <h1 className="font-display text-sm font-bold">Election Archive</h1>
        </div>
      </header>
      <main className="flex-1 py-8">
        <div className="mx-auto max-w-4xl px-4 space-y-4">
          <div className="mb-6">
            <h2 className="font-display text-2xl font-bold">Past Elections</h2>
            <p className="text-sm text-muted-foreground">Certified results from previous elections. All results are final and publicly verifiable.</p>
          </div>
          {archives.map((e) => (
            <Card key={e.id} className="votewise-card-glow">
              <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="grid h-12 w-12 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <Award className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-base font-bold">{e.name}</h3>
                      {e.certified && <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"><Trophy className="mr-1 h-3 w-3" /> Certified</Badge>}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {e.date}</span>
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {e.voters.toLocaleString()} voters</span>
                      <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" /> {e.turnout}% turnout</span>
                      <span className="flex items-center gap-1"><Trophy className="h-3 w-3" /> Winner: {e.winner}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link href={`/o/${subdomain}/results?election=${e.id}`}>
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs">View Results</Button>
                  </Link>
                  <Button variant="ghost" size="sm" className="gap-1.5 text-xs"><FileText className="h-3.5 w-3.5" /> Report</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  )
}
