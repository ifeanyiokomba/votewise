'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Award, CheckCircle2, FileText, Shield, Globe, Lock, Scale, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const FRAMEWORKS = [
  {
    icon: Shield,
    name: 'ISO 27001',
    fullName: 'Information Security Management Systems',
    status: 'In Progress',
    progress: 78,
    controls: '89 / 114 controls met',
    description: 'The international standard for managing information security. Covers policies, access control, cryptography, operations security, incident management, and business continuity.',
    keyControls: [
      'A.5 Information security policies',
      'A.9 Access control (RBAC + MFA)',
      'A.10 Cryptography (AES-256-GCM, TLS 1.3)',
      'A.12 Operations security (WAF + rate limiting + GuardDuty)',
      'A.16 Incident management (EIFDIRS + postmortems)',
    ],
  },
  {
    icon: FileText,
    name: 'SOC 2 Type II',
    fullName: 'Service Organization Control 2',
    status: 'In Progress',
    progress: 75,
    controls: '48 / 64 controls met',
    description: 'Audited framework for security, availability, processing integrity, confidentiality, and privacy of customer data.',
    keyControls: [
      'CC1 Control Environment (governance, SoD)',
      'CC3 Risk Assessment (annual + per-chapter threat modeling)',
      'CC4 Monitoring (PIHED, SLO tracking, internal audit)',
      'A1 Availability (Multi-AZ, 99.99% uptime SLO)',
      'C1 Confidentiality (encryption at rest + in transit)',
    ],
  },
  {
    icon: Globe,
    name: 'GDPR',
    fullName: 'General Data Protection Regulation (EU)',
    status: 'In Progress',
    progress: 73,
    controls: '22 / 30 controls met',
    description: 'EU data protection regulation. Governs the processing of personal data of individuals within the European Union.',
    keyControls: [
      'Lawful basis for processing (consent + contract)',
      'Data subject rights (export, rectify, delete)',
      '72-hour breach notification',
      'Privacy by design (PEPPER hashing, minimal data)',
      'Data Protection Officer (to be appointed for EU expansion)',
    ],
  },
  {
    icon: Scale,
    name: 'NDPR',
    fullName: 'Nigeria Data Protection Regulation',
    status: 'Certified',
    progress: 100,
    controls: '28 / 28 controls met',
    description: 'Nigeria\'s mandatory data protection regulation for all organizations processing Nigerian citizens\' data.',
    keyControls: [
      'Lawful basis (consent + legitimate interest)',
      'Data subject rights (access, rectification, erasure)',
      '72-hour breach notification to NDPR',
      'Data transfer outside Nigeria (adequacy + SCCs)',
      'DPO appointed: dpo@votewise.com.ng',
      'Privacy impact assessment completed',
    ],
    certifyingBody: 'Nigeria Data Protection Bureau (NDPB)',
    validUntil: 'June 2027',
  },
]

export function CompliancePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-12 text-center">
        <Badge className="mb-4 gap-1.5 border-2 border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-700 dark:text-amber-300">
          <Scale className="h-3 w-3" /> Compliance
        </Badge>
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">
          Certified for <span className="text-emerald-600 dark:text-emerald-400">Election Integrity</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm text-muted-foreground sm:text-base">
          VoteWise is committed to meeting the highest international standards for data protection, security, and privacy. We maintain evidence and audit records for every compliance framework.
        </p>
      </motion.div>

      {/* Framework cards */}
      <div className="space-y-6">
        {FRAMEWORKS.map((fw, i) => (
          <motion.div key={fw.name} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <Card className={fw.status === 'Certified' ? 'votewise-card-glow border-2 border-emerald-500/30' : ''}>
              <CardContent className="p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <div className={`grid h-14 w-14 shrink-0 place-items-center rounded-xl ${fw.status === 'Certified' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-primary/10 text-primary'}`}>
                    <fw.icon className="h-7 w-7" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-xl font-bold">{fw.name}</h2>
                      <Badge className={fw.status === 'Certified'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'}>
                        {fw.status === 'Certified' && <CheckCircle2 className="mr-1 h-3 w-3" />}
                        {fw.status}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">{fw.fullName}</p>
                    <p className="mt-2 text-sm text-muted-foreground">{fw.description}</p>

                    {/* Progress */}
                    <div className="mt-4">
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{fw.controls}</span>
                        <span className="font-semibold">{fw.progress}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className={`h-full ${fw.status === 'Certified' ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${fw.progress}%` }} />
                      </div>
                    </div>

                    {/* Key controls */}
                    <div className="mt-4 grid gap-1.5 sm:grid-cols-2">
                      {fw.keyControls.map((c) => (
                        <div key={c} className="flex items-start gap-2 text-xs">
                          <CheckCircle2 className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${fw.status === 'Certified' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`} />
                          <span className="text-muted-foreground">{c}</span>
                        </div>
                      ))}
                    </div>

                    {/* Certification details */}
                    {fw.status === 'Certified' && (
                      <div className="mt-4 flex flex-wrap gap-3 text-xs">
                        <span className="flex items-center gap-1.5"><Award className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> {fw.certifyingBody}</span>
                        <span className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> Valid until {fw.validUntil}</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Data protection principles */}
      <section className="mt-12">
        <Card className="votewise-card-glow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-xl"><Users className="h-5 w-5 text-primary" /> Data Protection Principles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { title: 'Lawful, Fair, Transparent', desc: 'We only process data with a lawful basis (consent or contract). Voters are informed of what data we collect and why.' },
                { title: 'Purpose Limitation', desc: 'Data collected for elections is used ONLY for elections. Never sold, shared, or repurposed.' },
                { title: 'Data Minimization', desc: 'We collect only what\'s necessary. Voter PII is separated from ballot data using PEPPER hashing.' },
                { title: 'Accuracy', desc: 'Voters can view and correct their data. Org admins verify voter records before elections.' },
                { title: 'Storage Limitation', desc: 'Data is retained per the organization\'s data retention policy. Completed election data is archived.' },
                { title: 'Integrity & Confidentiality', desc: 'AES-256-GCM encryption at rest. TLS 1.3 in transit. RBAC + MFA for all admin access.' },
              ].map((p) => (
                <div key={p.title} className="rounded-lg border border-border/60 p-4">
                  <h3 className="text-sm font-bold">{p.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{p.desc}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* CTA */}
      <section className="mt-12 text-center">
        <Link href="/trust">
          <Button variant="outline" className="gap-2">
            <Shield className="h-4 w-4" /> View Trust & Security
          </Button>
        </Link>
      </section>
    </div>
  )
}
