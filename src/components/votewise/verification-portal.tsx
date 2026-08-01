'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  ShieldCheck, CheckCircle2, XCircle, FileCheck, Hash, Lock, Download,
  Share2, Copy, Trophy, Users, Vote, TrendingUp, Award, Eye,
  ExternalLink, Loader2, AlertCircle, ChevronRight, KeyRound,
  ScrollText, BadgeCheck, Calendar, Building2, Sparkles, Maximize2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface VerificationCheck {
  key: string
  label: string
  passed: boolean
  detail: string
}

interface VerificationPackage {
  totalEligible: number
  totalVotes: number
  invalidVotes: number
  blankVotes: number
  turnoutPct: number
  auditHash: string
  recomputedAuditHash: string
  auditHashMatches: boolean
  integritySignature: string
  signatureValid: boolean
  generatedAt: string
}

interface CandidateResult {
  candidateId: string | null
  candidateName: string
  votes: number
  percentage: number
  isWinner: boolean
}

interface PositionResult {
  positionId: string
  title: string
  totalVotes: number
  results: CandidateResult[]
  tie: boolean
}

interface ChainEntry {
  id: string
  action: string
  actorName: string
  actorRole: string
  prevHash: string
  hash: string
  createdAt: string
}

interface ChainInfo {
  intact: boolean
  totalChecked: number
  brokenAt: string | null
  electionEntries: number
  genesis: string
  head: ChainEntry[]
  tail: ChainEntry[]
  hiddenMiddleCount: number
}

interface PortalData {
  electionId: string
  electionName: string
  description?: string | null
  organizationName?: string
  organizationSubdomain?: string
  university?: string
  academicSession?: string
  votingMethod?: string
  status: string
  certificationDate: string | null
  votingWindow: { start: string; end: string }
  verification: VerificationPackage
  resultsByPosition: PositionResult[]
  chain: ChainInfo
  voteRecordCount: number
  checks: VerificationCheck[]
  verified: boolean
  generatedAt: string
  portalUrl: string
  publicResultsUrl: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function shortHash(h: string, head = 10, tail = 6): string {
  if (!h) return '—'
  if (h.length <= head + tail + 3) return h
  return `${h.slice(0, head)}…${h.slice(-tail)}`
}

function copyToClipboard(value: string, label: string) {
  if (typeof navigator === 'undefined' || !navigator.clipboard) {
    toast.error('Clipboard not available')
    return
  }
  navigator.clipboard.writeText(value).then(
    () => toast.success(`${label} copied`),
    () => toast.error('Could not copy to clipboard'),
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function VerificationPortal({ electionId }: { electionId: string }) {
  const { t } = useTranslation()
  const [data, setData] = useState<PortalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const d = await api.getVerificationPortal(electionId)
      setData(d as PortalData)
    } catch (e: any) {
      setError(e?.message || 'Failed to load verification package')
    } finally {
      setLoading(false)
    }
  }, [electionId])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <div className="grid min-h-[60vh] place-items-center px-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">
            {t('verification.loadingVerification')}
          </p>
        </div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t('verification.verificationUnavailable')}</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>{error}</p>
            <p className="text-xs">
              {t('verification.verificationUnavailableDesc')}
            </p>
          </AlertDescription>
        </Alert>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/">
            <Button variant="outline" size="sm" className="gap-1.5">
              <ExternalLink className="h-4 w-4" /> {t('verification.backToVoteWise')}
            </Button>
          </Link>
          <ReceiptVerifyInline />
        </div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="votewise-portal-bg">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <HeaderCard data={data} />

        <VerificationStatusBanner data={data} />

        <SummaryStats data={data} />

        <TurnoutProgress data={data} />

        <CryptographicProof data={data} />

        <CertifiedResults data={data} />

        <AuditChainVisualization data={data} />

        <DownloadAndShare data={data} />

        <ReceiptVerifyInline />

        <PortalFooter data={data} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Header card
