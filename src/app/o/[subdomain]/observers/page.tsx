'use client'

import { use } from 'react'
import Link from 'next/link'
import { ArrowLeft, Users, Mail, Shield, Eye, FileText } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export default function ObserversPage({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = use(params)
  const observers = [
    { name: 'Prof. Sarah Adeyemi', role: 'Chief Observer', org: 'Department of Political Science', email: 's.adeyemi@demo.edu.ng', assignments: 3 },
    { name: 'Dr. Michael Okafor', role: 'Faculty Observer', org: 'Faculty of Law', email: 'm.okafor@demo.edu.ng', assignments: 2 },
    { name: 'Mrs. Grace Johnson', role: 'Independent Observer', org: 'Civil Society Coalition', email: 'g.johnson@csc.org.ng', assignments: 5 },
    { name: 'Mr. David Bello', role: 'Student Observer', org: 'Student Union Judiciary', email: 'd.bello@sug.demo.edu.ng', assignments: 1 },
  ]

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border/60 bg-muted/30">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link href={`/o/${subdomain}`}><Button variant="ghost" size="sm" className="gap-1.5"><ArrowLeft className="h-3.5 w-3.5" /> Back</Button></Link>
          <h1 className="font-display text-sm font-bold">Observer Directory</h1>
        </div>
      </header>
      <main className="flex-1 py-8">
        <div className="mx-auto max-w-4xl px-4 space-y-6">
          <div>
            <h2 className="font-display text-2xl font-bold">Election Observers</h2>
            <p className="text-sm text-muted-foreground">Independent observers monitor the election to ensure transparency and integrity. Observers can see turnout, integrity events, and audit trails — but never ballots or voter identities.</p>
          </div>

          <Card className="votewise-card-glow">
            <CardHeader><CardTitle className="flex items-center gap-2 font-display text-base"><Shield className="h-4 w-4 text-primary" /> Observer Independence</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              <p>• Observers are independent of the electoral committee and candidates.</p>
              <p>• Observers cannot cast votes, modify elections, or view ballot selections.</p>
              <p>• Observers can monitor live turnout, flag incidents, and submit reports.</p>
              <p>• All observer actions are logged in the audit trail.</p>
              <p>• Observer reports are published after the election is certified.</p>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            {observers.map((o) => (
              <Card key={o.email}>
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                      <Users className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-bold">{o.name}</h3>
                      <Badge variant="outline" className="mt-1 text-[9px]">{o.role}</Badge>
                      <p className="mt-1 text-xs text-muted-foreground">{o.org}</p>
                      <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Mail className="h-3 w-3" /> {o.email}
                      </div>
                      <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Eye className="h-3 w-3" /> {o.assignments} election(s) assigned
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
