'use client'

import { useEffect, useState } from 'react'
import {
  Vote, Shield, CheckCircle2, Loader2, ArrowLeft, ArrowRight, Lock,
  AlertCircle, Clock, Award, X, User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type Phase = 'loading' | 'ballot' | 'review' | 'submitting' | 'success'

export function BallotView({ electionId, subdomain }: { electionId: string; subdomain?: string }) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [ballot, setBallot] = useState<any>(null)
  const [selections, setSelections] = useState<Record<string, string>>({})
  const [receipts, setReceipts] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    api.generateBallot(electionId, undefined, false, subdomain).then((d) => {
      if (!active) return
      setBallot(d)
      setPhase('ballot')
    }).catch((e) => {
      if (!active) return
      setError(e.message)
      setPhase('ballot')
    })
    return () => { active = false }
  }, [electionId, subdomain])

  function selectCandidate(positionId: string, candidateId: string) {
    setSelections((s) => ({ ...s, [positionId]: candidateId }))
  }

  async function submitVote() {
    setPhase('submitting')
    try {
      const d = await api.submitVote(ballot.ballotId, selections, subdomain)
      setReceipts(d.receipts)
      setPhase('success')
      toast.success('Vote successfully recorded!')
    } catch (e: any) {
      setError(e.message)
      setPhase('ballot')
      toast.error(e.message)
    }
  }

  if (phase === 'loading') {
    return <div className="grid min-h-[60vh] place-items-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }

  // Success phase
  if (phase === 'success') {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        <Card className="votewise-card-glow">
          <CardContent className="p-8 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-100 text-emerald-600"><CheckCircle2 className="h-8 w-8" /></div>
            <h2 className="mt-4 font-display text-2xl font-bold">Vote Successfully Recorded</h2>
            <p className="mt-2 text-sm text-muted-foreground">Your vote has been encrypted, recorded, and audited. Save your receipt numbers below.</p>
            <div className="mt-6 space-y-2">
              {receipts.map((r, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/50 p-3">
                  <span className="text-xs text-muted-foreground">Receipt {i + 1}</span>
                  <span className="font-mono text-sm font-bold text-primary">{r}</span>
                </div>
              ))}
            </div>
            <Alert className="mt-4">
              <Shield className="h-4 w-4" />
              <AlertTitle>Ballot Secrecy Protected</AlertTitle>
              <AlertDescription>Your receipt confirms participation — not candidate choices. No one can determine who you voted for.</AlertDescription>
            </Alert>
            <Button onClick={() => window.location.href = `/workspace/elections/${electionId}?org=${subdomain || ''}`} className="mt-4 gap-2">Back to Election <ArrowRight className="h-4 w-4" /></Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Ballot / Review phase
  const positions = ballot?.content?.positions || []
  const currentPosition = phase === 'review' ? -1 : positions.findIndex((p: any) => !selections[p.positionId])

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <Button variant="ghost" size="sm" onClick={() => window.location.href = `/workspace/elections/${electionId}?org=${subdomain || ''}`} className="mb-4 gap-1.5">
        <ArrowLeft className="h-4 w-4" /> Back to Election
      </Button>

      {error && <Alert variant="destructive" className="mb-4"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}

      {/* Election header */}
      <div className="mb-6 text-center">
        <Badge variant="secondary" className="mb-2 gap-1"><span className="votewise-live-dot inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> Live Election</Badge>
        <h1 className="font-display text-2xl font-bold">{ballot?.content?.electionName || 'Election'}</h1>
        <p className="text-sm text-muted-foreground">Ballot expires at {new Date(ballot?.expiresAt).toLocaleTimeString()}</p>
      </div>

      {/* Progress */}
      <div className="mb-6">
        <div className="mb-1 flex justify-between text-xs"><span className="text-muted-foreground">Position {Math.min((currentPosition >= 0 ? currentPosition : positions.length) + 1, positions.length)} of {positions.length}</span><span className="text-primary">{Object.keys(selections).length}/{positions.length} completed</span></div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(Object.keys(selections).length / positions.length) * 100}%` }} /></div>
      </div>

      {/* Ballot positions */}
      {phase === 'ballot' && positions.map((pos: any, idx: number) => {
        const isCurrent = idx === currentPosition
        const isCompleted = !!selections[pos.positionId]
        return (
          <Card key={pos.positionId} className={cn('mb-4 transition-all', isCurrent ? 'ring-2 ring-primary' : isCompleted ? 'opacity-60' : 'opacity-40')}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className={cn('grid h-8 w-8 place-items-center rounded-full text-xs font-bold', isCompleted ? 'bg-emerald-100 text-emerald-700' : 'bg-primary text-primary-foreground')}>
                  {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                </div>
                <CardTitle className="font-display text-base">{pos.title}</CardTitle>
                <Badge variant="outline" className="text-[10px]">{pos.maximumVotes > 1 ? `Choose ${pos.maximumVotes}` : 'Choose 1'}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {pos.candidates.map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => selectCandidate(pos.positionId, c.id)}
                  className={cn('flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all', selections[pos.positionId] === c.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-muted/50')}
                >
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted text-sm font-bold text-muted-foreground">
                    {c.photo ? <img src={c.photo} alt={c.name} className="h-10 w-10 rounded-full object-cover" /> : c.name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{c.name}</div>
                    {c.slogan && <div className="text-xs italic text-muted-foreground">&ldquo;{c.slogan}&rdquo;</div>}
                  </div>
                  {selections[pos.positionId] === c.id && <CheckCircle2 className="h-5 w-5 text-primary" />}
                </button>
              ))}
              {/* NOTA option */}
              <button
                onClick={() => selectCandidate(pos.positionId, 'NOTA')}
                className={cn('flex w-full items-center gap-3 rounded-lg border border-dashed p-3 text-left transition-all', selections[pos.positionId] === 'NOTA' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50')}
              >
                <div className="grid h-10 w-10 place-items-center rounded-full bg-muted"><X className="h-4 w-4 text-muted-foreground" /></div>
                <span className="text-sm font-medium">None of the Above</span>
                {selections[pos.positionId] === 'NOTA' && <CheckCircle2 className="ml-auto h-5 w-5 text-primary" />}
              </button>
            </CardContent>
          </Card>
        )
      })}

      {/* Review phase */}
      {phase === 'review' && (
        <Card className="votewise-card-glow">
          <CardHeader><CardTitle className="font-display text-base flex items-center gap-2"><Shield className="h-5 w-5 text-primary" /> Review Your Vote</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {positions.map((pos: any) => {
              const sel = selections[pos.positionId]
              const candidate = pos.candidates.find((c: any) => c.id === sel)
              return (
                <div key={pos.positionId} className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                  <div><div className="text-xs text-muted-foreground">{pos.title}</div><div className="font-medium">{sel === 'NOTA' ? 'None of the Above' : candidate?.name || '—'}</div></div>
                  <Button size="sm" variant="ghost" onClick={() => setPhase('ballot')} className="text-xs">Change</Button>
                </div>
              )
            })}
            <Alert variant="destructive">
              <Lock className="h-4 w-4" />
              <AlertTitle>Final Confirmation</AlertTitle>
              <AlertDescription>You are about to submit your vote. This action cannot be reversed. Your ballot will be encrypted and recorded permanently.</AlertDescription>
            </Alert>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setPhase('ballot')} className="gap-1.5"><ArrowLeft className="h-4 w-4" /> Back</Button>
              <Button onClick={submitVote} className="flex-1 gap-2"><Lock className="h-4 w-4" /> Confirm &amp; Submit Vote</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Submit button (ballot phase) */}
      {phase === 'ballot' && Object.keys(selections).length === positions.length && (
        <div className="sticky bottom-4 z-10">
          <Card className="votewise-card-glow shadow-lg">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-600" /><span className="text-sm font-medium">All positions completed</span></div>
              <Button onClick={() => setPhase('review')} className="gap-2">Review Vote <ArrowRight className="h-4 w-4" /></Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Submitting phase */}
      {phase === 'submitting' && (
        <Card><CardContent className="py-12 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-3 text-sm font-medium">Encrypting and recording your vote…</p>
          <p className="mt-1 text-xs text-muted-foreground">This happens inside an atomic database transaction. If anything fails, your vote is NOT recorded.</p>
        </CardContent></Card>
      )}
    </div>
  )
}
