import { NextRequest } from 'next/server'
import { json } from '@/lib/election'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/portal/[subdomain] — Public organization election portal data.
// Returns: org info + branding + active elections + stats + countdown +
// candidates + timetable + announcements + committee.
//
// This drives the dynamic org homepage at /o/[subdomain].
// No auth — anyone can view the public portal.
export async function GET(req: NextRequest, { params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = await params

  const org = await db.organization.findUnique({
    where: { subdomain },
    select: {
      id: true, name: true, slug: true, subdomain: true, category: true,
      description: true, logoUrl: true, primaryColour: true, accentColour: true,
      status: true, plan: true, country: true, state: true,
    },
  })

  if (!org) {
    return json({ error: 'Organization not found' }, 404)
  }

  // Fetch branding, elections, stats, announcements in parallel
  const [brand, elections, announcements, committee, stats] = await Promise.all([
    db.organizationBrand.findUnique({ where: { organizationId: org.id } }),
    db.electionSession.findMany({
      where: { organizationId: org.id, status: { in: ['SCHEDULED', 'LIVE', 'UPCOMING', 'COMPLETED', 'CERTIFIED'] } },
      select: {
        id: true, name: true, status: true, startTime: true, endTime: true,
        description: true, category: true, electionType: true, visibility: true,
        settings: true,
      },
      orderBy: { startTime: 'desc' },
      take: 10,
    }),
    db.announcement.findMany({
      where: { organizationId: org.id },
      select: { id: true, title: true, message: true, type: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }).catch(() => []),
    db.organizationMember.findMany({
      where: { organizationId: org.id, role: { in: ['SUPER_ADMIN', 'ELECTORAL_COMMITTEE'] } },
      select: { id: true, name: true, role: true, email: true },
      take: 20,
    }).catch(() => []),
    (async () => {
      const [totalVoters, verifiedVoters, votesCast] = await Promise.all([
        db.voter.count({ where: { organizationId: org.id } }).catch(() => 0),
        db.voter.count({ where: { organizationId: org.id, verified: true } }).catch(() => 0),
        db.voteRecord.count({ where: { isSimulation: false } }).catch(() => 0),
      ])
      const turnout = totalVoters > 0 ? Math.round((votesCast / totalVoters) * 100) : 0
      return { totalVoters, verifiedVoters, votesCast, turnout }
    })(),
  ])

  // Parse election settings for results visibility
  const enrichedElections = elections.map((e) => {
    const settings = e.settings ? JSON.parse(e.settings) : {}
    const now = new Date()
    let phase: 'upcoming' | 'live' | 'completed' = 'upcoming'
    if (e.status === 'LIVE' || (now >= e.startTime && now < e.endTime && e.status !== 'CERTIFIED' && e.status !== 'COMPLETED')) {
      phase = 'live'
    } else if (e.status === 'COMPLETED' || e.status === 'CERTIFIED' || now >= e.endTime) {
      phase = 'completed'
    }

    // Countdown for upcoming elections
    let countdown = null
    if (phase === 'upcoming') {
      const diff = e.startTime.getTime() - now.getTime()
      if (diff > 0) {
        countdown = {
          days: Math.floor(diff / (1000 * 60 * 60 * 24)),
          hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((diff % (1000 * 60)) / 1000),
        }
      }
    }

    return {
      id: e.id,
      name: e.name,
      status: e.status,
      phase,
      startTime: e.startTime.toISOString(),
      endTime: e.endTime.toISOString(),
      description: e.description,
      category: e.category,
      electionType: e.electionType,
      resultsVisibility: settings.showLiveResults ? 'public' : settings.showTurnout ? 'turnout-only' : 'hidden',
      countdown,
    }
  })

  return json({
    organization: {
      ...org,
      branding: brand ? {
        logo: brand.logo,
        darkModeLogo: brand.darkModeLogo,
        primaryColor: brand.primaryColor,
        secondaryColor: brand.secondaryColor,
        accentColor: brand.accentColor,
        font: brand.font,
        banner: brand.banner,
        background: brand.background,
        welcomeMessage: brand.welcomeMessage,
        footer: brand.footer,
        socialLinks: brand.socialLinks ? JSON.parse(brand.socialLinks) : null,
      } : null,
    },
    elections: enrichedElections,
    activeElections: enrichedElections.filter((e) => e.phase === 'live'),
    upcomingElections: enrichedElections.filter((e) => e.phase === 'upcoming'),
    completedElections: enrichedElections.filter((e) => e.phase === 'completed'),
    stats,
    announcements,
    committee,
  })
}
