'use client'

import { use } from 'react'
import Link from 'next/link'
import { ArrowLeft, Headphones, MessageSquare, Mail, Phone } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function SupportPage({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = use(params)
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border/60 bg-muted/30">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link href={`/o/${subdomain}`}><Button variant="ghost" size="sm" className="gap-1.5"><ArrowLeft className="h-3.5 w-3.5" /> Back</Button></Link>
          <h1 className="font-display text-sm font-bold">Support Center</h1>
        </div>
      </header>
      <main className="flex-1 py-8">
        <div className="mx-auto max-w-2xl px-4 space-y-6">
          <Card className="votewise-card-glow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-base"><Headphones className="h-4 w-4 text-primary" /> How Can We Help?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Card><CardContent className="p-4"><MessageSquare className="mb-2 h-5 w-5 text-primary" /><h3 className="text-sm font-bold">Request New OTVP</h3><p className="text-[11px] text-muted-foreground">Didn't receive your voting code? Request a new one.</p><Button variant="outline" size="sm" className="mt-2 w-full text-xs">Request</Button></CardContent></Card>
                <Card><CardContent className="p-4"><Mail className="mb-2 h-5 w-5 text-primary" /><h3 className="text-sm font-bold">Report an Issue</h3><p className="text-[11px] text-muted-foreground">Experiencing a problem? Let us know.</p><Button variant="outline" size="sm" className="mt-2 w-full text-xs">Report</Button></CardContent></Card>
                <Card><CardContent className="p-4"><Phone className="mb-2 h-5 w-5 text-primary" /><h3 className="text-sm font-bold">Eligibility Problem</h3><p className="text-[11px] text-muted-foreground">Can't find your name? Contact us.</p><Button variant="outline" size="sm" className="mt-2 w-full text-xs">Contact</Button></CardContent></Card>
                <Card><CardContent className="p-4"><MessageSquare className="mb-2 h-5 w-5 text-primary" /><h3 className="text-sm font-bold">Report Duplicate Account</h3><p className="text-[11px] text-muted-foreground">Found a duplicate? Report it here.</p><Button variant="outline" size="sm" className="mt-2 w-full text-xs">Report</Button></CardContent></Card>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="font-display text-sm">Submit a Support Ticket</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2"><Label htmlFor="name">Your Name</Label><Input id="name" placeholder="Full name" /></div>
              <div className="space-y-2"><Label htmlFor="email">Email / Matric Number</Label><Input id="email" placeholder="How can we reach you?" /></div>
              <div className="space-y-2"><Label htmlFor="subject">Subject</Label><Input id="subject" placeholder="Brief description" /></div>
              <div className="space-y-2"><Label htmlFor="message">Message</Label><Textarea id="message" rows={4} placeholder="Describe your issue in detail" /></div>
              <Button className="w-full gap-2">Submit Ticket</Button>
              <p className="text-center text-[10px] text-muted-foreground">Tickets are routed to the Organization Admin → Observers → VoteWise Support</p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
