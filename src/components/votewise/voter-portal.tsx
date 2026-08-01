'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User, Vote, ShieldCheck, Headphones, Bell, Award, Clock, CheckCircle2,
  Loader2, ArrowLeft, Receipt, BadgeCheck, AlertCircle, Search, Copy,
  CalendarClock, ListChecks, FileText, ShieldAlert, Hourglass,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { api } from '@/lib/api'
import { useApp } from '@/lib/store'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface PortalElection {
  electionId: string
  name: string
  status: string
  hasVoted: boolean
  votedAt: string | null
  eligible: boolean
  votingOpen: boolean
  startTime: string
  endTime: string
  votingStatus: 'voted' | 'eligible' | 'pending'
}

interface PortalReceipt {
  receiptCode: string
  electionName: string
  positionTitle: string
  recordedAt: string
}

interface PortalTimelineEvent {
  id: string
  eventType: string
  description: string | null
  actorName: string | null
  electionId: string | null
  createdAt: string
}

interface PortalVoter {
  id: string
  fullName: string
  email: string | null
  matric: string
  hasVoted: boolean
  votedAt: string | null
  status: string | null
  verificationStatus: string | null
}

interface PortalData {
  voter: PortalVoter
  elections: PortalElection[]
  receipts: PortalReceipt[]
  timeline: PortalTimelineEvent[]
}

interface VerifyResult {
  valid: boolean
  receiptCode: string
  electionName?: string
  positionTitle?: string
  recordedAt?: string
  isSimulation?: boolean
  message: string
}

