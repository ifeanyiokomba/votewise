'use client'

import { useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, UserCheck, Vote, CheckCircle2, Clock, Shield, Lock, Mail,
  Phone, Hash, Calendar, ArrowRight, AlertCircle, FileText, Award,
  Loader2, Building2, KeyRound, ScrollText, Sparkles, ExternalLink,
  XCircle, ShieldCheck, BadgeCheck, EyeOff,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n'
import { toast } from 'sonner'

// ---------------------------------------------------------------------------
// Types — mirror the API response shape.
// ---------------------------------------------------------------------------

interface VoterSummary {
  fullName: string
  status: string
  verificationStatus: string
  organizationName: string
  organizationSubdomain: string | null
}

interface ElectionSummary {
  electionId: string
  name: string
  status: string
  hasVoted: boolean
  votedAt: string | null
  votingOpen: boolean
  startTime: string
  endTime: string
}

interface ReceiptSummary {
  receiptCode: string
  electionName: string
  positionTitle: string
  recordedAt: string
}

interface TimelineSummary {
  eventType: string
  description: string | null
  createdAt: string
}

interface VoterMatch {
  voter: VoterSummary
  elections: ElectionSummary[]
  receipts: ReceiptSummary[]
  timeline: TimelineSummary[]
}

interface VoterStatusResponse {
  found: boolean
  matches?: VoterMatch[]
  message?: string
  _privacy: {
    choicesHidden: string
    receiptAnchored: string
    voterHashOneWay: string
  }
}

interface ReceiptVerifyResult {
  valid: boolean
  counted?: boolean
  receiptCode: string
  electionName?: string
  positionTitle?: string
  recordedAt?: string
  isSimulation?: boolean
  message: string
  note?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0]?.toUpperCase() || '')
    .filter(Boolean)
    .slice(0, 2)
    .join('')
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function fmtDateShort(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

// Map voter status → Badge class (emerald / amber / red only — NO indigo/blue).
function statusBadgeCls(status: string): string {
  const s = (status || '').toUpperCase()
  if (s === 'ACTIVE') return 'bg-emerald-100 text-emerald-700'
  if (s === 'SUSPENDED') return 'bg-amber-100 text-amber-700'
  if (s === 'REMOVED') return 'bg-red-100 text-red-700'
  return 'bg-muted text-muted-foreground'
}

function verificationBadgeCls(v: string): string {
  const s = (v || '').toUpperCase()
  if (s === 'VERIFIED') return 'bg-emerald-100 text-emerald-700'
  if (s === 'PENDING') return 'bg-amber-100 text-amber-700'
  if (s === 'REJECTED') return 'bg-red-100 text-red-700'
  return 'bg-muted text-muted-foreground'
}

// Map election lifecycle status → Badge class.
function electionBadgeCls(status: string): string {
  const s = (status || '').toUpperCase()
  if (s === 'LIVE' || s === 'VOTING' || s === 'OPEN') return 'bg-emerald-100 text-emerald-700'
  if (s === 'CERTIFIED') return 'bg-accent text-accent-foreground'
  if (s === 'COMPLETED' || s === 'CLOSED') return 'bg-amber-100 text-amber-700'
  if (s === 'DRAFT') return 'bg-muted text-muted-foreground'
  if (s === 'PUBLISHED' || s === 'SCHEDULED' || s === 'READY') return 'bg-primary/10 text-primary'
  return 'bg-muted text-muted-foreground'
}

function electionStatusDisplay(status: string): string {
  const s = (status || '').toUpperCase()
  const map: Record<string, string> = {
    DRAFT: 'Draft',
    PUBLISHED: 'Published',
    SCHEDULED: 'Scheduled',
    READY: 'Ready',
    ACCREDITATION: 'Accreditation',
    LIVE: 'Live',
    VOTING: 'Voting Open',
    OPEN: 'Voting Open',
    PAUSED: 'Paused',
    COMPLETED: 'Completed',
    CLOSED: 'Closed',
    CERTIFIED: 'Certified',
    ARCHIVED: 'Archived',
    CANCELLED: 'Cancelled',
    PENDING_REVIEW: 'Pending Review',
  }
  return map[s] || status
}

// Timeline icon + tint map (emerald / amber / red only).
const TIMELINE_ICON_MAP: Record<string, { icon: any; cls: string }> = {
  IMPORTED: { icon: UserCheck, cls: 'bg-muted text-muted-foreground' },
  EMAIL_VERIFIED: { icon: BadgeCheck, cls: 'bg-emerald-100 text-emerald-700' },
  PHONE_VERIFIED: { icon: BadgeCheck, cls: 'bg-emerald-100 text-emerald-700' },
  ACCREDITED: { icon: ShieldCheck, cls: 'bg-emerald-100 text-emerald-700' },
  OTVP_ISSUED: { icon: KeyRound, cls: 'bg-amber-100 text-amber-700' },
  OTVP_VERIFIED: { icon: BadgeCheck, cls: 'bg-emerald-100 text-emerald-700' },
  VOTE_CAST: { icon: Vote, cls: 'bg-emerald-100 text-emerald-700' },
  VOTING_SESSION_STARTED: { icon: Clock, cls: 'bg-amber-100 text-amber-700' },
  RESULT_PUBLISHED: { icon: Award, cls: 'bg-accent text-accent-foreground' },
  SUSPENDED: { icon: AlertCircle, cls: 'bg-red-100 text-red-700' },
  REACTIVATED: { icon: BadgeCheck, cls: 'bg-emerald-100 text-emerald-700' },
  GROUP_ASSIGNED: { icon: UserCheck, cls: 'bg-muted text-muted-foreground' },
  PROFILE_UPDATED: { icon: UserCheck, cls: 'bg-muted text-muted-foreground' },
}

function timelineIconFor(eventType: string) {
  const key = (eventType || '').toUpperCase()
  return TIMELINE_ICON_MAP[key] || { icon: FileText, cls: 'bg-muted text-muted-foreground' }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VoterStatusPortal() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background">
      <VoterStatusPortalInner />
    </div>
  )
}

