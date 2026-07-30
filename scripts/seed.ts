// AfriVote SUG v2 — seed script.
// Run with: bun run scripts/seed.ts
//
// Seeds: election session (open now→+6h), settings, 6 faculties, ~14 departments,
// programmes, levels, 8 positions, 10 candidates (with manifestos + parties),
// 1 super-admin + 1 electoral-committee + 1 faculty officer + 1 department officer
// + 1 observer, 12 demo voters, and 8 pre-cast ENCRYPTED demo votes.

import { PrismaClient } from '@prisma/client'
import { randomBytes, scryptSync, createHash, createCipheriv } from 'crypto'

const db = new PrismaClient()

function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64, { N: 2 ** 14, r: 8, p: 1 }).toString('hex')
  return `scrypt:${salt}:${hash}`
}

function hashVoter(matric: string) {
  return createHash('sha256').update(`${matric}:afrivote-sug-pepper-v2`).digest('hex')
}

// Minimal AES-256-GCM encrypt for seed (mirrors src/lib/crypto).
const VOTE_ENC_KEY_RAW = process.env.VOTE_ENC_KEY || 'afrivote-sug-vote-encryption-key-v2-32bytes!'
const VOTE_ENC_KEY = Buffer.from(VOTE_ENC_KEY_RAW.length >= 32 ? VOTE_ENC_KEY_RAW.slice(0, 32) : createHash('sha256').update(VOTE_ENC_KEY_RAW).digest().subarray(0, 32))

