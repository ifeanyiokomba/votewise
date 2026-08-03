'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Vote, ShieldCheck, Headphones, Bell, Award, Clock, CheckCircle2,
  Loader2, Users, BarChart3, Calendar, FileText, Trophy, ChevronRight,
  Megaphone, Building2, Sparkles, ArrowRight, Clock3, TrendingUp,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { cn } from '@/lib/utils'

interface PortalData {
  organization: {
    id: string
    name: string
    slug: string
    subdomain: string
    category: string
    description: string | null
    logoUrl: string | null
    primaryColour: string
    accentColour: string
    status: string
    branding: {
      logo: string | null
      primaryColor: string
      secondaryColor: string | null
      accentColor: string
      banner: string | null
      welcomeMessage: string | null
      footer: string | null
      socialLinks: any
    } | null
  }
  elections: any[]
  activeElections: any[]
  upcomingElections: any[]
  completedElections: any[]
  stats: {
    totalVoters: number
    verifiedVoters: number
    votesCast: number
    turnout: number
  }
  announcements: any[]
  committee: any[]
}

export function OrgPortal({ subdomain }: { subdomain: string }) {
  const [data, setData] = useState<PortalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/portal/${encodeURIComponent(subdomain)}`).then((r) => r.json())
      if (res.error) {
        setNotFound(true)
      } else {
        setData(res)
      }
    } catch {
      setNotFound(true)
    } finally {
      setLoading(false)
    }
  }, [subdomain])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
          </div>
          <p className="text-sm text-muted-foreground">Loading portal…</p>
        </div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-muted text-muted-foreground ring-1 ring-border">
            <Building2 className="h-8 w-8" />
          </div>
          <h1 className="font-display text-2xl font-medium tracking-[-0.025em]">Organization Not Found<span className="vw-dot">.</span></h1>
          <p className="mt-2 text-sm text-muted-foreground">
            No organization exists with subdomain <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{subdomain}</code>.
          </p>
          <Link href="/">
            <Button variant="outline" className="mt-6 gap-1.5"><Building2 className="h-4 w-4" /> Back to VoteWise</Button>
          </Link>
        </div>
      </div>
    )
  }

  if (!data) return null

  const org = data.organization
  const branding = org.branding
  const primaryColor = branding?.primaryColor || org.primaryColour || '#15803d'
  const accentColor = branding?.accentColor || org.accentColour || '#b45309'

  // Determine the portal phase: if any election is LIVE, show "during voting" mode.
  // If only upcoming, show "before voting" mode. If all completed, show "after" mode.
  const hasLive = data.activeElections.length > 0
  const hasUpcoming = data.upcomingElections.length > 0
  const allCompleted = data.activeElections.length === 0 && data.upcomingElections.length === 0 && data.completedElections.length > 0
  const portalPhase = hasLive ? 'during' : hasUpcoming ? 'before' : allCompleted ? 'after' : 'before'

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* ---- Header / Nav ---- */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            {branding?.logo || org.logoUrl ? (
              <img src={branding?.logo || org.logoUrl} alt={org.name} className="h-9 w-9 rounded-lg object-cover" />
            ) : (
              <div className="grid h-9 w-9 place-items-center rounded-lg" style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}>
                <Building2 className="h-5 w-5" />
              </div>
            )}
            <div>
              <div className="font-display text-sm font-bold leading-tight">{org.name}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Official Election Portal</div>
            </div>
          </div>
          <nav className="hidden items-center gap-1 md:flex">
            <PortalNavLink href={`/o/${subdomain}`} label="Home" />
            <PortalNavLink href={`/o/${subdomain}/candidates`} label="Candidates" />
            <PortalNavLink href={`/o/${subdomain}/timetable`} label="Timetable" />
            <PortalNavLink href={`/o/${subdomain}/results`} label="Live Results" />
            <PortalNavLink href={`/o/${subdomain}/receipt`} label="Verify Receipt" />
            <PortalNavLink href={`/o/${subdomain}/verify-eligibility`} label="Eligibility" />
            <PortalNavLink href={`/o/${subdomain}/committee`} label="Committee" />
            <PortalNavLink href={`/o/${subdomain}/support`} label="Support" />
          </nav>
          <div className="flex items-center gap-2">
            {portalPhase === 'during' && (
              <Link href={`/workspace/elections/${data.activeElections[0]?.id}/vote?org=${subdomain}`}>
                <Button size="sm" className="gap-1.5" style={{ backgroundColor: primaryColor }}>
                  <Vote className="h-3.5 w-3.5" /> Cast Vote
                </Button>
              </Link>
            )}
          </div>
        </div>
        {/* Mobile nav */}
        <div className="flex gap-1 overflow-x-auto px-4 pb-2 md:hidden">
          <PortalNavLink href={`/o/${subdomain}`} label="Home" mobile />
          <PortalNavLink href={`/o/${subdomain}/candidates`} label="Candidates" mobile />
          <PortalNavLink href={`/o/${subdomain}/timetable`} label="Timetable" mobile />
          <PortalNavLink href={`/o/${subdomain}/results`} label="Results" mobile />
          <PortalNavLink href={`/o/${subdomain}/receipt`} label="Receipt" mobile />
          <PortalNavLink href={`/o/${subdomain}/verify-eligibility`} label="Eligibility" mobile />
          <PortalNavLink href={`/o/${subdomain}/committee`} label="Committee" mobile />
          <PortalNavLink href={`/o/${subdomain}/support`} label="Support" mobile />
        </div>
      </header>

      <main className="flex-1">
        {/* ---- Hero Section (adapts to lifecycle) ---- */}
        <HeroSection org={org} branding={branding} phase={portalPhase} primaryColor={primaryColor} accentColor={accentColor} activeElections={data.activeElections} subdomain={subdomain} />

        {/* ---- Election Countdown (if upcoming) ---- */}
        {portalPhase === 'before' && data.upcomingElections[0]?.countdown && (
          <CountdownSection countdown={data.upcomingElections[0].countdown} electionName={data.upcomingElections[0].name} />
        )}

        {/* ---- Statistics ---- */}
        <StatsSection stats={data.stats} primaryColor={primaryColor} />

        {/* ---- Active Elections (during voting) ---- */}
        {portalPhase === 'during' && data.activeElections.length > 0 && (
          <ActiveElectionsSection elections={data.activeElections} subdomain={subdomain} primaryColor={primaryColor} />
        )}

        {/* ---- Upcoming Elections (before voting) ---- */}
        {portalPhase === 'before' && data.upcomingElections.length > 0 && (
          <UpcomingElectionsSection elections={data.upcomingElections} subdomain={subdomain} />
        )}

        {/* ---- Completed Elections (after voting) ---- */}
        {data.completedElections.length > 0 && (
          <CompletedElectionsSection elections={data.completedElections} subdomain={subdomain} />
        )}

        {/* ---- Announcements ---- */}
        {data.announcements.length > 0 && (
          <AnnouncementsSection announcements={data.announcements} />
        )}

        {/* ---- Quick Actions ---- */}
        <QuickActionsSection subdomain={subdomain} phase={portalPhase} primaryColor={primaryColor} />

        {/* ---- Committee Preview ---- */}
        {data.committee.length > 0 && (
          <CommitteePreviewSection committee={data.committee} subdomain={subdomain} />
        )}
      </main>

      {/* ---- Footer ---- */}
      <footer className="border-t border-border/60 bg-muted/30 py-6">
        <div className="mx-auto max-w-6xl px-4 text-center text-xs text-muted-foreground sm:px-6">
          <p className="font-medium">{org.name} — Official Election Portal</p>
          <p className="mt-1">
            {branding?.footer || `Powered by VoteWise — Africa's Most Trusted Election Platform`}
          </p>
          <p className="mt-1">
            <Link href="/" className="hover:text-foreground">votewise.com.ng</Link>
            {' · '}
            <Link href="/status" className="hover:text-foreground">Platform Status</Link>
            {' · '}
            <Link href={`/o/${subdomain}/support`} className="hover:text-foreground">Support</Link>
          </p>
        </div>
      </footer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PortalNavLink({ href, label, mobile }: { href: string; label: string; mobile?: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        'shrink-0 rounded-md text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground',
        mobile ? 'px-3 py-1.5' : 'px-3 py-1.5',
      )}
    >
      {label}
    </Link>
  )
}

