'use client'

import { use } from 'react'
import Link from 'next/link'
import { ArrowLeft, Trophy, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export default function CandidatesPage({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = use(params)
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border/60 bg-muted/30">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link href={`/o/${subdomain}`}><Button variant="ghost" size="sm" className="gap-1.5"><ArrowLeft className="h-3.5 w-3.5" /> Back</Button></Link>
          <h1 className="font-display text-sm font-bold">Candidate Directory</h1>
        </div>
      </header>
      <main className="flex-1 py-8">
        <div className="mx-auto max-w-6xl px-4">
          <Card className="votewise-card-glow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-base"><Trophy className="h-4 w-4 text-primary" /> Candidates</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">View candidate profiles, manifestos, and campaign promises. Click a position to see the candidates running for it.</p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {['President', 'Vice President', 'Secretary General', 'Treasurer', 'PRO', 'Welfare Director'].map((pos) => (
                  <Card key={pos}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <h3 className="text-sm font-bold">{pos}</h3>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">View candidates running for this position.</p>
                      <Button variant="outline" size="sm" className="mt-3 w-full text-xs">View Candidates</Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
