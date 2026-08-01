// VoteWise — Chapter 10 SVE Seed Script.
// Creates a LIVE demo election in the Demo University org with positions,
// candidates (using existing /public/candidates photos), and voters.
// Run with: bun run scripts/seed-sve.ts

import { PrismaClient } from '@prisma/client'
import { randomBytes, scryptSync } from 'crypto'

const db = new PrismaClient()

function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64, { N: 2 ** 14, r: 8, p: 1 }).toString('hex')
  return `scrypt:${salt}:${hash}`
}

const CANDIDATE_PHOTOS = ['/candidates/c1.jpg', '/candidates/c2.jpg', '/candidates/c3.jpg', '/candidates/c4.jpg', '/candidates/c5.jpg', '/candidates/c6.jpg', '/candidates/c7.jpg', '/candidates/c8.jpg', '/candidates/c9.jpg']

const POSITIONS = [
  { title: 'President', slug: 'president-sve', maxVotes: 1, order: 1, scope: 'ORGANIZATION' },
  { title: 'Vice President', slug: 'vice-president-sve', maxVotes: 1, order: 2, scope: 'ORGANIZATION' },
  { title: 'Secretary General', slug: 'secretary-general-sve', maxVotes: 1, order: 3, scope: 'ORGANIZATION' },
  { title: 'Treasurer', slug: 'treasurer-sve', maxVotes: 1, order: 4, scope: 'ORGANIZATION' },
]

const CANDIDATES = [
  // President
  { positionSlug: 'president-sve', fullName: 'Adebayo Johnson', slug: 'adebayo-johnson-sve', slogan: 'Progress Through Unity', manifesto: 'I will champion transparent governance, fight for student welfare, and ensure every voice is heard. Together we build a stronger union.', photo: 0 },
  { positionSlug: 'president-sve', fullName: 'Chioma Okafor', slug: 'chioma-okafor-sve', slogan: 'Voice of the Students', manifesto: 'My mission is to bridge the gap between the union and the students. I will implement digital feedback systems and hold regular town halls.', photo: 5 },
  { positionSlug: 'president-sve', fullName: 'Ibrahim Musa', slug: 'ibrahim-musa-sve', slogan: 'Integrity First', manifesto: 'I promise accountable leadership. Every kobo of union dues will be tracked and published quarterly.', photo: 2 },
  // Vice President
  { positionSlug: 'vice-president-sve', fullName: 'Fatima Bello', slug: 'fatima-bello-sve', slogan: 'Excellence in Action', manifesto: 'I will support the President in driving student-centered policies and lead the welfare committee with compassion.', photo: 6 },
  { positionSlug: 'vice-president-sve', fullName: 'Emeka Nwosu', slug: 'emeka-nwosu-sve', slogan: 'Together We Rise', manifesto: 'I will strengthen faculty representation and ensure no department is left behind in union decisions.', photo: 1 },
  // Secretary
  { positionSlug: 'secretary-general-sve', fullName: 'Zainab Ibrahim', slug: 'zainab-ibrahim-sve', slogan: 'Documented Excellence', manifesto: 'I will digitize all union records, publish meeting minutes within 48 hours, and maintain transparent communication.', photo: 8 },
  { positionSlug: 'secretary-general-sve', fullName: 'David Olatunji', slug: 'david-olatunji-sve', slogan: 'Clear Records, Clear Future', manifesto: 'My priority is efficient administration. I will ensure timely correspondence and accurate record-keeping.', photo: 4 },
  // Treasurer
  { positionSlug: 'treasurer-sve', fullName: 'Grace Afolayan', slug: 'grace-afolayan-sve', slogan: 'Every Kobo Counts', manifesto: 'I will implement open-book accounting. Union finances will be auditable by any student at any time.', photo: 3 },
  { positionSlug: 'treasurer-sve', fullName: 'Yusuf Abdullahi', slug: 'yusuf-abdullahi-sve', slogan: 'Fiscal Responsibility', manifesto: 'I will ensure prudent financial management and publish quarterly budget reports.', photo: 7 },
]

const VOTER_NAMES = [
  'Aisha Mohammed', 'Bola Adeyemi', 'Chukwuemeka Obi', 'Doris Eze', 'Emmanuel Bassey',
  'Folake Ojo', 'Gidado Sani', 'Hauwa Lawal', 'Ifeanyi Okomba', 'Joy Egbai',
  'Kunle Adebisi', 'Lola Martins', 'Musa Bello', 'Ngozi Umeh', 'Oluwaseun Fashanu',
]

