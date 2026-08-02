'use client'

import { use } from 'react'
import Link from 'next/link'
import { ArrowLeft, Users, Mail, ShieldCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export default function CommitteePage({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = use(params)
  const committee = [
    { name: 'Dr. Adewale Johnson', role: 'Chairman', email: 'chairman@example.edu.ng' },
    { name: 'Mrs. Fatima Bello', role: 'Secretary', email: 'secretary@example.edu.ng' },
    { name: 'Prof. Nnamdi Okafor', role: 'Member', email: 'nokafor@example.edu.ng' },
    { name: 'Dr. Grace Adebayo', role: 'Member', email: 'gadebayo@example.edu.ng' },
  ]

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border/60 bg-muted/30">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link href={`/o/${subdomain}`}><Button variant="ghost" size="sm" className="gap-1.5"><ArrowLeft className="h-3.5 w-3.5" /> Back</Button></Link>
          <h1 className="font-display text-sm font-bold">Electoral Committee</h1>
        </div>
      </header>
      <main className="flex-1 py-8">
        <div className="mx-auto max-w-4xl px-4 space-y-6">
          <Card className="votewise-card-glow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-base"><ShieldCheck className="h-4 w-4 text-primary" /> Student Electoral Commission</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">The electoral committee oversees the conduct of free, fair, and transparent elections. Contact them for any election-related questions.</p>
            </CardContent>
          </Card>

          <div>
            <h2 className="mb-3 font-display text-base font-bold">Committee Members</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {committee.map((m) => (
                <Card key={m.email}>
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
                      <Users className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold">{m.name}</div>
                      <Badge variant="outline" className="mt-0.5 text-[9px]">{m.role}</Badge>
                      <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Mail className="h-3 w-3" /> {m.email}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <Card>
            <CardHeader><CardTitle className="font-display text-sm">Election Rules</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              <p>1. Every registered student is eligible to vote once.</p>
              <p>2. Voting is secret — no one can see your candidate selection.</p>
              <p>3. Vote buying, selling, or coercion is strictly prohibited.</p>
              <p>4. Campaign materials must not be brought into voting areas.</p>
              <p>5. Results are announced after voting closes and are certified by the committee.</p>
              <p>6. Any disputes must be filed within 24 hours of result announcement.</p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
