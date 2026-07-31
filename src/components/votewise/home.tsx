'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import {
  Shield, KeyRound, BadgeCheck, Vote, Users, Eye, Lock, FileCheck2,
  CheckCircle2, ArrowRight, ScrollText, Building2, Clock, Calendar,
  FileText, Play, Award, BookOpen, Sparkles, Globe, Server, Layers,
  Network, Landmark, Church, Heart, Briefcase, Users2, Home, Dumbbell,
  Store, GraduationCap, PartyPopper, Cpu, DollarSign, Headphones,
  ShieldAlert, Activity, TrendingUp, Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useApp } from '@/lib/store'
import { api } from '@/lib/api'
import { Reveal } from '@/components/votewise/faq'

// The 20+ organization types VoteWise serves. The system never knows or cares
// which one it is — they're all simply "Organizations".
const ORG_TYPES = [
  { icon: GraduationCap, label: 'Universities' },
  { icon: BookOpen, label: 'Polytechnics' },
  { icon: BookOpen, label: 'Colleges' },
  { icon: Users2, label: 'Student Unions' },
  { icon: Layers, label: 'Faculties' },
  { icon: Network, label: 'Departments' },
  { icon: Users, label: 'Alumni Associations' },
  { icon: Church, label: 'Churches' },
  { icon: Landmark, label: 'Mosques' },
  { icon: Heart, label: 'NGOs' },
  { icon: PartyPopper, label: 'Political Parties' },
  { icon: Landmark, label: 'Government Agencies' },
  { icon: Briefcase, label: 'Companies' },
  { icon: Users2, label: 'Cooperatives' },
  { icon: Award, label: 'Professional Bodies' },
  { icon: Home, label: 'Communities' },
  { icon: Users, label: 'Clubs' },
  { icon: Network, label: 'Associations' },
  { icon: Users2, label: 'Trade Unions' },
  { icon: Store, label: 'Market Associations' },
  { icon: Home, label: 'Resident Associations' },
  { icon: Dumbbell, label: 'Sports Clubs' },
]

// The three products of the VoteWise platform.
const PRODUCTS = [
  {
    icon: Globe,
    name: 'Public Website',
    tagline: 'Convince organizations to trust VoteWise.',
    desc: 'The marketing website. Homepage, features, pricing, security, testimonials, demo requests, documentation, login and registration. No election happens here.',
    color: 'bg-primary/10 text-primary',
  },
  {
    icon: Building2,
    name: 'Organization Portal',
    tagline: 'Each organization\'s digital headquarters.',
    desc: 'Every organization receives their own subdomain (org.votewise.com). Everything belonging to that organization lives here — elections, voters, admins, observers, candidates.',
    color: 'bg-accent/15 text-accent-foreground',
  },
  {
    icon: Shield,
    name: 'Platform Dashboard',
    tagline: 'The VoteWise staff control room.',
    desc: 'Only for VoteWise staff. Manage organizations, billing, support, monitoring, fraud detection, system health, revenue, audit, and security across the entire platform.',
    color: 'bg-purple-100 text-purple-700',
  },
]

// The six user roles.
const ROLES = [
  {
    icon: Shield, name: 'Platform Super Admin', colour: 'bg-purple-100 text-purple-700',
    can: ['View every organization', 'Suspend organizations', 'Monitor elections', 'Manage subscriptions', 'Resolve issues', 'Access support tickets', 'Monitor infrastructure'],
    cannot: ['Modify votes', 'Vote', 'Impersonate voters'],
    note: 'This protects trust.',
  },
  {
    icon: Building2, name: 'Organization Owner', colour: 'bg-primary/10 text-primary',
    can: ['Create elections', 'Invite admins', 'Manage billing', 'Configure branding', 'Connect domain'],
    cannot: ['—'],
    note: 'Only one owner initially. Ownership can be transferred.',
  },
  {
    icon: Users, name: 'Organization Admin', colour: 'bg-accent/15 text-accent-foreground',
    can: ['Import voters', 'Create candidates', 'Manage elections', 'Send OTPs', 'View reports', 'Manage observers'],
    cannot: ['Transfer ownership'],
    note: 'Helps manage elections.',
  },
  {
    icon: Eye, name: 'Observer', colour: 'bg-blue-100 text-blue-700',
    can: ['Verify voters', 'Monitor accreditation', 'Monitor voting', 'Handle support', 'Resend OTP', 'View logs'],
    cannot: ['Modify elections', 'Edit candidates', 'Change results'],
    note: 'Election officials.',
  },
  {
    icon: Vote, name: 'Voter', colour: 'bg-emerald-100 text-emerald-700',
    can: ['Login', 'Verify identity', 'Receive OTP', 'Vote', 'Track accreditation', 'View public results'],
    cannot: ['Anything beyond voting'],
    note: 'Simple. Nothing more.',
  },
  {
    icon: Users2, name: 'Guest', colour: 'bg-muted text-muted-foreground',
    can: ['Browse the public website'],
    cannot: ['Vote', 'Access any dashboard'],
    note: 'Not logged in.',
  },
]

