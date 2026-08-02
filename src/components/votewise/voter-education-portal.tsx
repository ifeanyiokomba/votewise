'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  GraduationCap, Shield, Lock, Vote, CheckCircle2, Play, BookOpen,
  HelpCircle, Lightbulb, ArrowRight, Clock, Users, KeyRound,
  BadgeCheck, FileText, AlertCircle, UserCheck, ScrollText, Eye,
  Fingerprint, Mail, Smartphone, MessageSquare, Vote as VoteIcon,
  Globe, Smartphone as DeviceIcon, Wifi, Save, EyeOff, ClipboardCheck,
  Headphones, BarChart3, Hash, Network, Award, Scale, Server, Cpu,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Section 2: The Voting Journey — 8 steps
// ---------------------------------------------------------------------------
type StepStatus = 'completed' | 'current' | 'upcoming'

interface JourneyStep {
  icon: React.ComponentType<{ className?: string }>
  title: string
  desc: string
  duration: string
}

const JOURNEY_STEPS: JourneyStep[] = [
  {
    icon: Users,
    title: 'Register',
    desc: 'Your organization adds you to the voter registry. You receive a voter ID and contact channel (email, SMS, or WhatsApp).',
    duration: '~30 sec',
  },
  {
    icon: Fingerprint,
    title: 'Verify Identity',
    desc: 'Confirm your identity via email, SMS, or WhatsApp OTP. Enter the 6-digit code to unlock your voting session.',
    duration: '~1 min',
  },
  {
    icon: BadgeCheck,
    title: 'Get Accredited',
    desc: 'Pass eligibility checks (if required by your organization). Accreditation is the digital equivalent of being cleared at a physical polling station.',
    duration: '~30 sec',
  },
  {
    icon: KeyRound,
    title: 'Receive OTVP',
    desc: 'A One-Time Voting Password (OTVP) is sent to you. This unlocks your secure ballot for this election only.',
    duration: 'Instant',
  },
  {
    icon: Vote,
    title: 'Open Ballot',
    desc: 'Click "Vote" to start your secure voting session. Candidate order is shuffled per voter to remove positional bias.',
    duration: '~10 sec',
  },
  {
    icon: CheckCircle2,
    title: 'Make Selections',
    desc: 'Choose your candidates for each eligible position. Single-choice or multiple-choice, depending on the position. You may also pick "None of the Above".',
    duration: '~2 min',
  },
  {
    icon: ClipboardCheck,
    title: 'Review & Confirm',
    desc: 'Review your selections carefully. Once you confirm, your vote is cast and cannot be changed. This step is irreversible.',
    duration: '~30 sec',
  },
  {
    icon: ScrollText,
    title: 'Get Receipt',
    desc: 'Receive a unique receipt code for each position. Use it later to verify your vote was counted — without revealing who you voted for.',
    duration: 'Instant',
  },
]

function statusColor(status: StepStatus) {
  switch (status) {
    case 'completed':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 ring-emerald-500/30'
    case 'current':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 ring-amber-500/40'
    case 'upcoming':
      return 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-400 ring-zinc-400/30'
  }
}

function statusLine(status: StepStatus) {
  switch (status) {
    case 'completed':
      return 'bg-emerald-500'
    case 'current':
      return 'bg-amber-500'
    case 'upcoming':
      return 'bg-zinc-300 dark:bg-zinc-700'
  }
}

// ---------------------------------------------------------------------------
// Section 3: Security Explained
// ---------------------------------------------------------------------------
const SECURITY_CARDS = [
  {
    icon: Lock,
    title: 'Encrypted at Rest',
    desc: 'Your vote choice is encrypted with AES-256-GCM before storage. Even database administrators cannot read your choice.',
    accent: 'emerald',
  },
  {
    icon: EyeOff,
    title: 'Anonymous',
    desc: 'Only a one-way hash of your identity is stored with your vote. No one can link your vote back to you.',
    accent: 'gold',
  },
  {
    icon: ScrollText,
    title: 'Receipt-Anchored',
    desc: 'You get a receipt code that proves your vote was counted — without revealing who you voted for.',
    accent: 'amber',
  },
  {
    icon: Shield,
    title: 'Audit-Verified',
    desc: 'Every action is recorded in a hash-chained audit log. The chain can be verified by anyone, at any time.',
    accent: 'emerald',
  },
]

