'use client'

import Link from 'next/link'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Vote, Users, ShieldCheck, Receipt, BarChart3, Play, ArrowRight,
  CheckCircle2, KeyRound, FileText, Eye, Trophy, Clock,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const STEPS = [
  { icon: Users, title: 'Verify Eligibility', desc: 'Enter your matric number to confirm you\'re registered to vote.' },
  { icon: KeyRound, title: 'Receive OTVP', desc: 'Get a One-Time Voting Password via SMS, Email, or WhatsApp.' },
  { icon: ShieldCheck, title: 'Authenticate', desc: 'Enter your OTVP to securely access the ballot.' },
  { icon: Vote, title: 'Select Candidates', desc: 'Review candidates and select your choices.' },
  { icon: CheckCircle2, title: 'Review & Submit', desc: 'Confirm your selections and cast your vote.' },
  { icon: Receipt, title: 'Receive Receipt', desc: 'Get a unique receipt code to verify your vote was recorded.' },
]

export function DemoPortalPage() {
  const [activeStep, setActiveStep] = useState(0)

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-12 text-center">
        <Badge className="mb-4 gap-1.5 border-2 border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-700 dark:text-emerald-300">
          <Play className="h-3 w-3" /> Interactive Demo
        </Badge>
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">
          Experience the <span className="text-emerald-600 dark:text-emerald-400">Voting Journey</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm text-muted-foreground sm:text-base">
          Walk through the complete VoteWise voting experience — from eligibility check to receipt verification. No registration required.
        </p>
      </motion.div>

      {/* Steps */}
      <div className="mb-12 space-y-4">
        {STEPS.map((step, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card
              className={`cursor-pointer transition-all ${activeStep === i ? 'votewise-card-glow border-2 border-emerald-500/30' : 'hover:border-emerald-500/20'}`}
              onClick={() => setActiveStep(i)}
            >
              <CardContent className="flex items-center gap-4 p-5">
                <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${activeStep === i ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                  <step.icon className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground">STEP {i + 1}</span>
                    {activeStep === i && <Badge className="text-[9px] bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">Active</Badge>}
                  </div>
                  <h3 className="font-display text-base font-bold">{step.title}</h3>
                  <p className="text-xs text-muted-foreground">{step.desc}</p>
                </div>
                <ArrowRight className={`h-4 w-4 transition-transform ${activeStep === i ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`} />
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Interactive preview */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeStep}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="mb-12"
        >
          <Card className="votewise-card-glow">
            <CardHeader>
              <CardTitle className="font-display text-base">
                {STEPS[activeStep].title} — Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid min-h-[200px] place-items-center rounded-lg bg-muted/30 p-8 text-center">
                <div>
                  {(() => { const StepIcon = STEPS[activeStep].icon; return <StepIcon className="mx-auto mb-3 h-12 w-12 text-primary" /> })()}
                  <p className="text-sm text-muted-foreground">
                    {activeStep === 0 && 'A form would appear here asking for your matriculation number. The system checks if you\'re registered and shows your faculty, department, and level.'}
                    {activeStep === 1 && 'After identity verification, a 6-digit OTVP is sent to your registered phone and email. The code expires in 5 minutes.'}
                    {activeStep === 2 && 'Enter the 6-digit OTVP here. Once verified, you\'re authenticated and can access the ballot.'}
                    {activeStep === 3 && 'The ballot appears here with positions and candidates. Large photos, manifestos, and clear selection buttons. Your progress is shown (1 of 5 positions).'}
                    {activeStep === 4 && 'A confirmation screen shows all your selections. You can go back and change any vote. Once you click "Submit Vote", your vote is final.'}
                    {activeStep === 5 && 'A receipt code (e.g., VW-UNILAG-2028-00823918) is displayed. You can verify this at any time — it confirms your vote was recorded without revealing your selection.'}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex justify-between">
                <Button variant="outline" size="sm" disabled={activeStep === 0} onClick={() => setActiveStep(Math.max(0, activeStep - 1))}>
                  Previous
                </Button>
                <Button size="sm" disabled={activeStep === STEPS.length - 1} onClick={() => setActiveStep(Math.min(STEPS.length - 1, activeStep + 1))} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                  Next Step <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>

      {/* Features showcase */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: ShieldCheck, title: 'Encrypted', desc: 'AES-256-GCM' },
          { icon: Eye, title: 'Observable', desc: 'Independent monitors' },
          { icon: Receipt, title: 'Verifiable', desc: 'Receipt for every vote' },
        ].map((f) => (
          <Card key={f.title}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <f.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold">{f.title}</div>
                <div className="text-[11px] text-muted-foreground">{f.desc}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* CTA */}
      <div className="mt-12 text-center">
        <Card className="votewise-card-glow border-2 border-emerald-500/30">
          <CardContent className="p-8">
            <Trophy className="mx-auto mb-3 h-10 w-10 text-emerald-600 dark:text-emerald-400" />
            <h2 className="font-display text-2xl font-bold">Ready for the Real Thing?</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Register your organization and conduct your first election with VoteWise.
            </p>
            <Link href="/?view=register">
              <Button size="lg" className="mt-6 gap-2 bg-emerald-600 hover:bg-emerald-700">
                Register Organization <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
