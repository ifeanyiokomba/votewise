'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShieldCheck, Search, CheckCircle2, XCircle, AlertTriangle, FileSearch,
  Hash, Download, RefreshCw, Trophy, Percent, Lock, Loader2, ChevronDown,
  ChevronRight, Database, ClipboardCopy,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types — mirror the SVE RLA module's RLAResult shape.
// ---------------------------------------------------------------------------

interface AuditSampleMismatch {
  voteId: string
  receiptCode: string | null
  expected: string | null
  actual: string | null
  isNota: boolean
  reason: string
}

interface RLAPositionResult {
  positionId: string
  title: string
  winner: string | null
  winnerIds: string[]
  margin: number
  totalVotes: number
  sampleSize: number
  sampled: number
  matching: number
  mismatches: AuditSampleMismatch[]
  riskLimitMet: boolean
}

interface RLAResult {
  electionId: string
  electionName: string
  riskLimit: number
  seed: string
  generatedAt: string
  tallyHash: string
  positions: RLAPositionResult[]
  overallPassed: boolean
  totalBallots: number
  totalSampled: number
  totalMatching: number
  totalMismatches: number
}

interface RiskLimitingAuditProps {
  electionId: string
  subdomain?: string
}

const RISK_LIMITS: Array<{ value: string; pct: string; numeric: number; hint: string }> = [
  { value: '0.05', pct: '5%', numeric: 0.05, hint: 'Highest confidence' },
  { value: '0.10', pct: '10%', numeric: 0.10, hint: 'Standard (recommended)' },
  { value: '0.20', pct: '20%', numeric: 0.20, hint: 'Faster, lower confidence' },
]

// Generate a 32-char hex seed on the client using the Web Crypto API.
function generateClientSeed(): string {
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    const bytes = new Uint8Array(16)
    window.crypto.getRandomValues(bytes)
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
  }
  // SSR / fallback — Math.random is only used to pre-fill the input; the
  // server always overrides with a cryptographic seed when the input is empty.
  return Math.random().toString(16).slice(2).padEnd(32, '0')
}