function accentClasses(accent: string) {
  switch (accent) {
    case 'emerald':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
    case 'gold':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
    case 'amber':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200'
    default:
      return 'bg-primary/10 text-primary'
  }
}

// ---------------------------------------------------------------------------
// Section 4: Video Guides
// ---------------------------------------------------------------------------
interface VideoGuide {
  title: string
  duration: string
  desc: string
  icon: React.ComponentType<{ className?: string }>
}

const VIDEO_GUIDES: VideoGuide[] = [
  {
    title: 'How to Register as a Voter',
    duration: '3 min',
    desc: 'A walkthrough of how organizations add voters, and what you can do to confirm your registration before election day.',
    icon: UserCheck,
  },
  {
    title: 'How to Cast Your Vote',
    duration: '5 min',
    desc: 'The full end-to-end voting flow — from entering your voter ID to confirming your ballot and getting a receipt.',
    icon: VoteIcon,
  },
  {
    title: 'How to Verify Your Receipt',
    duration: '2 min',
    desc: 'Use your receipt code on the homepage to confirm your vote was counted, without revealing your choice.',
    icon: ScrollText,
  },
  {
    title: 'Understanding Election Security',
    duration: '7 min',
    desc: 'A deep dive into how VoteWise protects your vote — encryption, anonymity, audit logs, and observer access.',
    icon: Shield,
  },
]

// ---------------------------------------------------------------------------
// Section 5: FAQ
// ---------------------------------------------------------------------------
const EDUCATION_FAQS = [
  {
    q: 'How do I know if I\'m registered?',
    a: 'Use the "Check Voter Status" tool — enter your voter ID, email, or phone number. If you\'re registered, you\'ll see your voter profile and which elections you\'re eligible for. If not, contact your organization\'s Electoral Committee to be added to the registry.',
  },
  {
    q: 'What if I lose my receipt code?',
    a: 'Your receipt code is also saved inside your voter dashboard (accessible after you log in). If you lose it, log in to your dashboard to retrieve it. Without the receipt you cannot independently verify your vote was counted — but your vote is still recorded and will be tallied.',
  },
  {
    q: 'Can I change my vote after submitting?',
    a: 'No. Once you confirm and cast your ballot, the vote is final and cannot be changed. This is enforced by a database transaction that marks you as having voted and inserts your encrypted vote atomically. Always review your selections carefully before confirming.',
  },
  {
    q: 'How do I verify my vote was counted?',
    a: 'Use the "Verify Receipt" tool on the homepage. Enter your receipt code — if it matches a recorded vote, you\'ll see a confirmation that your vote was counted. The verification never reveals who you voted for, only that a vote with that receipt exists.',
  },
  {
    q: 'What happens if my internet drops during voting?',
    a: 'Your session is preserved for a limited window (typically 15 minutes). If you reconnect before the session expires, you can resume from where you left off. If the session expires, you\'ll need to start a new voting session — but since your vote is only recorded when you explicitly confirm, no partial vote is cast.',
  },
  {
    q: 'Can someone find out who I voted for?',
    a: 'No. Your vote is encrypted with AES-256-GCM before storage. Only an opaque one-way hash of your identity is stored alongside it — not your identity itself. Even the Electoral Committee, database administrators, or platform operators cannot link a vote back to you. Your receipt proves your vote was counted but never reveals your choice.',
  },
  {
    q: 'What is NOTA (None of the Above)?',
    a: 'NOTA is an option on every position that lets you formally register "None of the Above" — meaning you do not support any of the listed candidates. Voting NOTA is a valid choice and is tallied alongside the candidates. It\'s useful when you want to participate but don\'t endorse any candidate.',
  },
  {
    q: 'How long do I have to vote?',
    a: 'The voting window is set by your organization\'s Electoral Committee — typically between 8 and 48 hours. The exact start and end times are shown on the election\'s public page and in your voter dashboard. We strongly recommend voting early in the window to avoid last-minute network congestion.',
  },
  {
    q: 'What devices can I use to vote?',
    a: 'VoteWise works on any modern device with a web browser — smartphones, tablets, laptops, or desktops. We recommend using an up-to-date browser (Chrome, Firefox, Safari, or Edge) on a device you trust. Avoid public or shared computers when possible.',
  },
  {
    q: 'What if I\'m having technical issues?',
    a: 'Open a support ticket via the "Support" tab in your voter dashboard, or use the chatbot in the bottom-right corner. Common issues (OTP not arriving, session expired) are usually resolved within minutes. If your issue is election-critical, an electoral officer will be paged immediately.',
  },
  {
    q: 'Why is candidate order different from my friend\'s?',
    a: 'Candidate order is shuffled per voter using a seeded Fisher-Yates shuffle. This removes positional bias — no candidate benefits from always appearing first on the ballot. You and your friend see the same candidates, just in a different order.',
  },
  {
    q: 'What does accreditation do?',
    a: 'Accreditation records that you\'ve been verified for this election on this device. It\'s the digital equivalent of being cleared at a physical polling station before voting. You only need to accredit once per election, and you cannot vote without completing it (if your organization requires it).',
  },
]

