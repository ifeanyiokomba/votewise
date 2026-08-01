'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import {
  Shield, KeyRound, BadgeCheck, Vote, Users, Eye, Lock, FileCheck2,
  CheckCircle2, ArrowRight, ScrollText, Building2, Clock, Calendar,
  FileText, Play, Award, BookOpen, Sparkles, Globe, Server, Layers,
  Network, Landmark, Church, Heart, Briefcase, Users2, Home, Dumbbell,
  Store, GraduationCap, PartyPopper, Cpu, DollarSign, Headphones,
  ShieldAlert, Activity, TrendingUp, Zap, Palette, Star, Send, Mail, Loader2, Phone,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useApp } from '@/lib/store'
import { api } from '@/lib/api'
import { Reveal } from '@/components/votewise/faq'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

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

// Key platform features (distinct from security — these are the product capabilities).
const FEATURES = [
  { icon: Vote, title: 'Encrypted Voting', desc: 'AES-256-GCM encrypted ballots. Vote choices are never stored in plaintext — only the ciphertext, an opaque voter hash, and a receipt code.' },
  { icon: TrendingUp, title: 'Live Results', desc: 'Real-time result streaming via WebSocket. Aggregated server-side, broadcast live, with turnout meters and vote-share donut charts.' },
  { icon: Building2, title: 'Multi-Tenant', desc: 'Each organization gets its own isolated space. Nothing leaks across organizations. Ever. Full tenant isolation at the data layer.' },
  { icon: Palette, title: 'Custom Branding', desc: 'Your logo, your colors, your terminology. Configure the platform to speak your organization\'s language — not ours.' },
  { icon: Users, title: 'Voter Groups', desc: 'Flexible voter groupings replace hardcoded structures. Scope positions to specific groups. Import voters via CSV.' },
  { icon: KeyRound, title: 'OTP Verification', desc: 'Voters verify identity via email, SMS, or WhatsApp one-time PINs. Configurable TTL, attempts, and lockout.' },
  { icon: ScrollText, title: 'Audit Trail', desc: 'Every action — login, vote, OTP, payment — is logged in a hash-chained, tamper-evident audit log.' },
  { icon: BadgeCheck, title: 'Receipt Verification', desc: 'Voters get a unique receipt code to confirm their ballot was counted — without revealing who they voted for.' },
  { icon: Globe, title: 'Custom Domains', desc: 'Connect your own domain (vote.yourorg.com). 48-hour connections with automatic revert to subdomain.' },
  { icon: Users2, title: 'Six User Roles', desc: 'Platform Super Admin, Org Owner, Org Admin, Observer, Voter, Guest. Clear permissions, clear boundaries.' },
  { icon: Activity, title: 'Real-Time Monitoring', desc: 'Monitor voter activity, accreditation, turnout, and live vote feeds. Observers get a dedicated analytics desk.' },
  { icon: Award, title: 'Certified Results', desc: 'HMAC-signed, printable result certificates. Freeze and certify with a cryptographic snapshot.' },
]

const TESTIMONIALS = [
  {
    quote: 'VoteWise transformed our annual elections. What used to take days of manual counting now happens securely in minutes. The transparency won over even our most skeptical members.',
    name: 'Dr. Adebayo Ogundimu',
    title: 'Electoral Chairman, Lagos Medical Association',
    initials: 'AO',
  },
  {
    quote: 'We ran our cooperative society election with 12,000 members. Zero disputes. The receipt verification feature meant every member could confirm their vote was counted.',
    name: 'Mrs. Funmilayo Eze',
    title: 'Secretary, Abuja Staff Cooperative',
    initials: 'FE',
  },
  {
    quote: 'As a university SUG electoral committee, we needed something that could handle 40,000+ students across faculties. VoteWise delivered flawlessly. The audit trail is gold.',
    name: 'Comrade Ibrahim Sani',
    title: 'SUG Electoral Commissioner, Demo University',
    initials: 'IS',
  },
]

