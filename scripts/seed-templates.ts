// VoteWise — Election Templates Seed Script.
// Seeds 4 built-in election templates (organisationId = "built-in", isBuiltIn = true)
// that every organization can apply when creating a new election.
// Run with: bun run scripts/seed-templates.ts

import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const BUILT_IN_ORG_ID = 'built-in'

interface SeedPosition {
  title: string
  description: string
  scope: string
  maximumVotes: number
  candidates?: Array<{ fullName: string; slogan?: string; manifesto?: string }>
}

interface SeedTemplate {
  name: string
  description: string
  category: string
  electionType: string
  votingMethod: string
  positions: SeedPosition[]
}

const TEMPLATES: SeedTemplate[] = [
  {
    name: 'University SUG Election',
    description:
      'A standard Students\u2019 Union Government (SUG) executive election template for any Nigerian university, polytechnic, or college. Five officer positions with placeholder candidates ready to be replaced.',
    category: 'Student Union',
    electionType: 'General',
    votingMethod: 'Single Choice',
    positions: [
      {
        title: 'President',
        description: 'Chief executive of the Students\u2019 Union Government. Presides over all union meetings and represents the student body to the school administration.',
        scope: 'ORGANIZATION',
        maximumVotes: 1,
        candidates: [
          { fullName: 'Candidate A', slogan: 'Leadership with Integrity', manifesto: 'I will champion transparent governance and student welfare.' },
          { fullName: 'Candidate B', slogan: 'A Voice for Every Student', manifesto: 'My mission is to bridge the gap between the union and the students.' },
        ],
      },
      {
        title: 'Vice President',
        description: 'Deputises the President and chairs the welfare committee.',
        scope: 'ORGANIZATION',
        maximumVotes: 1,
        candidates: [
          { fullName: 'Candidate A', slogan: 'Excellence in Action', manifesto: 'I will support the President in driving student-centered policies.' },
          { fullName: 'Candidate B', slogan: 'Together We Rise', manifesto: 'Strengthening faculty representation across all departments.' },
        ],
      },
      {
        title: 'Secretary General',
        description: 'Custodian of all union records and official correspondence.',
        scope: 'ORGANIZATION',
        maximumVotes: 1,
        candidates: [
          { fullName: 'Candidate A', slogan: 'Documented Excellence', manifesto: 'Digitising all union records and publishing minutes within 48 hours.' },
        ],
      },
      {
        title: 'Treasurer',
        description: 'Manages union finances and publishes quarterly reports.',
        scope: 'ORGANIZATION',
        maximumVotes: 1,
        candidates: [
          { fullName: 'Candidate A', slogan: 'Every Kobo Counts', manifesto: 'Open-book accounting — union finances auditable by any student.' },
        ],
      },
      {
        title: 'PRO (Public Relations Officer)',
        description: 'Manages all official communications between the union and the student body.',
        scope: 'ORGANIZATION',
        maximumVotes: 1,
        candidates: [
          { fullName: 'Candidate A', slogan: 'Your Voice, Amplified', manifesto: 'Building transparent communication channels for every student.' },
        ],
      },
    ],
  },
  {
    name: 'Corporate Board Election',
    description:
      'A board-of-directors election template for companies, cooperatives, and corporate entities. Four officer positions designed for executive governance.',
    category: 'Executive',
    electionType: 'General',
    votingMethod: 'Single Choice',
    positions: [
      {
        title: 'Chairman',
        description: 'Presides over all board meetings and sets the strategic agenda.',
        scope: 'ORGANIZATION',
        maximumVotes: 1,
        candidates: [
          { fullName: 'Candidate A', slogan: 'Strategic Vision, Steady Hands', manifesto: 'Driving long-term value through sound governance.' },
          { fullName: 'Candidate B', slogan: 'Governance with Purpose', manifesto: 'Strengthening board oversight and stakeholder trust.' },
        ],
      },
      {
        title: 'Vice Chairman',
        description: 'Deputises the Chairman and oversees committee operations.',
        scope: 'ORGANIZATION',
        maximumVotes: 1,
        candidates: [
          { fullName: 'Candidate A', slogan: 'Committed Leadership', manifesto: 'Supporting the Chairman with focused committee leadership.' },
        ],
      },
      {
        title: 'Secretary',
        description: 'Maintains board minutes, resolutions, and statutory records.',
        scope: 'ORGANIZATION',
        maximumVotes: 1,
        candidates: [
          { fullName: 'Candidate A', slogan: 'Records You Can Trust', manifesto: 'Professional, compliant, and timely record-keeping.' },
        ],
      },
      {
        title: 'Treasurer',
        description: 'Custodian of the board\u2019s finances and audit lead.',
        scope: 'ORGANIZATION',
        maximumVotes: 1,
        candidates: [
          { fullName: 'Candidate A', slogan: 'Fiscal Discipline', manifesto: 'Prudent financial management with full transparency.' },
        ],
      },
    ],
  },
  {
    name: 'Association Executive Election',
    description:
      'A general-purpose executive election template for associations, professional bodies, clubs, and NGOs. Five officer positions covering the standard executive structure.',
    category: 'Executive',
    electionType: 'General',
    votingMethod: 'Single Choice',
    positions: [
      {
        title: 'President',
        description: 'Chief executive officer of the association.',
        scope: 'ORGANIZATION',
        maximumVotes: 1,
        candidates: [
          { fullName: 'Candidate A', slogan: 'Service Above Self', manifesto: 'Building a stronger association for every member.' },
          { fullName: 'Candidate B', slogan: 'Action, Not Promises', manifesto: 'Delivering tangible value to members in the first 100 days.' },
        ],
      },
      {
        title: 'Vice President',
        description: 'Deputises the President and oversees membership engagement.',
        scope: 'ORGANIZATION',
        maximumVotes: 1,
        candidates: [
          { fullName: 'Candidate A', slogan: 'Members First', manifesto: 'Re-engaging dormant members and growing the association.' },
        ],
      },
      {
        title: 'Secretary',
        description: 'Maintains association records, minutes, and correspondence.',
        scope: 'ORGANIZATION',
        maximumVotes: 1,
        candidates: [
          { fullName: 'Candidate A', slogan: 'Clear Records, Clear Future', manifesto: 'Efficient administration with full transparency.' },
        ],
      },
      {
        title: 'Financial Secretary',
        description: 'Manages dues, collections, and the association\u2019s financial books.',
        scope: 'ORGANIZATION',
        maximumVotes: 1,
        candidates: [
          { fullName: 'Candidate A', slogan: 'Accountable to the Last Kobo', manifesto: 'Clean books, timely dues, and clear reporting.' },
        ],
      },
      {
        title: 'PRO (Public Relations Officer)',
        description: 'Handles the association\u2019s public communications and events.',
        scope: 'ORGANIZATION',
        maximumVotes: 1,
        candidates: [
          { fullName: 'Candidate A', slogan: 'Telling Our Story', manifesto: 'Raising the association\u2019s public profile.' },
        ],
      },
    ],
  },
  {
    name: 'Church Committee Election',
    description:
      'A church committee election template for parishes, fellowships, and church departments. Five officer positions covering standard church governance.',
    category: 'Committee',
    electionType: 'General',
    votingMethod: 'Single Choice',
    positions: [
      {
        title: 'Chairman',
        description: 'Leads the committee and presides over all meetings.',
        scope: 'ORGANIZATION',
        maximumVotes: 1,
        candidates: [
          { fullName: 'Candidate A', slogan: 'Servant Leadership', manifesto: 'Serving with humility, integrity, and vision.' },
          { fullName: 'Candidate B', slogan: 'Faithful Stewardship', manifesto: 'Building a committee that honors God and serves members.' },
        ],
      },
      {
        title: 'Vice Chairman',
        description: 'Assists the Chairman and oversees committee operations.',
        scope: 'ORGANIZATION',
        maximumVotes: 1,
        candidates: [
          { fullName: 'Candidate A', slogan: 'Steady Support', manifesto: 'Supporting the Chairman and empowering every committee lead.' },
        ],
      },
      {
        title: 'Secretary',
        description: 'Records minutes, manages correspondence, and maintains the committee register.',
        scope: 'ORGANIZATION',
        maximumVotes: 1,
        candidates: [
          { fullName: 'Candidate A', slogan: 'Orderly Records', manifesto: 'Keeping the committee\u2019s records accurate and accessible.' },
        ],
      },
      {
        title: 'Treasurer',
        description: 'Manages the committee\u2019s finances, offerings, and disbursements.',
        scope: 'ORGANIZATION',
        maximumVotes: 1,
        candidates: [
          { fullName: 'Candidate A', slogan: 'Faithful Accounting', manifesto: 'Transparent handling of every offering and disbursement.' },
        ],
      },
      {
        title: 'Auditor',
        description: 'Independently reviews the committee\u2019s financial records each quarter.',
        scope: 'ORGANIZATION',
        maximumVotes: 1,
        candidates: [
          { fullName: 'Candidate A', slogan: 'Independent Oversight', manifesto: 'Quarterly reviews with full independence and integrity.' },
        ],
      },
    ],
  },
]