// ---------------------------------------------------------------------------
// Section 6: Best Practices
// ---------------------------------------------------------------------------
const BEST_PRACTICES = [
  {
    icon: Clock,
    title: 'Vote Early',
    desc: 'Don\'t wait until the last minute. Network congestion may slow things down near the end of the voting window.',
  },
  {
    icon: Wifi,
    title: 'Use a Stable Connection',
    desc: 'Ensure you have a stable internet connection before starting. Wi-Fi or strong mobile data is recommended.',
  },
  {
    icon: Save,
    title: 'Keep Your Receipt Safe',
    desc: 'Save your receipt code immediately after voting — screenshot it, write it down, or copy it to a notes app.',
  },
  {
    icon: EyeOff,
    title: 'Vote in Private',
    desc: 'Don\'t let anyone see your screen or pressure you. Your vote is your choice — coercion is a serious offense.',
  },
  {
    icon: ClipboardCheck,
    title: 'Verify Before Submitting',
    desc: 'Review your selections carefully before confirming. Once submitted, your vote cannot be changed.',
  },
  {
    icon: AlertCircle,
    title: 'Report Issues',
    desc: 'If you encounter problems, report them immediately via the Support tab. Don\'t wait — early reporting helps everyone.',
  },
]

// ---------------------------------------------------------------------------
// Section 7: Glossary
// ---------------------------------------------------------------------------
const GLOSSARY = [
  { term: 'Ballot', def: 'The digital form you fill out to cast your vote. Contains one or more positions, each with candidates and a NOTA option.' },
  { term: 'Receipt', def: 'A unique code issued after you cast your vote. Use it to verify your vote was counted — without revealing your choice.' },
  { term: 'OTVP', def: 'One-Time Voting Password. A single-use password sent to you that unlocks your ballot for one specific election.' },
  { term: 'Accreditation', def: 'A one-time verification step that confirms your identity and device for an election. The digital equivalent of being cleared at a polling station.' },
  { term: 'NOTA', def: '"None of the Above". A formal option to register that you do not support any listed candidate. Counted alongside candidate votes.' },
  { term: 'Turnout', def: 'The percentage of registered voters who actually cast a ballot. A key measure of election participation.' },
  { term: 'Certification', def: 'The official process by which the Electoral Committee freezes and signs the final results, making them the official record.' },
  { term: 'Audit Log', def: 'A tamper-evident, hash-chained record of every action taken in the election. Can be verified by anyone to confirm integrity.' },
  { term: 'AES-256-GCM', def: 'The encryption standard used to protect your vote choice before storage. A military-grade symmetric cipher.' },
  { term: 'One-Way Hash', def: 'A mathematical function that converts your identity into a fixed-length string that cannot be reversed. Used to anonymize your vote.' },
  { term: 'Constituency', def: 'The group of voters eligible to vote for a particular position. E.g. only Faculty of Science students vote for Faculty of Science Rep.' },
  { term: 'Electoral Committee', def: 'The body that oversees an election — sets rules, manages voter registry, certifies results. Sometimes called ELCOM or SEC.' },
  { term: 'Observer', def: 'An independent monitor with read-only access to election activity. Observers verify transparency without influencing the vote.' },
  { term: 'Hash Chain', def: 'A sequence of records where each record includes a hash of the previous one. Any tampering breaks the chain and is immediately detectable.' },
]

