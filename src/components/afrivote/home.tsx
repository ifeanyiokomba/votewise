'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import {
  Shield, KeyRound, BadgeCheck, Vote, Users, Eye, Lock, FileCheck2,
  CheckCircle2, ArrowRight, ScrollText, Building2, GraduationCap, Clock, Calendar,
  FileText, Play, Award, BookOpen,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { useApp } from '@/lib/store'
import { api } from '@/lib/api'
import { StatusBadge, Countdown } from '@/components/afrivote/shared'
import { LiveResultsPanel } from '@/components/afrivote/live-results'
import { ElectionTimetable, LiveActivityFeed, ResultsSkeleton } from '@/components/afrivote/timetable'
import { FaqSection, Reveal } from '@/components/afrivote/faq'

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
        {/* Animated background orbs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="afrivote-orb absolute -left-20 top-10 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
          <div className="afrivote-orb afrivote-orb-delay absolute -right-20 top-20 h-80 w-80 rounded-full bg-accent/10 blur-3xl" />
        </div>
        <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-2 md:py-16">
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
            {/* Animated stats strip */}
            {live && (
              <div className="mt-8 grid grid-cols-3 gap-4">
                <HeroStat value={live.turnout?.voted ?? 0} label="Votes Cast" />
                <HeroStat value={live.turnout?.turnoutPct ?? 0} suffix="%" label="Turnout" />
                <HeroStat value={live.positions?.length ?? 0} label="Positions" />
              </div>
            )}
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
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setView('compare')} className="gap-1.5">
                <Users className="h-4 w-4" /> Compare
              </Button>
              <Badge variant="outline">{allCandidates.length} candidates</Badge>
            </div>
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
        <Reveal>
          <div className="mb-8 text-center">
            <Badge variant="secondary" className="mb-2">4 Simple Steps</Badge>
            <h2 className="font-display text-3xl font-bold sm:text-4xl">How Voting Works</h2>
            <p className="mx-auto mt-2 max-w-2xl text-muted-foreground">
              Designed to be fast, transparent, and tamper-proof — even on a 2G connection.
            </p>
          </div>
        </Reveal>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {HOW_STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 100}>
              <Card className="afrivote-card-glow relative h-full overflow-hidden">
                <CardHeader>
                  <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
                    <s.icon className="h-6 w-6" />
                  </div>
                  <CardTitle className="mt-3 font-display text-base">{s.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">{s.desc}</CardContent>
              </Card>
            </Reveal>
          ))}
        </div>
        <Reveal delay={400}>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button size="lg" onClick={() => setView('verify')} className="gap-2">
              Start Voting <ArrowRight className="h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => setView('guide')} className="gap-2">
              <BookOpen className="h-5 w-5" /> Full Guide
            </Button>
          </div>
        </Reveal>
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

      {/* VERIFY RECEIPT + CERTIFICATE CTA */}
      <section id="receipt" className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 scroll-mt-20">
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="afrivote-card-glow overflow-hidden">
            <CardContent className="p-6">
              <Badge variant="secondary" className="mb-2 gap-1"><BadgeCheck className="h-3.5 w-3.5" /> Voter-verifiable</Badge>
              <h3 className="font-display text-xl font-bold">Verify Your Receipt</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Enter the receipt code you received after voting to confirm your ballot was recorded and counted.
              </p>
              <Button size="sm" variant="outline" onClick={() => setView('verify-receipt')} className="mt-4 gap-1.5">
                <BadgeCheck className="h-4 w-4" /> Verify My Vote
              </Button>
            </CardContent>
          </Card>
          <Card className="afrivote-card-glow overflow-hidden">
            <CardContent className="p-6">
              <Badge variant="secondary" className="mb-2 gap-1"><Award className="h-3.5 w-3.5" /> Certified</Badge>
              <h3 className="font-display text-xl font-bold">Official Results Certificate</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                View the cryptographically signed, printable certificate of certified election results.
              </p>
              <Button size="sm" variant="outline" onClick={() => setView('certificate')} className="mt-4 gap-1.5">
                <Award className="h-4 w-4" /> View Certificate
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* FAQ */}
      <FaqSection />
    </div>
  )
}

