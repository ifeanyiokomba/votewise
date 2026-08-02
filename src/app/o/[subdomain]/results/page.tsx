'use client'

import { use } from 'react'
import Link from 'next/link'
import { ArrowLeft, BarChart3, Lock, TrendingUp, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export default function ResultsPage({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = use(params)
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border/60 bg-muted/30">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link href={`/o/${subdomain}`}><Button variant="ghost" size="sm" className="gap-1.5"><ArrowLeft className="h-3.5 w-3.5" /> Back</Button></Link>
          <h1 className="font-display text-sm font-bold">Live Results</h1>
        </div>
      </header>
      <main className="flex-1 py-8">
        <div className="mx-auto max-w-4xl px-4 space-y-6">
          <Card className="votewise-card-glow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-base"><BarChart3 className="h-4 w-4 text-primary" /> Election Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div><div className="font-display text-2xl font-bold">11,002</div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Votes Cast</div></div>
                <div><div className="font-display text-2xl font-bold">72%</div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Turnout</div></div>
                <div><div className="font-display text-2xl font-bold">15,210</div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Verified</div></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-display text-sm flex items-center gap-2"><Lock className="h-4 w-4 text-muted-foreground" /> Results Visibility</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Results visibility is configured by the electoral committee. Options include: Hidden, Turnout Only, Partial Results (authorized viewers), or Public Results.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge variant="outline">Turnout: Public</Badge>
                <Badge variant="outline">Candidate Results: Hidden until certified</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="font-display text-sm">Turnout Analytics</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm"><span className="flex items-center gap-2"><Users className="h-3.5 w-3.5 text-muted-foreground" /> Faculty of Engineering</span><span className="font-mono font-semibold">78%</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-emerald-500" style={{ width: '78%' }} /></div>
              <div className="flex items-center justify-between text-sm"><span className="flex items-center gap-2"><Users className="h-3.5 w-3.5 text-muted-foreground" /> Faculty of Science</span><span className="font-mono font-semibold">71%</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-emerald-500" style={{ width: '71%' }} /></div>
              <div className="flex items-center justify-between text-sm"><span className="flex items-center gap-2"><Users className="h-3.5 w-3.5 text-muted-foreground" /> Faculty of Arts</span><span className="font-mono font-semibold">65%</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-amber-500" style={{ width: '65%' }} /></div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
