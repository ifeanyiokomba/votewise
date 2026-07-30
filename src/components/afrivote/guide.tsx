'use client'

import { useState } from 'react'
import Image from 'next/image'
import {
  ArrowLeft, Shield, KeyRound, Fingerprint, Vote, BadgeCheck, CheckCircle2,
  Clock, Users, Eye, Lock, FileCheck2, AlertCircle, ChevronRight, Play,
  GraduationCap, Mail, Smartphone, MessageSquare, HelpCircle, BookOpen,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useApp } from '@/lib/store'
import { cn } from '@/lib/utils'
import { Reveal } from '@/components/afrivote/faq'

const GUIDE_STEPS = [
  {
    icon: Shield,
    title: 'Verify Your Matriculation Number',
    duration: '~30 seconds',
    desc: 'Enter your matric number on the voting page. We check it against the official student register before anything else.',
    tips: [
      'Use the exact format on your student ID (e.g. CSC/2022/001)',
      'Your matric is case-insensitive — we normalise it automatically',
      'If your matric isn\'t found, contact the Electoral Committee',
    ],
    color: 'bg-blue-100 text-blue-700',
  },
  {
    icon: KeyRound,
    title: 'Receive a Verification PIN',
    duration: '~1 minute',
    desc: 'Choose how to receive your one-time PIN: email, SMS, or WhatsApp. Enter the 6-digit code to unlock your ballot.',
    tips: [
      'The PIN expires in 10 minutes',
      'You can resend after 60 seconds if it doesn\'t arrive',
      'Check your spam folder for email PINs',
      '5 incorrect attempts locks your account for 15 minutes',
    ],
    color: 'bg-purple-100 text-purple-700',
  },
  {
    icon: Fingerprint,
    title: 'Complete Accreditation',
    duration: '~30 seconds',
    desc: 'Accreditation records that you\'ve been verified for this election on this device. This mirrors the physical accreditation done at Nigerian campus polling units.',
    tips: [
      'You only need to accredit once per election',
      'Accreditation binds your session to this device',
      'You cannot vote without completing accreditation',
    ],
    color: 'bg-amber-100 text-amber-700',
  },
  {
    icon: Vote,
    title: 'Cast Your Ballot',
    duration: '~2 minutes',
    desc: 'Vote for each position you\'re eligible for. Candidate order is shuffled per voter to remove bias. You may choose "None of the Above" to abstain.',
    tips: [
      'You\'ll see only positions you\'re eligible for',
      'University-wide positions are open to all students',
      'Faculty rep positions are voted only by that faculty',
      'Department senator positions are voted only by that department',
      'Review your selections carefully before confirming',
    ],
    color: 'bg-emerald-100 text-emerald-700',
  },
  {
    icon: BadgeCheck,
    title: 'Get Your Receipt',
    duration: 'Instant',
    desc: 'After casting your vote, you receive a unique receipt code for each position. Use it later to confirm your vote was counted — without revealing who you voted for.',
    tips: [
      'Save your receipt codes securely',
      'Each position has its own receipt code',
      'Receipts do NOT reveal your vote choice',
      'Anyone can verify a receipt on the homepage',
    ],
    color: 'bg-accent/20 text-accent-foreground',
  },
]

const HELP_TOPICS = [
  { icon: Mail, title: 'Email Delivery', desc: 'PIN sent to your institutional or personal email.' },
  { icon: Smartphone, title: 'SMS Delivery', desc: 'PIN sent via SMS to your registered phone number.' },
  { icon: MessageSquare, title: 'WhatsApp Delivery', desc: 'PIN sent via WhatsApp to your registered number.' },
  { icon: Lock, title: 'Ballot Secrecy', desc: 'Your vote is encrypted with AES-256-GCM. No one can see your choice.' },
  { icon: FileCheck2, title: 'Audit Trail', desc: 'Every action is logged in a tamper-evident hash-chained audit log.' },
  { icon: Eye, title: 'Observer Access', desc: 'Independent observers monitor the election in real-time.' },
]