// ---------------------------------------------------------------------------
// Section 8: Get Help links
// ---------------------------------------------------------------------------
const HELP_LINKS = [
  {
    icon: UserCheck,
    title: 'Check Voter Status',
    desc: 'See if you\'re registered and which elections you can vote in.',
    href: '/status',
  },
  {
    icon: ScrollText,
    title: 'Verify Your Receipt',
    desc: 'Confirm your vote was counted using your receipt code.',
    href: '/',
  },
  {
    icon: Headphones,
    title: 'Contact Support',
    desc: 'Open a support ticket or chat with an electoral officer.',
    href: '/#contact',
  },
  {
    icon: BarChart3,
    title: 'View Public Results',
    desc: 'See live and certified results for public elections.',
    href: '/results/demo',
  },
]

// ---------------------------------------------------------------------------
// Animation helpers
// ---------------------------------------------------------------------------
const sectionVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
}

function SectionHeader({
  badge, badgeIcon: BadgeIcon, title, subtitle, highlight,
}: {
  badge: string
  badgeIcon: React.ComponentType<{ className?: string }>
  title: string
  subtitle?: string
  highlight?: string
}) {
  return (
    <div className="mb-8 text-center">
      <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
        <BadgeIcon className="h-3.5 w-3.5" /> {badge}
      </div>
      <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
        {title}{' '}
        {highlight && <span className="text-primary">{highlight}</span>}
      </h2>
      {subtitle && (
        <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
          {subtitle}
        </p>
      )}
    </div>
  )
}

