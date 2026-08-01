'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import {
  ArrowLeft, ArrowRight, CheckCircle2, Loader2, AlertCircle, Lock, Shield,
  Clock, X, Copy, Check, Hash, Sparkles, WifiOff, Wifi, Eye, Vote as VoteIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { api, getVoterToken } from '@/lib/api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from '@/lib/i18n'

type Phase = 'loading' | 'ballot' | 'review' | 'submitting' | 'success'

interface BallotCandidate {
  id: string
  name: string
  photo?: string | null
  slogan?: string | null
  manifesto?: string | null
  politicalGroup?: string | null
  biography?: string | null
}
interface BallotPosition {
  positionId: string
  title: string
  description?: string | null
  maximumVotes: number
  scope: string
  candidates: BallotCandidate[]
  allowNota: boolean
}
interface BallotData {
  ballotId: string
  content: {
    electionId: string
    electionName: string
    electionDescription?: string
    votingMethod: string
    positions: BallotPosition[]
  }
  integrityToken: string
  digitalSignature: string
  expiresAt: string
  isSimulation: boolean
  voter: { fullName: string; eligiblePositions: number }
  election: { name: string; votingOpen: boolean; closesAt: string; timeRemainingMs: number }
}

export function BallotView({ electionId, subdomain, voterId }: { electionId: string; subdomain?: string; voterId?: string }) {
  const { t } = useTranslation()
  const [phase, setPhase] = useState<Phase>('loading')
  const [ballot, setBallot] = useState<BallotData | null>(null)
  const [selections, setSelections] = useState<Record<string, string | string[]>>({})
  const [receipts, setReceipts] = useState<Array<{ positionId: string; positionTitle: string; receiptCode: string }>>([])
  const [error, setError] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [liveCount, setLiveCount] = useState<{ votesCast: number; turnoutPct: number } | null>(null)
  const [online, setOnline] = useState(true)
  const [autoSaved, setAutoSaved] = useState(false)
  const [expandedCandidate, setExpandedCandidate] = useState<string | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load ballot + auto-saved selections.
  useEffect(() => {
    let active = true
    const sessionToken = getVoterToken() || undefined
    api.generateBallot(electionId, voterId, false, subdomain, sessionToken).then((d: BallotData) => {
      if (!active) return
      setBallot(d)
      setTimeRemaining(d.election.timeRemainingMs)
      // Try to restore auto-saved selections.
      api.getAutoSavedSelections(d.ballotId, subdomain).then((saved: any) => {
        if (saved?.savedSelections) {
          setSelections(saved.savedSelections)
          setAutoSaved(true)
          toast.info('Your previous selections were restored.')
        }
      }).catch(() => {})
      setPhase('ballot')
    }).catch((e) => {
      if (!active) return
      setError(e.message || 'Failed to load ballot')
      setPhase('ballot')
    })
    return () => { active = false }
  }, [electionId, subdomain, voterId])

  // Countdown timer.
  useEffect(() => {
    if (!ballot) return
    const interval = setInterval(() => {
      const remaining = new Date(ballot.election.closesAt).getTime() - Date.now()
      setTimeRemaining(Math.max(0, remaining))
    }, 1000)
    return () => clearInterval(interval)
  }, [ballot])

  // Online/offline detection.
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  // WebSocket: live vote count.
  useEffect(() => {
    if (!ballot) return
    const socket = io('/?XTransformPort=3030', { path: '/', transports: ['websocket', 'polling'], reconnection: true })
    socketRef.current = socket
    socket.on('connect', () => {
      socket.emit('subscribe', { electionId: ballot.content.electionId })
    })
    socket.on('sve:live', (data: any) => {
      if (data.electionId === ballot.content.electionId) {
        setLiveCount({ votesCast: data.votesCast, turnoutPct: data.turnoutPct })
      }
    })
    return () => { socket.disconnect() }
  }, [ballot])

  // Auto-save selections (debounced 1.5s).
  const scheduleAutoSave = useCallback((sels: Record<string, string | string[]>) => {
    if (!ballot || Object.keys(sels).length === 0) return
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => {
      api.autoSaveSelections(ballot.ballotId, sels, subdomain).then(() => {
        setAutoSaved(true)
      }).catch(() => {})
    }, 1500)
  }, [ballot, subdomain])

  function selectCandidate(positionId: string, candidateId: string, maxVotes: number) {
    setSelections((prev) => {
      const current = prev[positionId]
      let next: string | string[]
      if (maxVotes === 1) {
        // Single choice — radio behavior.
        next = candidateId
      } else {
        // Multiple choice — checkbox behavior.
        const arr = Array.isArray(current) ? current : (current ? [current] : [])
        if (arr.includes(candidateId)) {
          next = arr.filter((c) => c !== candidateId)
        } else {
          if (arr.length >= maxVotes) {
            toast.warning(`${t('voting.chooseN')} ${maxVotes}`)
            return prev
          }
          next = [...arr, candidateId]
        }
        if (Array.isArray(next) && next.length === 0) {
          const { [positionId]: _, ...rest } = prev
          scheduleAutoSave(rest)
          return rest
        }
      }
      const updated = { ...prev, [positionId]: next }
      scheduleAutoSave(updated)
      return updated
    })
  }

  function selectNota(positionId: string) {
    setSelections((prev) => {
      const updated = { ...prev, [positionId]: 'NOTA' }
      scheduleAutoSave(updated)
      return updated
    })
  }

  function clearPosition(positionId: string) {
    setSelections((prev) => {
      const { [positionId]: _, ...rest } = prev
      scheduleAutoSave(rest)
      return rest
    })
  }

  async function submitVote() {
    setShowConfirm(false)
    setPhase('submitting')
    try {
      const d = await api.submitVote(ballot!.ballotId, selections, subdomain)
      setReceipts(d.receipts)
      // Clear auto-saved selections + voter token (session is now revoked).
      api.clearAutoSavedSelections(ballot!.ballotId, subdomain).catch(() => {})
      localStorage.removeItem('votewise_voter_token')
      setPhase('success')
      toast.success(t('voting.voteRecorded'))
    } catch (e: any) {
      setError(e.message || 'Failed to cast vote')
      setPhase('ballot')
      toast.error(e.message || 'Failed to cast vote')
    }
  }

  // ------------------------------------------------------------------------
  // Render phases
  // ------------------------------------------------------------------------
  if (phase === 'loading') {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-3 text-sm text-muted-foreground">{t('voting.generatingBallot')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('voting.generatingBallotSub')}</p>
        </div>
      </div>
    )
  }

  if (phase === 'success') {
    return <VoteSuccess receipts={receipts} electionId={electionId} subdomain={subdomain} />
  }

  if (error && !ballot) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t('voting.cannotLoadBallot')}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button variant="outline" onClick={() => window.location.href = `/workspace/elections/${electionId}?org=${subdomain || ''}`} className="mt-4 gap-1.5">
          <ArrowLeft className="h-4 w-4" /> {t('voting.backToElection')}
        </Button>
      </div>
    )
  }

  const positions = ballot?.content?.positions || []
  const answeredCount = Object.keys(selections).length
  const allAnswered = positions.length > 0 && answeredCount === positions.length

  // Find the first unanswered position for the "current position" indicator.
  const currentPositionIdx = positions.findIndex((p) => !selections[p.positionId])

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      {/* Top bar */}
      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => window.location.href = `/workspace/elections/${electionId}?org=${subdomain || ''}`} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> {t('voting.backBtn')}
        </Button>
        <div className="flex items-center gap-2">
          <Badge variant={online ? 'outline' : 'destructive'} className="gap-1">
            {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {online ? t('voting.online') : t('voting.offline')}
          </Badge>
          {autoSaved && online && (
            <Badge variant="outline" className="gap-1 text-emerald-600">
              <Check className="h-3 w-3" /> {t('voting.autoSaved')}
            </Badge>
          )}
        </div>
      </div>

      {error && <Alert variant="destructive" className="mb-4"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}

      {/* Election header with countdown */}
      <Card className="votewise-card-glow mb-6">
        <CardContent className="p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Badge variant="secondary" className="mb-1 gap-1">
                <span className="votewise-live-dot inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> {t('voting.liveElection')}
              </Badge>
              <h1 className="font-display text-xl font-bold sm:text-2xl">{ballot?.content?.electionName || t('workspace.elections')}</h1>
              <p className="text-xs text-muted-foreground">{t('voting.voter')}: {ballot?.voter.fullName}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-primary">
                <Clock className="h-4 w-4" />
                <span className="font-mono tabular-nums">{formatDuration(timeRemaining)}</span>
              </div>
              <p className="text-[10px] text-muted-foreground">{t('voting.votingClosesIn')}</p>
            </div>
          </div>
          {liveCount && (
            <div className="mt-4 flex items-center gap-4 rounded-lg bg-muted/50 p-2 text-xs">
              <span className="flex items-center gap-1"><VoteIcon className="h-3 w-3 text-primary" /> <strong>{liveCount.votesCast.toLocaleString()}</strong> {t('publicResults.votesCast').toLowerCase()}</span>
              <span className="flex items-center gap-1"><Sparkles className="h-3 w-3 text-amber-600" /> <strong>{liveCount.turnoutPct}%</strong> {t('election.turnout').toLowerCase()}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Progress */}
      <div className="mb-6">
        <div className="mb-1 flex justify-between text-xs">
          <span className="text-muted-foreground">
            {phase === 'review' ? t('voting.reviewing') : `${t('voting.position')} ${Math.min((currentPositionIdx >= 0 ? currentPositionIdx : positions.length) + 1, positions.length)} ${t('voting.of')} ${positions.length}`}
          </span>
          <span className="text-primary">{answeredCount}/{positions.length} {t('voting.completed')}</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${(answeredCount / Math.max(positions.length, 1)) * 100}%` }} />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {phase === 'ballot' && (
          <motion.div key="ballot" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            {positions.map((pos, idx) => {
              const isCurrent = idx === currentPositionIdx
              const isCompleted = !!selections[pos.positionId]
              const sel = selections[pos.positionId]
              return (
                <Card key={pos.positionId} className={cn('mb-4 transition-all', isCurrent ? 'ring-2 ring-primary shadow-md' : isCompleted ? 'opacity-70' : 'opacity-50')}>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <div className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold', isCompleted ? 'bg-emerald-100 text-emerald-700' : 'bg-primary text-primary-foreground')}>
                        {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                      </div>
                      <CardTitle className="font-display text-base">{pos.title}</CardTitle>
                      <Badge variant="outline" className="text-[10px]">
                        {pos.maximumVotes > 1 ? `${t('voting.chooseN')} ${pos.maximumVotes}` : t('voting.chooseOne')}
                      </Badge>
                      {isCompleted && (
                        <Button size="sm" variant="ghost" className="ml-auto h-7 text-xs" onClick={() => clearPosition(pos.positionId)}>
                          {t('voting.clear')}
                        </Button>
                      )}
                    </div>
                    {pos.description && <p className="text-sm text-muted-foreground">{pos.description}</p>}
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {pos.candidates.map((c) => {
                      const selected = Array.isArray(sel) ? sel.includes(c.id) : sel === c.id
                      const isExpanded = expandedCandidate === c.id
                      return (
                        <div key={c.id}>
                          <button
                            onClick={() => selectCandidate(pos.positionId, c.id, pos.maximumVotes)}
                            className={cn('flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-all', selected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-muted/50 hover:border-primary/30')}
                          >
                            <div className="relative shrink-0">
                              <Avatar className="h-12 w-12 border-2 border-background">
                                {c.photo ? <AvatarImage src={c.photo} alt={c.name} /> : null}
                                <AvatarFallback className="bg-muted text-sm font-bold">{c.name.charAt(0)}</AvatarFallback>
                              </Avatar>
                              {selected && (
                                <div className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground">
                                  <Check className="h-3 w-3" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{c.name}</span>
                                {c.politicalGroup && <Badge variant="secondary" className="text-[9px]">{c.politicalGroup}</Badge>}
                              </div>
                              {c.slogan && <div className="text-xs italic text-muted-foreground">&ldquo;{c.slogan}&rdquo;</div>}
                              {c.manifesto && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setExpandedCandidate(isExpanded ? null : c.id) }}
                                  className="mt-1 flex items-center gap-1 text-[11px] text-primary hover:underline"
                                >
                                  <Eye className="h-3 w-3" /> {isExpanded ? t('voting.hideManifesto') : t('voting.readManifesto')}
                                </button>
                              )}
                            </div>
                            {pos.maximumVotes === 1 && (
                              <div className={cn('mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition-all', selected ? 'border-primary bg-primary' : 'border-muted-foreground/30')}>
                                {selected && <div className="h-2 w-2 rounded-full bg-primary-foreground" />}
                              </div>
                            )}
                            {pos.maximumVotes > 1 && (
                              <Checkbox checked={selected} className="mt-1" />
                            )}
                          </button>
                          <AnimatePresence>
                            {isExpanded && c.manifesto && (
                              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                <div className="ml-15 mt-1 rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground" style={{ marginLeft: '3.5rem' }}>
                                  <p className="font-medium text-foreground mb-1">{t('voting.manifesto')}</p>
                                  {c.manifesto}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )
                    })}
                    {/* NOTA option */}
                    {pos.allowNota && (
                      <button
                        onClick={() => selectNota(pos.positionId)}
                        className={cn('flex w-full items-center gap-3 rounded-xl border border-dashed p-3 text-left transition-all', sel === 'NOTA' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-muted/50')}
                      >
                        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-muted">
                          <X className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium">{t('voting.noneOfTheAbove')}</div>
                          <div className="text-xs text-muted-foreground">{t('voting.noneOfTheAboveDesc')}</div>
                        </div>
                        {sel === 'NOTA' && <CheckCircle2 className="h-5 w-5 text-primary" />}
                      </button>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </motion.div>
        )}

        {phase === 'review' && (
          <motion.div key="review" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <Card className="votewise-card-glow">
              <CardHeader>
                <CardTitle className="font-display text-base flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" /> {t('voting.reviewYourVote')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {positions.map((pos) => {
                  const sel = selections[pos.positionId]
                  const selArr = Array.isArray(sel) ? sel : (sel ? [sel] : [])
                  const selectedCandidates = selArr
                    .filter((s) => s !== 'NOTA')
                    .map((s) => pos.candidates.find((c) => c.id === s))
                    .filter(Boolean)
                  const isNota = selArr.includes('NOTA')
                  return (
                    <div key={pos.positionId} className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                      <div className="min-w-0">
                        <div className="text-xs text-muted-foreground">{pos.title}</div>
                        {isNota ? (
                          <div className="font-medium text-muted-foreground">{t('voting.noneOfTheAbove')}</div>
                        ) : selectedCandidates.length > 0 ? (
                          <div className="font-medium">{selectedCandidates.map((c) => c!.name).join(', ')}</div>
                        ) : (
                          <div className="font-medium text-muted-foreground">—</div>
                        )}
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => setPhase('ballot')} className="text-xs">{t('voting.change')}</Button>
                    </div>
                  )
                })}
                <Alert>
                  <Lock className="h-4 w-4" />
                  <AlertTitle>{t('voting.ballotSecrecyProtected')}</AlertTitle>
                  <AlertDescription>
                    {t('voting.ballotSecrecyDesc')}
                  </AlertDescription>
                </Alert>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setPhase('ballot')} className="gap-1.5">
                    <ArrowLeft className="h-4 w-4" /> {t('voting.backBtn')}
                  </Button>
                  <Button onClick={() => setShowConfirm(true)} className="flex-1 gap-2">
                    <Lock className="h-4 w-4" /> {t('voting.submitVote')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sticky submit bar */}
      {phase === 'ballot' && allAnswered && (
        <div className="sticky bottom-4 z-10">
          <Card className="votewise-card-glow shadow-xl">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <span className="text-sm font-medium">{t('voting.allPositionsCompleted')}</span>
              </div>
              <Button onClick={() => setPhase('review')} className="gap-2">
                {t('voting.review')} <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Submitting phase */}
      {phase === 'submitting' && (
        <Card className="votewise-card-glow">
          <CardContent className="py-12 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            <p className="mt-3 text-sm font-medium">{t('voting.encrypting')}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t('voting.encryptingSub')}</p>
          </CardContent>
        </Card>
      )}

      {/* Final confirmation dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600" /> {t('voting.finalConfirmation')}
            </DialogTitle>
            <DialogDescription>
              {t('voting.finalConfirmationDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <div className="font-medium mb-1">{t('voting.summary')}</div>
            <div className="text-muted-foreground">
              {positions.length} {t('workspace.positions').toLowerCase()}{positions.length === 1 ? '' : 's'} · {Object.values(selections).reduce((acc, s) => acc + (Array.isArray(s) ? s.length : 1), 0)} {t('voting.ballot').toLowerCase()}{Object.values(selections).reduce((acc, s) => acc + (Array.isArray(s) ? s.length : 1), 0) === 1 ? '' : 's'}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>{t('common.cancel')}</Button>
            <Button onClick={submitVote} className="gap-2">
              <Lock className="h-4 w-4" /> {t('voting.confirmAndSubmit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Vote Success — receipt display
// ---------------------------------------------------------------------------
function VoteSuccess({ receipts, electionId, subdomain }: { receipts: Array<{ positionId: string; positionTitle: string; receiptCode: string }>; electionId: string; subdomain?: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState<string | null>(null)
  const [verifying, setVerifying] = useState<string | null>(null)
  const [verifyResult, setVerifyResult] = useState<any>(null)

  function copy(code: string) {
    navigator.clipboard.writeText(code)
    setCopied(code)
    toast.success(t('voting.receiptCopied'))
    setTimeout(() => setCopied(null), 2000)
  }

  async function verify(code: string) {
    setVerifying(code)
    try {
      const result = await api.verifyReceipt(code, subdomain)
      setVerifyResult(result)
    } catch (e: any) {
      setVerifyResult({ valid: false, message: e.message })
    } finally {
      setVerifying(null)
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', duration: 0.5 }}>
        <Card className="votewise-card-glow">
          <CardContent className="p-8 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-100 text-emerald-600"
            >
              <CheckCircle2 className="h-8 w-8" />
            </motion.div>
            <h2 className="mt-4 font-display text-2xl font-bold">{t('voting.voteRecorded')}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t('voting.voteRecordedDesc')}
            </p>

            <div className="mt-6 space-y-2 text-left">
              {receipts.map((r, i) => (
                <div key={i} className="rounded-lg border border-border/60 bg-muted/50 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-muted-foreground">{r.positionTitle}</div>
                      <div className="font-mono text-sm font-bold text-primary">{r.receiptCode}</div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => copy(r.receiptCode)}>
                        {copied === r.receiptCode ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => verify(r.receiptCode)} disabled={verifying === r.receiptCode}>
                        {verifying === r.receiptCode ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Hash className="h-3 w-3" /> {t('voting.verify')}</>}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {verifyResult && (
              <Alert className={cn('mt-4 text-left', verifyResult.valid ? 'border-emerald-500/30 bg-emerald-500/5' : '')}>
                <Shield className="h-4 w-4" />
                <AlertTitle>{verifyResult.valid ? t('voting.receiptVerified') : t('voting.verificationFailed')}</AlertTitle>
                <AlertDescription>{verifyResult.message}</AlertDescription>
              </Alert>
            )}

            <Alert className="mt-4 text-left">
              <Lock className="h-4 w-4" />
              <AlertTitle>{t('voting.ballotSecrecyProtected')}</AlertTitle>
              <AlertDescription>
                {t('voting.ballotSecrecyDesc')}
              </AlertDescription>
            </Alert>

            <Button onClick={() => window.location.href = `/workspace/elections/${electionId}?org=${subdomain || ''}`} className="mt-6 gap-2">
              {t('voting.backToElection')} <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

function formatDuration(ms: number): string {
  if (ms <= 0) return '00:00:00'
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