export function RiskLimitingAudit({ electionId, subdomain }: RiskLimitingAuditProps) {
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<RLAResult | null>(null)
  const [runAt, setRunAt] = useState<string | null>(null)
  const [runBy, setRunBy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [riskLimitValue, setRiskLimitValue] = useState('0.10')
  const [seed, setSeed] = useState('')

  const [expandedPosition, setExpandedPosition] = useState<string | null>(null)

  // Initial load — fetch the last RLA result for this election (if any).
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const d = await api.getRiskLimitingAudit(electionId, subdomain)
      if (d?.found && d.result) {
        setResult(d.result)
        setRunAt(d.runAt ?? null)
        setRunBy(d.runBy ?? null)
        setSeed(d.result.seed)
        setRiskLimitValue(String(d.result.riskLimit))
      } else {
        setResult(null)
        setRunAt(null)
        setRunBy(null)
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      // 404 means no audit yet — not an error worth surfacing as a toast.
      if (!/not found|404/i.test(msg)) {
        setError(msg)
      }
      setResult(null)
    } finally {
      setLoading(false)
    }
  }, [electionId, subdomain])

  // On mount: pre-fill the seed input with a fresh client-generated seed.
  useEffect(() => {
    setSeed(generateClientSeed())
  }, [])

  // On mount + when electionId changes: fetch the last audit.
  useEffect(() => {
    load()
  }, [load])

  async function runAudit(useSeed?: string) {
    setRunning(true)
    setError(null)
    const effectiveSeed = useSeed ?? seed
    const numericRisk = parseFloat(riskLimitValue)
    try {
      const d = await api.runRiskLimitingAudit(
        electionId,
        { riskLimit: numericRisk, seed: effectiveSeed || undefined },
        subdomain,
      )
      if (d?.result) {
        setResult(d.result)
        setRunAt(new Date().toISOString())
        setRunBy(null)
        setSeed(d.result.seed)
        setRiskLimitValue(String(d.result.riskLimit))
        toast.success(d.message || 'Audit complete.')
      } else {
        toast.error('Audit ran but no result was returned.')
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      toast.error(msg)
    } finally {
      setRunning(false)
    }
  }

  function regenerateSeed() {
    setSeed(generateClientSeed())
    toast.info('New seed generated — the next audit will sample different ballots.')
  }

  function copySeed() {
    if (!seed) return
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(seed)
      toast.success('Seed copied to clipboard.')
    }
  }

  function downloadReport() {
    if (!result) return
    const payload = {
      ...result,
      _meta: {
        runAt,
        runBy,
        exportedAt: new Date().toISOString(),
        platform: 'VoteWise',
      },
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `votewise-rla-${result.electionId}-${result.seed.slice(0, 8)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Audit report downloaded.')
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col gap-2"
      >
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1 border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
            <ShieldCheck className="h-3 w-3" /> Post-Election Audit
          </Badge>
        </div>
        <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Risk-Limiting Audit</h2>
        <p className="text-sm text-muted-foreground sm:text-base">
          Statistically verify the correctness of the certified tally by examining a random sample of ballots.
        </p>
      </motion.div>

      {/* Info Alert */}
      <Alert className="border-emerald-300/60 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20">
        <FileSearch className="h-4 w-4 text-emerald-600" />
        <AlertTitle className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200">
          What is a Risk-Limiting Audit?
        </AlertTitle>
        <AlertDescription className="text-emerald-900/80 dark:text-emerald-100/80">
          A risk-limiting audit examines a random sample of encrypted ballots, decrypts them, and compares to the reported tally.
          If the sample matches, we have strong statistical evidence the outcome is correct. If mismatches are found, a full recount is triggered.
        </AlertDescription>
      </Alert>

      {/* Configuration Card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.05 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-base">
              <Search className="h-4 w-4 text-primary" /> Audit Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Risk Limit */}
              <div className="space-y-1.5">
                <Label htmlFor="rla-risk-limit" className="flex items-center gap-1.5 text-xs">
                  <Percent className="h-3 w-3" /> Risk Limit
                </Label>
                <Select value={riskLimitValue} onValueChange={setRiskLimitValue}>
                  <SelectTrigger id="rla-risk-limit" className="w-full">
                    <SelectValue placeholder="Select risk limit" />
                  </SelectTrigger>
                  <SelectContent>
                    {RISK_LIMITS.map((rl) => (
                      <SelectItem key={rl.value} value={rl.value}>
                        <span className="font-medium">{rl.pct}</span>
                        <span className="ml-2 text-xs text-muted-foreground">— {rl.hint}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  The maximum risk of certifying an incorrect outcome. Lower = more ballots sampled = higher confidence.
                </p>
              </div>

              {/* Seed */}
              <div className="space-y-1.5 lg:col-span-2">
                <Label htmlFor="rla-seed" className="flex items-center gap-1.5 text-xs">
                  <Hash className="h-3 w-3" /> Reproducibility Seed
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="rla-seed"
                    value={seed}
                    onChange={(e) => setSeed(e.target.value)}
                    placeholder="Auto-generated"
                    className="flex-1 font-mono text-xs"
                  />
                  <Button type="button" variant="outline" size="icon" onClick={copySeed} aria-label="Copy seed" title="Copy seed">
                    <ClipboardCopy className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="outline" size="icon" onClick={regenerateSeed} aria-label="Regenerate seed" title="Regenerate seed">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Auto-generated, but you can override for reproducibility. Anyone can re-run with the same seed and verify the same ballots were sampled.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Button
                onClick={() => runAudit()}
                disabled={running || loading}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700"
              >
                {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {running ? 'Running Audit…' : 'Run Audit'}
              </Button>
              {result && (
                <Button variant="outline" onClick={load} disabled={loading} className="gap-1.5">
                  <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} /> Refresh
                </Button>
              )}
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Results Section */}
      <AnimatePresence mode="wait">
        {loading && !result ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid min-h-[20vh] place-items-center"
          >
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </motion.div>
        ) : result ? (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4 }}
            className="space-y-4"
          >
            {/* Overall Result Banner */}
            <div
              className={cn(
                'votewise-card-glow overflow-hidden rounded-xl border-2 p-5 sm:p-6',
                result.overallPassed
                  ? 'border-emerald-400/60 bg-emerald-50/80 dark:border-emerald-700/50 dark:bg-emerald-950/30'
                  : 'border-red-400/60 bg-red-50/80 dark:border-red-700/50 dark:bg-red-950/30',
              )}
            >
              <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'grid h-12 w-12 shrink-0 place-items-center rounded-full',
                      result.overallPassed
                        ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/60 dark:text-emerald-300'
                        : 'bg-red-100 text-red-600 dark:bg-red-900/60 dark:text-red-300',
                    )}
                  >
                    {result.overallPassed
                      ? <CheckCircle2 className="h-7 w-7" />
                      : <XCircle className="h-7 w-7" />}
                  </div>
                  <div>
                    <div className={cn('font-display text-xl font-bold sm:text-2xl', result.overallPassed ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300')}>
                      {result.overallPassed ? '✓ Audit Passed' : '✗ Audit Failed'}
                    </div>
                    <div className="mt-0.5 text-sm text-muted-foreground">
                      {result.overallPassed
                        ? 'The risk limit was met — the reported outcome is statistically confirmed.'
                        : 'Discrepancies were found — a full recount is recommended.'}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="outline" className="gap-1 border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <Percent className="h-3 w-3" /> Risk Limit: {(result.riskLimit * 100).toFixed(0)}%
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <Lock className="h-3 w-3" /> Tally Hash: {result.tallyHash.slice(0, 8)}…
                  </Badge>
                </div>
              </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <StatBox icon={Database} label="Total Ballots" value={result.totalBallots.toLocaleString()} />
              <StatBox icon={Search} label="Total Sampled" value={result.totalSampled.toLocaleString()} highlight />
              <StatBox icon={CheckCircle2} label="Matching" value={result.totalMatching.toLocaleString()} positive />
              <StatBox icon={AlertTriangle} label="Mismatches" value={result.totalMismatches.toLocaleString()} negative={result.totalMismatches > 0} />
              <StatBox icon={Percent} label="Risk Limit" value={`${(result.riskLimit * 100).toFixed(0)}%`} />
            </div>

            {/* Match-rate progress bar */}
            <Card>
              <CardContent className="p-4 sm:p-5">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Sample Match Rate
                  </div>
                  <div className="text-sm tabular-nums text-muted-foreground">
                    {result.totalSampled > 0
                      ? `${((result.totalMatching / result.totalSampled) * 100).toFixed(1)}%`
                      : '—'}
                    <span className="ml-2 text-xs">
                      ({result.totalMatching} / {result.totalSampled})
                    </span>
                  </div>
                </div>
                <Progress
                  value={result.totalSampled > 0 ? (result.totalMatching / result.totalSampled) * 100 : 0}
                  className="bg-muted [&_[data-slot=progress-indicator]]:bg-emerald-500"
                />
                {runAt && (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Last run: {new Date(runAt).toLocaleString()}{runBy ? ` by ${runBy}` : ''}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Per-Position Results Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-display text-base">
                  <Trophy className="h-4 w-4 text-amber-600" /> Per-Position Results
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 sm:p-0">
                <div className="max-h-[32rem] overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-card">
                      <TableRow>
                        <TableHead className="min-w-[8rem]">Position</TableHead>
                        <TableHead className="min-w-[8rem]">Winner</TableHead>
                        <TableHead className="text-right">Margin</TableHead>
                        <TableHead className="text-right">Sample Size</TableHead>
                        <TableHead className="text-right">Sampled</TableHead>
                        <TableHead className="text-right">Matching</TableHead>
                        <TableHead className="text-right">Mismatches</TableHead>
                        <TableHead className="text-center">Risk Limit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.positions.map((pos) => (
                        <PositionRow
                          key={pos.positionId}
                          pos={pos}
                          expanded={expandedPosition === pos.positionId}
                          onToggle={() =>
                            setExpandedPosition(expandedPosition === pos.positionId ? null : pos.positionId)
                          }
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Reproducibility Card */}
            <Card className="votewise-card-glow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-display text-base">
                  <Lock className="h-4 w-4 text-primary" /> Reproducibility
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Seed used for this audit</Label>
                  <code className="block break-all rounded-lg bg-muted p-3 font-mono text-xs">{result.seed}</code>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  The seed makes this audit fully reproducible. Anyone can re-run with the same seed and verify the same ballots were sampled — this is what makes a risk-limiting audit independently verifiable.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => runAudit(result.seed)} disabled={running} className="gap-1.5">
                    {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    Re-run with same seed
                  </Button>
                  <Button variant="outline" size="sm" onClick={downloadReport} className="gap-1.5">
                    <Download className="h-3.5 w-3.5" /> Download Audit Report
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : !loading ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Card>
              <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
                  <FileSearch className="h-6 w-6" />
                </div>
                <p className="text-sm font-medium">No audit run yet</p>
                <p className="max-w-sm text-xs text-muted-foreground">
                  Configure the risk limit and seed above, then click <span className="font-medium text-foreground">Run Audit</span> to statistically verify the certified tally.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Position Row (table row + expandable sample details)
// ---------------------------------------------------------------------------

function PositionRow({
  pos, expanded, onToggle,
}: {
  pos: RLAPositionResult
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <>
      <TableRow
        onClick={onToggle}
        className={cn(
          'cursor-pointer transition-colors hover:bg-muted/50',
          !pos.riskLimitMet && 'bg-red-50/40 dark:bg-red-950/10',
        )}
      >
        <TableCell className="font-medium">
          <div className="flex items-center gap-1.5">
            {expanded
              ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
            <span className="line-clamp-1">{pos.title}</span>
          </div>
        </TableCell>
        <TableCell>
          {pos.winner ? (
            <span className="line-clamp-1 text-sm text-emerald-700 dark:text-emerald-300">{pos.winner}</span>
          ) : (
            <span className="text-xs text-muted-foreground">No winner</span>
          )}
        </TableCell>
        <TableCell className="text-right tabular-nums">
          {(pos.margin * 100).toFixed(1)}%
        </TableCell>
        <TableCell className="text-right tabular-nums">{pos.sampleSize}</TableCell>
        <TableCell className="text-right tabular-nums">{pos.sampled}</TableCell>
        <TableCell className="text-right tabular-nums text-emerald-600">{pos.matching}</TableCell>
        <TableCell className={cn('text-right tabular-nums', pos.mismatches.length > 0 ? 'text-red-600 font-medium' : 'text-muted-foreground')}>
          {pos.mismatches.length}
        </TableCell>
        <TableCell className="text-center">
          {pos.riskLimitMet ? (
            <Badge variant="outline" className="gap-1 border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
              <CheckCircle2 className="h-3 w-3" /> Met
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
              <XCircle className="h-3 w-3" /> Failed
            </Badge>
          )}
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={8} className="bg-muted/30 p-4">
            <PositionSampleDetails pos={pos} />
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

function PositionSampleDetails({ pos }: { pos: RLAPositionResult }) {
  if (pos.sampled === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <AlertTriangle className="h-3.5 w-3.5" /> No ballots were sampled for this position (no votes cast).
      </div>
    )
  }

  // Build a list of "matches" (voteId + matching flag). For matches we don't
  // have per-vote detail from the API (only mismatches are returned with
  // detail) — so we show the mismatches in detail and a summary count for
  // the matches.
  const matchedCount = pos.matching

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="space-y-3"
    >
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="outline" className="gap-1">
          <Search className="h-3 w-3" /> {pos.sampled} sampled
        </Badge>
        <Badge variant="outline" className="gap-1 border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          <CheckCircle2 className="h-3 w-3" /> {matchedCount} matched
        </Badge>
        {pos.mismatches.length > 0 && (
          <Badge variant="outline" className="gap-1 border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
            <XCircle className="h-3 w-3" /> {pos.mismatches.length} mismatched
          </Badge>
        )}
        <Badge variant="outline" className="gap-1">
          <Percent className="h-3 w-3" /> margin {(pos.margin * 100).toFixed(1)}%
        </Badge>
        <Badge variant="outline" className="gap-1">
          <Hash className="h-3 w-3" /> sample size {pos.sampleSize}
        </Badge>
      </div>

      {pos.mismatches.length > 0 ? (
        <div className="space-y-2">
          <div className="text-xs font-medium text-red-700 dark:text-red-300">Discrepancies found:</div>
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {pos.mismatches.map((m) => (
              <div
                key={m.voteId}
                className="rounded-lg border border-red-200 bg-red-50/60 p-3 text-xs dark:border-red-900/50 dark:bg-red-950/20"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <code className="font-mono text-[10px] text-muted-foreground">{m.voteId}</code>
                  {m.receiptCode && (
                    <Badge variant="outline" className="font-mono text-[10px]">receipt: {m.receiptCode}</Badge>
                  )}
                  {m.isNota && (
                    <Badge variant="outline" className="text-[10px]">NOTA</Badge>
                  )}
                </div>
                <div className="mt-1.5 grid gap-1 sm:grid-cols-2">
                  <div>
                    <span className="text-muted-foreground">Expected: </span>
                    <code className="font-mono">{m.expected ?? 'null'}</code>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Actual: </span>
                    <code className="font-mono">{m.actual ?? 'null'}</code>
                  </div>
                </div>
                <div className="mt-1 text-[11px] italic text-red-700/80 dark:text-red-300/80">{m.reason}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-xs text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-200">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            All {pos.sampled} sampled ballots matched the reported tally. The decrypted choices were consistent with the stored candidate IDs — strong evidence that the tally for <span className="font-medium">{pos.title}</span> is correct.
          </span>
        </div>
      )}

      <Separator />
      <p className="text-[11px] text-muted-foreground">
        Sampled vote IDs are reproducible from the audit seed. Re-running the audit with the same seed will select the exact same ballots.
      </p>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Stat Box
// ---------------------------------------------------------------------------

function StatBox({
  icon: Icon, label, value, highlight, positive, negative,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  highlight?: boolean
  positive?: boolean
  negative?: boolean
}) {
  return (
    <Card
      className={cn(
        highlight && 'ring-1 ring-primary/30',
        positive && 'border-emerald-300/60 dark:border-emerald-800/60',
        negative && 'border-red-300/60 dark:border-red-800/60',
      )}
    >
      <CardContent className="p-3 text-center sm:p-4">
        <Icon
          className={cn(
            'mx-auto h-4 w-4',
            positive && 'text-emerald-600',
            negative && 'text-red-600',
            highlight && 'text-primary',
            !positive && !negative && !highlight && 'text-muted-foreground',
          )}
        />
        <div className="mt-1 font-display text-lg font-bold tabular-nums sm:text-xl">{value}</div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground sm:text-[11px]">{label}</div>
      </CardContent>
    </Card>
  )
}