// ---------------------------------------------------------------------------
function HeaderCard({ data }: { data: PortalData }) {
  const { t } = useTranslation()
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="votewise-card-glow overflow-hidden">
        <CardContent className="p-5 sm:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="gap-1 bg-primary/10 text-primary hover:bg-primary/10">
                  <ShieldCheck className="h-3.5 w-3.5" /> {t('verification.portalTitle')}
                </Badge>
                <Badge className="gap-1 bg-amber-100 text-amber-800 hover:bg-amber-100">
                  <BadgeCheck className="h-3.5 w-3.5" /> {t('verification.certified')}
                </Badge>
                {data.organizationName && (
                  <Badge variant="outline" className="gap-1">
                    <Building2 className="h-3 w-3" /> {data.organizationName}
                  </Badge>
                )}
                {data.votingMethod && (
                  <Badge variant="secondary" className="gap-1">
                    <Vote className="h-3 w-3" /> {data.votingMethod}
                  </Badge>
                )}
              </div>
              <h1 className="mt-3 font-display text-2xl font-bold tracking-tight sm:text-4xl">
                {data.electionName}
              </h1>
              {data.description && (
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
                  {data.description}
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                {data.certificationDate && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-primary" />
                    Certified: {new Date(data.certificationDate).toLocaleString()}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-primary" />
                  Voting: {new Date(data.votingWindow.start).toLocaleDateString()} →{' '}
                  {new Date(data.votingWindow.end).toLocaleDateString()}
                </span>
                {data.academicSession && (
                  <span className="flex items-center gap-1">
                    <ScrollText className="h-3.5 w-3.5 text-primary" />
                    {data.academicSession}
                  </span>
                )}
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-start gap-2 lg:items-end">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center">
                <div className="flex items-center justify-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                  <ShieldCheck className="h-3.5 w-3.5" /> {t('verification.verificationStatus')}
                </div>
                <div
                  className={cn(
                    'mt-0.5 font-display text-lg font-bold sm:text-xl',
                    data.verified ? 'text-emerald-700' : 'text-red-600',
                  )}
                >
                  {data.verified ? t('verification.verified') : t('verification.failed')}
                </div>
              </div>
              <Link href={data.publicResultsUrl}>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Eye className="h-4 w-4" /> {t('verification.publicResults')}
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Verification status banner
// ---------------------------------------------------------------------------
function VerificationStatusBanner({ data }: { data: PortalData }) {
  const { t } = useTranslation()
  const allPass = data.verified
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.05 }}
      className="mt-4"
    >
      <Card
        className={cn(
          'votewise-card-glow overflow-hidden border-2',
          allPass
            ? 'border-emerald-300 bg-emerald-50/60'
            : 'border-red-300 bg-red-50/40',
        )}
      >
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <div
              className={cn(
                'grid h-14 w-14 shrink-0 place-items-center rounded-2xl',
                allPass ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white',
              )}
            >
              {allPass ? (
                <CheckCircle2 className="h-8 w-8" />
              ) : (
                <XCircle className="h-8 w-8" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2
                className={cn(
                  'font-display text-xl font-bold sm:text-2xl',
                  allPass ? 'text-emerald-800' : 'text-red-700',
                )}
              >
                {allPass
                  ? t('verification.electionVerified')
                  : t('verification.verificationFailed')}
              </h2>
              <p
                className={cn(
                  'mt-1 text-sm',
                  allPass ? 'text-emerald-700' : 'text-red-600',
                )}
              >
                {allPass
                  ? t('verification.electionVerifiedDesc')
                  : t('verification.verificationFailedDesc')}
              </p>
            </div>
          </div>

          <Separator className="my-4" />

          <div className="grid gap-2 sm:grid-cols-2">
            {data.checks.map((c) => (
              <div
                key={c.key}
                className={cn(
                  'flex items-start gap-2.5 rounded-lg border p-3',
                  c.passed
                    ? 'border-emerald-200 bg-emerald-50/60'
                    : 'border-red-200 bg-red-50/60',
                )}
              >
                {c.passed ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                )}
                <div className="min-w-0">
                  <div
                    className={cn(
                      'text-sm font-semibold',
                      c.passed ? 'text-emerald-800' : 'text-red-700',
                    )}
                  >
                    {c.label}
                  </div>
                  <div
                    className={cn(
                      'text-xs',
                      c.passed ? 'text-emerald-700' : 'text-red-600',
                    )}
                  >
                    {c.detail}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Summary stats (5 cards)
// ---------------------------------------------------------------------------
function SummaryStats({ data }: { data: PortalData }) {
  const v = data.verification
  const stats = [
    {
      icon: Users,
      label: 'Total Eligible',
      value: v.totalEligible.toLocaleString(),
      tint: 'bg-emerald-50 text-emerald-700',
    },
    {
      icon: Vote,
      label: 'Total Votes',
      value: v.totalVotes.toLocaleString(),
      tint: 'bg-primary/10 text-primary',
    },
    {
      icon: XCircle,
      label: 'Invalid Votes',
      value: v.invalidVotes.toLocaleString(),
      tint: 'bg-red-50 text-red-700',
    },
    {
      icon: Eye,
      label: 'Blank Votes',
      value: v.blankVotes.toLocaleString(),
      tint: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300',
    },
    {
      icon: TrendingUp,
      label: 'Turnout',
      value: `${v.turnoutPct.toFixed(2)}%`,
      tint: 'bg-amber-50 text-amber-700',
    },
  ]
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } },
      }}
      className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
    >
      {stats.map((s) => (
        <motion.div
          key={s.label}
          variants={{
            hidden: { opacity: 0, y: 8 },
            show: { opacity: 1, y: 0 },
          }}
        >
          <Card className="h-full">
            <CardContent className="p-4">
              <div className={cn('grid h-9 w-9 place-items-center rounded-lg', s.tint)}>
                <s.icon className="h-4 w-4" />
              </div>
              <div className="mt-2 font-display text-xl font-bold tabular-nums sm:text-2xl">
                {s.value}
              </div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Turnout progress bar (visual breakdown of certified turnout)
// ---------------------------------------------------------------------------
function TurnoutProgress({ data }: { data: PortalData }) {
  const v = data.verification
  const pct = Math.max(0, Math.min(100, v.turnoutPct))
  const remaining = Math.max(0, v.totalEligible - v.totalVotes)
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.12 }}
      className="mt-3"
    >
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <TrendingUp className="h-4 w-4 text-primary" /> Certified Turnout
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <Progress value={pct} className="h-3" />
          <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
            <span>
              <strong className="text-foreground">{v.totalVotes.toLocaleString()}</strong> of{' '}
              <strong className="text-foreground">{v.totalEligible.toLocaleString()}</strong> eligible voters
            </span>
            <span>
              <strong className="text-foreground">{remaining.toLocaleString()}</strong> did not vote
              {' · '}
              <strong className="text-amber-700">{pct.toFixed(2)}%</strong> turnout
            </span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Cryptographic proof
// ---------------------------------------------------------------------------
function CryptographicProof({ data }: { data: PortalData }) {
  const v = data.verification
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className="mt-4"
    >
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 font-display text-base sm:text-lg">
            <KeyRound className="h-4 w-4 text-primary" /> Cryptographic Proof
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          <p className="text-xs text-muted-foreground sm:text-sm">
            The <strong>audit hash</strong> is a SHA-256 of all vote records
            sorted by ID. Any modification to a single vote changes this hash.
            The <strong>integrity signature</strong> is an HMAC-SHA256 over
            the audit hash — proving this tally was produced by VoteWise and
            has not been altered since certification.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <HashField
              icon={Hash}
              label="Audit Hash (SHA-256)"
              value={v.auditHash}
              match={v.auditHashMatches}
              matchLabel={
                v.auditHashMatches
                  ? 'Matches recomputed hash'
                  : 'Does not match recomputed hash'
              }
            />
            <HashField
              icon={Lock}
              label="Integrity Signature (HMAC-SHA256)"
              value={v.integritySignature}
              match={v.signatureValid}
              matchLabel={
                v.signatureValid
                  ? 'Signature valid (HMAC re-verified)'
                  : 'Signature invalid'
              }
            />
          </div>

          <Separator />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <ProofMeta
              icon={Calendar}
              label="Generated At"
              value={new Date(v.generatedAt).toLocaleString()}
            />
            <ProofMeta
              icon={FileCheck}
              label="Vote Records"
              value={`${data.voteRecordCount.toLocaleString()} stored`}
            />
            <ProofMeta
              icon={ScrollText}
              label="Audit Entries"
              value={`${data.chain.electionEntries.toLocaleString()} for this election`}
            />
          </div>

          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
            <div className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
              <p className="text-xs text-emerald-800">
                <strong>How to independently verify:</strong> Download the
                verification package below, recompute the SHA-256 of all vote
                record IDs + receipt codes + position IDs + timestamps
                (sorted by ID), and compare to the audit hash. Then verify
                the HMAC-SHA256 signature using VoteWise&apos;s public key.
                Any mismatch proves tampering.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function HashField({
  icon: Icon,
  label,
  value,
  match,
  matchLabel,
}: {
  icon: any
  label: string
  value: string
  match?: boolean
  matchLabel?: string
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Icon className="h-3.5 w-3.5 text-primary" /> {label}
        </div>
        {typeof match === 'boolean' && (
          <Badge
            className={cn(
              'gap-1 text-[10px]',
              match
                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
                : 'bg-red-100 text-red-700 hover:bg-red-100',
            )}
          >
            {match ? (
              <CheckCircle2 className="h-3 w-3" />
            ) : (
              <XCircle className="h-3 w-3" />
            )}
            {match ? 'Verified' : 'Mismatch'}
          </Badge>
        )}
      </div>
      <div className="flex items-start gap-2">
        <code className="min-w-0 flex-1 break-all font-mono text-xs text-foreground">
          {value}
        </code>
        <div className="flex shrink-0 items-center gap-0.5">
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-1.5 text-xs"
                aria-label={`Expand ${label}`}
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 font-display">
                  <Icon className="h-4 w-4 text-primary" /> {label}
                </DialogTitle>
                <DialogDescription>
                  Full value below — copy and use for independent verification.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <pre className="max-h-64 overflow-auto votewise-scroll rounded-lg border border-border/60 bg-muted/40 p-3 font-mono text-xs leading-relaxed">
                  {value}
                </pre>
                <Button
                  onClick={() => copyToClipboard(value, label)}
                  className="w-full gap-2"
                >
                  <Copy className="h-4 w-4" /> Copy to clipboard
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => copyToClipboard(value, label)}
            className="h-7 px-2 text-xs"
            aria-label={`Copy ${label}`}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {matchLabel && (
        <div
          className={cn(
            'mt-1.5 text-[11px]',
            match ? 'text-emerald-700' : 'text-red-600',
          )}
        >
          {matchLabel}
        </div>
      )}
    </div>
  )
}

function ProofMeta({
  icon: Icon,
  label,
  value,
}: {
  icon: any
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-primary" /> {label}
      </div>
      <div className="mt-1 truncate text-sm font-medium">{value}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Certified results by position
// ---------------------------------------------------------------------------
function CertifiedResults({ data }: { data: PortalData }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="mt-4"
    >
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 font-display text-base sm:text-lg">
              <Trophy className="h-4 w-4 text-amber-600" /> Certified Results
            </CardTitle>
            <Badge className="gap-1 bg-amber-100 text-amber-800 hover:bg-amber-100">
              <Award className="h-3 w-3" /> Final & Certified
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          <p className="text-xs text-muted-foreground">
            These are the official, certified results. Winners are highlighted
            with a gold border. The vote counts are derived by decrypting
            every AES-256-GCM encrypted ballot using the tally key.
          </p>

          {data.resultsByPosition.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/60 bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              No positions configured for this election.
            </div>
          ) : (
            <div className="space-y-4">
              {data.resultsByPosition.map((pos, idx) => (
                <PositionTable key={pos.positionId} position={pos} delay={idx * 0.04} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

function PositionTable({ position, delay }: { position: PositionResult; delay: number }) {
  const total = position.results.reduce((s, r) => s + r.votes, 0)
  const maxVotes = Math.max(...position.results.map((r) => r.votes), 0)
  const sorted = [...position.results].sort((a, b) => b.votes - a.votes)

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="rounded-xl border border-border/60 bg-card p-3 sm:p-4"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-display text-sm font-semibold sm:text-base">
          <Vote className="h-4 w-4 text-primary" /> {position.title}
        </h3>
        <div className="flex items-center gap-2">
          {position.tie && (
            <Badge variant="outline" className="gap-1 border-amber-300 text-amber-700">
              <Sparkles className="h-3 w-3" /> Tie
            </Badge>
          )}
          <Badge variant="secondary" className="gap-1">
            <Hash className="h-3 w-3" /> {total.toLocaleString()} votes
          </Badge>
        </div>
      </div>

      {/* Mobile: card list / Desktop: table */}
      <div className="space-y-2 sm:hidden">
        {sorted.map((r) => {
          const widthPct = maxVotes > 0 ? (r.votes / maxVotes) * 100 : 0
          return (
            <div
              key={r.candidateId || 'nota'}
              className={cn(
                'rounded-lg border p-3',
                r.isWinner
                  ? 'border-amber-300 bg-amber-50/60'
                  : 'border-border/60 bg-card',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span
                    className={cn(
                      'truncate text-sm font-semibold',
                      r.isWinner ? 'text-amber-800' : 'text-foreground',
                    )}
                  >
                    {r.candidateName}
                  </span>
                  {r.isWinner && (
                    <Badge className="shrink-0 gap-1 bg-amber-500 text-white hover:bg-amber-500">
                      <Trophy className="h-3 w-3" /> Winner
                    </Badge>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-mono text-sm font-bold tabular-nums">
                    {r.votes.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {r.percentage.toFixed(2)}%
                  </div>
                </div>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                <motion.div
                  className={cn(
                    'h-full rounded-full',
                    r.isWinner ? 'bg-amber-500' : 'bg-primary/60',
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${widthPct}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-lg border border-border/60 sm:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-semibold">Candidate</th>
              <th className="px-3 py-2 text-right font-semibold">Votes</th>
              <th className="px-3 py-2 text-right font-semibold">Pct</th>
              <th className="px-3 py-2 font-semibold">Share</th>
              <th className="px-3 py-2 text-right font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const widthPct = maxVotes > 0 ? (r.votes / maxVotes) * 100 : 0
              return (
                <tr
                  key={r.candidateId || 'nota'}
                  className={cn(
                    'border-t border-border/40',
                    r.isWinner ? 'bg-amber-50/60' : 'bg-card',
                  )}
                >
                  <td className="px-3 py-2.5">
                    <span
                      className={cn(
                        'font-medium',
                        r.isWinner ? 'text-amber-800' : 'text-foreground',
                      )}
                    >
                      {r.candidateName}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-bold tabular-nums">
                    {r.votes.toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                    {r.percentage.toFixed(2)}%
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="h-2 w-32 overflow-hidden rounded-full bg-muted">
                      <motion.div
                        className={cn(
                          'h-full rounded-full',
                          r.isWinner ? 'bg-amber-500' : 'bg-primary/60',
                        )}
                        initial={{ width: 0 }}
                        animate={{ width: `${widthPct}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {r.isWinner ? (
                      <Badge className="gap-1 bg-amber-500 text-white hover:bg-amber-500">
                        <Trophy className="h-3 w-3" /> Winner
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Audit chain visualization
// ---------------------------------------------------------------------------
function AuditChainVisualization({ data }: { data: PortalData }) {
  const chain = data.chain
  // Build the visible entries list. When the election has ≤6 audit entries,
  // head and tail overlap — deduplicate so we don't render the same entry
  // twice (and avoid duplicate React keys).
  const headIds = new Set(chain.head.map((e) => e.id))
  const tailDeduped = chain.tail.filter((e) => !headIds.has(e.id))
  const hasMiddle = chain.hiddenMiddleCount > 0 && tailDeduped.length > 0
  const entries = [...chain.head, ...tailDeduped]
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.25 }}
      className="mt-4"
    >
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 font-display text-base sm:text-lg">
              <ScrollText className="h-4 w-4 text-primary" /> Audit Chain Integrity
            </CardTitle>
            <Badge
              className={cn(
                'gap-1',
                chain.intact
                  ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
                  : 'bg-red-100 text-red-700 hover:bg-red-100',
              )}
            >
              {chain.intact ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                <XCircle className="h-3 w-3" />
              )}
              {chain.intact ? 'Chain Intact' : 'Chain Broken'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          <p className="text-xs text-muted-foreground">
            Every privileged action — voter verification, vote cast,
            certification — is appended to a hash-chained audit log. Each
            entry&apos;s hash depends on the previous entry&apos;s hash. Any
            modification to a past entry breaks the chain and is immediately
            detectable. {chain.totalChecked.toLocaleString()} entries
            verified for this election.
          </p>

          {/* Chain stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ChainStat label="Entries verified" value={chain.totalChecked.toLocaleString()} />
            <ChainStat label="This election" value={chain.electionEntries.toLocaleString()} />
            <ChainStat
              label="Genesis"
              value={shortHash(chain.genesis, 6, 4)}
              mono
            />
            <ChainStat
              label="Status"
              value={chain.intact ? 'Intact' : 'Broken'}
              tone={chain.intact ? 'emerald' : 'red'}
            />
          </div>

          {/* Chain diagram */}
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3 sm:p-4">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {hasMiddle
                ? `Hash chain (first ${chain.head.length} + last ${tailDeduped.length} entries)`
                : `Hash chain (all ${entries.length} entries)`}
            </div>
            <div className="space-y-2">
              {/* Genesis */}
              <ChainNode
                label="GENESIS"
                sub="Anchor hash"
                hash={chain.genesis}
                isGenesis
              />
              {entries.map((entry, idx) => (
                <ChainNode
                  key={`${idx}-${entry.id}`}
                  label={entry.action}
                  sub={`${entry.actorName} · ${entry.actorRole} · ${new Date(entry.createdAt).toLocaleString()}`}
                  hash={entry.hash}
                  prevHash={entry.prevHash}
                  isTail={idx >= chain.head.length}
                  showDivider={idx === chain.head.length && hasMiddle}
                  hiddenCount={chain.hiddenMiddleCount}
                />
              ))}
            </div>
          </div>

          {chain.brokenAt && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>Audit chain broken</AlertTitle>
              <AlertDescription>
                The chain verification failed at entry{' '}
                <code className="font-mono text-xs">{chain.brokenAt}</code>.
                This indicates tampering with the audit log. Do not trust
                these results.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

function ChainStat({
  label,
  value,
  mono,
  tone,
}: {
  label: string
  value: string
  mono?: boolean
  tone?: 'emerald' | 'red'
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          'mt-1 truncate text-sm font-semibold',
          mono && 'font-mono',
          tone === 'emerald' && 'text-emerald-700',
          tone === 'red' && 'text-red-600',
        )}
      >
        {value}
      </div>
    </div>
  )
}

function ChainNode({
  label,
  sub,
  hash,
  prevHash,
  isGenesis,
  isTail,
  showDivider,
  hiddenCount,
}: {
  label: string
  sub: string
  hash: string
  prevHash?: string
  isGenesis?: boolean
  isTail?: boolean
  showDivider?: boolean
  hiddenCount?: number
}) {
  return (
    <>
      {showDivider && hiddenCount ? (
        <div className="flex items-center gap-2 py-1 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border/60" />
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">
            {hiddenCount.toLocaleString()} entries hidden
          </span>
          <div className="h-px flex-1 bg-border/60" />
        </div>
      ) : null}
      <div
        className={cn(
          'flex items-start gap-2 rounded-lg border p-2.5',
          isGenesis
            ? 'border-primary/40 bg-primary/5'
            : isTail
              ? 'border-amber-200 bg-amber-50/40'
              : 'border-border/60 bg-card',
        )}
      >
        <div
          className={cn(
            'mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md text-[10px] font-bold',
            isGenesis
              ? 'bg-primary/20 text-primary'
              : 'bg-muted text-muted-foreground',
          )}
        >
          {isGenesis ? '◆' : isTail ? '⇲' : '→'}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs font-semibold uppercase tracking-wide">
              {label}
            </span>
            <button
              onClick={() => copyToClipboard(hash, 'Hash')}
              className="shrink-0 text-muted-foreground transition-colors hover:text-primary"
              aria-label="Copy hash"
            >
              <Copy className="h-3 w-3" />
            </button>
          </div>
          <div className="truncate text-[11px] text-muted-foreground">{sub}</div>
          <div className="mt-1 flex flex-col gap-0.5 font-mono text-[10px] text-muted-foreground">
            {prevHash && (
              <div className="truncate">
                <span className="text-muted-foreground/60">prev:</span>{' '}
                {shortHash(prevHash, 8, 6)}
              </div>
            )}
            <div className="truncate">
              <span className="text-muted-foreground/60">hash:</span>{' '}
              {shortHash(hash, 8, 6)}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Download + Share
// ---------------------------------------------------------------------------
function DownloadAndShare({ data }: { data: PortalData }) {
  function downloadPackage() {
    const payload = {
      electionId: data.electionId,
      electionName: data.electionName,
      description: data.description,
      organizationName: data.organizationName,
      university: data.university,
      academicSession: data.academicSession,
      votingMethod: data.votingMethod,
      status: data.status,
      certificationDate: data.certificationDate,
      votingWindow: data.votingWindow,
      verification: data.verification,
      resultsByPosition: data.resultsByPosition,
      chain: {
        intact: data.chain.intact,
        totalChecked: data.chain.totalChecked,
        electionEntries: data.chain.electionEntries,
        genesis: data.chain.genesis,
        brokenAt: data.chain.brokenAt,
      },
      voteRecordCount: data.voteRecordCount,
      checks: data.checks,
      verified: data.verified,
      generatedAt: new Date().toISOString(),
      portalUrl: typeof window !== 'undefined' ? window.location.href : data.portalUrl,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `votewise-verification-${data.electionId}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Verification package downloaded')
  }

  const shareUrl =
    typeof window !== 'undefined' ? window.location.href : data.portalUrl
  const shareText = `Verified election results for "${data.electionName}"${data.organizationName ? ` by ${data.organizationName}` : ''} — independent cryptographic verification via VoteWise.`

  const socials = [
    {
      name: 'Twitter / X',
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
    },
    {
      name: 'WhatsApp',
      href: `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`,
    },
    {
      name: 'Facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    },
    {
      name: 'LinkedIn',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
    },
  ]

  function copyShareLink() {
    copyToClipboard(shareUrl, 'Verification URL')
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      className="mt-4 grid gap-4 lg:grid-cols-2"
    >
      {/* Download */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 font-display text-base">
            <Download className="h-4 w-4 text-primary" /> Download Verification Package
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-2">
          <p className="text-xs text-muted-foreground">
            Download the full verification package as JSON. Contains the
            audit hash, integrity signature, certified results, chain
            integrity report, and check status. Share it with auditors,
            journalists, or anyone who wants to independently verify.
          </p>
          <Button onClick={downloadPackage} className="w-full gap-2">
            <Download className="h-4 w-4" /> Download JSON
          </Button>
        </CardContent>
      </Card>

      {/* Share */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 font-display text-base">
            <Share2 className="h-4 w-4 text-primary" /> Share this verification
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-2">
          <p className="text-xs text-muted-foreground">
            Anyone with this URL can independently verify the integrity of
            this certified election. Share widely — transparency builds trust.
          </p>
          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={shareUrl}
              className="font-mono text-xs"
              aria-label="Verification URL"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={copyShareLink}
              className="shrink-0 gap-1.5"
            >
              <Copy className="h-4 w-4" /> Copy
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {socials.map((s) => (
              <a
                key={s.name}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-border bg-card px-3 text-xs font-medium transition-colors hover:bg-muted"
              >
                <ExternalLink className="h-3 w-3" />
                <span className="truncate">{s.name}</span>
              </a>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Inline receipt verification
// ---------------------------------------------------------------------------
function ReceiptVerifyInline() {
  const [receiptCode, setReceiptCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [result, setResult] = useState<any>(null)

  async function verify() {
    const code = receiptCode.trim()
    if (!code) {
      toast.error('Enter your receipt code first')
      return
    }
    setVerifying(true)
    setResult(null)
    try {
      const r = await api.publicVerifyReceipt(code)
      setResult(r)
    } catch (e: any) {
      setResult({
        valid: false,
        message: e?.message || 'Receipt not found',
      })
    } finally {
      setVerifying(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.35 }}
      className="mt-4"
    >
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 font-display text-base">
            <BadgeCheck className="h-4 w-4 text-primary" /> Verify your vote was counted
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-2">
          <p className="text-xs text-muted-foreground">
            Cast a vote in this election? Enter your receipt code below to
            confirm your ballot was recorded and counted. Your choice remains
            encrypted — only participation is verifiable.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder="VW-YYYY-XXXXXXXX"
              value={receiptCode}
              onChange={(e) => setReceiptCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === 'Enter') verify()
              }}
              className="font-mono sm:flex-1"
              autoComplete="off"
              spellCheck={false}
              aria-label="Receipt code"
            />
            <Button
              onClick={verify}
              disabled={verifying || !receiptCode.trim()}
              className="shrink-0 gap-2"
            >
              {verifying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              Verify Receipt
            </Button>
          </div>

          {result && (
            <Alert
              variant={result.valid ? 'default' : 'destructive'}
              className={
                result.valid
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : ''
              }
            >
              {result.valid ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertTitle className={result.valid ? 'text-emerald-800' : ''}>
                {result.valid ? 'Vote confirmed & counted' : 'Receipt not found'}
              </AlertTitle>
              <AlertDescription
                className={result.valid ? 'text-emerald-700' : ''}
              >
                {result.electionName && (
                  <p>Election: <strong>{result.electionName}</strong></p>
                )}
                {(result.positionTitle || result.position) && (
                  <p>
                    Position:{' '}
                    <strong>{result.positionTitle || result.position}</strong>
                  </p>
                )}
                {result.recordedAt && (
                  <p>
                    Recorded at:{' '}
                    <span className="font-mono">
                      {new Date(result.recordedAt).toLocaleString()}
                    </span>
                  </p>
                )}
                {result.isSimulation && (
                  <p className="mt-1 inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                    <AlertCircle className="h-3 w-3" /> Simulation vote (not counted)
                  </p>
                )}
                {result.message && (
                  <p className="mt-1 text-xs">{result.message}</p>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------
function PortalFooter({ data }: { data: PortalData }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, delay: 0.4 }}
      className="mt-6 flex flex-col items-center justify-between gap-3 rounded-xl border border-border/60 bg-secondary/30 p-4 sm:flex-row"
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
        <span>
          This verification was generated by VoteWise using AES-256-GCM
          encrypted ballots, a hash-chained audit log, and HMAC-SHA256
          signed tallies. Package generated{' '}
          {new Date(data.generatedAt).toLocaleString()}.
        </span>
      </div>
      <div className="flex shrink-0 gap-2">
        <Link href={data.publicResultsUrl}>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Eye className="h-4 w-4" /> Public Results
          </Button>
        </Link>
        <Link href="/">
          <Button variant="ghost" size="sm" className="gap-1.5">
            VoteWise <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>
    </motion.div>
  )
}