// The six platform principles.
const PRINCIPLES = [
  { num: '01', icon: Building2, title: 'Organizations own their data', desc: 'VoteWise hosts it. Never owns it. Every organization controls its elections, voters, and records.' },
  { num: '02', icon: Lock, title: 'Every organization is isolated', desc: 'No cross-tenant access. Nothing leaks across organizations. Ever.' },
  { num: '03', icon: ScrollText, title: 'Security first', desc: 'Every login, vote, OTP, payment, and API call produces an audit trail. Tamper-evident and hash-chained.' },
  { num: '04', icon: Cpu, title: 'Everything is configurable', desc: 'Never hardcode "University", "Faculty", "Department". Organizations configure their own terminology.' },
  { num: '05', icon: Zap, title: 'Simple onboarding', desc: 'An organization should create an account in under 5 minutes. No hidden complexity.' },
  { num: '06', icon: Eye, title: 'No hidden complexity', desc: 'The interface feels simple, even though the platform is powerful. Power without overwhelming.' },
]

const HIERARCHY = [
  { icon: Building2, label: 'Organization', desc: 'Any entity that runs elections' },
  { icon: Layers, label: 'Workspace', desc: 'Sub-division (Faculty / Branch / Parish)' },
  { icon: Vote, label: 'Election', desc: 'A single voting event' },
  { icon: Users, label: 'Voter Groups', desc: 'Flexible groupings of voters' },
  { icon: Users2, label: 'Voters', desc: 'The people who vote' },
  { icon: Award, label: 'Candidates', desc: 'The people running' },
  { icon: CheckCircle2, label: 'Voting', desc: 'Encrypted, receipt-anchored' },
  { icon: TrendingUp, label: 'Results', desc: 'Live, certified, verifiable' },
]

const SECURITY_FEATURES = [
  { icon: Lock, title: 'AES-256-GCM Encryption', desc: 'Every vote is encrypted at rest. The plaintext choice is NEVER stored — only the ciphertext, an opaque voter hash, and the receipt code.' },
  { icon: ScrollText, title: 'Hash-Chained Audit Log', desc: 'Every admin & voter action is logged with actor, role, IP, and timestamp. Each entry chains to the previous — tampering breaks the chain visibly.' },
  { icon: BadgeCheck, title: 'Receipt-Anchored Verification', desc: 'Every vote produces a unique receipt code. Voters paste it on the homepage to confirm their ballot was counted — without revealing their choice.' },
  { icon: Shield, title: 'Vote-Buying Detection', desc: 'Device fingerprint clustering auto-flags shared devices. Admins can flag suspicious voters; flagged votes do not count.' },
  { icon: KeyRound, title: 'OTP + 2FA', desc: 'Voters verify via email/SMS/WhatsApp OTP. Platform admins and org owners require TOTP two-factor authentication.' },
  { icon: FileCheck2, title: 'HMAC-Signed Results', desc: 'Certified results are frozen and cryptographically signed. Any post-certification tampering is immediately detectable.' },
]

