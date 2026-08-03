'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Shield, ShieldCheck, Lock, ScrollText, Fingerprint, Eye, Vote,
  FileCheck2, KeyRound, Server, Cloud, AlertTriangle, CheckCircle2,
  ArrowRight, Award, BarChart3, Users,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const SECURITY_PILLARS = [
  {
    icon: Lock,
    title: 'AES-256-GCM Encryption',
    desc: 'Every vote is encrypted with AES-256-GCM before it touches the database. The plaintext candidate selection is NEVER stored — only the ciphertext, an opaque voter hash, and the receipt code.',
    detail: 'Military-grade encryption used by banks and governments.',
  },
  {
    icon: ScrollText,
    title: 'Hash-Chained Audit Log',
    desc: 'Every action — login, vote, OTP, payment, admin change — is logged with actor, role, IP, and timestamp. Each entry cryptographically chains to the previous one. Tampering breaks the chain visibly.',
    detail: 'Tamper-evident. Any manipulation is immediately detectable.',
  },
  {
    icon: Fingerprint,
    title: 'Voter Anonymity',
    desc: 'Voter identity is separated from the ballot using PEPPER-hashed identifiers. No one — not even platform administrators — can link a voter to their candidate selection.',
    detail: 'Vote secrecy is mathematically guaranteed.',
  },
  {
    icon: Eye,
    title: 'Observer Transparency',
    desc: 'Independent observers monitor every election in real time. They see turnout, integrity events, and audit trails — but never ballots or voter identities.',
    detail: 'Public oversight without compromising privacy.',
  },
  {
    icon: KeyRound,
    title: 'OTVP Authentication',
    desc: 'One-Time Voting Passwords are delivered via SMS, Email, and WhatsApp. Each OTVP expires in 5 minutes, can only be used once, and is rate-limited to prevent brute force.',
    detail: 'Multi-channel delivery with automatic failover.',
  },
  {
    icon: ShieldCheck,
    title: 'Receipt Verification',
    desc: 'Every voter receives a unique receipt code. They can verify their vote was recorded at any time — without revealing their candidate selection. The receipt proves the vote exists, not who it was for.',
    detail: 'Verifiable without compromising secrecy.',
  },
]

const FRAUD_DETECTIONS = [
  'Vote flooding detection',
  'Impossible travel (geo-anomaly)',
  'Device fingerprint reuse',
  'Velocity checks (bot detection)',
  'OTVP brute-force prevention',
  'Session hijack detection',
  'Ballot stuffing pattern detection',
  'Coordinated attack clustering',
  'VPN/proxy detection',
  'Duplicate IP detection',
]

const COMPLIANCE_ITEMS = [
  { name: 'ISO 27001', status: 'In Progress', progress: 78 },
  { name: 'SOC 2 Type II', status: 'In Progress', progress: 75 },
  { name: 'GDPR', status: 'In Progress', progress: 73 },
  { name: 'NDPR (Nigeria)', status: 'Certified', progress: 100 },
]

export function TrustSecurityPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-12 text-center"
      >
        <Badge className="mb-4 gap-1.5 border-2 border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-700 dark:text-emerald-300">
          <ShieldCheck className="h-3 w-3" /> Trust & Security
        </Badge>
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">
          Engineered for <span className="text-emerald-600 dark:text-emerald-400">Election Integrity</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm text-muted-foreground sm:text-base">
          VoteWise is built on the principle that democracy requires trust. Every layer of our platform — from encryption to audit trails to observer transparency — is designed to ensure elections are secure, verifiable, and tamper-proof.
        </p>
      </motion.div>

      {/* Security Pillars */}
      <section className="mb-16">
        <h2 className="mb-6 text-center font-display text-2xl font-bold">Security Architecture</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {SECURITY_PILLARS.map((pillar, i) => (
            <motion.div
              key={pillar.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              <Card className="votewise-card-glow h-full">
                <CardContent className="p-6">
                  <div className="mb-3 grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
                    <pillar.icon className="h-6 w-6" />
                  </div>
                  <h3 className="font-display text-base font-bold">{pillar.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{pillar.desc}</p>
                  <p className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">{pillar.detail}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Fraud Detection */}
      <section className="mb-16">
        <Card className="votewise-card-glow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-xl">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              Fraud Detection Engine
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              Our EIFDIRS (Election Integrity, Fraud Detection & Incident Response System) continuously monitors every election with 11 automated detectors. Suspicious activity is flagged, scored, and — if critical — automatically locks the election.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {FRAUD_DETECTIONS.map((d) => (
                <div key={d} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  {d}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Compliance */}
      <section className="mb-16">
        <h2 className="mb-6 text-center font-display text-2xl font-bold">Compliance & Certification</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {COMPLIANCE_ITEMS.map((item, i) => (
            <motion.div key={item.name} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }}>
              <Card className={item.status === 'Certified' ? 'border-emerald-500/30 bg-emerald-500/5' : ''}>
                <CardContent className="p-5 text-center">
                  <Award className={`mx-auto mb-2 h-8 w-8 ${item.status === 'Certified' ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`} />
                  <h3 className="font-display text-sm font-bold">{item.name}</h3>
                  <Badge className={`mt-1 text-[9px] ${item.status === 'Certified' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'}`}>
                    {item.status}
                  </Badge>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className={`h-full ${item.status === 'Certified' ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${item.progress}%` }} />
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground">{item.progress}% complete</div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Infrastructure */}
      <section className="mb-16">
        <Card className="votewise-card-glow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-xl">
              <Server className="h-5 w-5 text-primary" />
              Production Infrastructure
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { icon: Cloud, label: 'Multi-AZ Deployment', desc: 'Multi-Availability-Zone RDS + ElastiCache + ECS' },
                { icon: Shield, label: 'WAF + DDoS Protection', desc: 'Cloudflare WAF + AWS Shield + rate limiting' },
                { icon: Lock, label: 'TLS 1.3 Everywhere', desc: 'HSTS + strong ciphers + auto-renewal' },
                { icon: Server, label: '99.99% Uptime SLA', desc: 'Auto-scaling 3-20 replicas, zero-downtime deploys' },
                { icon: ScrollText, label: 'Centralized Logging', desc: '6 log categories, searchable, 365-day retention' },
                { icon: BarChart3, label: 'SLO Tracking', desc: 'Error budgets, burn-rate alerts, 6 SLOs monitored' },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <item.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{item.label}</div>
                    <div className="text-[11px] text-muted-foreground">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* CTA */}
      <section className="text-center">
        <Card className="votewise-card-glow border-2 border-emerald-500/30">
          <CardContent className="p-8">
            <Vote className="mx-auto mb-3 h-10 w-10 text-emerald-600 dark:text-emerald-400" />
            <h2 className="font-display text-2xl font-bold">Ready to Conduct a Trusted Election?</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Join the organizations that trust VoteWise with their most important decisions.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link href="/?view=register">
                <Button size="lg" className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                  Register Organization <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/?view=official-login">
                <Button size="lg" variant="outline" className="gap-2">
                  Admin Login
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