// ===========================================================================
// MAIN COMPONENT
// ===========================================================================
export function VoterEducationPortal() {
  const [activeStep, setActiveStep] = useState<number | null>(null)
  const [videoOpen, setVideoOpen] = useState(false)
  const [activeVideo, setActiveVideo] = useState<VideoGuide | null>(null)

  function stepStatus(i: number): StepStatus {
    if (activeStep === null) return 'upcoming'
    if (i < activeStep) return 'completed'
    if (i === activeStep) return 'current'
    return 'upcoming'
  }

  function openVideo(v: VideoGuide) {
    setActiveVideo(v)
    setVideoOpen(true)
  }

  return (
    <div className="w-full">
      {/* ----------------------------------------------------------------- */}
      {/* SECTION 1: HERO                                                   */}
      {/* ----------------------------------------------------------------- */}
      <section className="relative overflow-hidden border-b border-border/60 bg-gradient-to-b from-primary/10 via-primary/5 to-background">
        <div className="pointer-events-none absolute inset-0 -z-10 opacity-40 [background:radial-gradient(60%_50%_at_50%_0%,var(--tw-color-primary,theme(colors.emerald.500))/_0.18,transparent_70%)]" />
        <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 md:py-20">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mx-auto max-w-3xl text-center"
          >
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <GraduationCap className="h-3.5 w-3.5" /> Voter Education Portal
            </div>
            <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              Learn How to Vote{' '}
              <span className="text-primary">Securely</span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
              Everything you need to know about voting with VoteWise — from registration to verification.
              Understand the journey, the security guarantees, and the best practices that keep your vote safe.
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="gap-2">
                <Link href="/status">
                  <UserCheck className="h-4 w-4" /> Check If You&apos;re Registered
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="gap-2">
                <Link href="/#contact">
                  <Headphones className="h-4 w-4" /> Talk to Support
                </Link>
              </Button>
            </div>
          </motion.div>

          {/* Quick stat strip */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="mx-auto mt-10 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-4"
          >
            {[
              { icon: Clock, value: '~5 min', label: 'Average voting time' },
              { icon: Lock, value: 'AES-256', label: 'Encryption standard' },
              { icon: ScrollText, value: 'Hash-chained', label: 'Audit trail' },
              { icon: EyeOff, value: '100%', label: 'Anonymous votes' },
            ].map((s) => (
              <Card key={s.label} className="votewise-card-glow">
                <CardContent className="flex flex-col items-center gap-1 p-4 text-center">
                  <s.icon className="h-5 w-5 text-primary" />
                  <div className="font-display text-lg font-bold text-foreground">{s.value}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
                </CardContent>
              </Card>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* SECTION 2: THE VOTING JOURNEY                                     */}
      {/* ----------------------------------------------------------------- */}
      <section className="border-b border-border/60 bg-background">
        <div className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6 md:py-16">
          <motion.div
            variants={sectionVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.5 }}
          >
            <SectionHeader
              badge="The Voting Journey"
              badgeIcon={Vote}
              title="8 Steps from Registration"
              highlight="to Receipt"
              subtitle="A visual timeline of the complete voting process. Click any step to mark it as your current stage — steps before are completed, steps after are upcoming."
            />
          </motion.div>

          {/* Timeline */}
          <div className="relative">
            {/* vertical connecting line */}
            <div className="absolute left-5 top-2 bottom-2 w-0.5 bg-border sm:left-6" aria-hidden />

            <ol className="space-y-4">
              {JOURNEY_STEPS.map((step, i) => {
                const status = stepStatus(i)
                const Icon = step.icon
                return (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -16 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: '-60px' }}
                    transition={{ duration: 0.4, delay: i * 0.05 }}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveStep(activeStep === i ? null : i)}
                      className="group flex w-full items-start gap-4 text-left"
                      aria-pressed={status === 'current'}
                    >
                      {/* Node */}
                      <div className="relative z-10 shrink-0">
                        <div
                          className={cn(
                            'grid h-10 w-10 place-items-center rounded-full ring-2 transition-all sm:h-12 sm:w-12',
                            statusColor(status),
                            status === 'current' && 'ring-offset-2 ring-offset-background'
                          )}
                        >
                          {status === 'completed' ? (
                            <CheckCircle2 className="h-5 w-5" />
                          ) : (
                            <Icon className="h-5 w-5" />
                          )}
                        </div>
                        {/* short connector to the card */}
                        <span className={cn('absolute left-1/2 top-full h-4 w-0.5 -translate-x-1/2', statusLine(status))} aria-hidden />
                      </div>

                      {/* Card */}
                      <Card
                        className={cn(
                          'flex-1 transition-all group-hover:shadow-md',
                          status === 'current' && 'ring-1 ring-amber-500/40'
                        )}
                      >
                        <CardContent className="p-4 sm:p-5">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="gap-1">
                              <span className="font-mono text-[10px]">STEP {String(i + 1).padStart(2, '0')}</span>
                            </Badge>
                            <h3 className="font-display text-base font-semibold sm:text-lg">{step.title}</h3>
                            <Badge variant="secondary" className="ml-auto gap-1">
                              <Clock className="h-3 w-3" /> {step.duration}
                            </Badge>
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground">{step.desc}</p>
                          {status === 'current' && (
                            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                              <span className="votewise-live-dot inline-block h-1.5 w-1.5 rounded-full bg-amber-600" />
                              You are here
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </button>
                  </motion.li>
                )
              })}
            </ol>
          </div>

          {/* Reset / progress hint */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {activeStep === null
                ? 'Tip: click a step to track your progress through the journey.'
                : `Progress: ${activeStep + 1} of ${JOURNEY_STEPS.length} steps marked.`}
            </p>
            {activeStep !== null && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveStep(null)}
                className="gap-1.5"
              >
                Reset timeline
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* SECTION 3: SECURITY EXPLAINED                                     */}
      {/* ----------------------------------------------------------------- */}
      <section className="border-b border-border/60 bg-secondary/30">
        <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 md:py-16">
          <motion.div
            variants={sectionVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.5 }}
          >
            <SectionHeader
              badge="Security Explained"
              badgeIcon={Shield}
              title="How Your Vote Is"
              highlight="Protected"
              subtitle="Four layers of protection work together so your vote is secret, verifiable, and tamper-proof."
            />
          </motion.div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SECURITY_CARDS.map((card, i) => {
              const Icon = card.icon
              return (
                <motion.div
                  key={card.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                >
                  <Card className="votewise-card-glow h-full">
                    <CardHeader className="pb-3">
                      <div className={cn('grid h-11 w-11 place-items-center rounded-xl', accentClasses(card.accent))}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <CardTitle className="mt-3 font-display text-base font-semibold">{card.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{card.desc}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </div>

          {/* Security principles strip */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-6"
          >
            <Alert className="border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <Shield className="h-4 w-4 text-emerald-600" />
              <AlertTitle className="text-emerald-900 dark:text-emerald-200">Security by design, not by promise</AlertTitle>
              <AlertDescription className="text-emerald-900/80 dark:text-emerald-200/80">
                VoteWise never stores your vote choice in plain text. The system is engineered so that
                even a full database compromise cannot reveal who voted for whom — only the encrypted
                blobs and the public audit chain.
              </AlertDescription>
            </Alert>
          </motion.div>
        </div>
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* SECTION 4: VIDEO GUIDES                                           */}
      {/* ----------------------------------------------------------------- */}
      <section className="border-b border-border/60 bg-background">
        <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 md:py-16">
          <motion.div
            variants={sectionVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.5 }}
          >
            <SectionHeader
              badge="Video Guides"
              badgeIcon={Play}
              title="Watch and"
              highlight="Learn"
              subtitle="Short video tutorials that walk you through every part of the voting process. Click any card to play."
            />
          </motion.div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {VIDEO_GUIDES.map((v, i) => {
              const Icon = v.icon
              return (
                <motion.div
                  key={v.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                >
                  <button
                    type="button"
                    onClick={() => openVideo(v)}
                    className="group w-full text-left"
                    aria-label={`Play video: ${v.title}`}
                  >
                    <Card className="votewise-card-glow h-full overflow-hidden transition-all group-hover:-translate-y-0.5 group-hover:shadow-lg">
                      {/* Thumbnail */}
                      <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-primary/15 via-primary/5 to-amber-500/10">
                        <div className="absolute inset-0 grid place-items-center">
                          <div className="grid h-14 w-14 place-items-center rounded-full bg-background/80 text-primary shadow-md transition-transform group-hover:scale-110">
                            <Play className="h-6 w-6 fill-current" />
                          </div>
                        </div>
                        <div className="absolute left-3 top-3">
                          <div className="grid h-10 w-10 place-items-center rounded-lg bg-background/70 text-primary backdrop-blur">
                            <Icon className="h-5 w-5" />
                          </div>
                        </div>
                        <Badge
                          variant="secondary"
                          className="absolute bottom-3 right-3 gap-1 bg-background/85 backdrop-blur"
                        >
                          <Clock className="h-3 w-3" /> {v.duration}
                        </Badge>
                      </div>
                      <CardContent className="p-4">
                        <h3 className="font-display text-sm font-semibold leading-snug">{v.title}</h3>
                        <p className="mt-1.5 text-xs text-muted-foreground">{v.desc}</p>
                      </CardContent>
                    </Card>
                  </button>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* SECTION 5: FAQ                                                    */}
      {/* ----------------------------------------------------------------- */}
      <section className="border-b border-border/60 bg-secondary/30">
        <div className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6 md:py-16">
          <motion.div
            variants={sectionVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.5 }}
          >
            <SectionHeader
              badge="Frequently Asked Questions"
              badgeIcon={HelpCircle}
              title="Voter"
              highlight="FAQs"
              subtitle="Real questions from real voters — answered clearly."
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Card className="votewise-card-glow">
              <CardContent className="p-2">
                <Accordion type="single" collapsible className="w-full">
                  {EDUCATION_FAQS.map((faq, i) => (
                    <AccordionItem key={i} value={`item-${i}`} className="border-b border-border/60 last:border-0">
                      <AccordionTrigger className="px-4 text-left text-sm font-medium hover:no-underline">
                        {faq.q}
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4 text-sm text-muted-foreground">
                        {faq.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* SECTION 6: BEST PRACTICES                                         */}
      {/* ----------------------------------------------------------------- */}
      <section className="border-b border-border/60 bg-background">
        <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 md:py-16">
          <motion.div
            variants={sectionVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.5 }}
          >
            <SectionHeader
              badge="Best Practices"
              badgeIcon={Lightbulb}
              title="Tips for"
              highlight="Secure Voting"
              subtitle="Six habits that make your voting experience smooth and safe."
            />
          </motion.div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {BEST_PRACTICES.map((tip, i) => {
              const Icon = tip.icon
              return (
                <motion.div
                  key={tip.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ duration: 0.4, delay: i * 0.06 }}
                >
                  <Card className="h-full transition-shadow hover:shadow-md">
                    <CardContent className="flex items-start gap-3 p-5">
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-muted-foreground">#{String(i + 1).padStart(2, '0')}</span>
                          <h3 className="font-display text-sm font-semibold">{tip.title}</h3>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{tip.desc}</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* SECTION 7: GLOSSARY                                               */}
      {/* ----------------------------------------------------------------- */}
      <section className="border-b border-border/60 bg-secondary/30">
        <div className="mx-auto w-full max-w-4xl px-4 py-14 sm:px-6 md:py-16">
          <motion.div
            variants={sectionVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.5 }}
          >
            <SectionHeader
              badge="Glossary"
              badgeIcon={BookOpen}
              title="Election Terms"
              highlight="Explained"
              subtitle="Plain-English definitions of the words you'll see throughout the voting process."
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Card className="votewise-card-glow">
              <CardContent className="p-2">
                <Accordion type="single" collapsible className="w-full">
                  {GLOSSARY.map((g, i) => (
                    <AccordionItem key={g.term} value={`glossary-${i}`} className="border-b border-border/60 last:border-0">
                      <AccordionTrigger className="px-4 text-left text-sm font-medium hover:no-underline">
                        <span className="flex items-center gap-2">
                          <BookOpen className="h-3.5 w-3.5 text-primary" />
                          <span className="font-display font-semibold">{g.term}</span>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4 pl-11 text-sm text-muted-foreground">
                        {g.def}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* SECTION 8: GET HELP                                               */}
      {/* ----------------------------------------------------------------- */}
      <section className="bg-background">
        <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 md:py-16">
          <motion.div
            variants={sectionVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.5 }}
          >
            <SectionHeader
              badge="Get Help"
              badgeIcon={Headphones}
              title="Ready to"
              highlight="Take the Next Step?"
              subtitle="Pick where you want to go next — we'll take you there."
            />
          </motion.div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {HELP_LINKS.map((link, i) => {
              const Icon = link.icon
              return (
                <motion.div
                  key={link.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                >
                  <Link href={link.href} className="group block h-full">
                    <Card className="votewise-card-glow h-full transition-all group-hover:-translate-y-0.5 group-hover:shadow-lg">
                      <CardContent className="flex h-full flex-col p-5">
                        <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
                          <Icon className="h-5 w-5" />
                        </div>
                        <h3 className="mt-3 font-display text-base font-semibold">{link.title}</h3>
                        <p className="mt-1 flex-1 text-sm text-muted-foreground">{link.desc}</p>
                        <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-primary">
                          Go <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              )
            })}
          </div>

          {/* Final reassurance strip */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="mt-8"
          >
            <Card className="votewise-card-glow overflow-hidden">
              <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <GraduationCap className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-display text-base font-semibold sm:text-lg">
                    Still unsure? You&apos;re not alone.
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Most first-time voters have questions. Our support team and electoral officers are here to help —
                    no question is too small. Reach out any time during the voting window.
                  </p>
                </div>
                <Button asChild className="gap-2">
                  <Link href="/#contact">
                    <Headphones className="h-4 w-4" /> Contact Support
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          <Separator className="my-8" />

          <p className="text-center text-xs text-muted-foreground">
            VoteWise Voter Education Portal · Built for transparent, secure elections.
          </p>
        </div>
      </section>

      {/* Video placeholder dialog */}
      <Dialog open={videoOpen} onOpenChange={setVideoOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <Play className="h-4 w-4 text-primary" />
              {activeVideo?.title}
            </DialogTitle>
            <DialogDescription>
              {activeVideo?.desc}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="grid h-20 w-20 place-items-center rounded-full bg-primary/10 text-primary">
              <Play className="h-8 w-8 fill-current" />
            </div>
            <div className="text-center">
              <p className="font-display text-base font-semibold">Video coming soon</p>
              <p className="mt-1 text-sm text-muted-foreground">
                This tutorial is being produced. In the meantime, read the step-by-step guide above or contact support.
              </p>
              <Badge variant="secondary" className="mt-3 gap-1">
                <Clock className="h-3 w-3" /> {activeVideo?.duration}
              </Badge>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setVideoOpen(false)}>Close</Button>
            <Button asChild className="gap-2">
              <Link href="/#contact">
                <Headphones className="h-4 w-4" /> Ask support
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