const PRICING = [
  {
    name: 'Pay-As-You-Go', price: '₦500', unit: '/ voter',
    desc: 'Perfect for one-off elections. Pay only for the voters you register.',
    features: ['Encrypted voting', 'Live results', 'Audit trail', 'Up to 50,000 voters', 'Email + SMS OTP', 'Subdomain included'],
    cta: 'Start Free Trial', highlight: true,
  },
  {
    name: 'Enterprise', price: 'Custom', unit: '',
    desc: 'For large organizations running multiple elections per year.',
    features: ['Everything in PAYG', 'Custom domain', 'Unlimited voters', 'Dedicated support', 'SSO + advanced 2FA', 'On-premise option', 'SLA guarantee'],
    cta: 'Contact Sales', highlight: false,
  },
]

export function HomeView() {
  const { setView, live } = useApp()
  const [orgs, setOrgs] = useState<any[]>([])

  useEffect(() => {
    api.listOrganizations().then((d) => setOrgs(d.organizations || [])).catch(() => {})
  }, [])

  return (
    <div className="flex flex-col">
      {/* HERO */}
      <section className="votewise-hero-bg relative overflow-hidden border-b border-border/60">
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="votewise-orb absolute -left-20 top-10 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
          <div className="votewise-orb votewise-orb-delay absolute -right-20 top-20 h-80 w-80 rounded-full bg-accent/10 blur-3xl" />
        </div>
        <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 md:grid-cols-2 md:py-20">
          <div className="flex flex-col justify-center">
            <Badge variant="secondary" className="mb-4 w-fit gap-1.5">
              <span className="votewise-live-dot inline-block h-2 w-2 rounded-full bg-emerald-500" />
              Africa&apos;s Election Management Platform
            </Badge>
            <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
              We&apos;re not building<br />
              a voting app.<br />
              <span className="text-primary">We&apos;re building a platform</span><br />
              <span className="text-accent">that conducts elections.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
              VoteWise enables <strong className="text-foreground">any organization</strong> — universities,
              companies, churches, NGOs, cooperatives, associations — to create, manage, conduct, and monitor
              secure elections from a single trusted cloud platform.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button size="lg" onClick={() => setView('signup')} className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
                <Sparkles className="h-5 w-5" /> Register Your Organization
              </Button>
              <Button size="lg" variant="outline" onClick={() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' })} className="gap-2">
                <Eye className="h-5 w-5" /> Explore the Platform
              </Button>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5 text-primary" /> Encrypted voting</span>
              <span className="flex items-center gap-1.5"><BadgeCheck className="h-3.5 w-3.5 text-primary" /> Receipt-anchored</span>
              <span className="flex items-center gap-1.5"><FileCheck2 className="h-3.5 w-3.5 text-primary" /> Full audit trail</span>
              <span className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5 text-primary" /> Any organization</span>
            </div>
            {/* Live platform stats */}
            <div className="mt-8 grid grid-cols-3 gap-4">
              <HeroStat value={orgs.length} label="Organizations" />
              <HeroStat value={20} suffix="+" label="Org Types" />
              <HeroStat value={6} label="User Roles" />
            </div>
          </div>

          <div className="relative">
            <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-border shadow-xl">
              <Image
                src="/hero-platform.png"
                alt="VoteWise — collective, transparent decision-making for any organization"
                fill
                className="object-cover"
                priority
                sizes="(max-width: 768px) 100vw, 50vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-primary/30 via-transparent to-transparent" />
            </div>
            {/* Floating principle card */}
            <Card className="votewise-card-glow absolute -bottom-6 -left-2 w-64 max-w-[80%] sm:-left-6">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Shield className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold">Trusted &amp; Transparent</div>
                    <div className="text-[10px] text-muted-foreground">Every vote verifiable. Every action audited.</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* ORGANIZATIONS SERVED */}
      <section className="border-b border-border/60 bg-secondary/30">
        <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6">
          <Reveal>
            <div className="mb-6 text-center">
              <Badge variant="secondary" className="mb-2 gap-1"><Building2 className="h-3.5 w-3.5" /> Built for ANY Organization</Badge>
              <h2 className="font-display text-2xl font-bold sm:text-3xl">The system never knows or cares which one it is.</h2>
              <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">
                They&apos;re all simply <strong className="text-foreground">Organizations</strong>. VoteWise works for every one of them.
              </p>
            </div>
          </Reveal>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
            {ORG_TYPES.map((o, i) => (
              <Reveal key={o.label} delay={Math.min(i * 30, 400)}>
                <div className="flex flex-col items-center gap-2 rounded-xl border border-border/60 bg-card p-3 text-center transition-all hover:border-primary/40 hover:shadow-sm">
                  <o.icon className="h-6 w-6 text-primary" />
                  <span className="text-[11px] font-medium leading-tight">{o.label}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* THREE PRODUCTS */}
      <section id="products" className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 scroll-mt-20">
        <Reveal>
          <div className="mb-10 text-center">
            <Badge variant="secondary" className="mb-2 gap-1"><Layers className="h-3.5 w-3.5" /> Three Products</Badge>
            <h2 className="font-display text-3xl font-bold sm:text-4xl">The VoteWise Platform</h2>
            <p className="mx-auto mt-2 max-w-2xl text-muted-foreground">
              Three distinct products, one trusted platform. Clear separation of concerns.
            </p>
          </div>
        </Reveal>
        <div className="grid gap-6 md:grid-cols-3">
          {PRODUCTS.map((p, i) => (
            <Reveal key={p.name} delay={i * 120}>
              <Card className="votewise-card-glow h-full overflow-hidden">
                <CardHeader>
                  <div className={cn('grid h-12 w-12 place-items-center rounded-xl', p.color)}>
                    <p.icon className="h-6 w-6" />
                  </div>
                  <CardTitle className="mt-3 font-display text-lg">{p.name}</CardTitle>
                  <p className="text-sm font-medium text-primary">{p.tagline}</p>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{p.desc}</p>
                </CardContent>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>

      {/* THE BIGGEST ARCHITECTURAL SHIFT — new hierarchy */}
      <section className="border-y border-border/60 bg-primary text-primary-foreground">
        <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6">
          <Reveal>
            <div className="mb-8 text-center">
              <Badge className="mb-2 gap-1 bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/20">
                <Sparkles className="h-3.5 w-3.5" /> The Biggest Architectural Shift
              </Badge>
              <h2 className="font-display text-3xl font-bold sm:text-4xl">A Universal Hierarchy</h2>
              <p className="mx-auto mt-2 max-w-3xl text-sm text-primary-foreground/80">
                Not <em>University → Faculty → Department → Student → Election</em>. That only works for one org type.
                VoteWise uses a generic hierarchy that works for <strong>every</strong> organization.
              </p>
            </div>
          </Reveal>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            {HIERARCHY.map((h, i) => (
              <Reveal key={h.label} delay={i * 80}>
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="flex flex-col items-center gap-2 rounded-xl bg-primary-foreground/10 px-4 py-3 backdrop-blur transition-all hover:bg-primary-foreground/15">
                    <h.icon className="h-6 w-6" />
                    <div className="text-center">
                      <div className="text-sm font-semibold">{h.label}</div>
                      <div className="text-[10px] text-primary-foreground/70">{h.desc}</div>
                    </div>
                  </div>
                  {i < HIERARCHY.length - 1 && <ArrowRight className="h-5 w-5 text-primary-foreground/50" />}
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={600}>
            <div className="mx-auto mt-8 max-w-2xl rounded-xl border border-primary-foreground/20 bg-primary-foreground/5 p-4 text-center text-sm text-primary-foreground/80">
              <strong className="text-primary-foreground">This single change makes the platform universal.</strong> A university configures its terminology as Organization=University, Workspace=Faculty, Voter Group=Department. A church configures Organization=Church, Workspace=Parish, Voter Group=Fellowship. The system treats them identically.
            </div>
          </Reveal>
        </div>
      </section>

      {/* SIX USER ROLES */}
      <section id="roles" className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 scroll-mt-20">
        <Reveal>
          <div className="mb-10 text-center">
            <Badge variant="secondary" className="mb-2 gap-1"><Users className="h-3.5 w-3.5" /> Six User Roles</Badge>
            <h2 className="font-display text-3xl font-bold sm:text-4xl">Exactly Six. Not Twenty. Not Fifty.</h2>
            <p className="mx-auto mt-2 max-w-2xl text-muted-foreground">
              Every person on VoteWise fits one of these six categories. Clear permissions, clear boundaries.
            </p>
          </div>
        </Reveal>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {ROLES.map((r, i) => (
            <Reveal key={r.name} delay={i * 90}>
              <Card className="votewise-card-glow h-full">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className={cn('grid h-11 w-11 place-items-center rounded-xl', r.colour)}>
                      <r.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="font-display text-base">{r.name}</CardTitle>
                      <p className="text-[11px] text-muted-foreground">{r.note}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-600">Can</div>
                    <ul className="space-y-1">
                      {r.can.map((c) => (
                        <li key={c} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                          <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" /> {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {r.cannot[0] !== '—' && (
                    <div>
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-destructive">Cannot</div>
                      <ul className="space-y-1">
                        {r.cannot.map((c) => (
                          <li key={c} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <Lock className="mt-0.5 h-3 w-3 shrink-0 text-destructive" /> {c}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>

      {/* PLATFORM PRINCIPLES */}
      <section id="principles" className="border-y border-border/60 bg-secondary/30 scroll-mt-20">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6">
          <Reveal>
            <div className="mb-10 text-center">
              <Badge variant="secondary" className="mb-2 gap-1"><Shield className="h-3.5 w-3.5" /> Six Platform Principles</Badge>
              <h2 className="font-display text-3xl font-bold sm:text-4xl">Every Feature Must Satisfy These</h2>
              <p className="mx-auto mt-2 max-w-2xl text-muted-foreground">
                If a design decision can&apos;t answer &ldquo;Can this work for ANY organization?&rdquo; with yes, we don&apos;t build it.
              </p>
            </div>
          </Reveal>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {PRINCIPLES.map((p, i) => (
              <Reveal key={p.num} delay={i * 80}>
                <Card className="votewise-card-glow h-full">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
                        <p.icon className="h-5 w-5" />
                      </div>
                      <span className="font-display text-2xl font-bold text-muted/40">{p.num}</span>
                    </div>
                    <h3 className="mt-4 font-display text-base font-semibold">{p.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{p.desc}</p>
                  </CardContent>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* SECURITY FEATURES */}
      <section id="security" className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 scroll-mt-20">
        <Reveal>
          <div className="mb-10 text-center">
            <Badge variant="secondary" className="mb-2 gap-1"><Lock className="h-3.5 w-3.5" /> Security First</Badge>
            <h2 className="font-display text-3xl font-bold sm:text-4xl">Built for Trust</h2>
            <p className="mx-auto mt-2 max-w-2xl text-muted-foreground">
              Every action produces an audit trail. Every vote is encrypted. Every result is verifiable.
            </p>
          </div>
        </Reveal>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {SECURITY_FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 80}>
              <Card className="h-full">
                <CardContent className="p-6">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-accent/15 text-accent-foreground">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 font-display text-base font-semibold">{f.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
                </CardContent>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="border-y border-border/60 bg-secondary/30 scroll-mt-20">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6">
          <Reveal>
            <div className="mb-10 text-center">
              <Badge variant="secondary" className="mb-2 gap-1"><DollarSign className="h-3.5 w-3.5" /> Simple Pricing</Badge>
              <h2 className="font-display text-3xl font-bold sm:text-4xl">Pay Only for What You Use</h2>
              <p className="mx-auto mt-2 max-w-2xl text-muted-foreground">
                Start free. Pay to go live. No hidden fees. Negotiation available for large organizations.
              </p>
            </div>
          </Reveal>
          <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
            {PRICING.map((p, i) => (
              <Reveal key={p.name} delay={i * 120}>
                <Card className={cn('h-full', p.highlight && 'ring-2 ring-primary')}>
                  {p.highlight && (
                    <div className="rounded-t-xl bg-primary px-6 py-1.5 text-center text-xs font-semibold text-primary-foreground">
                      Most Popular
                    </div>
                  )}
                  <CardContent className="p-6">
                    <h3 className="font-display text-lg font-bold">{p.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{p.desc}</p>
                    <div className="mt-4 flex items-baseline gap-1">
                      <span className="font-display text-4xl font-bold">{p.price}</span>
                      <span className="text-sm text-muted-foreground">{p.unit}</span>
                    </div>
                    <ul className="mt-5 space-y-2">
                      {p.features.map((f) => (
                        <li key={f} className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" /> {f}
                        </li>
                      ))}
                    </ul>
                    <Button
                      onClick={() => setView(p.highlight ? 'signup' : 'signup')}
                      className="mt-6 w-full gap-2"
                      variant={p.highlight ? 'default' : 'outline'}
                    >
                      {p.cta} <ArrowRight className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ORGANIZATIONS DIRECTORY */}
      {orgs.length > 0 && (
        <section id="organizations" className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 scroll-mt-20">
          <Reveal>
            <div className="mb-8 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <Badge variant="secondary" className="mb-2 gap-1"><Globe className="h-3.5 w-3.5" /> Live Directory</Badge>
                <h2 className="font-display text-3xl font-bold sm:text-4xl">Organizations on VoteWise</h2>
                <p className="mt-2 max-w-2xl text-muted-foreground">
                  Real organizations already running their elections on VoteWise.
                </p>
              </div>
            </div>
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {orgs.map((o, i) => (
              <Reveal key={o.id} delay={i * 80}>
                <Card className="h-full transition-all hover:shadow-md">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3">
                      {o.logoUrl ? (
                        <img src={o.logoUrl} alt={o.name} className="h-12 w-12 rounded-xl object-contain" />
                      ) : (
                        <div className="grid h-12 w-12 place-items-center rounded-xl text-white" style={{ backgroundColor: o.primaryColour }}>
                          <Building2 className="h-6 w-6" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-display text-sm font-semibold">{o.name}</h3>
                        <Badge variant="outline" className="mt-0.5 text-[10px]">{o.category?.replace(/_/g, ' ') || 'Organization'}</Badge>
                      </div>
                    </div>
                    {o.description && <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">{o.description}</p>}
                    <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {o._count?.members || 0} members</span>
                      <span className="flex items-center gap-1"><Layers className="h-3 w-3" /> {o._count?.workspaces || 0} workspaces</span>
                      <span className="flex items-center gap-1"><Network className="h-3 w-3" /> {o._count?.voterGroups || 0} groups</span>
                    </div>
                    <div className="mt-2 font-mono text-[10px] text-muted-foreground">{o.subdomain}.votewise.ng</div>
                  </CardContent>
                </Card>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* PLATFORM DASHBOARD PREVIEW */}
      <section className="border-t border-border/60 bg-gradient-to-br from-primary/5 via-accent/5 to-transparent">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-14 sm:px-6 md:grid-cols-2 md:items-center">
          <div>
            <Badge variant="secondary" className="mb-2 gap-1"><Shield className="h-3.5 w-3.5" /> Platform Dashboard</Badge>
            <h2 className="font-display text-3xl font-bold sm:text-4xl">The VoteWise Control Room</h2>
            <p className="mt-2 max-w-lg text-muted-foreground">
              For VoteWise staff only. Monitor every organization, manage billing, resolve support tickets,
              detect fraud, and keep the platform healthy — all from one secure dashboard.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[
                { icon: Building2, label: 'Organizations' },
                { icon: DollarSign, label: 'Billing' },
                { icon: Headphones, label: 'Support' },
                { icon: Activity, label: 'Monitoring' },
                { icon: ShieldAlert, label: 'Fraud Detection' },
                { icon: Server, label: 'System Health' },
                { icon: TrendingUp, label: 'Revenue' },
                { icon: ScrollText, label: 'Audit Log' },
              ].map((f) => (
                <div key={f.label} className="flex items-center gap-2 rounded-lg border border-border/60 bg-card p-2.5">
                  <f.icon className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium">{f.label}</span>
                </div>
              ))}
            </div>
            <Button size="lg" variant="outline" onClick={() => setView('platform-login')} className="mt-6 gap-2">
              <Shield className="h-5 w-5" /> Platform Admin Login
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border/60 bg-card p-4 text-center">
              <Server className="mx-auto h-8 w-8 text-emerald-600" />
              <div className="mt-2 font-display text-2xl font-bold">99.9%</div>
              <div className="text-[10px] text-muted-foreground">Uptime</div>
            </div>
            <div className="rounded-xl border border-border/60 bg-card p-4 text-center">
              <Activity className="mx-auto h-8 w-8 text-primary" />
              <div className="mt-2 font-display text-2xl font-bold">Live</div>
              <div className="text-[10px] text-muted-foreground">Monitoring</div>
            </div>
            <div className="rounded-xl border border-border/60 bg-card p-4 text-center">
              <Lock className="mx-auto h-8 w-8 text-accent-foreground" />
              <div className="mt-2 font-display text-2xl font-bold">AES-256</div>
              <div className="text-[10px] text-muted-foreground">Encryption</div>
            </div>
            <div className="rounded-xl border border-border/60 bg-card p-4 text-center">
              <ScrollText className="mx-auto h-8 w-8 text-purple-600" />
              <div className="mt-2 font-display text-2xl font-bold">Chained</div>
              <div className="text-[10px] text-muted-foreground">Audit Log</div>
            </div>
          </div>
        </div>
      </section>

      {/* DEMO ELECTION CTA */}
      <section id="demo" className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 scroll-mt-20">
        <Reveal>
          <Card className="votewise-card-glow overflow-hidden">
            <CardContent className="p-8 text-center">
              <Badge variant="secondary" className="mb-3 gap-1"><Play className="h-3.5 w-3.5" /> Live Demo</Badge>
              <h2 className="font-display text-3xl font-bold sm:text-4xl">See It In Action</h2>
              <p className="mx-auto mt-2 max-w-2xl text-muted-foreground">
                Explore a live demo election with real encrypted votes, live results, and the full voter journey.
                No registration required.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Button size="lg" onClick={() => setView('verify')} className="gap-2">
                  <Vote className="h-5 w-5" /> Try Voting
                </Button>
                <Button size="lg" variant="outline" onClick={() => setView('about')} className="gap-2">
                  <Building2 className="h-5 w-5" /> About the Demo
                </Button>
                <Button size="lg" variant="outline" onClick={() => setView('guide')} className="gap-2">
                  <BookOpen className="h-5 w-5" /> Voter Guide
                </Button>
              </div>
            </CardContent>
          </Card>
        </Reveal>
      </section>

      {/* ORG SIGNUP CTA */}
      <section className="border-t border-border/60 bg-gradient-to-br from-accent/10 via-primary/5 to-transparent">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-14 sm:px-6 md:grid-cols-2 md:items-center">
          <div>
            <Badge variant="secondary" className="mb-2 gap-1"><Sparkles className="h-3.5 w-3.5" /> Simple Onboarding</Badge>
            <h2 className="font-display text-3xl font-bold sm:text-4xl">Set Up Your Election in Under 5 Minutes</h2>
            <p className="mt-2 max-w-lg text-muted-foreground">
              Register your organization, configure your terminology, and launch your first election.
              No technical expertise required. No hidden complexity.
            </p>
            <div className="mt-4 space-y-1.5">
              {[
                'Works for any organization type',
                'Configure your own terminology (Faculty / Branch / Parish / Unit)',
                'Custom branding with your logo & colors',
                'Pay only when you go live',
              ].map((f) => (
                <div key={f} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" /> {f}
                </div>
              ))}
            </div>
            <Button size="lg" onClick={() => setView('signup')} className="mt-6 gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
              <Building2 className="h-5 w-5" /> Register Your Organization
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: Building2, label: 'University', desc: 'Full SUG election' },
              { icon: Heart, label: 'NGO', desc: 'Board election' },
              { icon: Church, label: 'Church', desc: 'Parish council' },
              { icon: Briefcase, label: 'Company', desc: 'Staff election' },
              { icon: Users2, label: 'Cooperative', desc: 'Exec election' },
              { icon: Award, label: 'Prof. Body', desc: 'Officers election' },
            ].map((o, i) => (
              <div key={i} className="rounded-xl border border-border/60 bg-card p-4 text-center">
                <o.icon className="mx-auto h-8 w-8 text-primary" />
                <div className="mt-2 text-sm font-semibold">{o.label}</div>
                <div className="text-[10px] text-muted-foreground">{o.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
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
      const eased = 1 - Math.pow(1 - progress, 3)
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

// Local cn helper (avoid extra import churn in this file).
function cn(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ')
}