function encryptVote(plaintext: object) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', VOTE_ENC_KEY, iv)
  const data = Buffer.concat([cipher.update(JSON.stringify(plaintext), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return { ciphertext: Buffer.concat([data, tag]).toString('base64'), iv: iv.toString('base64'), keyId: 'v1' }
}

async function main() {
  // Election session
  const now = new Date()
  const start = new Date(now.getTime() - 60 * 1000)
  const end = new Date(now.getTime() + 6 * 60 * 60 * 1000)
  const election = await db.electionSession.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      name: 'SUG General Elections 2024/2025',
      university: 'Federal University of Lagos',
      academicSession: '2024/2025',
      startTime: start, endTime: end,
      accreditationStart: new Date(now.getTime() - 2 * 60 * 1000),
      accreditationEnd: end,
      status: 'VOTING',
    },
    update: { startTime: start, endTime: end, status: 'VOTING' },
  })

  await db.electionSetting.upsert({
    where: { id: 'default' },
    create: {
      id: 'default', electionSessionId: election.id,
      publicLiveResults: true, showTurnout: true, requireOtp: true, requireAccreditation: true,
      otpTtlSeconds: 600, ballotRandomization: true, notaEnabled: true, maxOtpAttempts: 5,
      singleDeviceEnforcement: false, sessionTtlMinutes: 30, accessTtlMinutes: 15, refreshTtlDays: 7,
    },
    update: {},
  })

  // Levels
  const levels = ['100', '200', '300', '400', '500']
  for (let i = 0; i < levels.length; i++) {
    await db.level.upsert({ where: { code: levels[i] }, create: { code: levels[i], name: `${levels[i]} Level`, order: i + 1 }, update: {} })
  }

  // Faculties + departments + programmes
  const facultyDefs = [
    { code: 'ENG', name: 'Faculty of Engineering', departments: [
      { code: 'ELE', name: 'Electrical Engineering', programme: 'B.Eng Electrical Engineering' },
      { code: 'MCE', name: 'Mechanical Engineering', programme: 'B.Eng Mechanical Engineering' },
      { code: 'CVE', name: 'Civil Engineering', programme: 'B.Eng Civil Engineering' },
    ]},
    { code: 'SCI', name: 'Faculty of Science', departments: [
      { code: 'CSC', name: 'Computer Science', programme: 'B.Sc Computer Science' },
      { code: 'CHM', name: 'Chemistry', programme: 'B.Sc Chemistry' },
      { code: 'PHY', name: 'Physics', programme: 'B.Sc Physics' },
    ]},
    { code: 'ART', name: 'Faculty of Arts', departments: [
      { code: 'ENG-LIT', name: 'English & Literary Studies', programme: 'B.A English' },
      { code: 'HIS', name: 'History & Diplomatic Studies', programme: 'B.A History' },
    ]},
    { code: 'SOC', name: 'Faculty of Social Sciences', departments: [
      { code: 'POL', name: 'Political Science', programme: 'B.Sc Political Science' },
      { code: 'ECO', name: 'Economics', programme: 'B.Sc Economics' },
    ]},
    { code: 'MGT', name: 'Faculty of Management Sciences', departments: [
      { code: 'ACC', name: 'Accounting', programme: 'B.Sc Accounting' },
      { code: 'BIZ', name: 'Business Administration', programme: 'B.Sc Business Administration' },
    ]},
    { code: 'EDU', name: 'Faculty of Education', departments: [
      { code: 'EDU-SCI', name: 'Science Education', programme: 'B.Sc (Ed) Science' },
      { code: 'EDU-ART', name: 'Arts Education', programme: 'B.A (Ed) Arts' },
    ]},
  ]
  const facultyMap = new Map<string, any>()
  const deptMap = new Map<string, any>()
  const progMap = new Map<string, any>()
  for (const f of facultyDefs) {
    const fac = await db.faculty.upsert({ where: { code: f.code }, create: { code: f.code, name: f.name }, update: { name: f.name } })
    facultyMap.set(f.code, fac)
    for (const d of f.departments) {
      const dep = await db.department.upsert({ where: { code: d.code }, create: { code: d.code, name: d.name, facultyId: fac.id }, update: { name: d.name, facultyId: fac.id } })
      deptMap.set(d.code, dep)
      const progCode = d.programme.replace(/\s+/g, '-').toUpperCase()
      const prog = await db.programme.upsert({ where: { code: progCode }, create: { code: progCode, name: d.programme, facultyId: fac.id, departmentId: dep.id, durationYears: d.code.startsWith('ENG') ? 5 : 4 }, update: {} })
      progMap.set(d.code, prog)
    }
  }

  // Political parties (non-partisan option + two fictional blocs)
  await db.politicalParty.upsert({ where: { acronym: 'NP' }, create: { acronym: 'NP', name: 'Non-Partisan', colour: '#64748b' }, update: {} })
  await db.politicalParty.upsert({ where: { acronym: 'PBS' }, create: { acronym: 'PBS', name: 'Progressive Bloc of Students', colour: '#15803d', manifesto: 'Reform, transparency, welfare.' }, update: {} })
  await db.politicalParty.upsert({ where: { acronym: 'UAS' }, create: { acronym: 'UAS', name: 'United Action Students', colour: '#b45309', manifesto: 'Unity, accountability, action.' }, update: {} })

  // Positions
  const engId = facultyMap.get('ENG')!.id
  const cscId = deptMap.get('CSC')!.id
  const accId = deptMap.get('ACC')!.id
  const positionDefs = [
    { title: 'President', slug: 'president', scope: 'UNIVERSITY', order: 1, desc: 'Head of the Students\' Union Government.' },
    { title: 'Vice President', slug: 'vice-president', scope: 'UNIVERSITY', order: 2, desc: 'Deputises the President and oversees welfare.' },
    { title: 'Secretary General', slug: 'secretary-general', scope: 'UNIVERSITY', order: 3, desc: 'Custodian of union records.' },
    { title: 'Public Relations Officer (PRO)', slug: 'pro', scope: 'UNIVERSITY', order: 4, desc: 'Manages union communications.' },
    { title: 'Financial Secretary', slug: 'financial-secretary', scope: 'UNIVERSITY', order: 5, desc: 'Keeps the accounts of the union.' },
    { title: 'Engineering Faculty Representative', slug: 'eng-faculty-rep', scope: 'FACULTY', facultyId: engId, order: 6, desc: 'Represents Engineering students.' },
    { title: 'Computer Science Senator', slug: 'csc-senator', scope: 'DEPARTMENT', departmentId: cscId, order: 7, desc: 'Departmental senator for Computer Science.' },
    { title: 'Accounting Senator', slug: 'acc-senator', scope: 'DEPARTMENT', departmentId: accId, order: 8, desc: 'Departmental senator for Accounting.' },
  ]
  const posMap = new Map<string, any>()
  for (const p of positionDefs) {
    const pos = await db.position.upsert({
      where: { slug: p.slug },
      create: { title: p.title, slug: p.slug, scope: p.scope, description: p.desc, electionSessionId: election.id, facultyId: p.facultyId || null, departmentId: p.departmentId || null, order: p.order },
      update: { description: p.desc, electionSessionId: election.id, facultyId: p.facultyId || null, departmentId: p.departmentId || null, order: p.order },
    })
    posMap.set(p.slug, pos)
  }

  // Candidates
  const engFac = facultyMap.get('ENG')!
  const cscDep = deptMap.get('CSC')!
  const accDep = deptMap.get('ACC')!
  const partyPBS = await db.politicalParty.findUnique({ where: { acronym: 'PBS' } })
  const partyUAS = await db.politicalParty.findUnique({ where: { acronym: 'UAS' } })
  const partyNP = await db.politicalParty.findUnique({ where: { acronym: 'NP' } })

  const candidateDefs = [
    { fullName: 'Adebayo Johnson', photo: 'c1.jpg', position: 'president', party: partyPBS, slogan: 'A Voice for Every Student', manifesto: 'Affordable hostels, reliable WiFi, transparent SUG budget published every semester, weekly office hours.', level: '400' },
    { fullName: 'Chidinma Okafor', photo: 'c2.jpg', position: 'president', party: partyUAS, slogan: 'Progress With Integrity', manifesto: 'Academic welfare: extended library hours, subsidised past-question banks, student emergency fund.', level: '300' },
    { fullName: 'Fatima Bello', photo: 'c3.jpg', position: 'president', party: partyNP, slogan: 'Unity in Diversity', manifesto: 'Inclusive union, campus safety walk, 24-hour counselling helpline.', level: '500' },
    { fullName: 'Emeka Nwosu', photo: 'c4.jpg', position: 'vice-president', party: partyPBS, slogan: 'Service Above Self', manifesto: 'Faculty mentorship programme, revived SUG skills workshops.', level: '400' },
    { fullName: 'Grace Okon', photo: 'c5.jpg', position: 'secretary-general', party: partyUAS, slogan: 'Records You Can Trust', manifesto: 'Digitised SUG minutes published within 48 hours of every congress.', level: '300' },
    { fullName: 'Ibrahim Musa', photo: 'c6.jpg', position: 'pro', party: partyPBS, slogan: 'Your Story, Our Voice', manifesto: 'Weekly SUG radio recap, verified information channel.', level: '200' },
    { fullName: 'Zainab Yusuf', photo: 'c7.jpg', position: 'financial-secretary', party: partyUAS, slogan: 'Every Naira Accounted For', manifesto: 'Quarterly financial digest, independent student audit committee.', level: '400' },
    { fullName: 'Daniel Terver', photo: 'c8.jpg', position: 'eng-faculty-rep', party: partyNP, slogan: 'Engineering Excellence', manifesto: 'Modern lab equipment, annual Engineering career fair.', level: '400', facultyId: engFac.id },
    { fullName: 'Aisha Mohammed', photo: 'c9.jpg', position: 'csc-senator', party: partyPBS, slogan: 'Code. Community. Change.', manifesto: 'Student-run project server, peer-tutoring network for 100-level.', level: '300', departmentId: cscDep.id },
  ]
  for (const c of candidateDefs) {
    const pos = posMap.get(c.position)!
    // Deterministic slug: fullName + positionSlug — ensures upsert finds the
    // existing row on re-seed instead of creating duplicates.
    const slug = c.fullName.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + c.position
    await db.candidate.upsert({
      where: { slug },
      create: {
        fullName: c.fullName, slug, positionId: pos.id, electionSessionId: election.id,
        facultyId: c.facultyId || (c.position === 'eng-faculty-rep' ? engFac.id : null),
        departmentId: c.departmentId || null, level: c.level,
        slogan: c.slogan, manifesto: c.manifesto, photoUrl: `/candidates/${c.photo}`,
        politicalPartyId: c.party?.id || null,
        screeningStatus: 'APPROVED', screenedAt: new Date(),
        status: 'APPROVED', cgpa: 4.2,
      },
      update: { fullName: c.fullName, slogan: c.slogan, manifesto: c.manifesto, photoUrl: `/candidates/${c.photo}`, politicalPartyId: c.party?.id || null, facultyId: c.facultyId || (c.position === 'eng-faculty-rep' ? engFac.id : null), departmentId: c.departmentId || null, level: c.level, status: 'APPROVED', screeningStatus: 'APPROVED' },
    })
  }
  // Accounting senator
  const accPos = posMap.get('acc-senator')!
  await db.candidate.upsert({
    where: { slug: 'tunde-bakare-acc' },
    create: { fullName: 'Tunde Bakare', slug: 'tunde-bakare-acc', positionId: accPos.id, electionSessionId: election.id, departmentId: accDep.id, level: '300', slogan: 'Accountability First', manifesto: 'ICAN study materials, internship placements.', photoUrl: '/candidates/c5.jpg', politicalPartyId: partyUAS?.id, status: 'APPROVED', screeningStatus: 'APPROVED', screenedAt: new Date() },
    update: {},
  })

  // Officials
  const officials = [
    { email: 'admin@afrivote.ng', name: 'Electoral Committee Chairperson', role: 'SUPER_ADMIN', password: 'admin123' },
    { email: 'elcom@afrivote.ng', name: 'ELCOM Member', role: 'ELECTORAL_COMMITTEE', password: 'elcom123' },
    { email: 'eng.faculty@afrivote.ng', name: 'Engineering Faculty Officer', role: 'FACULTY_OFFICER', password: 'faculty123', scopeFacultyId: engFac.id },
    { email: 'csc.dept@afrivote.ng', name: 'Computer Science Dept Officer', role: 'DEPARTMENT_OFFICER', password: 'dept123', scopeDepartmentId: cscDep.id },
    { email: 'observer@afrivote.ng', name: 'Independent Observer', role: 'OBSERVER', password: 'observer123', organization: 'National Association of Nigerian Students' },
  ]
  for (const o of officials) {
    await db.electionOfficial.upsert({
      where: { email: o.email },
      create: {
        email: o.email, name: o.name, role: o.role as any,
        scopeFacultyId: (o as any).scopeFacultyId || null,
        scopeDepartmentId: (o as any).scopeDepartmentId || null,
        organization: (o as any).organization || null,
        passwordHash: hashPassword(o.password),
        emailVerified: true,
        // 2FA disabled by default for demo convenience; officials can enable it.
        totpEnabled: false,
      },
      update: { passwordHash: hashPassword(o.password) },
    })
  }

  // Demo voters
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
    const prog = progMap.get(v.dept)
    await db.voter.upsert({
      where: { matric: v.matric },
      create: { matric: v.matric, fullName: v.fullName, institutionEmail: v.email, phone: v.phone, facultyId: fac.id, departmentId: dep.id, programmeId: prog?.id, level: v.level, electionSessionId: election.id, emailVerified: true },
      update: { fullName: v.fullName, institutionEmail: v.email, phone: v.phone, facultyId: fac.id, departmentId: dep.id, programmeId: prog?.id, level: v.level, electionSessionId: election.id, hasVoted: false, votedAt: null, sessionToken: null, otpCode: null, lockedUntil: null, failedOtpAttempts: 0 },
    })
  }

  // Pre-cast 8 encrypted demo votes + accredit those voters.
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

  const existingVotes = await db.encryptedVote.count()
  if (existingVotes === 0) {
    const demoBallots = [
      { matric: 'CSC/2022/001', picks: { president: presA, 'vice-president': vp, 'secretary-general': sec, pro, 'financial-secretary': fin, 'csc-senator': cscSen } },
      { matric: 'CSC/2021/010', picks: { president: presB, 'vice-president': vp, 'secretary-general': sec, pro, 'financial-secretary': fin, 'csc-senator': cscSen } },
      { matric: 'ENG/2022/015', picks: { president: presA, 'vice-president': vp, 'secretary-general': sec, pro, 'financial-secretary': fin, 'eng-faculty-rep': engRep } },
      { matric: 'ACC/2022/022', picks: { president: presC, 'vice-president': vp, 'secretary-general': sec, pro, 'financial-secretary': fin, 'acc-senator': accSen } },
      { matric: 'POL/2023/005', picks: { president: presA, 'vice-president': vp, 'secretary-general': sec, pro, 'financial-secretary': fin } },
      { matric: 'CHM/2020/009', picks: { president: presB, 'vice-president': vp, 'secretary-general': sec, pro, 'financial-secretary': fin } },
      { matric: 'MCE/2022/011', picks: { president: presA, 'vice-president': vp, 'secretary-general': sec, pro, 'financial-secretary': fin, 'eng-faculty-rep': engRep } },
      { matric: 'LIT/2023/002', picks: { president: presC, 'vice-president': vp, 'secretary-general': sec, pro, 'financial-secretary': fin } },
    ]
    // Genesis audit row.
    const auditGenesis = await db.auditLog.findFirst()
    if (!auditGenesis) {
      await db.auditLog.create({ data: { actorId: 'system', actorRole: 'SYSTEM', actorName: 'System', action: 'GENESIS', details: null, ip: null, prevHash: 'GENESIS-afrivote-sug-v2', hash: createHash('sha256').update('GENESIS-afrivote-sug-v2|system|GENESIS||' + new Date().toISOString() + '|genesis').digest('hex'), nonce: 'genesis' } })
    }
    for (const b of demoBallots) {
      const voter = await db.voter.findUnique({ where: { matric: b.matric } })
      if (!voter) continue
      // Accreditation
      await db.accreditation.upsert({
        where: { voterId_electionSessionId: { voterId: voter.id, electionSessionId: election.id } },
        create: { voterId: voter.id, electionSessionId: election.id, status: 'APPROVED', channel: 'MATRIC', deviceFingerprint: 'seed-device', ipAddress: '127.0.0.1' },
        update: {},
      })
      await db.$transaction(async (tx) => {
        let prevHash = (await tx.auditLog.findFirst({ orderBy: { createdAt: 'desc' } }))?.hash || 'GENESIS-afrivote-sug-v2'
        for (const [slug, cand] of Object.entries(b.picks)) {
          if (!cand) continue
          const pos = await tx.position.findUnique({ where: { slug } })
          if (!pos) continue
          const blob = encryptVote({ candidateId: (cand as any).id, isNota: false })
          await tx.encryptedVote.create({
            data: {
              electionSessionId: election.id,
              voterHash: hashVoter(voter.matric),
              positionId: pos.id,
              candidateId: null, isNota: false,
              ciphertext: blob.ciphertext, iv: blob.iv, keyId: blob.keyId,
              receiptCode: `AV-SEED-${randomBytes(3).toString('hex').toUpperCase()}-${randomBytes(2).toString('hex').toUpperCase()}`,
              idempotencyKey: createHash('sha256').update(`${voter.id}|${election.id}|${pos.id}`).digest('hex'),
            },
          })
        }
        await tx.voter.update({ where: { id: voter.id }, data: { hasVoted: true, votedAt: new Date() } })
        const createdAt = new Date()
        const nonce = randomBytes(8).toString('hex')
        const detailsStr = JSON.stringify({ positions: Object.keys(b.picks), count: Object.keys(b.picks).length })
        const hash = createHash('sha256').update(`${prevHash}|${voter.id}|VOTE_CAST|${detailsStr}|${createdAt.toISOString()}|${nonce}`).digest('hex')
        await tx.auditLog.create({
          data: { electionId: election.id, actorId: voter.id, actorRole: 'VOTER', actorName: voter.fullName, action: 'VOTE_CAST', details: detailsStr, ip: '127.0.0.1', prevHash, hash, nonce, createdAt },
        })
      })
    }
    console.log('[seed] 8 encrypted demo votes cast + audit chain started')
  }

  console.log('[seed] done ✅')
  console.log('  Super Admin:           admin@afrivote.ng / admin123')
  console.log('  Electoral Committee:   elcom@afrivote.ng / elcom123')
  console.log('  Faculty Officer (ENG): eng.faculty@afrivote.ng / faculty123')
  console.log('  Dept Officer (CSC):    csc.dept@afrivote.ng / dept123')
  console.log('  Observer:              observer@afrivote.ng / observer123')
  console.log('  Fresh voter:           ECO/2021/014 (OTP shown in UI in dev)')
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => db.$disconnect())