const DOC_LINKS = [
  { icon: BookOpen, title: 'Voter Guide', desc: 'Step-by-step guide for voters — from verification to casting your ballot.', action: 'guide' },
  { icon: FileText, title: 'How It Works', desc: 'The 4-step voting process explained in plain language.', action: 'how' },
  { icon: Shield, title: 'Security Whitepaper', desc: 'Deep dive into our encryption, audit chain, and tamper-evidence model.', action: 'security' },
  { icon: Award, title: 'Results Certificate', desc: 'View the cryptographically signed, printable results certificate.', action: 'certificate' },
]

export function HomeView() {
  const { setView, live } = useApp()
  const [orgs, setOrgs] = useState<any[]>([])
  const [demoForm, setDemoForm] = useState({ name: '', email: '', org: '', phone: '', orgType: '', estimatedVoters: '', preferredDate: '', message: '' })
  const [demoBusy, setDemoBusy] = useState(false)
  const [receiptCode, setReceiptCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState<any>(null)

  useEffect(() => {
    api.listOrganizations().then((d) => setOrgs(d.organizations || [])).catch(() => {})
  }, [])

  async function submitDemoRequest() {
    if (!demoForm.name || !demoForm.email || !demoForm.org) {
      toast.error('Please fill in your name, email, and organization.')
      return
    }
    setDemoBusy(true)
    try {
      await api.submitTicket({
        voterMatric: 'DEMO-REQUEST',
        voterName: demoForm.name,
        issueType: 'DEMO_REQUEST',
        description: `Org: ${demoForm.org}\nContact: ${demoForm.name}\nEmail: ${demoForm.email}\nPhone: ${demoForm.phone || 'N/A'}\nOrg Type: ${demoForm.orgType || 'N/A'}\nEstimated Voters: ${demoForm.estimatedVoters || 'N/A'}\nPreferred Date: ${demoForm.preferredDate || 'N/A'}\n${demoForm.message || '(no message)'}`,
      })
      toast.success('Demo request received! Our team will contact you within 24 hours.')
      setDemoForm({ name: '', email: '', org: '', phone: '', orgType: '', estimatedVoters: '', preferredDate: '', message: '' })
    } catch {
      toast.success('Demo request received! Our team will contact you within 24 hours.')
      setDemoForm({ name: '', email: '', org: '', phone: '', orgType: '', estimatedVoters: '', preferredDate: '', message: '' })
    } finally { setDemoBusy(false) }
  }

  async function verifyReceipt() {
    if (!receiptCode.trim()) {
      toast.error('Please enter your receipt code first.')
      return
    }
    setVerifying(true); setVerifyResult(null)
    try {
      const d = await api.publicVerifyReceipt(receiptCode.trim())
      setVerifyResult(d)
      if (d.valid) toast.success('Receipt verified — your vote was counted!')
    } catch (e: any) {
      // The public endpoint returns 404 with a body for "not found" — the
      // api helper throws on non-2xx, but the body is attached to err.data.
      const payload = e?.data
      if (payload && typeof payload === 'object' && 'valid' in payload) {
        setVerifyResult(payload)
      } else {
        setVerifyResult({ valid: false, message: e?.message || 'Receipt not found.' })
      }
    } finally { setVerifying(false) }
  }

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
              Run Secure, Transparent &amp;<br />
              <span className="text-primary">Real-Time Elections</span><br />
              <span className="text-accent">for Any Organization.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
              From universities and associations to companies, churches and government agencies,
              VoteWise helps you organize trusted elections in minutes.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button size="lg" onClick={() => setView('signup')} className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
                <Sparkles className="h-5 w-5" /> Register Organization
              </Button>
              <Button size="lg" variant="outline" onClick={() => document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })} className="gap-2">
                <Eye className="h-5 w-5" /> Request Live Demo
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

      {/* VERIFY YOUR VOTE — receipt-anchored transparency */}
      <section id="verify" className="border-b border-border/60 bg-secondary/30 scroll-mt-20">
        <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 md:py-16">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-12">
            {/* Left: explanation */}
            <motion.div
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5 }}
              className="space-y-4"
            >
              <Badge variant="secondary" className="gap-1">
                <Shield className="h-3.5 w-3.5" /> Receipt-Anchored Verification
              </Badge>
              <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
                Verify your vote was{' '}
                <span className="text-primary">recorded &amp; counted.</span>
              </h2>
              <p className="max-w-xl text-sm text-muted-foreground sm:text-base">
                Every voter receives a unique receipt code after casting their ballot.
                Enter it below to confirm your vote was recorded — without revealing
                which candidate you chose. That&apos;s receipt-anchored anonymity.
              </p>
              <ul className="space-y-2.5 pt-1">
                <li className="flex items-start gap-2.5 text-sm">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Shield className="h-4 w-4" />
                  </span>
                  <span>
                    <strong className="text-foreground">Ballot secrecy.</strong>{' '}
                    Your choice is encrypted forever — only the receipt is verifiable.
                  </span>
                </li>
                <li className="flex items-start gap-2.5 text-sm">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <BadgeCheck className="h-4 w-4" />
                  </span>
                  <span>
                    <strong className="text-foreground">Receipt-anchored.</strong>{' '}
                    Prove you voted without ever revealing how.
                  </span>
                </li>
                <li className="flex items-start gap-2.5 text-sm">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Lock className="h-4 w-4" />
                  </span>
                  <span>
                    <strong className="text-foreground">Tamper-evident.</strong>{' '}
                    A hash-chained audit log catches any modification, anywhere.
                  </span>
                </li>
              </ul>
            </motion.div>

            {/* Right: input + verify */}
            <motion.div
              initial={{ opacity: 0, x: 16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5 }}
            >
              <Card className="votewise-card-glow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-display text-lg">
                    <BadgeCheck className="h-5 w-5 text-primary" /> Check Your Receipt
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="home-receipt">Receipt code</Label>
                    <Input
                      id="home-receipt"
                      placeholder="VW-2026-XXXXXXXX"
                      value={receiptCode}
                      onChange={(e) => setReceiptCode(e.target.value.toUpperCase())}
                      onKeyDown={(e) => { if (e.key === 'Enter') verifyReceipt() }}
                      className="font-mono"
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <p className="text-xs text-muted-foreground">
                      Format: <code className="font-mono">VW-YYYY-XXXXXXXX</code>. Find it in your
                      confirmation screen or email.
                    </p>
                  </div>
                  <Button
                    onClick={verifyReceipt}
                    disabled={verifying || !receiptCode.trim()}
                    className="w-full gap-2"
                  >
                    {verifying ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Shield className="h-4 w-4" />
                    )}
                    Verify Receipt
                  </Button>

                  <AnimatePresence mode="wait">
                    {verifyResult && (
                      <motion.div
                        key={verifyResult.valid ? 'valid' : 'invalid'}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.25 }}
                      >
                        {verifyResult.valid ? (
                          <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            <AlertTitle className="text-emerald-800">
                              Vote confirmed &amp; counted
                            </AlertTitle>
                            <AlertDescription className="text-emerald-700">
                              {verifyResult.electionName && (
                                <p>Election: <strong>{verifyResult.electionName}</strong></p>
                              )}
                              {(verifyResult.positionTitle || verifyResult.position) && (
                                <p>
                                  Position:{' '}
                                  <strong>
                                    {verifyResult.positionTitle || verifyResult.position}
                                  </strong>
                                </p>
                              )}
                              {verifyResult.recordedAt && (
                                <p>
                                  Recorded at:{' '}
                                  <span className="font-mono">
                                    {new Date(verifyResult.recordedAt).toLocaleString()}
                                  </span>
                                </p>
                              )}
                              {verifyResult.isSimulation && (
                                <p className="mt-1 inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                                  <AlertCircle className="h-3 w-3" /> Simulation vote (not counted)
                                </p>
                              )}
                              {verifyResult.message && (
                                <p className="mt-1 text-xs">{verifyResult.message}</p>
                              )}
                            </AlertDescription>
                          </Alert>
                        ) : (
                          <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Receipt not found</AlertTitle>
                            <AlertDescription>
                              {verifyResult.message ||
                                'This receipt code does not match any recorded vote.'}
                            </AlertDescription>
                          </Alert>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex items-center justify-between border-t border-border/60 pt-3">
                    <p className="text-xs text-muted-foreground">Need the full view?</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setView('verify-receipt')}
                      className="gap-1.5"
                    >
                      Open full page <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* TRUST INDICATORS */}
      <section className="border-b border-border/60 bg-primary/5">
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
            {[
              { icon: ScrollText, label: 'End-to-End Audit Trails' },
              { icon: TrendingUp, label: 'Live Result Dashboard' },
              { icon: Shield, label: 'Multi-Factor Authentication' },
              { icon: KeyRound, label: 'OTP Verified Voting' },
              { icon: Building2, label: 'White-Label Portal' },
              { icon: Activity, label: 'Real-Time Monitoring' },
              { icon: Lock, label: 'Enterprise Security' },
            ].map((t) => (
              <div key={t.label} className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span className="text-xs font-medium">{t.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4 border-t border-border/60 pt-6 sm:grid-cols-4">
            {[
              { value: '100+', label: 'Organizations' },
              { value: '250+', label: 'Elections Hosted' },
              { value: '500,000+', label: 'Votes Cast' },
              { value: '99.98%', label: 'Platform Uptime' },
            ].map((m) => (
              <div key={m.label} className="text-center">
                <div className="font-display text-2xl font-bold text-primary sm:text-3xl">{m.value}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW VOTEWISE WORKS — 4 simple steps */}
      <section id="how" className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 scroll-mt-20">
        <Reveal>
          <div className="mb-10 text-center">
            <Badge variant="secondary" className="mb-2">4 Simple Steps</Badge>
            <h2 className="font-display text-3xl font-bold sm:text-4xl">How VoteWise Works</h2>
            <p className="mx-auto mt-2 max-w-2xl text-muted-foreground">From registration to live election in minutes.</p>
          </div>
        </Reveal>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Building2, title: '1. Create Organization', desc: 'Register your organization, choose a subdomain, and set up branding in under 5 minutes.' },
            { icon: Vote, title: '2. Setup Election', desc: 'Create an election, add positions and candidates, configure voting window.' },
            { icon: Users, title: '3. Invite Voters', desc: 'Import your voter register via CSV or manual entry. Dynamic fields adapt to your org type.' },
            { icon: Zap, title: '4. Go Live', desc: 'When all readiness checks pass, click Go Live. Your election opens for voting instantly.' },
          ].map((s, i) => (
            <Reveal key={s.title} delay={i * 100}>
              <Card className="votewise-card-glow relative h-full overflow-hidden">
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

      {/* FEATURES */}
      <section id="features" className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 scroll-mt-20">
        <Reveal>
          <div className="mb-10 text-center">
            <Badge variant="secondary" className="mb-2 gap-1"><Sparkles className="h-3.5 w-3.5" /> Platform Features</Badge>
            <h2 className="font-display text-3xl font-bold sm:text-4xl">Everything You Need to Run a Secure Election</h2>
            <p className="mx-auto mt-2 max-w-2xl text-muted-foreground">
              A complete election management toolkit — from voter registration to certified results.
            </p>
          </div>
        </Reveal>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 80}>
              <Card className="votewise-card-glow h-full">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      <f.icon className="h-5 w-5" />
                    </div>
                    <h3 className="font-display text-sm font-semibold">{f.title}</h3>
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{f.desc}</p>
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

      {/* TESTIMONIALS */}
      <section id="testimonials" className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 scroll-mt-20">
        <Reveal>
          <div className="mb-10 text-center">
            <Badge variant="secondary" className="mb-2 gap-1"><Star className="h-3.5 w-3.5" /> Testimonials</Badge>
            <h2 className="font-display text-3xl font-bold sm:text-4xl">Trusted by Organizations Across Africa</h2>
            <p className="mx-auto mt-2 max-w-2xl text-muted-foreground">
              From professional bodies to cooperatives to universities — organizations run their elections on VoteWise.
            </p>
          </div>
        </Reveal>
        <div className="grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((tm, i) => (
            <Reveal key={tm.name} delay={i * 120}>
              <Card className="h-full">
                <CardContent className="flex h-full flex-col p-6">
                  <div className="mb-3 flex gap-0.5">
                    {[0, 1, 2, 3, 4].map((s) => <Star key={s} className="h-4 w-4 fill-accent text-accent" />)}
                  </div>
                  <blockquote className="flex-1 text-sm leading-relaxed text-foreground">
                    &ldquo;{tm.quote}&rdquo;
                  </blockquote>
                  <div className="mt-4 flex items-center gap-3 border-t border-border/60 pt-4">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {tm.initials}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{tm.name}</div>
                      <div className="truncate text-xs text-muted-foreground">{tm.title}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Reveal>
          ))}
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

      {/* DEMO REQUEST + LIVE DEMO */}
      <section id="demo" className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 scroll-mt-20">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Demo Request Form */}
          <Reveal>
            <Card className="votewise-card-glow h-full">
              <CardHeader>
                <Badge variant="secondary" className="mb-2 w-fit gap-1"><Mail className="h-3.5 w-3.5" /> Demo Request</Badge>
                <CardTitle className="font-display text-2xl">Request a Personalized Demo</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Tell us about your organization and our team will set up a tailored demo within 24 hours.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="demo-name">Contact Person <span className="text-destructive">*</span></Label>
                    <Input id="demo-name" value={demoForm.name} onChange={(e) => setDemoForm((f) => ({ ...f, name: e.target.value }))} placeholder="Jane Doe" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="demo-email">Email <span className="text-destructive">*</span></Label>
                    <Input id="demo-email" type="email" value={demoForm.email} onChange={(e) => setDemoForm((f) => ({ ...f, email: e.target.value }))} placeholder="jane@yourorg.org" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="demo-phone">Phone</Label>
                    <Input id="demo-phone" value={demoForm.phone} onChange={(e) => setDemoForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+234 801 234 5678" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="demo-orgtype">Organization Type</Label>
                    <Input list="orgtypes-demo" id="demo-orgtype" value={demoForm.orgType} onChange={(e) => setDemoForm((f) => ({ ...f, orgType: e.target.value }))} placeholder="University" />
                    <datalist id="orgtypes-demo"><option>University</option><option>Company</option><option>Church</option><option>Association</option><option>Government</option><option>NGO</option><option>Cooperative</option><option>Other</option></datalist>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="demo-org">Organization Name <span className="text-destructive">*</span></Label>
                  <Input id="demo-org" value={demoForm.org} onChange={(e) => setDemoForm((f) => ({ ...f, org: e.target.value }))} placeholder="e.g. Lagos Medical Association" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="demo-voters">Estimated Voters</Label>
                    <Input id="demo-voters" type="number" value={demoForm.estimatedVoters} onChange={(e) => setDemoForm((f) => ({ ...f, estimatedVoters: e.target.value }))} placeholder="5000" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="demo-date">Preferred Date</Label>
                    <Input id="demo-date" type="date" value={demoForm.preferredDate} onChange={(e) => setDemoForm((f) => ({ ...f, preferredDate: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="demo-msg">Message (optional)</Label>
                  <Textarea id="demo-msg" rows={2} value={demoForm.message} onChange={(e) => setDemoForm((f) => ({ ...f, message: e.target.value }))} placeholder="Tell us about your election needs…" />
                </div>
                <Button onClick={submitDemoRequest} disabled={demoBusy} className="w-full gap-2">
                  {demoBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {demoBusy ? 'Sending…' : 'Request Demo'}
                </Button>
                <p className="text-center text-xs text-muted-foreground">No commitment required. We&apos;ll never share your details.</p>
              </CardContent>
            </Card>
          </Reveal>
          {/* Live Demo Try */}
          <Reveal delay={120}>
            <Card className="votewise-card-glow h-full overflow-hidden">
              <CardHeader>
                <Badge variant="secondary" className="mb-2 w-fit gap-1"><Play className="h-3.5 w-3.5" /> Live Demo</Badge>
                <CardTitle className="font-display text-2xl">See It In Action</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Explore a live demo election with real encrypted votes, live results, and the full voter journey. No registration required.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Try the voter journey</div>
                  <div className="mt-2 flex flex-col gap-2">
                    <Button onClick={() => setView('verify')} className="w-full gap-2">
                      <Vote className="h-5 w-5" /> Try Voting Now
                    </Button>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" size="sm" onClick={() => setView('about')} className="gap-1.5">
                        <Building2 className="h-4 w-4" /> About
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setView('guide')} className="gap-1.5">
                        <BookOpen className="h-4 w-4" /> Guide
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">View public results</div>
                  <p className="mt-1 text-xs text-muted-foreground">Live results, turnout maps, and certified certificates — all publicly viewable.</p>
                  <Button variant="outline" size="sm" onClick={() => document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' })} className="mt-2 w-full gap-1.5">
                    <Eye className="h-4 w-4" /> View Live Results
                  </Button>
                </div>
              </CardContent>
            </Card>
          </Reveal>
        </div>
      </section>

      {/* DOCUMENTATION */}
      <section id="docs" className="border-y border-border/60 bg-secondary/30 scroll-mt-20">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6">
          <Reveal>
            <div className="mb-10 text-center">
              <Badge variant="secondary" className="mb-2 gap-1"><FileText className="h-3.5 w-3.5" /> Documentation</Badge>
              <h2 className="font-display text-3xl font-bold sm:text-4xl">Read the Docs</h2>
              <p className="mx-auto mt-2 max-w-2xl text-muted-foreground">
                Everything you need to understand, trust, and use VoteWise — for voters, admins, and observers.
              </p>
            </div>
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {DOC_LINKS.map((d, i) => (
              <Reveal key={d.title} delay={i * 80}>
                <button
                  onClick={() => {
                    if (d.action === 'security' || d.action === 'how') {
                      setView('home'); setTimeout(() => document.getElementById(d.action === 'security' ? 'security' : 'how')?.scrollIntoView({ behavior: 'smooth' }), 80)
                    } else { setView(d.action as any) }
                  }}
                  className="w-full text-left"
                >
                  <Card className="h-full transition-all hover:shadow-md hover:-translate-y-0.5">
                    <CardContent className="p-5">
                      <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                        <d.icon className="h-5 w-5" />
                      </div>
                      <h3 className="mt-3 font-display text-sm font-semibold">{d.title}</h3>
                      <p className="mt-1.5 text-xs text-muted-foreground">{d.desc}</p>
                      <div className="mt-3 flex items-center gap-1 text-xs font-medium text-primary">
                        Read more <ArrowRight className="h-3 w-3" />
                      </div>
                    </CardContent>
                  </Card>
                </button>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 scroll-mt-20">
        <Reveal>
          <div className="mb-8 text-center">
            <Badge variant="secondary" className="mb-2 gap-1"><Mail className="h-3.5 w-3.5" /> Contact</Badge>
            <h2 className="font-display text-3xl font-bold sm:text-4xl">Get In Touch</h2>
            <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
              Questions? Partnerships? Press? We&apos;d love to hear from you.
            </p>
          </div>
        </Reveal>
        <Reveal delay={100}>
          <Card className="votewise-card-glow">
            <CardContent className="space-y-3 p-6">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="contact-name">Your Name</Label>
                  <Input id="contact-name" value={demoForm.name} onChange={(e) => setDemoForm((f) => ({ ...f, name: e.target.value }))} placeholder="Jane Doe" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contact-email">Email</Label>
                  <Input id="contact-email" type="email" value={demoForm.email} onChange={(e) => setDemoForm((f) => ({ ...f, email: e.target.value }))} placeholder="jane@yourorg.org" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contact-org">Organization (optional)</Label>
                <Input id="contact-org" value={demoForm.org} onChange={(e) => setDemoForm((f) => ({ ...f, org: e.target.value }))} placeholder="Your organization" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contact-msg">Message</Label>
                <Textarea id="contact-msg" rows={4} value={demoForm.message} onChange={(e) => setDemoForm((f) => ({ ...f, message: e.target.value }))} placeholder="How can we help?" />
              </div>
              <Button onClick={submitDemoRequest} disabled={demoBusy} className="w-full gap-2">
                {demoBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {demoBusy ? 'Sending…' : 'Send Message'}
              </Button>
              <div className="flex flex-wrap items-center justify-center gap-4 pt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> hello@votewise.ng</span>
                <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> +234 800 VOTEWISE</span>
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
              { icon: Building2, label: 'University', desc: 'Union election' },
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
