'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import {
  Shield, KeyRound, BadgeCheck, Vote, Users, Eye, Lock, FileCheck2,
  CheckCircle2, ArrowRight, ScrollText, Building2, GraduationCap, Clock, Calendar,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useApp } from '@/lib/store'
import { api } from '@/lib/api'
import { StatusBadge, Countdown } from '@/components/afrivote/shared'
import { LiveResultsPanel } from '@/components/afrivote/live-results'
import { ElectionTimetable, LiveActivityFeed, ResultsSkeleton } from '@/components/afrivote/timetable'

const HOW_STEPS = [
  { icon: KeyRound, title: '1. Verify Matric', desc: 'Enter your matriculation number. We check it against the official student register before anything else.' },
  { icon: Shield, title: '2. Receive OTP', desc: 'A one-time verification PIN is sent to your registered email, SMS, or WhatsApp. Enter it to unlock your ballot.' },
  { icon: Vote, title: '3. Cast Your Ballot', desc: 'Vote for each position you are eligible for. Candidate order is shuffled per voter — no positional bias.' },
  { icon: BadgeCheck, title: '4. Get Your Receipt', desc: 'You receive a unique receipt code. Use it on the homepage to confirm your vote was counted — without revealing who you voted for.' },
]

export function HomeView() {
  const { election, setElection, settings, setSettings, setView, live } = useApp()
  const [positions, setPositions] = useState<any[]>([])

  useEffect(() => {
    api.getElection().then((e) => { setElection(e); setSettings(e.settings) }).catch(() => {})
    api.getPositions().then((d) => setPositions(d.positions)).catch(() => {})
  }, [setElection, setSettings])

  const allCandidates = positions.flatMap((p: any) =>
    p.candidates.map((c: any) => ({ ...c, positionTitle: p.title, scope: p.scope }))
  )

  return (
    <div className="flex flex-col">
      {/* HERO */}
      <section className="afrivote-hero-bg relative overflow-hidden border-b border-border/60">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-2 md:py-16">
          <div className="flex flex-col justify-center">
            <Badge variant="secondary" className="mb-4 w-fit gap-1.5">
              <span className="afrivote-live-dot inline-block h-2 w-2 rounded-full bg-emerald-500" />
              {election?.university || 'Federal University of Lagos'} · SUG Elections
            </Badge>
            <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
              Your vote.<br />
              <span className="text-primary">Verifiable.</span>{' '}
              <span className="text-accent">Secret.</span>{' '}
              <span className="text-foreground">Secure.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
              The official electronic voting platform for the {election?.name || 'SUG General Elections'}.
              Verify your matric, receive a one-time PIN, cast your ballot, and prove your vote was counted —
              all in under two minutes.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button size="lg" onClick={() => setView('verify')} className="gap-2">
                <Shield className="h-5 w-5" /> Cast Your Vote Now
              </Button>
              <Button size="lg" variant="outline" onClick={() => document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' })} className="gap-2">
                <Eye className="h-5 w-5" /> View Live Results
              </Button>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5 text-primary" /> End-to-end ballot secrecy</span>
              <span className="flex items-center gap-1.5"><BadgeCheck className="h-3.5 w-3.5 text-primary" /> Receipt-anchored votes</span>
              <span className="flex items-center gap-1.5"><FileCheck2 className="h-3.5 w-3.5 text-primary" /> Full audit trail</span>
            </div>
          </div>

          <div className="relative">
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-border shadow-xl">
              <Image
                src="/hero-campus.jpg"
                alt="A vibrant Nigerian university campus"
                fill
                className="object-cover"
                priority
                sizes="(max-width: 768px) 100vw, 50vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-primary/40 via-transparent to-transparent" />
            </div>
            {/* Floating status card */}
            {election && (
              <Card className="afrivote-card-glow absolute -bottom-6 -left-2 w-64 max-w-[80%] sm:-left-6">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wider text-muted-foreground">Election Status</span>
                    <StatusBadge status={election.liveStatus || election.status} />
                  </div>
                  <div className="mt-3"><Countdown start={election.startTime} end={election.endTime} status={election.status} /></div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </section>

      {/* LIVE RESULTS */}
      <section id="results" className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 scroll-mt-20">
        <div className="mb-8 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <Badge variant="secondary" className="mb-2 gap-1.5">
              <span className="afrivote-live-dot inline-block h-2 w-2 rounded-full bg-emerald-500" /> Live
            </Badge>
            <h2 className="font-display text-3xl font-bold sm:text-4xl">Real-time Results</h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Aggregated and broadcast live via a secure WebSocket. Every cast vote updates the tally within seconds.
              Counts are computed server-side and cannot be manipulated by the client.
            </p>
          </div>
          {live?.election && (
            <div className="text-right text-xs text-muted-foreground">
              Last updated<br />
              <span className="font-mono text-foreground">{new Date(live.generatedAt || Date.now()).toLocaleTimeString()}</span>
            </div>
          )}
        </div>
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <LiveResultsPanel />
          <div className="space-y-6">
            <LiveActivityFeed />
          </div>
        </div>
      </section>

      {/* ELECTION TIMETABLE */}
      <section id="timetable" className="border-y border-border/60 bg-secondary/30 scroll-mt-20">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6">
          <div className="mb-8 text-center">
            <Badge variant="secondary" className="mb-2 gap-1"><Calendar className="h-3.5 w-3.5" /> Full Cycle</Badge>
            <h2 className="font-display text-3xl font-bold sm:text-4xl">Election Timetable</h2>
            <p className="mx-auto mt-2 max-w-2xl text-muted-foreground">
              From nomination to appeal — the complete SUG election lifecycle, following Nigerian federal university electoral practice.
            </p>
          </div>
          <div className="mx-auto max-w-2xl">
            <ElectionTimetable election={election} />
          </div>
        </div>
      </section>

      {/* CANDIDATES */}
      <section id="candidates" className="border-y border-border/60 bg-secondary/30 scroll-mt-20">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6">
          <div className="mb-8 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <h2 className="font-display text-3xl font-bold sm:text-4xl">Meet the Candidates</h2>
              <p className="mt-2 max-w-2xl text-muted-foreground">
                {allCandidates.length} approved candidates across {positions.length} positions. Tap a candidate to read their manifesto.
              </p>
            </div>
            <Badge variant="outline">{allCandidates.length} candidates</Badge>
          </div>
          {positions.length === 0 ? (
            <p className="text-muted-foreground">Loading candidates…</p>
          ) : (
            <Tabs defaultValue={positions[0]?.slug}>
              <TabsList className="afrivote-scroll mb-6 flex h-auto w-full max-w-full overflow-x-auto py-1">
                {positions.map((p: any) => (
                  <TabsTrigger key={p.slug} value={p.slug} className="whitespace-nowrap text-xs">
                    {p.title}
                  </TabsTrigger>
                ))}
              </TabsList>
              {positions.map((p: any) => (
                <TabsContent key={p.slug} value={p.slug}>
                  <div className="mb-3 flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{scopeLabel(p.scope)}</Badge>
                    {p.faculty && <span className="text-xs text-muted-foreground">{p.faculty.name}</span>}
                    {p.department && <span className="text-xs text-muted-foreground">{p.department.name}</span>}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {p.candidates.map((c: any) => (
                      <CandidateCard key={c.id} c={c} positionTitle={p.title} />
                    ))}
                    {p.candidates.length === 0 && <p className="text-sm text-muted-foreground">No approved candidates for this position.</p>}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          )}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 scroll-mt-20">
        <div className="mb-8 text-center">
          <Badge variant="secondary" className="mb-2">4 Simple Steps</Badge>
          <h2 className="font-display text-3xl font-bold sm:text-4xl">How Voting Works</h2>
          <p className="mx-auto mt-2 max-w-2xl text-muted-foreground">
            Designed to be fast, transparent, and tamper-proof — even on a 2G connection.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {HOW_STEPS.map((s) => (
            <Card key={s.title} className="afrivote-card-glow relative overflow-hidden">
              <CardHeader>
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
                  <s.icon className="h-6 w-6" />
                </div>
                <CardTitle className="mt-3 font-display text-base">{s.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{s.desc}</CardContent>
            </Card>
          ))}
        </div>
        <div className="mt-8 flex justify-center">
          <Button size="lg" onClick={() => setView('verify')} className="gap-2">
            Start Voting <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* TRUST / SECURITY */}
      <section className="border-t border-border/60 bg-primary text-primary-foreground">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 md:grid-cols-3">
          {[
            { icon: Lock, title: 'Ballot Secrecy', desc: 'Your vote is stored with an opaque hash — not your identity. No one, not even the electoral committee, can link a vote to a voter.' },
            { icon: BadgeCheck, title: 'Receipt-Anchored Verification', desc: 'Every vote produces a unique receipt code. Paste it on the homepage to confirm it was counted — without revealing your choice.' },
            { icon: ScrollText, title: 'Tamper-Evident Audit Trail', desc: 'Every admin & observer action is logged with actor, role, IP and timestamp. Results can be frozen and certified.' },
          ].map((f) => (
            <div key={f.title}>
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary-foreground/15">
                <f.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-primary-foreground/80">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* VERIFY RECEIPT CTA */}
      <section id="receipt" className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 scroll-mt-20">
        <Card className="afrivote-card-glow overflow-hidden">
          <CardContent className="grid gap-6 p-8 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <Badge variant="secondary" className="mb-2 gap-1"><BadgeCheck className="h-3.5 w-3.5" /> Voter-verifiable</Badge>
              <h3 className="font-display text-2xl font-bold">Already voted? Verify your receipt.</h3>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                Enter the receipt code you received after voting to confirm your ballot was recorded and counted.
                Your choice remains secret — this only proves the vote exists.
              </p>
            </div>
            <Button size="lg" variant="outline" onClick={() => setView('verify-receipt')} className="gap-2">
              <BadgeCheck className="h-5 w-5" /> Verify My Vote
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

function CandidateCard({ c, positionTitle }: { c: any; positionTitle: string }) {
  const [open, setOpen] = useState(false)
  return (
    <Card className="group overflow-hidden transition-shadow hover:shadow-lg">
      <div className="relative aspect-square w-full overflow-hidden bg-muted">
        {c.photoUrl ? (
          <Image src={c.photoUrl} alt={c.fullName} fill className="object-cover transition-transform duration-500 group-hover:scale-105" sizes="(max-width: 640px) 100vw, 33vw" />
        ) : (
          <div className="grid h-full place-items-center text-muted-foreground"><GraduationCap className="h-12 w-12" /></div>
        )}
        {c.slogan && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3">
            <p className="text-xs font-medium italic text-white">&ldquo;{c.slogan}&rdquo;</p>
          </div>
        )}
      </div>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <h4 className="truncate font-display text-sm font-semibold">{c.fullName}</h4>
            <p className="text-xs text-muted-foreground">{positionTitle}{c.level ? ` · ${c.level} Level` : ''}</p>
          </div>
          {open ? (
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Hide</Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Manifesto</Button>
          )}
        </div>
        {open && c.manifesto && (
          <div className="mt-3 max-h-48 overflow-y-auto afrivote-scroll rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
            {c.manifesto}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function scopeLabel(s: string) {
  if (s === 'UNIVERSITY') return 'University-wide'
  if (s === 'FACULTY') return 'Faculty'
  if (s === 'DEPARTMENT') return 'Department'
  return s
}