function VoterStatusPortalInner() {
  const { t } = useTranslation()
  const searchParams = useSearchParams()
  // Prefill is parsed so searchParams stays consistent with prior behaviour;
  // the cross-org lookup intentionally ignores it (kept for log-compatibility).
  const prefillOrg = searchParams.get('org') || undefined
  void prefillOrg

  const [identifier, setIdentifier] = useState('')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<VoterStatusResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const runSearch = useCallback(async () => {
    const q = identifier.trim()
    if (!q) {
      toast.error(t('voterStatus.identifier'))
      return
    }
    setLoading(true)
    setError(null)
    setData(null)
    try {
      const res = await api.checkVoterStatus(q)
      setData(res)
    } catch (e: any) {
      setError(e?.message || 'Something went wrong while looking up your record.')
    } finally {
      setLoading(false)
    }
  }, [identifier, t])

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !loading) runSearch()
  }

  const privacy = data?._privacy

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 md:py-14">
      {/* ----------------------------------------------------------------- */}
      {/* HEADER                                                            */}
      {/* ----------------------------------------------------------------- */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-8 text-center"
      >
        <Badge variant="secondary" className="mb-3 gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" /> {t('voterStatus.portalTitle')}
        </Badge>
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          {t('voterStatus.title')} <span className="text-primary">{t('voterStatus.titleHighlight')}</span>
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
          {t('voterStatus.desc')}{' '}
          <span className="font-medium text-foreground">{t('voterStatus.descHighlight')}</span>
        </p>
      </motion.div>

      {/* ----------------------------------------------------------------- */}
      {/* SEARCH                                                            */}
      {/* ----------------------------------------------------------------- */}
      <Card className="votewise-card-glow mb-8 overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <Search className="h-5 w-5 text-primary" /> {t('voterStatus.lookUpRecord')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="voter-status-identifier" className="sr-only">
              {t('voterStatus.identifier')}
            </Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="voter-status-identifier"
                  type="text"
                  inputMode="email"
                  placeholder={t('voterStatus.identifierPlaceholder')}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  onKeyDown={onKeyDown}
                  className="h-12 pl-9 text-base"
                  autoComplete="off"
                  spellCheck={false}
                  disabled={loading}
                />
              </div>
              <Button
                onClick={runSearch}
                disabled={loading || !identifier.trim()}
                className="h-12 gap-2 px-6 sm:w-auto"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> {t('voterStatus.checking')}
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" /> {t('voterStatus.checkStatus')}
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('voterStatus.identifierHint')}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ----------------------------------------------------------------- */}
      {/* ERROR                                                             */}
      {/* ----------------------------------------------------------------- */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="mb-6"
          >
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{t('voterStatus.voterNotFound')}</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ----------------------------------------------------------------- */}
      {/* RESULTS                                                           */}
      {/* ----------------------------------------------------------------- */}
      <AnimatePresence mode="wait">
        {data && (
          <motion.div
            key={data.found ? 'found' : 'notfound'}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35 }}
            className="space-y-6"
          >
            {data.found && data.matches && data.matches.length > 0 ? (
              <FoundResults matches={data.matches} message={data.message} />
            ) : (
              <NotFoundResults message={data.message} />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ----------------------------------------------------------------- */}
      {/* PRIVACY NOTICE                                                    */}
      {/* ----------------------------------------------------------------- */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.4 }}
        className="mt-12"
      >
        <Card className="border-primary/20 bg-primary/[0.03]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-base">
              <Shield className="h-5 w-5 text-primary" /> {t('voterStatus.privacyGuarantees')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                  {t('voterStatus.whatIsShown')}
                </p>
                <PrivacyLine ok icon={UserCheck} text={t('voterStatus.shownRegistration')} />
                <PrivacyLine ok icon={Vote} text={t('voterStatus.shownParticipation')} />
                <PrivacyLine ok icon={FileText} text={t('voterStatus.shownReceipts')} />
              </div>
              <div className="space-y-2.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-red-700">
                  {t('voterStatus.whatIsNeverRevealed')}
                </p>
                <PrivacyLine icon={Lock} text={t('voterStatus.hiddenChoices')} />
                <PrivacyLine icon={EyeOff} text={t('voterStatus.hiddenIdentity')} />
                <PrivacyLine icon={KeyRound} text={t('voterStatus.hiddenLinking')} />
              </div>
            </div>
            <Separator className="my-4" />
            <div className="space-y-2 text-xs text-muted-foreground">
              <p className="flex items-start gap-2">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <span>{privacy?.choicesHidden}</span>
              </p>
              <p className="flex items-start gap-2">
                <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <span>{privacy?.receiptAnchored}</span>
              </p>
              <p className="flex items-start gap-2">
                <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <span>{privacy?.voterHashOneWay}</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Privacy line — emerald check or red cross
// ---------------------------------------------------------------------------

function PrivacyLine({
  ok,
  icon: Icon,
  text,
}: {
  ok?: boolean
  icon: any
  text: string
}) {
  return (
    <div className="flex items-start gap-2.5">
      {ok ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
      ) : (
        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
      )}
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="text-sm">{text}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Found results — list of matches (one per org)
// ---------------------------------------------------------------------------

function FoundResults({ matches, message }: { matches: VoterMatch[]; message?: string }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-6">
      {/* Summary banner */}
      {message && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-100">
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>{t('voterStatus.recordFound')}</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        </motion.div>
      )}

      {/* Per-org match cards */}
      {matches.map((m, idx) => (
        <motion.div
          key={`${m.voter.organizationName}-${idx}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: Math.min(idx * 0.08, 0.4) }}
        >
          <VoterMatchCard match={m} />
        </motion.div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// One match card — voter card + elections + receipts + timeline
// ---------------------------------------------------------------------------

function VoterMatchCard({ match }: { match: VoterMatch }) {
  const { t } = useTranslation()
  const { voter, elections, receipts, timeline } = match

  return (
    <div className="space-y-5">
      {/* Voter identity card */}
      <Card className="votewise-card-glow overflow-hidden">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14 border-2 border-primary/20 sm:h-16 sm:w-16">
                <AvatarFallback className="bg-primary/10 text-base font-bold text-primary sm:text-lg">
                  {initials(voter.fullName) || '?'}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="font-display text-xl font-bold tracking-tight sm:text-2xl">
                  {voter.fullName}
                </h2>
                <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5" />
                  <span>{voter.organizationName}</span>
                  {voter.organizationSubdomain && (
                    <Badge variant="outline" className="ml-1 text-[10px] font-mono">
                      {voter.organizationSubdomain}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={cn('gap-1', statusBadgeCls(voter.status))}>
                <UserCheck className="h-3.5 w-3.5" />
                {voter.status}
              </Badge>
              <Badge className={cn('gap-1', verificationBadgeCls(voter.verificationStatus))}>
                <BadgeCheck className="h-3.5 w-3.5" />
                {voter.verificationStatus}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Elections list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-base">
            <Vote className="h-4 w-4 text-primary" /> {t('voterStatus.elections')}
            <Badge variant="outline" className="text-[10px]">{elections.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {elections.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <Vote className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <p className="mt-2">{t('voterStatus.noElections')}</p>
            </div>
          ) : (
            <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
              {elections.map((e, i) => (
                <ElectionRow key={e.electionId} election={e} subdomain={voter.organizationSubdomain} index={i} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Receipts */}
      {receipts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-base">
              <FileText className="h-4 w-4 text-primary" /> {t('voterStatus.yourReceipts')}
              <Badge variant="outline" className="text-[10px]">{receipts.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
              {receipts.map((r, i) => (
                <ReceiptRow key={r.receiptCode} receipt={r} index={i} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      {timeline.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-base">
              <ScrollText className="h-4 w-4 text-primary" /> {t('voterStatus.recentActivity')}
              <Badge variant="outline" className="text-[10px]">{timeline.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="relative space-y-4 border-l border-border/60 pl-5">
              {timeline.map((tlEvt, i) => {
                const { icon: Icon, cls } = timelineIconFor(tlEvt.eventType)
                return (
                  <motion.li
                    key={`${tlEvt.eventType}-${i}`}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, delay: Math.min(i * 0.04, 0.3) }}
                    className="relative"
                  >
                    <span
                      className={cn(
                        'absolute -left-[26px] grid h-7 w-7 place-items-center rounded-full ring-2 ring-background',
                        cls,
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">
                          {(tlEvt.eventType || 'EVENT').replace(/_/g, ' ')}
                        </span>
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {tlEvt.eventType}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {fmtDate(tlEvt.createdAt)}
                      </span>
                    </div>
                    {tlEvt.description && (
                      <p className="mt-1 text-sm text-muted-foreground">{tlEvt.description}</p>
                    )}
                  </motion.li>
                )
              })}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Election row
// ---------------------------------------------------------------------------

function ElectionRow({
  election,
  subdomain,
  index,
}: {
  election: ElectionSummary
  subdomain: string | null
  index: number
}) {
  const { t } = useTranslation()
  const now = Date.now()
  const startMs = new Date(election.startTime).getTime()
  const endMs = new Date(election.endTime).getTime()
  const upcoming = now < startMs
  const closed = now >= endMs

  const voteHref = subdomain
    ? `/workspace/elections/${encodeURIComponent(election.electionId)}/vote?org=${encodeURIComponent(subdomain)}`
    : `/workspace/elections/${encodeURIComponent(election.electionId)}/vote`

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.04, 0.3) }}
      className={cn(
        'rounded-lg border p-3 sm:p-4',
        election.votingOpen
          ? 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20'
          : 'border-border/60 bg-card',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold sm:text-base">{election.name}</h3>
            <Badge className={cn('text-[10px]', electionBadgeCls(election.status))}>
              {electionStatusDisplay(election.status)}
            </Badge>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {fmtDateShort(election.startTime)} — {fmtDateShort(election.endTime)}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          {election.hasVoted ? (
            <Badge className="gap-1 bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" /> {t('voterStatus.voted')}
            </Badge>
          ) : election.votingOpen ? (
            <Badge className="gap-1 bg-emerald-100 text-emerald-700">
              <Vote className="h-3.5 w-3.5" /> {t('voterStatus.eligibleOpen')}
            </Badge>
          ) : upcoming ? (
            <Badge className="gap-1 bg-primary/10 text-primary">
              <Clock className="h-3.5 w-3.5" /> {t('voterStatus.eligibleUpcoming')}
            </Badge>
          ) : closed ? (
            <Badge className="gap-1 bg-amber-100 text-amber-700">
              <Clock className="h-3.5 w-3.5" /> {t('voterStatus.didNotVote')}
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1">
              <Clock className="h-3.5 w-3.5" /> {t('voterStatus.pending')}
            </Badge>
          )}
          {election.hasVoted && election.votedAt && (
            <span className="text-[11px] text-muted-foreground">
              {t('voterStatus.voted')} {fmtDate(election.votedAt)}
            </span>
          )}
          {election.votingOpen && !election.hasVoted && (
            <Button asChild size="sm" className="gap-1.5">
              <Link href={voteHref}>
                <Vote className="h-3.5 w-3.5" /> {t('voterStatus.voteNow')}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Receipt row — with inline Verify button
// ---------------------------------------------------------------------------

function ReceiptRow({ receipt, index }: { receipt: ReceiptSummary; index: number }) {
  const { t } = useTranslation()
  const [verifying, setVerifying] = useState(false)
  const [result, setResult] = useState<ReceiptVerifyResult | null>(null)
  const [verifyError, setVerifyError] = useState<string | null>(null)

  async function verify() {
    setVerifying(true)
    setVerifyError(null)
    setResult(null)
    try {
      const res = await api.publicVerifyReceipt(receipt.receiptCode)
      setResult(res as ReceiptVerifyResult)
    } catch (e: any) {
      // 404 from the API returns { valid: false } — handled in the success
      // path. Only network/parse errors land here.
      setVerifyError(e?.message || t('voterStatus.verificationFailed'))
    } finally {
      setVerifying(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.04, 0.3) }}
      className="rounded-lg border border-border/60 bg-card p-3 sm:p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs font-semibold text-foreground">
              {receipt.receiptCode}
            </code>
            <Badge variant="outline" className="gap-1 text-[10px]">
              <FileText className="h-3 w-3" /> {t('voterStatus.receipt')}
            </Badge>
          </div>
          <div className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
            <p className="flex items-center gap-1.5">
              <Vote className="h-3.5 w-3.5" /> {receipt.electionName}
            </p>
            <p className="flex items-center gap-1.5">
              <Award className="h-3.5 w-3.5" /> {receipt.positionTitle}
            </p>
            <p className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" /> {t('voterStatus.recorded')} {fmtDate(receipt.recordedAt)}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={verify}
          disabled={verifying}
          className="gap-1.5"
        >
          {verifying ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('voterStatus.verifying')}
            </>
          ) : (
            <>
              <ShieldCheck className="h-3.5 w-3.5" /> {t('voterStatus.verify')}
            </>
          )}
        </Button>
      </div>

      {/* Inline verify result */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <Alert
              className={cn(
                'mt-3',
                result.valid
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-100'
                  : 'border-red-200 bg-red-50 text-red-900 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-100',
              )}
            >
              {result.valid ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              <AlertTitle>{result.valid ? t('voterStatus.voteConfirmed') : t('voterStatus.receiptNotFound')}</AlertTitle>
              <AlertDescription className="text-xs">
                {result.message}
                {result.electionName && (
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                    <span>{t('voterStatus.election')}: <span className="font-medium">{result.electionName}</span></span>
                    {result.positionTitle && (
                      <span>{t('voterStatus.position')}: <span className="font-medium">{result.positionTitle}</span></span>
                    )}
                    {result.recordedAt && (
                      <span>{t('voterStatus.recorded')}: <span className="font-medium">{fmtDate(result.recordedAt)}</span></span>
                    )}
                  </div>
                )}
                {result.note && (
                  <p className="mt-1.5 italic opacity-80">{result.note}</p>
                )}
              </AlertDescription>
            </Alert>
          </motion.div>
        )}
        {verifyError && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <Alert variant="destructive" className="mt-3">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{t('voterStatus.verificationFailed')}</AlertTitle>
              <AlertDescription>{verifyError}</AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Not-found results
// ---------------------------------------------------------------------------

function NotFoundResults({ message }: { message?: string }) {
  const { t } = useTranslation()
  const suggestions = [
    { icon: Search, text: t('voterStatus.suggestion1') },
    { icon: Hash, text: t('voterStatus.suggestion2') },
    { icon: Mail, text: t('voterStatus.suggestion3') },
    { icon: Phone, text: t('voterStatus.suggestion4') },
    { icon: Shield, text: t('voterStatus.suggestion5') },
  ]
  return (
    <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-base">
          <AlertCircle className="h-5 w-5 text-amber-600" /> {t('voterStatus.voterNotFound')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {message ||
            t('voterStatus.notFoundDesc')}
        </p>
        <Separator />
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('voterStatus.suggestions')}
          </p>
          <ul className="space-y-2">
            {suggestions.map((s, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: Math.min(i * 0.05, 0.3) }}
                className="flex items-start gap-2.5 text-sm"
              >
                <s.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{s.text}</span>
              </motion.li>
            ))}
          </ul>
        </div>
        <Separator />
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5" /> {t('voterStatus.lookupsPrivate')}
          </span>
          <Link
            href="/"
            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
          >
            <Sparkles className="h-3.5 w-3.5" /> {t('voterStatus.backToHome')}
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
