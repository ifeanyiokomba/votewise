'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Quote, Star, TrendingUp, Users, Vote, Shield, ArrowRight, Building2, GraduationCap, Landmark } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const STORIES = [
  {
    org: 'Demo University',
    type: 'University',
    icon: GraduationCap,
    election: '2025 SUG General Elections',
    voters: 42316,
    turnout: 91.8,
    duration: '8 hours',
    quote: 'VoteWise transformed our annual elections. What used to take days of manual counting now happens securely in minutes. The transparency won over even our most skeptical members.',
    author: 'Dr. Adewale Johnson',
    role: 'Chairman, Student Electoral Committee',
    highlights: ['42,316 votes cast', '91.8% turnout', '0 critical incidents', 'p95 latency: 142ms'],
  },
  {
    org: 'Lagos Tech Meetup',
    type: 'Organization',
    icon: Building2,
    election: '2025 Board Election',
    voters: 187,
    turnout: 93.5,
    duration: '2 hours',
    quote: 'As a smaller organization, we needed something simple but trustworthy. VoteWise gave us enterprise-grade security without the enterprise-grade complexity. Perfect UX.',
    author: 'Fatima Bello',
    role: 'Secretary',
    highlights: ['187 votes cast', '93.5% turnout', '0 incidents', 'OTP delivered in <3s'],
  },
  {
    org: 'National NGO Coalition',
    type: 'NGO',
    icon: Landmark,
    election: '2025 Executive Election',
    voters: 15200,
    turnout: 78.4,
    duration: '8 hours',
    quote: 'We needed a platform that could handle 15,000+ members across Nigeria. VoteWise delivered flawlessly. The audit trail and observer transparency gave our members confidence.',
    author: 'Prof. Nnamdi Okafor',
    role: 'Election Committee Chair',
    highlights: ['15,200 eligible voters', '78.4% turnout', '0 vote loss', 'Multi-channel OTP'],
  },
]

const STATS = [
  { label: 'Organizations Served', value: '150+', icon: Building2 },
  { label: 'Votes Cast', value: '2.3M+', icon: Vote },
  { label: 'Avg. Turnout', value: '87%', icon: TrendingUp },
  { label: 'Elections Certified', value: '340+', icon: Shield },
]

export function SuccessStoriesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-12 text-center">
        <Badge className="mb-4 gap-1.5 border-2 border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-700 dark:text-emerald-300">
          <Star className="h-3 w-3" /> Success Stories
        </Badge>
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">
          Trusted by Organizations <span className="text-emerald-600 dark:text-emerald-400">Across Africa</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm text-muted-foreground sm:text-base">
          From student unions to national NGOs, organizations choose VoteWise for secure, transparent, and trusted elections.
        </p>
      </motion.div>

      {/* Stats */}
      <section className="mb-12">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {STATS.map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }}>
              <Card className="text-center">
                <CardContent className="p-5">
                  <stat.icon className="mx-auto mb-2 h-6 w-6 text-primary" />
                  <div className="font-display text-2xl font-bold">{stat.value}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{stat.label}</div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Stories */}
      <div className="space-y-8">
        {STORIES.map((story, i) => (
          <motion.div key={story.org} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.15 }}>
            <Card className="votewise-card-glow overflow-hidden">
              <CardContent className="p-0">
                <div className="grid gap-0 md:grid-cols-3">
                  {/* Left: org info */}
                  <div className="bg-gradient-to-br from-primary/10 to-accent/10 p-6">
                    <div className="mb-3 grid h-12 w-12 place-items-center rounded-xl bg-primary/15 text-primary">
                      <story.icon className="h-6 w-6" />
                    </div>
                    <Badge variant="outline" className="mb-2 text-[9px]">{story.type}</Badge>
                    <h3 className="font-display text-lg font-bold">{story.org}</h3>
                    <p className="text-xs text-muted-foreground">{story.election}</p>
                    <div className="mt-4 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Voters</span>
                        <span className="font-semibold">{story.voters.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Turnout</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">{story.turnout}%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Duration</span>
                        <span className="font-semibold">{story.duration}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: quote + highlights */}
                  <div className="col-span-2 p-6">
                    <Quote className="mb-3 h-8 w-8 text-primary/20" />
                    <blockquote className="text-sm leading-relaxed text-foreground">
                      "{story.quote}"
                    </blockquote>
                    <div className="mt-4">
                      <div className="text-sm font-semibold">{story.author}</div>
                      <div className="text-xs text-muted-foreground">{story.role}</div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {story.highlights.map((h) => (
                        <Badge key={h} variant="outline" className="gap-1 text-[10px]">
                          <Star className="h-2.5 w-2.5 text-amber-500" /> {h}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* CTA */}
      <section className="mt-12 text-center">
        <Card className="votewise-card-glow border-2 border-emerald-500/30">
          <CardContent className="p-8">
            <Users className="mx-auto mb-3 h-10 w-10 text-emerald-600 dark:text-emerald-400" />
            <h2 className="font-display text-2xl font-bold">Join the Organizations Trusting VoteWise</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Conduct your next election with the platform trusted by universities, NGOs, and companies across Africa.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link href="/?view=register">
                <Button size="lg" className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                  Register Organization <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/trust">
                <Button size="lg" variant="outline" className="gap-2">
                  <Shield className="h-4 w-4" /> Why VoteWise?
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