export function GuideView() {
  const { setView } = useApp()
  const [activeStep, setActiveStep] = useState(0)

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <Button variant="ghost" size="sm" onClick={() => setView('home')} className="mb-4 gap-1.5">
        <ArrowLeft className="h-4 w-4" /> Back to home
      </Button>

      {/* Header */}
      <Reveal>
        <div className="mb-8 text-center">
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <BookOpen className="h-3.5 w-3.5" /> Voter Guide
          </div>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">How to Vote — Step by Step</h1>
          <p className="mx-auto mt-2 max-w-2xl text-muted-foreground">
            A complete visual guide to casting your vote in the SUG election. The entire process takes less than 5 minutes.
          </p>
        </div>
      </Reveal>

      {/* Step timeline */}
      <div className="mb-8 grid gap-2 sm:grid-cols-5">
        {GUIDE_STEPS.map((step, i) => (
          <button
            key={i}
            onClick={() => setActiveStep(i)}
            className={cn(
              'flex flex-col items-center gap-2 rounded-lg border p-3 text-center transition-all',
              activeStep === i ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-muted/50'
            )}
          >
            <div className={cn('grid h-10 w-10 place-items-center rounded-full', activeStep === i ? step.color : 'bg-muted text-muted-foreground')}>
              {i < activeStep ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <step.icon className="h-5 w-5" />}
            </div>
            <span className={cn('text-xs font-medium', activeStep === i ? 'text-foreground' : 'text-muted-foreground')}>
              Step {i + 1}
            </span>
          </button>
        ))}
      </div>

      {/* Active step detail */}
      <Reveal key={activeStep}>
        <Card className="afrivote-card-glow mb-8 overflow-hidden">
          <div className={cn('flex items-center gap-4 p-6', GUIDE_STEPS[activeStep].color)}>
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-white/30">
              {(() => { const Icon = GUIDE_STEPS[activeStep].icon; return <Icon className="h-7 w-7" /> })()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-xl font-bold">{GUIDE_STEPS[activeStep].title}</h2>
                <Badge variant="outline" className="bg-white/30 text-current">
                  <Clock className="mr-1 h-3 w-3" /> {GUIDE_STEPS[activeStep].duration}
                </Badge>
              </div>
              <p className="mt-1 text-sm opacity-90">{GUIDE_STEPS[activeStep].desc}</p>
            </div>
          </div>
          <CardContent className="p-6">
            <h3 className="mb-3 flex items-center gap-1.5 font-display text-sm font-semibold">
              <HelpCircle className="h-4 w-4 text-primary" /> Tips & Important Notes
            </h3>
            <ul className="space-y-2">
              {GUIDE_STEPS[activeStep].tips.map((tip, j) => (
                <li key={j} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span className="text-muted-foreground">{tip}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </Reveal>

      {/* Navigation */}
      <div className="mb-8 flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setActiveStep((s) => Math.max(0, s - 1))}
          disabled={activeStep === 0}
          className="gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" /> Previous
        </Button>
        <span className="text-sm text-muted-foreground">{activeStep + 1} of {GUIDE_STEPS.length}</span>
        {activeStep < GUIDE_STEPS.length - 1 ? (
          <Button onClick={() => setActiveStep((s) => Math.min(GUIDE_STEPS.length - 1, s + 1))} className="gap-1.5">
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={() => setView('verify')} className="gap-1.5">
            <Shield className="h-4 w-4" /> Start Voting
          </Button>
        )}
      </div>

      {/* Help topics grid */}
      <Reveal>
        <div className="mb-8">
          <h2 className="mb-4 font-display text-xl font-bold">Key Features & Guarantees</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {HELP_TOPICS.map((topic) => (
              <Card key={topic.title} className="transition-shadow hover:shadow-md">
                <CardContent className="flex items-start gap-3 p-4">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <topic.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-medium">{topic.title}</h3>
                    <p className="text-xs text-muted-foreground">{topic.desc}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </Reveal>

      {/* Support CTA */}
      <Reveal>
        <Alert className="afrivote-card-glow">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Need help?</AlertTitle>
          <AlertDescription>
            If you encounter any issues during voting, use the chatbot (bottom-right corner) or open a support ticket.
            An electoral officer will assist you promptly.
          </AlertDescription>
        </Alert>
      </Reveal>
    </div>
  )
}