function CandidateCard({ c, positionTitle }: { c: any; positionTitle: string }) {
  const [open, setOpen] = useState(false)
  const partyColour = c.politicalParty?.colour || '#15803d'
  return (
    <>
      <Card className="group overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5">
        <div className="relative aspect-square w-full overflow-hidden bg-muted">
          {/* Party colour stripe */}
          <div className="absolute left-0 top-0 z-10 h-full w-1.5" style={{ backgroundColor: partyColour }} />
          {c.photoUrl ? (
            <Image src={c.photoUrl} alt={c.fullName} fill className="object-cover transition-transform duration-500 group-hover:scale-105" sizes="(max-width: 640px) 100vw, 33vw" />
          ) : (
            <div className="grid h-full place-items-center text-muted-foreground"><GraduationCap className="h-12 w-12" /></div>
          )}
          {/* Party badge */}
          {c.politicalParty && (
            <div className="absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold text-white shadow-sm" style={{ backgroundColor: partyColour }}>
              {c.politicalParty.acronym}
            </div>
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
            <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Details
            </Button>
          </div>
        </CardContent>
      </Card>
      <CandidateDetailDialog candidate={c} positionTitle={positionTitle} open={open} onOpenChange={setOpen} partyColour={partyColour} />
    </>
  )
}

function CandidateDetailDialog({ candidate, positionTitle, open, onOpenChange, partyColour }: {
  candidate: any; positionTitle: string; open: boolean; onOpenChange: (o: boolean) => void; partyColour: string
}) {
  const c = candidate
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-hidden p-0">
        <DialogTitle className="sr-only">{c?.fullName} — Candidate Details</DialogTitle>
        {/* Header with photo + gradient */}
        <div className="relative h-40 overflow-hidden">
          <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${partyColour}dd, ${partyColour}55)` }} />
          <div className="relative flex h-full items-center gap-4 p-6">
            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border-4 border-white/30 shadow-lg">
              {c?.photoUrl ? (
                <Image src={c.photoUrl} alt={c.fullName} fill className="object-cover" sizes="96px" />
              ) : (
                <div className="grid h-full place-items-center bg-white/20 text-white"><GraduationCap className="h-8 w-8" /></div>
              )}
            </div>
            <div className="min-w-0 flex-1 text-white">
              <h2 className="font-display text-2xl font-bold leading-tight">{c?.fullName}</h2>
              <p className="text-sm text-white/85">{positionTitle}{c?.level ? ` · ${c.level} Level` : ''}</p>
              {c?.slogan && <p className="mt-1 text-sm italic text-white/90">&ldquo;{c.slogan}&rdquo;</p>}
              {c?.politicalParty && (
                <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#fff' }} />
                  {c.politicalParty.name}
                </span>
              )}
            </div>
          </div>
        </div>
        {/* Body */}
        <div className="afrivote-scroll max-h-[50vh] overflow-y-auto p-6">
          {c?.campaignVideoUrl && (
            <div className="mb-4">
              <h3 className="mb-2 flex items-center gap-1.5 font-display text-sm font-semibold"><Play className="h-4 w-4 text-primary" /> Campaign Video</h3>
              <div className="aspect-video overflow-hidden rounded-lg border border-border bg-muted">
                <iframe src={embedUrl(c.campaignVideoUrl)} className="h-full w-full" allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
              </div>
            </div>
          )}
          <h3 className="mb-2 flex items-center gap-1.5 font-display text-sm font-semibold"><FileText className="h-4 w-4 text-primary" /> Manifesto</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{c?.manifesto || 'No manifesto provided.'}</p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function embedUrl(url: string): string {
  // Convert YouTube watch URLs to embed URLs.
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/)
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`
  return url
}

function scopeLabel(s: string) {
  if (s === 'UNIVERSITY') return 'University-wide'
  if (s === 'FACULTY') return 'Faculty'
  if (s === 'DEPARTMENT') return 'Department'
  return s
}

function HeroStat({ value, suffix, label }: { value: number; suffix?: string; label: string }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    const duration = 800
    const start = display
    const diff = value - start
    if (diff === 0) return
    const startTime = Date.now()
    const t = setInterval(() => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(1, elapsed / duration)
      const eased = 1 - Math.pow(1 - progress, 3) // easeOutCubic
      setDisplay(Math.round(start + diff * eased))
      if (progress >= 1) clearInterval(t)
    }, 16)
    return () => clearInterval(t)
  }, [value])
  return (
    <div className="rounded-xl border border-border/60 bg-card/50 p-3 backdrop-blur">
      <div className="font-display text-2xl font-bold tabular-nums text-primary sm:text-3xl">
        {display.toLocaleString()}{suffix}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  )
}