function HeroSection({ org, branding, phase, primaryColor, accentColor, activeElections, subdomain }: any) {
  const heroText = phase === 'during'
    ? 'Cast Your Vote'
    : phase === 'after'
      ? 'Election Results'
      : 'Vote Securely'

  const heroSubtext = phase === 'during'
    ? `${activeElections[0]?.name || 'Election'} is now live. Your voice matters.`
    : phase === 'after'
      ? 'The election has concluded. View certified results and download reports.'
      : branding?.welcomeMessage || `${org.name} — Official Online Election Portal`

  return (
    <section className="votewise-hero-bg relative overflow-hidden border-b border-border">
      {/* Background gradient using org colors */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${accentColor} 100%)` }}
      />
      {branding?.banner && (
        <img src={branding.banner} alt="" className="absolute inset-0 h-full w-full object-cover opacity-15" />
      )}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="votewise-orb absolute -left-20 top-10 h-72 w-72 rounded-full blur-3xl" style={{ backgroundColor: `${primaryColor}15` }} />
        <div className="votewise-orb votewise-orb-delay absolute -right-20 top-20 h-80 w-80 rounded-full blur-3xl" style={{ backgroundColor: `${accentColor}15` }} />
      </div>

      <div className="relative mx-auto max-w-[1152px] px-4 py-16 text-center sm:px-6 sm:py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs font-medium backdrop-blur">
            <ShieldCheck className="h-3.5 w-3.5" style={{ color: primaryColor }} />
            Secure · Transparent · Trusted
          </div>

          {/* Title */}
          <h1 className="mt-5 font-display text-3xl font-medium tracking-[-0.03em] sm:text-5xl">
            {heroText}<span className="vw-dot">.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-muted-foreground sm:text-base">
            {heroSubtext}
          </p>

          {/* CTA buttons based on phase */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {phase === 'during' && (
              <Link href={`/workspace/elections/${activeElections[0]?.id}/vote?org=${subdomain}`}>
                <Button size="lg" className="gap-2" style={{ backgroundColor: primaryColor }}>
                  <Vote className="h-4 w-4" /> Cast Your Vote
                </Button>
              </Link>
            )}
            {phase === 'before' && (
              <Link href={`/o/${subdomain}/candidates`}>
                <Button size="lg" className="gap-2" style={{ backgroundColor: primaryColor }}>
                  <Trophy className="h-4 w-4" /> View Candidates
                </Button>
              </Link>
            )}
            {phase === 'after' && (
              <Link href={`/o/${subdomain}/results`}>
                <Button size="lg" className="gap-2" style={{ backgroundColor: primaryColor }}>
                  <BarChart3 className="h-4 w-4" /> View Results
                </Button>
              </Link>
            )}
            <Link href={`/o/${subdomain}/verify-eligibility`}>
              <Button size="lg" variant="outline" className="gap-2">
                <CheckCircle2 className="h-4 w-4" /> Verify Eligibility
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

function CountdownSection({ countdown, electionName }: { countdown: any; electionName: string }) {
  return (
    <section className="border-b border-border bg-muted/20 py-10">
      <div className="mx-auto max-w-[1152px] px-4 text-center sm:px-6">
        <div className="vw-eyebrow mb-4 justify-center">
          <Clock className="h-3.5 w-3.5" />
          {electionName} Starts In
        </div>
        <div className="flex items-center justify-center gap-4 sm:gap-8">
          {[
            { label: 'Days', value: countdown.days },
            { label: 'Hours', value: countdown.hours },
            { label: 'Minutes', value: countdown.minutes },
            { label: 'Seconds', value: countdown.seconds },
          ].map((unit) => (
            <div key={unit.label} className="text-center">
              <div className="vw-stat text-4xl tabular-nums sm:text-6xl" style={{ color: 'var(--foreground)' }}>
                {String(unit.value).padStart(2, '0')}
              </div>
              <div className="mt-1.5 text-[10px] uppercase tracking-wider text-muted-foreground sm:text-xs">
                {unit.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function StatsSection({ stats, primaryColor }: { stats: any; primaryColor: string }) {
  return (
    <section className="border-b border-border/60 py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard icon={Users} label="Registered Voters" value={stats.totalVoters.toLocaleString()} color={primaryColor} />
          <StatCard icon={CheckCircle2} label="Verified" value={stats.verifiedVoters.toLocaleString()} color={primaryColor} />
          <StatCard icon={Vote} label="Votes Cast" value={stats.votesCast.toLocaleString()} color={primaryColor} />
          <StatCard icon={TrendingUp} label="Turnout" value={`${stats.turnout}%`} color={primaryColor} />
        </div>
      </div>
    </section>
  )
}

function StatCard({ icon: Icon, label, value, color }: any) {
  return (
    <Card className="vw-lift text-center">
      <CardContent className="p-4">
        <div className="mx-auto mb-1.5 grid h-9 w-9 place-items-center rounded-lg ring-1" style={{ backgroundColor: `${color}12`, color, borderColor: `${color}30` }}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="vw-stat text-xl tabular-nums sm:text-2xl">{value}</div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  )
}

function ActiveElectionsSection({ elections, subdomain, primaryColor }: any) {
  return (
    <section className="border-b border-border/60 py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="mb-4 font-display text-xl font-bold">Active Elections</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {elections.map((e: any, i: number) => (
            <motion.div key={e.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="votewise-card-glow h-full">
                <CardContent className="flex flex-col gap-3 p-5">
                  <div className="flex items-center justify-between">
                    <Badge className="gap-1.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 votewise-live-dot" />
                      LIVE
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">{e.category || 'Election'}</span>
                  </div>
                  <div>
                    <h3 className="font-display text-base font-bold">{e.name}</h3>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{e.description || 'Vote now — your voice matters.'}</p>
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Ends {new Date(e.endTime).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}
                  </div>
                  <Link href={`/workspace/elections/${e.id}/vote?org=${subdomain}`} className="mt-auto">
                    <Button className="w-full gap-2" style={{ backgroundColor: primaryColor }}>
                      <Vote className="h-3.5 w-3.5" /> Vote Now
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

function UpcomingElectionsSection({ elections, subdomain }: any) {
  return (
    <section className="border-b border-border/60 py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="mb-4 font-display text-xl font-bold">Upcoming Elections</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {elections.map((e: any) => (
            <Card key={e.id}>
              <CardContent className="flex flex-col gap-3 p-5">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="gap-1.5">
                    <Clock3 className="h-3 w-3" /> Coming Soon
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">{e.category || 'Election'}</span>
                </div>
                <div>
                  <h3 className="font-display text-base font-bold">{e.name}</h3>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{e.description || 'Election details coming soon.'}</p>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Starts {new Date(e.startTime).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
                <Link href={`/o/${subdomain}/candidates`} className="mt-auto">
                  <Button variant="outline" className="w-full gap-2 text-xs">
                    <Trophy className="h-3.5 w-3.5" /> View Candidates
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

function CompletedElectionsSection({ elections, subdomain }: any) {
  return (
    <section className="border-b border-border/60 py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="mb-4 font-display text-xl font-bold">Past Elections</h2>
        <div className="space-y-3">
          {elections.slice(0, 5).map((e: any) => (
            <Card key={e.id}>
              <CardContent className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-bold">{e.name}</h3>
                    {e.status === 'CERTIFIED' && (
                      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                        <Award className="mr-1 h-3 w-3" /> Certified
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Completed {new Date(e.endTime).toLocaleDateString('en-NG', { dateStyle: 'medium' })}
                  </p>
                </div>
                <Link href={`/o/${subdomain}/results?election=${e.id}`}>
                  <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
                    View Results <ChevronRight className="h-3 w-3" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

function AnnouncementsSection({ announcements }: { announcements: any[] }) {
  return (
    <section className="border-b border-border/60 py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-bold">
          <Megaphone className="h-5 w-5 text-primary" /> Announcements
        </h2>
        <div className="space-y-3">
          {announcements.map((a) => (
            <Alert key={a.id}>
              <Megaphone className="h-4 w-4" />
              <AlertTitle className="text-sm">{a.title}</AlertTitle>
              <AlertDescription className="text-xs">
                {a.message}
                <span className="mt-1 block text-[10px] text-muted-foreground">
                  {new Date(a.createdAt).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}
                </span>
              </AlertDescription>
            </Alert>
          ))}
        </div>
      </div>
    </section>
  )
}

function QuickActionsSection({ subdomain, phase, primaryColor }: any) {
  const actions = [
    { icon: Vote, label: 'Cast Vote', href: phase === 'during' ? `/workspace/elections/demo-election/vote?org=${subdomain}` : `/o/${subdomain}/verify-eligibility`, desc: phase === 'during' ? 'Vote in the active election' : 'Check if you can vote' },
    { icon: CheckCircle2, label: 'Verify Eligibility', href: `/o/${subdomain}/verify-eligibility`, desc: 'Check your voter status' },
    { icon: Trophy, label: 'Candidates', href: `/o/${subdomain}/candidates`, desc: 'View candidate profiles' },
    { icon: Calendar, label: 'Timetable', href: `/o/${subdomain}/timetable`, desc: 'Election schedule' },
    { icon: BarChart3, label: 'Live Results', href: `/o/${subdomain}/results`, desc: 'Real-time turnout & results' },
    { icon: FileText, label: 'Verify Receipt', href: `/o/${subdomain}/receipt`, desc: 'Confirm your vote was recorded' },
    { icon: ShieldCheck, label: 'Committee', href: `/o/${subdomain}/committee`, desc: 'Meet the electoral committee' },
    { icon: Headphones, label: 'Support', href: `/o/${subdomain}/support`, desc: 'Get help' },
  ]

  return (
    <section className="border-b border-border/60 py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="mb-4 font-display text-xl font-bold">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {actions.map((a) => (
            <Link key={a.label} href={a.href}>
              <Card className="h-full transition-all hover:shadow-md">
                <CardContent className="flex flex-col items-center gap-2 p-4 text-center">
                  <div className="grid h-10 w-10 place-items-center rounded-lg" style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}>
                    <a.icon className="h-5 w-5" />
                  </div>
                  <div className="text-xs font-semibold">{a.label}</div>
                  <div className="text-[10px] text-muted-foreground">{a.desc}</div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

function CommitteePreviewSection({ committee, subdomain }: any) {
  return (
    <section className="py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">Electoral Committee</h2>
          <Link href={`/o/${subdomain}/committee`}>
            <Button variant="ghost" size="sm" className="gap-1 text-xs">
              View All <ChevronRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {committee.slice(0, 4).map((m: any) => (
            <Card key={m.id}>
              <CardContent className="flex flex-col items-center gap-2 p-4 text-center">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
                  <Users className="h-5 w-5" />
                </div>
                <div className="text-xs font-semibold">{m.name}</div>
                <div className="text-[10px] text-muted-foreground">{m.role === 'SUPER_ADMIN' ? 'Chairman' : 'Committee Member'}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
