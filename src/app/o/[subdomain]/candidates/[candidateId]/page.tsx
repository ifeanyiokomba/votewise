'use client'

import { use, useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Trophy, Users, FileText, Video, Award, Download,
  Twitter, Facebook, Instagram, Linkedin, Globe, Briefcase,
  GraduationCap, MapPin, Calendar, CheckCircle2, Loader2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

export default function CandidateProfilePage({ params }: { params: Promise<{ subdomain: string; candidateId: string }> }) {
  const { subdomain, candidateId } = use(params)
  const [candidate, setCandidate] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // In production, fetch from /api/portal/[subdomain]/candidates/[candidateId]
    // For now, use a rich mock that demonstrates the full profile layout
    setTimeout(() => {
      setCandidate({
        id: candidateId,
        fullName: 'John Adeyemi Okoya',
        position: 'President',
        photoUrl: null,
        slogan: 'Together We Rise: A Voice for Every Student',
        biography: 'John Adeyemi Okoya is a 400-level student of Computer Engineering at Demo University. A passionate advocate for student welfare, John has served as the Vice President of the Faculty of Engineering Students Association for two consecutive sessions. He founded the Tech Innovators Club, which now has over 500 members across the university.\n\nJohn believes in transparent leadership, actionable plans, and accountability. His vision is to make Demo University the most student-friendly campus in Nigeria through technology, welfare programs, and academic support.',
        manifesto: '1. Digital Transformation: Launch a unified student app for results, timetables, and complaints.\n2. Welfare: Renovate 3 hostels per semester and install solar-powered reading rooms.\n3. Transportation: Partner with transport companies for discounted student fares.\n4. Academic Support: Create a peer-tutoring network across all faculties.\n5. Transparency: Publish monthly financial reports and hold quarterly town halls.',
        agenda: [
          'Launch a unified student digital platform within 60 days',
          'Renovate 3 hostels per semester (9 total in one academic session)',
          'Install solar-powered 24/7 reading rooms in each faculty',
          'Negotiate 30% student discount with major transport companies',
          'Establish peer-tutoring network across all 12 faculties',
          'Publish monthly financial reports on the SUG website',
          'Hold quarterly town halls for direct student feedback',
        ],
        achievements: [
          'Vice President, Faculty of Engineering Students Association (2023-2025)',
          'Founder, Tech Innovators Club (500+ members)',
          'Dean\'s List for Academic Excellence (2022, 2023, 2024)',
          'Organized the largest hackathon in university history (1,200 participants)',
          'Secured ₦5M sponsorship for student startup incubator',
        ],
        campaignVideoUrl: 'https://www.youtube.com/watch?v=demo',
        campaignPosterUrl: null,
        socialLinks: {
          twitter: '@johnokoya',
          facebook: 'john.okoya',
          instagram: '@john_okoya',
          linkedin: 'john-adeyemi-okoya',
          website: 'johnokoya.com',
        },
        department: 'Computer Engineering',
        faculty: 'Engineering',
        level: '400',
        manifestoPdfUrl: '#',
      })
      setLoading(false)
    }, 500)
  }, [candidateId])

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!candidate) return null

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border/60 bg-muted/30">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <Link href={`/o/${subdomain}/candidates`}><Button variant="ghost" size="sm" className="gap-1.5"><ArrowLeft className="h-3.5 w-3.5" /> Back to Candidates</Button></Link>
        </div>
      </header>

      <main className="flex-1 py-8">
        <div className="mx-auto max-w-4xl px-4 space-y-6">
          {/* Hero card with photo + name + position */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="votewise-card-glow overflow-hidden">
              <CardContent className="p-0">
                <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-start">
                  {/* Photo */}
                  <div className="mx-auto sm:mx-0">
                    <div className="grid h-32 w-32 place-items-center rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 text-primary sm:h-40 sm:w-40">
                      <Users className="h-16 w-16" />
                    </div>
                  </div>
                  {/* Info */}
                  <div className="min-w-0 flex-1 text-center sm:text-left">
                    <Badge className="mb-2 gap-1.5"><Trophy className="h-3 w-3" /> {candidate.position}</Badge>
                    <h1 className="font-display text-2xl font-bold sm:text-3xl">{candidate.fullName}</h1>
                    <p className="mt-1 text-sm italic text-muted-foreground">"{candidate.slogan}"</p>
                    <div className="mt-4 flex flex-wrap justify-center gap-3 text-xs text-muted-foreground sm:justify-start">
                      <span className="flex items-center gap-1"><GraduationCap className="h-3.5 w-3.5" /> {candidate.department}</span>
                      <span className="flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" /> {candidate.faculty}</span>
                      <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {candidate.level} Level</span>
                    </div>
                    {/* Social links */}
                    <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
                      {candidate.socialLinks?.twitter && <SocialIcon icon={Twitter} label="Twitter" />}
                      {candidate.socialLinks?.facebook && <SocialIcon icon={Facebook} label="Facebook" />}
                      {candidate.socialLinks?.instagram && <SocialIcon icon={Instagram} label="Instagram" />}
                      {candidate.socialLinks?.linkedin && <SocialIcon icon={Linkedin} label="LinkedIn" />}
                      {candidate.socialLinks?.website && <SocialIcon icon={Globe} label="Website" />}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Campaign Video */}
          {candidate.campaignVideoUrl && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 font-display text-base"><Video className="h-4 w-4 text-primary" /> Campaign Video</CardTitle></CardHeader>
              <CardContent>
                <div className="grid aspect-video place-items-center rounded-lg bg-muted">
                  <div className="text-center">
                    <Video className="mx-auto h-12 w-12 text-muted-foreground" />
                    <p className="mt-2 text-sm text-muted-foreground">Campaign video available on YouTube</p>
                    <Button variant="outline" size="sm" className="mt-3 gap-1.5">
                      <Video className="h-3.5 w-3.5" /> Watch Video
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Biography */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 font-display text-base"><Users className="h-4 w-4 text-primary" /> Biography</CardTitle></CardHeader>
            <CardContent>
              <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{candidate.biography}</p>
            </CardContent>
          </Card>

          {/* Manifesto */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 font-display text-base"><FileText className="h-4 w-4 text-primary" /> Manifesto</CardTitle>
                {candidate.manifestoPdfUrl && (
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                    <Download className="h-3.5 w-3.5" /> Download PDF
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{candidate.manifesto}</p>
            </CardContent>
          </Card>

          {/* Agenda */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 font-display text-base"><CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Campaign Agenda</CardTitle></CardHeader>
            <CardContent>
              <ol className="space-y-2">
                {candidate.agenda.map((item: string, i: number) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-xs font-bold text-emerald-600 dark:text-emerald-400">{i + 1}</span>
                    <span className="pt-0.5">{item}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          {/* Achievements */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 font-display text-base"><Award className="h-4 w-4 text-amber-600 dark:text-amber-400" /> Achievements</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {candidate.achievements.map((item: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Award className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* CTA */}
          <Card className="border-2 border-emerald-500/30 bg-emerald-500/5">
            <CardContent className="p-6 text-center">
              <p className="text-sm font-medium">Ready to vote for {candidate.fullName.split(' ')[0]}?</p>
              <Link href={`/o/${subdomain}/verify-eligibility`}>
                <Button className="mt-3 gap-2 bg-emerald-600 hover:bg-emerald-700">
                  <Trophy className="h-4 w-4" /> Cast Your Vote
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}

function SocialIcon({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <a href="#" className="grid h-8 w-8 place-items-center rounded-lg bg-muted text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary" aria-label={label}>
      <Icon className="h-4 w-4" />
    </a>
  )
}