async function main() {
  console.log('Seeding built-in election templates\u2026')
  let created = 0
  let updated = 0

  for (const t of TEMPLATES) {
    // Look up by name + organizationId = built-in (unique-by-name within built-in pool).
    const existing = await db.electionTemplate.findFirst({
      where: { organizationId: BUILT_IN_ORG_ID, name: t.name },
      select: { id: true },
    })

    const templateData = JSON.stringify({
      positions: t.positions.map((p) => ({
        title: p.title,
        description: p.description,
        scope: p.scope,
        maximumVotes: p.maximumVotes,
        candidates: (p.candidates || []).map((c) => ({
          fullName: c.fullName,
          slogan: c.slogan || null,
          manifesto: c.manifesto || null,
        })),
      })),
    })

    const settings = JSON.stringify({
      requireAccreditation: true,
      requireOTVP: false,
      showLiveTurnout: true,
      showLiveResults: false,
      hideResultsUntilEnd: true,
      allowResultDownload: true,
      notaEnabled: true,
    })

    if (existing) {
      await db.electionTemplate.update({
        where: { id: existing.id },
        data: {
          description: t.description,
          category: t.category,
          electionType: t.electionType,
          votingMethod: t.votingMethod,
          visibility: 'PRIVATE',
          settings,
          templateData,
          isBuiltIn: true,
        },
      })
      updated++
      console.log(`  \u2713 Updated: ${t.name} (${t.positions.length} positions)`)
    } else {
      await db.electionTemplate.create({
        data: {
          organizationId: BUILT_IN_ORG_ID,
          name: t.name,
          description: t.description,
          category: t.category,
          electionType: t.electionType,
          votingMethod: t.votingMethod,
          visibility: 'PRIVATE',
          settings,
          templateData,
          isBuiltIn: true,
          createdBy: null,
        },
      })
      created++
      console.log(`  + Created: ${t.name} (${t.positions.length} positions)`)
    }
  }

  console.log(`\n\u2705 Done. ${created} created, ${updated} updated.`)
  const total = await db.electionTemplate.count({ where: { organizationId: BUILT_IN_ORG_ID } })
  console.log(`   Built-in templates in DB: ${total}`)
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1) })
