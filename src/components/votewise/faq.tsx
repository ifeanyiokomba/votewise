'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, HelpCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion'
import { cn } from '@/lib/utils'

// Scroll-reveal wrapper: fades + slides up children when they enter the viewport.
export function Reveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setVisible(true), delay)
          observer.disconnect()
        }
      },
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [delay])
  return (
    <div
      ref={ref}
      className={cn(
        'transition-all duration-700 ease-out',
        visible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0',
        className
      )}
    >
      {children}
    </div>
  )
}

const FAQS = [
  {
    q: 'How do I verify my voterIdulation number?',
    a: 'Click "Cast Your Vote", enter your voter ID (e.g. CSC/2022/001), and we check it against the official voter register. If found, you choose a channel (email, SMS, or WhatsApp) to receive a one-time verification PIN.',
  },
  {
    q: 'I didn\'t receive my OTP. What should I do?',
    a: 'Wait 60 seconds, check your spam folder (for email), then use the "Resend PIN" option. If you still don\'t receive it, open a support ticket via the chatbot (bottom-right corner) and an electoral officer will assist you.',
  },
  {
    q: 'Can someone see who I voted for?',
    a: 'No. Your vote is encrypted with AES-256-GCM before storage. The system records only an opaque hash of your voter ID — not your identity. Even the electoral committee cannot link a vote to a voter. You receive a receipt code that proves your vote was counted, but it does not reveal your choice.',
  },
  {
    q: 'What positions am I eligible to vote for?',
    a: 'University-wide positions (President, VP, Secretary General, etc.) are open to every registered student. Faculty Representative positions are voted only by students of that faculty. Departmental Senator positions are voted only by students of that department. You will see only your eligible positions on the ballot.',
  },
  {
    q: 'Why is the candidate order different from my friend\'s?',
    a: 'Candidate order is shuffled per voter (using a seeded Fisher-Yates shuffle) to remove positional bias. This ensures no candidate benefits from appearing first on the ballot. Both you and your friend see the same candidates, just in a different order.',
  },
  {
    q: 'Can I change my vote after casting it?',
    a: 'No. Once you confirm and cast your ballot, the vote is final and cannot be changed. This is enforced by a database transaction that marks you as having voted and inserts your encrypted vote atomically. Please review your selections carefully before confirming.',
  },
  {
    q: 'How are results calculated and when are they announced?',
    a: 'Results are calculated in real-time as votes are cast. The live tally is visible on the homepage. After the voting window closes, the Electoral Committee certifies the results (freezing a signed snapshot), and the final certified results are published publicly.',
  },
  {
    q: 'What is accreditation and why is it required?',
    a: 'Accreditation is a one-time verification step that confirms your identity and device for this election. It mirrors the physical accreditation done at Nigerian campus polling units (where students are cleared with indelible ink). You must complete accreditation before you can access your ballot.',
  },
]

export function FaqSection() {
  return (
    <section id="faq" className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 scroll-mt-20">
      <Reveal>
        <div className="mb-8 text-center">
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <HelpCircle className="h-3.5 w-3.5" /> Frequently Asked Questions
          </div>
          <h2 className="font-display text-3xl font-bold sm:text-4xl">Got Questions?</h2>
          <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
            Everything you need to know about voting in the election.
          </p>
        </div>
      </Reveal>
      <Reveal delay={100}>
        <Card className="votewise-card-glow">
          <CardContent className="p-2">
            <Accordion type="single" collapsible className="w-full">
              {FAQS.map((faq, i) => (
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
      </Reveal>
    </section>
  )
}
