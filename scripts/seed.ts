// AfriVote SUG — seed script.
// Run with: bun run scripts/seed.ts
//
// Seeds: election (open window now→+6h), settings, 6 faculties, ~12 departments,
// 8 positions (5 university-wide, 1 faculty rep, 2 department senators),
// 9 candidates mapped to c1..c9.jpg, 1 super-admin, 1 observer, and ~12 demo
// voters across faculties so the voting flow can be exercised end-to-end.

import { PrismaClient } from '@prisma/client'
import { randomBytes, scryptSync, createHash } from 'crypto'

const db = new PrismaClient()

function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

async function main() {
  // --- Election (singleton) ---
  const now = new Date()
  const start = new Date(now.getTime() - 60 * 1000) // open 1 min ago
  const end = new Date(now.getTime() + 6 * 60 * 60 * 1000) // open for 6 hours
  await db.election.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      name: 'SUG General Elections 2024/2025',
      university: 'Federal University of Lagos',
      academicSession: '2024/2025',
      startTime: start,
      endTime: end,
      status: 'open',
    },
    update: { startTime: start, endTime: end, status: 'open' },
  })

  await db.electionSetting.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      publicLiveResults: true,
      showTurnout: true,
      requireOtp: true,
      otpTtlSeconds: 600,
      ballotRandomization: true,
      notaEnabled: true,
      maxOtpAttempts: 5,
    },
    update: {},
  })

  // --- Faculties & Departments ---
  const facultyDefs = [
    { code: 'ENG', name: 'Faculty of Engineering', departments: [
      { code: 'ELE', name: 'Electrical Engineering' },
      { code: 'MCE', name: 'Mechanical Engineering' },
      { code: 'CVE', name: 'Civil Engineering' },
    ]},
    { code: 'SCI', name: 'Faculty of Science', departments: [
      { code: 'CSC', name: 'Computer Science' },
      { code: 'CHM', name: 'Chemistry' },
      { code: 'PHY', name: 'Physics' },
    ]},
    { code: 'ART', name: 'Faculty of Arts', departments: [
      { code: 'ENG-LIT', name: 'English & Literary Studies' },
      { code: 'HIS', name: 'History & Diplomatic Studies' },
    ]},
    { code: 'SOC', name: 'Faculty of Social Sciences', departments: [
      { code: 'POL', name: 'Political Science' },
      { code: 'ECO', name: 'Economics' },
    ]},
    { code: 'MGT', name: 'Faculty of Management Sciences', departments: [
      { code: 'ACC', name: 'Accounting' },
      { code: 'BIZ', name: 'Business Administration' },
    ]},
    { code: 'EDU', name: 'Faculty of Education', departments: [
      { code: 'EDU-SCI', name: 'Science Education' },
      { code: 'EDU-ART', name: 'Arts Education' },
    ]},
  ]

  const facultyMap = new Map<string, { id: string }>()
  const deptMap = new Map<string, { id: string; facultyId: string }>()
  for (const f of facultyDefs) {
    const fac = await db.faculty.upsert({ where: { code: f.code }, create: { code: f.code, name: f.name }, update: { name: f.name } })
    facultyMap.set(f.code, fac)
    for (const d of f.departments) {
      const dep = await db.department.upsert({ where: { code: d.code }, create: { code: d.code, name: d.name, facultyId: fac.id }, update: { name: d.name, facultyId: fac.id } })
      deptMap.set(d.code, dep)
    }
  }

  // --- Positions ---
  const engId = facultyMap.get('ENG')!.id
  const cscId = deptMap.get('CSC')!.id
  const accId = deptMap.get('ACC')!.id

  const positionDefs = [
    { title: 'President', slug: 'president', scope: 'UNIVERSITY', order: 1, desc: 'Head of the Students\' Union Government. Provides strategic leadership and represents the student body to the university management.' },
    { title: 'Vice President', slug: 'vice-president', scope: 'UNIVERSITY', order: 2, desc: 'Deputises the President and oversees union welfare programmes.' },
    { title: 'Secretary General', slug: 'secretary-general', scope: 'UNIVERSITY', order: 3, desc: 'Custodian of union records, minutes and official correspondence.' },
    { title: 'Public Relations Officer (PRO)', slug: 'pro', scope: 'UNIVERSITY', order: 4, desc: 'Manages communications between the union and the student body.' },
    { title: 'Financial Secretary', slug: 'financial-secretary', scope: 'UNIVERSITY', order: 5, desc: 'Keeps the accounts of the union and presents financial reports.' },
    { title: 'Engineering Faculty Representative', slug: 'eng-faculty-rep', scope: 'FACULTY', facultyId: engId, order: 6, desc: 'Represents Engineering students in the SUG council.' },
    { title: 'Computer Science Senator', slug: 'csc-senator', scope: 'DEPARTMENT', departmentId: cscId, order: 7, desc: 'Departmental senator for Computer Science.' },
    { title: 'Accounting Senator', slug: 'acc-senator', scope: 'DEPARTMENT', departmentId: accId, order: 8, desc: 'Departmental senator for Accounting.' },
  ]

  const posMap = new Map<string, { id: string }>()
  for (const p of positionDefs) {
    const pos = await db.position.upsert({
      where: { slug: p.slug },
      create: { title: p.title, slug: p.slug, scope: p.scope, description: p.desc, facultyId: p.facultyId || null, departmentId: p.departmentId || null, order: p.order },
      update: { description: p.desc, facultyId: p.facultyId || null, departmentId: p.departmentId || null, order: p.order },
    })
    posMap.set(p.slug, pos)
  }

  // --- Candidates (9, mapped to c1..c9.jpg) ---
  const engFac = facultyMap.get('ENG')!
  const cscDep = deptMap.get('CSC')!
  const accDep = deptMap.get('ACC')!

  const candidateDefs = [
    { fullName: 'Adebayo Johnson', photo: 'c1.jpg', position: 'president', slogan: 'A Voice for Every Student', manifesto: 'I will fight for affordable hostel accommodation, reliable campus WiFi, and a transparent SUG budget published every semester. My administration will hold weekly office hours open to every student.', level: '400' },
    { fullName: 'Chidinma Okafor', photo: 'c2.jpg', position: 'president', slogan: 'Progress With Integrity', manifesto: 'My priority is academic welfare: extended library hours during exams, subsidised past-question banks, and a student emergency fund. I will publish every SUG expense online.', level: '300' },
    { fullName: 'Fatima Bello', photo: 'c3.jpg', position: 'president', slogan: 'Unity in Diversity', manifesto: 'I will champion an inclusive union that represents every faculty and every faith. I will institute a campus safety walk and a 24-hour counselling helpline.', level: '500' },
    { fullName: 'Emeka Nwosu', photo: 'c4.jpg', position: 'vice-president', slogan: 'Service Above Self', manifesto: 'I will coordinate a faculty mentorship programme pairing senior students with freshers, and revive the SUG skills workshop series.', level: '400' },
    { fullName: 'Grace Okon', photo: 'c5.jpg', position: 'secretary-general', slogan: 'Records You Can Trust', manifesto: 'I will digitise SUG minutes and publish them within 48 hours of every congress. Transparency is non-negotiable.', level: '300' },
    { fullName: 'Ibrahim Musa', photo: 'c6.jpg', position: 'pro', slogan: 'Your Story, Our Voice', manifesto: 'I will launch a weekly SUG radio recap and a verified information channel to fight rumour and misinformation on campus.', level: '200' },
    { fullName: 'Zainab Yusuf', photo: 'c7.jpg', position: 'financial-secretary', slogan: 'Every Naira Accounted For', manifesto: 'I will publish a quarterly financial digest and commission an independent student audit committee.', level: '400' },
    { fullName: 'Daniel Terver', photo: 'c8.jpg', position: 'eng-faculty-rep', slogan: 'Engineering Excellence', manifesto: 'I will lobby for modern lab equipment and an annual Engineering career fair with industry partners.', level: '400', facultyId: engFac.id },
    { fullName: 'Aisha Mohammed', photo: 'c9.jpg', position: 'csc-senator', slogan: 'Code. Community. Change.', manifesto: 'I will push for a student-run server hosting final-year projects and a peer-tutoring network for 100-level students.', level: '300', departmentId: cscDep.id },
  ]

  for (const c of candidateDefs) {
    const pos = posMap.get(c.position)!
    const slug = c.fullName.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + randomBytes(2).toString('hex')
    await db.candidate.upsert({
      where: { slug },
      create: {
        fullName: c.fullName,
        slug,
        positionId: pos.id,
        facultyId: c.facultyId || (c.position === 'eng-faculty-rep' ? engFac.id : null),
        departmentId: c.departmentId || null,
        level: c.level,
        slogan: c.slogan,
        manifesto: c.manifesto,
        photoUrl: `/candidates/${c.photo}`,
        status: 'APPROVED',
      },
      update: {
        fullName: c.fullName, slogan: c.slogan, manifesto: c.manifesto, photoUrl: `/candidates/${c.photo}`,
        facultyId: c.facultyId || (c.position === 'eng-faculty-rep' ? engFac.id : null),
        departmentId: c.departmentId || null, level: c.level, status: 'APPROVED',
      },
    })
  }

  // Also add an Accounting senator candidate (only 9 photos, so reuse a photoless approach)
  const accPos = posMap.get('acc-senator')!
  await db.candidate.upsert({
    where: { slug: 'tunde-bakare-acc' },
    create: { fullName: 'Tunde Bakare', slug: 'tunde-bakare-acc', positionId: accPos.id, departmentId: accDep.id, level: '300', slogan: 'Accountability First', manifesto: 'I will ensure Accounting students have access to ICAN study materials and internship placements.', photoUrl: '/candidates/c5.jpg', status: 'APPROVED' },
    update: { manifesto: 'I will ensure Accounting students have access to ICAN study materials and internship placements.' },
  })

  // --- Admin & Observer ---
  await db.admin.upsert({
    where: { email: 'admin@afrivote.ng' },
    create: { email: 'admin@afrivote.ng', name: 'Electoral Committee Chairperson', passwordHash: hashPassword('admin123'), role: 'SUPER_ADMIN' },
    update: { passwordHash: hashPassword('admin123') },
  })
  await db.observer.upsert({
    where: { email: 'observer@afrivote.ng' },
    create: { email: 'observer@afrivote.ng', name: 'Independent Observer', organization: 'National Association of Nigerian Students', passwordHash: hashPassword('observer123') },
    update: { passwordHash: hashPassword('observer123') },
  })

  // --- Demo voters (matric, faculty, dept, level) ---
  const voterDefs = [
    { matric: 'CSC/2022/001', fullName: 'Demo Voter One', faculty: 'SCI', dept: 'CSC', level: '300', email: 'demo1@afrivote.ng', phone: '08030000001' },
    { matric: 'CSC/2021/010', fullName: 'Demo Voter Two', faculty: 'SCI', dept: 'CSC', level: '400', email: 'demo2@afrivote.ng', phone: '08030000002' },
    { matric: 'ENG/2022/015', fullName: 'Demo Voter Three', faculty: 'ENG', dept: 'ELE', level: '300', email: 'demo3@afrivote.ng', phone: '08030000003' },
    { matric: 'ACC/2022/022', fullName: 'Demo Voter Four', faculty: 'MGT', dept: 'ACC', level: '300', email: 'demo4@afrivote.ng', phone: '08030000004' },
    { matric: 'POL/2023/005', fullName: 'Demo Voter Five', faculty: 'SOC', dept: 'POL', level: '200', email: 'demo5@afrivote.ng', phone: '08030000005' },
    { matric: 'CHM/2020/009', fullName: 'Demo Voter Six', faculty: 'SCI', dept: 'CHM', level: '500', email: 'demo6@afrivote.ng', phone: '08030000006' },
    { matric: 'MCE/2022/011', fullName: 'Demo Voter Seven', faculty: 'ENG', dept: 'MCE', level: '300', email: 'demo7@afrivote.ng', phone: '08030000007' },
    { matric: 'LIT/2023/002', fullName: 'Demo Voter Eight', faculty: 'ART', dept: 'ENG-LIT', level: '200', email: 'demo8@afrivote.ng', phone: '08030000008' },
    { matric: 'ECO/2021/014', fullName: 'Demo Voter Nine', faculty: 'SOC', dept: 'ECO', level: '400', email: 'demo9@afrivote.ng', phone: '08030000009' },
    { matric: 'BIZ/2022/019', fullName: 'Demo Voter Ten', faculty: 'MGT', dept: 'BIZ', level: '300', email: 'demo10@afrivote.ng', phone: '08030000010' },
    { matric: 'CVE/2020/007', fullName: 'Demo Voter Eleven', faculty: 'ENG', dept: 'CVE', level: '500', email: 'demo11@afrivote.ng', phone: '08030000011' },
    { matric: 'PHY/2023/003', fullName: 'Demo Voter Twelve', faculty: 'SCI', dept: 'PHY', level: '200', email: 'demo12@afrivote.ng', phone: '08030000012' },
  ]
  for (const v of voterDefs) {
    const fac = facultyMap.get(v.faculty)!
    const dep = deptMap.get(v.dept)!
    await db.voter.upsert({
      where: { matric: v.matric },
      create: { matric: v.matric, fullName: v.fullName, email: v.email, phone: v.phone, facultyId: fac.id, departmentId: dep.id, level: v.level },
      update: { fullName: v.fullName, email: v.email, phone: v.phone, facultyId: fac.id, departmentId: dep.id, level: v.level, hasVoted: false, votedAt: null, sessionToken: null, otpCode: null },
    })
  }

  // Cast a few demo votes so results have data immediately.
  const candidates = await db.candidate.findMany()
  const cByName = new Map(candidates.map((c) => [c.fullName, c]))
  const presA = cByName.get('Adebayo Johnson')
  const presB = cByName.get('Chidinma Okafor')
  const vp = cByName.get('Emeka Nwosu')
  const sec = cByName.get('Grace Okon')
  const pro = cByName.get('Ibrahim Musa')
  const fin = cByName.get('Zainab Yusuf')
  const engRep = cByName.get('Daniel Terver')
  const cscSen = cByName.get('Aisha Mohammed')
  const accSen = cByName.get('Tunde Bakare')
  const presC = cByName.get('Fatima Bello')

  const existingVotes = await db.vote.count()
  if (existingVotes === 0) {
    const demoBallots = [
      // voter1 (CSC/300): President A, VP, Sec, PRO, Fin, EngRep(n/a - SCI), CSC Sen
      { matric: 'CSC/2022/001', picks: { president: presA, 'vice-president': vp, 'secretary-general': sec, pro, 'financial-secretary': fin, 'csc-senator': cscSen } },
      { matric: 'CSC/2021/010', picks: { president: presB, 'vice-president': vp, 'secretary-general': sec, pro, 'financial-secretary': fin, 'csc-senator': cscSen } },
      { matric: 'ENG/2022/015', picks: { president: presA, 'vice-president': vp, 'secretary-general': sec, pro, 'financial-secretary': fin, 'eng-faculty-rep': engRep } },
      { matric: 'ACC/2022/022', picks: { president: presC, 'vice-president': vp, 'secretary-general': sec, pro, 'financial-secretary': fin, 'acc-senator': accSen } },
      { matric: 'POL/2023/005', picks: { president: presA, 'vice-president': vp, 'secretary-general': sec, pro, 'financial-secretary': fin } },
      { matric: 'CHM/2020/009', picks: { president: presB, 'vice-president': vp, 'secretary-general': sec, pro, 'financial-secretary': fin } },
      { matric: 'MCE/2022/011', picks: { president: presA, 'vice-president': vp, 'secretary-general': sec, pro, 'financial-secretary': fin, 'eng-faculty-rep': engRep } },
      { matric: 'LIT/2023/002', picks: { president: presC, 'vice-president': vp, 'secretary-general': sec, pro, 'financial-secretary': fin } },
    ]
    for (const b of demoBallots) {
      const voter = await db.voter.findUnique({ where: { matric: b.matric } })
      if (!voter) continue
      await db.$transaction(async (tx) => {
        for (const [slug, cand] of Object.entries(b.picks)) {
          if (!cand) continue
          const pos = await tx.position.findUnique({ where: { slug } })
          if (!pos) continue
          await tx.vote.create({
            data: {
              voterHash: createHash('sha256').update(`${voter.matric}:afrivote-sug-pepper-v1`).digest('hex'),
              candidateId: cand.id,
              positionId: pos.id,
              isNota: false,
              receiptCode: `AV-SEED-${randomBytes(3).toString('hex').toUpperCase()}-${randomBytes(2).toString('hex').toUpperCase()}`,
            },
          })
        }
        await tx.voter.update({ where: { id: voter.id }, data: { hasVoted: true, votedAt: new Date() } })
      })
    }
    console.log('[seed] demo votes cast for 8 voters')
  }

  console.log('[seed] done ✅')
  console.log('  Admin:    admin@afrivote.ng / admin123')
  console.log('  Observer: observer@afrivote.ng / observer123')
  console.log('  Voter:    CSC/2022/001 (Demo Voter One) — OTP will be shown in the UI (dev mode)')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