// Timeline icon map — emerald / amber palette only.
const TIMELINE_ICONS: Record<string, { icon: any; cls: string }> = {
  IMPORTED:                { icon: User, cls: 'bg-muted text-muted-foreground' },
  EMAIL_VERIFIED:          { icon: BadgeCheck, cls: 'bg-emerald-100 text-emerald-700' },
  PHONE_VERIFIED:          { icon: BadgeCheck, cls: 'bg-emerald-100 text-emerald-700' },
  ACCREDITED:              { icon: ShieldCheck, cls: 'bg-emerald-100 text-emerald-700' },
  OTVP_ISSUED:             { icon: ShieldCheck, cls: 'bg-amber-100 text-amber-700' },
  OTVP_VERIFIED:           { icon: BadgeCheck, cls: 'bg-emerald-100 text-emerald-700' },
  VOTE_CAST:               { icon: Vote, cls: 'bg-emerald-100 text-emerald-700' },
  VOTING_SESSION_STARTED:  { icon: Clock, cls: 'bg-amber-100 text-amber-700' },
  RESULT_PUBLISHED:        { icon: Award, cls: 'bg-accent text-accent-foreground' },
  SUSPENDED:               { icon: ShieldAlert, cls: 'bg-red-100 text-red-700' },
  REACTIVATED:             { icon: BadgeCheck, cls: 'bg-emerald-100 text-emerald-700' },
  GROUP_ASSIGNED:          { icon: ListChecks, cls: 'bg-muted text-muted-foreground' },
  PROFILE_UPDATED:         { icon: User, cls: 'bg-muted text-muted-foreground' },
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function VoterPortal({ subdomain: subdomainProp }: { subdomain?: string }) {
  return (
    <Suspense fallback={<div className="grid min-h-[40vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
      <VoterPortalInner subdomain={subdomainProp} />
    </Suspense>
  )
}

function VoterPortalInner({ subdomain: subdomainProp }: { subdomain?: string }) {
  const { setView, voterProfile } = useApp()
  const searchParams = useSearchParams()
  const subdomain = subdomainProp || searchParams.get('org') || undefined
  const demoVoterId = searchParams.get('voterId') || undefined

  const [tab, setTab] = useState('My Profile')
  const [data, setData] = useState<PortalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const TABS = [
    { label: 'My Profile', icon: User },
    { label: 'My Elections', icon: Vote },
    { label: 'Voting Status', icon: ShieldCheck },
    { label: 'My Receipts', icon: Receipt },
    { label: 'Timeline', icon: Clock },
    { label: 'Support', icon: Headphones },
    { label: 'Notifications', icon: Bell },
  ]

  async function load() {
    setLoading(true)
    setError(null)
    try {
      // If we have a demo voterId, pass it via the query string.
      const path = demoVoterId
        ? `/api/workspace/voter-portal?${subdomain ? `x-vw-org=${encodeURIComponent(subdomain)}&` : ''}voterId=${encodeURIComponent(demoVoterId)}`
        : undefined
      if (path) {
        const res = await fetch(path, { headers: { 'content-type': 'application/json' }, credentials: 'include' })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error || 'Failed to load portal data')
        setData(json)
      } else {
        const d = await api.getVoterPortal(subdomain)
        setData(d as PortalData)
      }
    } catch (e: any) {
      setError(e?.message || 'Unable to load your voter portal data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [subdomain, demoVoterId])

  // Header display name: prefer SVE data, fall back to legacy voterProfile.
  const displayName = data?.voter?.fullName || voterProfile?.fullName || 'Voter'
  const displayId = data?.voter?.matric || data?.voter?.id || voterProfile?.voterId || voterProfile?.matric || '—'
  const hasVoted = data?.voter?.hasVoted ?? voterProfile?.hasVoted ?? false
  const votedAt = data?.voter?.votedAt || voterProfile?.votedAt

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      <Button variant="ghost" size="sm" onClick={() => setView('home')} className="mb-4 gap-1.5">
        <ArrowLeft className="h-4 w-4" /> Back to Home
      </Button>

      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-2xl font-bold text-primary">
          {displayName.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">{displayName}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="font-mono text-[10px]">{displayId}</Badge>
            {hasVoted ? (
              <Badge className="gap-1 bg-emerald-100 text-emerald-700"><CheckCircle2 className="h-3 w-3" /> Voted</Badge>
            ) : (
              <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Not Voted</Badge>
            )}
            {data?.voter?.verificationStatus === 'VERIFIED' && (
              <Badge variant="outline" className="gap-1 bg-emerald-50 text-emerald-700"><BadgeCheck className="h-3 w-3" /> Verified</Badge>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.label}
            onClick={() => setTab(t.label)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              tab === t.label ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
            )}
          >
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18 }}
        >
          {tab === 'My Profile' && (
            <Card>
              <CardHeader><CardTitle className="font-display text-base">My Profile</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-muted/50 p-3"><div className="text-xs text-muted-foreground">Name</div><div className="font-medium">{displayName}</div></div>
                  <div className="rounded-lg bg-muted/50 p-3"><div className="text-xs text-muted-foreground">Voter ID</div><div className="font-mono text-xs">{displayId}</div></div>
                  <div className="rounded-lg bg-muted/50 p-3"><div className="text-xs text-muted-foreground">Email</div><div className="font-medium">{data?.voter?.email || voterProfile?.institutionEmail || voterProfile?.personalEmail || '—'}</div></div>
                  <div className="rounded-lg bg-muted/50 p-3"><div className="text-xs text-muted-foreground">Verification</div><div className="font-medium">{data?.voter?.verificationStatus || voterProfile?.verificationStatus || 'PENDING'}</div></div>
                </div>
                {voterProfile?.faculty && <div className="rounded-lg bg-muted/50 p-3"><div className="text-xs text-muted-foreground">Organization Unit</div><div className="font-medium">{voterProfile.faculty?.name || voterProfile.faculty}</div></div>}
                {voterProfile?.department && <div className="rounded-lg bg-muted/50 p-3"><div className="text-xs text-muted-foreground">Voter Group</div><div className="font-medium">{voterProfile.department?.name || voterProfile.department}</div></div>}
              </CardContent>
            </Card>
          )}

          {tab === 'My Elections' && (
            <Card><CardContent className="py-8 text-center">
              <Vote className="mx-auto h-12 w-12 text-muted-foreground/40" />
              <p className="mt-2 text-sm font-medium">Available Elections</p>
              <p className="mt-1 text-xs text-muted-foreground">Elections you are eligible for will appear in the Voting Status tab.</p>
              <Button size="sm" className="mt-3 gap-2" onClick={() => setTab('Voting Status')}><Vote className="h-4 w-4" /> View Voting Status</Button>
            </CardContent></Card>
          )}

          {tab === 'Voting Status' && (
            <VotingStatusTab
              data={data}
              loading={loading}
              error={error}
              subdomain={subdomain}
              hasVoted={hasVoted}
              votedAt={votedAt}
              onRetry={load}
            />
          )}

          {tab === 'My Receipts' && (
            <ReceiptsTab receipts={data?.receipts || []} loading={loading} error={error} onRetry={load} />
          )}

          {tab === 'Timeline' && (
            <TimelineTab events={data?.timeline || []} loading={loading} error={error} onRetry={load} />
          )}

          {tab === 'Support' && (
            <Card><CardContent className="py-8 text-center">
              <Headphones className="mx-auto h-12 w-12 text-muted-foreground/40" />
              <p className="mt-2 text-sm font-medium">Need Help?</p>
              <p className="mt-1 text-xs text-muted-foreground">Open a support ticket or chat with our AI assistant.</p>
              <Button size="sm" variant="outline" className="mt-3 gap-2"><Headphones className="h-4 w-4" /> Open Ticket</Button>
            </CardContent></Card>
          )}

          {tab === 'Notifications' && (
            <Card><CardContent className="py-8 text-center">
              <Bell className="mx-auto h-12 w-12 text-muted-foreground/40" />
              <p className="mt-2 text-sm text-muted-foreground">No notifications yet.</p>
            </CardContent></Card>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Voting Status tab — list of elections with voting status badges + Vote Now
// ---------------------------------------------------------------------------
function VotingStatusTab({
  data, loading, error, subdomain, hasVoted, votedAt, onRetry,
}: {
  data: PortalData | null
  loading: boolean
  error: string | null
  subdomain?: string
  hasVoted: boolean
  votedAt?: string | null
  onRetry: () => void
}) {
  if (loading) return <LoadingCard label="Loading your elections…" />
  if (error) return <ErrorCard error={error} onRetry={onRetry} />

  const elections = data?.elections || []
  const eligibleCount = elections.filter((e) => e.votingStatus === 'eligible').length
  const votedCount = elections.filter((e) => e.votingStatus === 'voted').length
  const pendingCount = elections.filter((e) => e.votingStatus === 'pending').length

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryStat icon={CheckCircle2} label="Voted" value={votedCount} cls="bg-emerald-100 text-emerald-700" />
        <SummaryStat icon={Vote} label="Eligible" value={eligibleCount} cls="bg-primary/10 text-primary" />
        <SummaryStat icon={Hourglass} label="Pending" value={pendingCount} cls="bg-amber-100 text-amber-700" />
      </div>

      {/* Overall status */}
      <Card className="votewise-card-glow">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className={cn('h-5 w-5', hasVoted ? 'text-emerald-600' : 'text-primary')} />
              <span className="text-sm font-medium">Overall Vote Status</span>
            </div>
            {hasVoted ? (
              <Badge className="bg-emerald-100 text-emerald-700">Voted</Badge>
            ) : (
              <Badge variant="secondary">Not Voted</Badge>
            )}
          </div>
          {votedAt && (
            <div className="mt-2 text-xs text-muted-foreground">
              Last voted on {new Date(votedAt).toLocaleString()}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Per-election list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-base">
            <ListChecks className="h-4 w-4 text-primary" /> Elections
            <Badge variant="outline" className="text-[10px]">{elections.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {elections.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <Vote className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <p className="mt-2">No elections available yet.</p>
              <p className="mt-1 text-xs">Elections you are eligible for will appear here.</p>
            </div>
          ) : (
            <div className="max-h-[600px] space-y-2 overflow-y-auto pr-1">
              {elections.map((e, idx) => (
                <motion.div
                  key={e.electionId}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: Math.min(idx * 0.03, 0.2) }}
                  className="rounded-lg border border-border/60 bg-card p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-medium">{e.name}</h4>
                        <VotingStatusBadge status={e.votingStatus} votingOpen={e.votingOpen} />
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1"><CalendarClock className="h-3 w-3" /> {new Date(e.startTime).toLocaleDateString()} → {new Date(e.endTime).toLocaleDateString()}</span>
                        {e.votedAt && <span className="flex items-center gap-1 text-emerald-700"><CheckCircle2 className="h-3 w-3" /> Voted {new Date(e.votedAt).toLocaleString()}</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {e.votingStatus === 'voted' ? (
                        <Badge variant="outline" className="gap-1 bg-emerald-50 text-emerald-700"><CheckCircle2 className="h-3 w-3" /> Done</Badge>
                      ) : e.votingOpen ? (
                        <Button
                          size="sm"
                          className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => {
                            window.location.href = `/workspace/elections/${e.electionId}/vote?org=${subdomain || ''}`
                          }}
                        >
                          <Vote className="h-3.5 w-3.5" /> Vote Now
                        </Button>
                      ) : (
                        <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> {e.status}</Badge>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// My Receipts tab — receipt list with inline verify
// ---------------------------------------------------------------------------
function ReceiptsTab({
  receipts, loading, error, onRetry,
}: {
  receipts: PortalReceipt[]
  loading: boolean
  error: string | null
  onRetry: () => void
}) {
  const [verifying, setVerifying] = useState<Set<string>>(new Set())
  const [results, setResults] = useState<Record<string, VerifyResult>>({})
  const [manualCode, setManualCode] = useState('')

  async function verify(code: string) {
    setVerifying((p) => new Set(p).add(code))
    try {
      const r = (await api.publicVerifyReceipt(code)) as VerifyResult
      setResults((p) => ({ ...p, [code]: r }))
      if (r.valid) toast.success('Receipt verified — your vote was counted.')
      else toast.error(r.message || 'Receipt could not be verified.')
    } catch (e: any) {
      setResults((p) => ({ ...p, [code]: { valid: false, receiptCode: code, message: e?.message || 'Verification failed' } }))
      toast.error(e?.message || 'Verification failed')
    } finally {
      setVerifying((p) => { const n = new Set(p); n.delete(code); return n })
    }
  }

  function copyCode(code: string) {
    navigator.clipboard?.writeText(code).then(() => toast.success('Receipt copied')).catch(() => {})
  }

  if (loading) return <LoadingCard label="Loading your receipts…" />
  if (error) return <ErrorCard error={error} onRetry={onRetry} />

  return (
    <div className="space-y-4">
      {/* Manual verify */}
      <Card className="votewise-card-glow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-base">
            <Search className="h-4 w-4 text-primary" /> Verify a Receipt
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="VW-2025-XXXXXXXX"
              className="font-mono"
              aria-label="Receipt code"
            />
            <Button
              onClick={() => { if (manualCode.trim()) verify(manualCode.trim().toUpperCase()) }}
              disabled={!manualCode.trim() || verifying.has(manualCode.trim().toUpperCase())}
              className="gap-2"
            >
              {verifying.has(manualCode.trim().toUpperCase()) ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Verify
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Receipt verification confirms your vote was recorded — without revealing which candidate you chose.
          </p>
          {manualCode.trim() && results[manualCode.trim().toUpperCase()] && (
            <ReceiptVerifyResult result={results[manualCode.trim().toUpperCase()]} />
          )}
        </CardContent>
      </Card>

      {/* Receipt list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-base">
            <Receipt className="h-4 w-4 text-primary" /> My Receipts
            <Badge variant="outline" className="text-[10px]">{receipts.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {receipts.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <Receipt className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <p className="mt-2">No receipts yet.</p>
              <p className="mt-1 text-xs">Receipt codes for votes you have cast will appear here.</p>
            </div>
          ) : (
            <div className="max-h-[600px] space-y-2 overflow-y-auto pr-1">
              {receipts.map((r, idx) => {
                const code = r.receiptCode
                const result = results[code]
                const isVerifying = verifying.has(code)
                return (
                  <motion.div
                    key={code}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18, delay: Math.min(idx * 0.03, 0.2) }}
                    className="rounded-lg border border-border/60 bg-card p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs">{code}</code>
                          <button
                            onClick={() => copyCode(code)}
                            className="text-muted-foreground hover:text-foreground"
                            aria-label="Copy receipt"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          <div className="font-medium text-foreground">{r.electionName}</div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> {r.positionTitle}</span>
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(r.recordedAt).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => verify(code)}
                        disabled={isVerifying}
                        className="shrink-0 gap-1.5"
                      >
                        {isVerifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                        Verify
                      </Button>
                    </div>
                    {result && <ReceiptVerifyResult result={result} />}
                  </motion.div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ReceiptVerifyResult({ result }: { result: VerifyResult }) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      className="mt-2 overflow-hidden"
    >
      <Alert
        className={cn(
          result.valid
            ? 'border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/30'
            : 'border-red-500/40 bg-red-50 dark:bg-red-950/30',
        )}
      >
        {result.valid ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertCircle className="h-4 w-4 text-red-600" />}
        <AlertTitle className={result.valid ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}>
          {result.valid ? 'Receipt Verified' : 'Verification Failed'}
        </AlertTitle>
        <AlertDescription className={result.valid ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}>
          {result.message}
          {result.valid && result.electionName && (
            <span className="mt-1 block text-xs">
              <strong>Election:</strong> {result.electionName}
              {result.positionTitle && <> · <strong>Position:</strong> {result.positionTitle}</>}
              {result.recordedAt && <> · <strong>Recorded:</strong> {new Date(result.recordedAt).toLocaleString()}</>}
            </span>
          )}
        </AlertDescription>
      </Alert>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Timeline tab — voter timeline events
// ---------------------------------------------------------------------------
function TimelineTab({
  events, loading, error, onRetry,
}: {
  events: PortalTimelineEvent[]
  loading: boolean
  error: string | null
  onRetry: () => void
}) {
  if (loading) return <LoadingCard label="Loading your timeline…" />
  if (error) return <ErrorCard error={error} onRetry={onRetry} />
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-base">
          <Clock className="h-4 w-4 text-primary" /> My Timeline
          <Badge variant="outline" className="text-[10px]">{events.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <Clock className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="mt-2">No timeline events yet.</p>
          </div>
        ) : (
          <div className="max-h-[600px] space-y-2 overflow-y-auto pr-1">
            {events.map((ev, idx) => {
              const meta = TIMELINE_ICONS[ev.eventType] || { icon: Clock, cls: 'bg-muted text-muted-foreground' }
              const Icon = meta.icon
              return (
                <motion.div
                  key={ev.id}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.18, delay: Math.min(idx * 0.02, 0.2) }}
                  className="flex items-start gap-3 rounded-lg border border-border/60 bg-card p-3"
                >
                  <div className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-full', meta.cls)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span className="text-sm font-medium">{ev.eventType.replace(/_/g, ' ')}</span>
                      <span className="text-[11px] text-muted-foreground">{new Date(ev.createdAt).toLocaleString()}</span>
                    </div>
                    {ev.description && <p className="mt-0.5 text-xs text-muted-foreground">{ev.description}</p>}
                    {ev.actorName && ev.actorName !== 'System' && (
                      <p className="mt-0.5 text-[11px] text-muted-foreground">by {ev.actorName}</p>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Shared small components
// ---------------------------------------------------------------------------
function VotingStatusBadge({ status, votingOpen }: { status: 'voted' | 'eligible' | 'pending'; votingOpen: boolean }) {
  if (status === 'voted') return <Badge className="bg-emerald-100 text-emerald-700 gap-1"><CheckCircle2 className="h-3 w-3" /> Voted</Badge>
  if (status === 'eligible' && votingOpen) return <Badge className="bg-emerald-100 text-emerald-700 gap-1"><Vote className="h-3 w-3" /> Voting Open</Badge>
  if (status === 'eligible') return <Badge className="bg-primary/10 text-primary gap-1"><Clock className="h-3 w-3" /> Eligible</Badge>
  return <Badge className="bg-amber-100 text-amber-700 gap-1"><Hourglass className="h-3 w-3" /> Pending</Badge>
}

function SummaryStat({ icon: Icon, label, value, cls }: { icon: any; label: string; value: number; cls: string }) {
  return (
    <Card>
      <CardContent className="p-3 text-center">
        <div className={cn('mx-auto grid h-8 w-8 place-items-center rounded-lg', cls)}><Icon className="h-4 w-4" /></div>
        <div className="mt-1 font-display text-xl font-bold tabular-nums">{value.toLocaleString()}</div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  )
}

function LoadingCard({ label }: { label: string }) {
  return (
    <Card>
      <CardContent className="grid place-items-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="mt-2 text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  )
}

function ErrorCard({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Unable to load</AlertTitle>
      <AlertDescription>
        {error}
        <div className="mt-3">
          <Button size="sm" variant="outline" onClick={onRetry} className="gap-1.5">Retry</Button>
        </div>
      </AlertDescription>
    </Alert>
  )
}