async function main() {
  const org = await db.organization.findFirst({ where: { subdomain: 'demo' } })
  if (!org) { console.error('Demo org not found. Run the organization seed first.'); process.exit(1) }
  console.log(`Using org: ${org.name} (${org.id})`)

  // Check for an existing faculty + department (needed for Voter model legacy fields).
  let faculty = await db.faculty.findFirst()
  if (!faculty) {
    faculty = await db.faculty.create({ data: { name: 'Faculty of Engineering', code: 'ENG', tenantId: null } })
  }
  let department = await db.department.findFirst()
  if (!department) {
    department = await db.department.create({ data: { name: 'Electrical Engineering', code: 'ELE', facultyId: faculty.id } })
  }

  // Create a LIVE election.
  const now = new Date()
  const start = new Date(now.getTime() - 60 * 1000) // opened 1 min ago
  const end = new Date(now.getTime() + 6 * 60 * 60 * 1000) // closes in 6 hours

  const election = await db.electionSession.upsert({
    where: { id: 'sve-demo' },
    create: {
      id: 'sve-demo',
      organizationId: org.id,
      name: 'SUG General Elections 2025 (SVE Demo)',
      description: 'A live demonstration of the VoteWise Secure Voting Engine. All votes are encrypted, auditable, and anonymous.',
      category: 'Student Union',
      electionType: 'General',
      votingMethod: 'Single Choice',
      visibility: 'Public',
      university: org.name,
      academicSession: '2024/2025',
      startTime: start,
      endTime: end,
      status: 'LIVE',
      settings: JSON.stringify({
        requireAccreditation: false, // disabled for demo ease
        requireOTVP: false, // disabled for demo ease
        showLiveTurnout: true,
        showLiveResults: true,
        hideResultsUntilEnd: false,
        allowResultDownload: true,
        notaEnabled: true,
      }),
    },
    update: {
      organizationId: org.id,
      startTime: start,
      endTime: end,
      status: 'LIVE',
      settings: JSON.stringify({
        requireAccreditation: false,
        requireOTVP: false,
        showLiveTurnout: true,
        showLiveResults: true,
        hideResultsUntilEnd: false,
        allowResultDownload: true,
        notaEnabled: true,
      }),
    },
  })
  console.log(`Election: ${election.name} (${election.id}) — status: ${election.status}`)

  // Create positions.
  for (const pos of POSITIONS) {
    await db.position.upsert({
      where: { slug: pos.slug },
      create: {
        slug: pos.slug,
        organizationId: org.id,
        electionSessionId: election.id,
        title: pos.title,
        scope: pos.scope,
        maximumVotes: pos.maxVotes,
        displayOrder: pos.order,
        order: pos.order,
      },
      update: {
        organizationId: org.id,
        electionSessionId: election.id,
        title: pos.title,
        scope: pos.scope,
        maximumVotes: pos.maxVotes,
        displayOrder: pos.order,
      },
    })
    console.log(`  Position: ${pos.title}`)
  }

  // Create candidates.
  for (const c of CANDIDATES) {
    const pos = await db.position.findUnique({ where: { slug: c.positionSlug } })
    if (!pos) continue
    await db.candidate.upsert({
      where: { slug: c.slug },
      create: {
        slug: c.slug,
        organizationId: org.id,
        electionSessionId: election.id,
        positionId: pos.id,
        fullName: c.fullName,
        slogan: c.slogan,
        manifesto: c.manifesto,
        photoUrl: CANDIDATE_PHOTOS[c.photo],
        status: 'APPROVED',
        screeningStatus: 'APPROVED',
        displayOrder: c.photo,
      },
      update: {
        organizationId: org.id,
        electionSessionId: election.id,
        positionId: pos.id,
        fullName: c.fullName,
        slogan: c.slogan,
        manifesto: c.manifesto,
        photoUrl: CANDIDATE_PHOTOS[c.photo],
        status: 'APPROVED',
        screeningStatus: 'APPROVED',
      },
    })
    console.log(`    Candidate: ${c.fullName} (${c.positionSlug})`)
  }

  // Create voters.
  let voterCount = 0
  for (let i = 0; i < VOTER_NAMES.length; i++) {
    const name = VOTER_NAMES[i]
    const matric = `VOT/SVE/${String(i + 1).padStart(3, '0')}`
    const email = `voter${i + 1}@demo.votewise.ng`
    await db.voter.upsert({
      where: { matric },
      create: {
        matric,
        organizationId: org.id,
        electionSessionId: election.id,
        fullName: name,
        firstName: name.split(' ')[0],
        lastName: name.split(' ').slice(1).join(' '),
        email,
        institutionEmail: email,
        phone: `+23480${String(10000000 + i)}`,
        facultyId: faculty.id,
        departmentId: department.id,
        level: '300',
        status: 'ACTIVE',
        verificationStatus: 'VERIFIED',
        emailVerified: true,
        flagged: false,
        hasVoted: false,
      },
      update: {
        organizationId: org.id,
        electionSessionId: election.id,
        fullName: name,
        email,
        status: 'ACTIVE',
        verificationStatus: 'VERIFIED',
        flagged: false,
        hasVoted: false,
      },
    })
    voterCount++
  }
  console.log(`  Voters: ${voterCount}`)

  // Create an ElectionEvent for the go-live.
  await db.electionEvent.create({
    data: {
      electionId: election.id,
      organizationId: org.id,
      eventType: 'GO_LIVE',
      description: 'Election went live (SVE demo)',
      actorName: 'System',
      metadata: JSON.stringify({ seeded: true }),
    },
  }).catch(() => {})

  console.log('\n✅ SVE demo election seeded successfully.')
  console.log(`   Election ID: ${election.id}`)
  console.log(`   URL: /workspace/elections/${election.id}?org=demo`)
  console.log(`   Vote URL: /workspace/elections/${election.id}/vote?org=demo`)
  console.log(`   Voters can vote now. Voting closes at ${end.toISOString()}`)
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1) })
