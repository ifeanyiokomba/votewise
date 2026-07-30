'use client'

import { useEffect, useState } from 'react'
import {
  Vote, ArrowLeft, ArrowRight, CheckCircle2, Loader2, AlertCircle, Copy,
  Trophy, Shield, BadgeCheck, MinusCircle, GraduationCap, Lock, Sparkles, Mail,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { useApp } from '@/lib/store'
import { api, setVoterToken } from '@/lib/api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export function VoteView() {
  const { setView, voterToken, voterProfile, setVoterProfile, setVoterToken, lastReceipts, setLastReceipts, setReceiptChannel } = useApp()
  const [ballot, setBallot] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selections, setSelections] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!voterToken) { setView('verify'); return }
    api.getBallot()
      .then((d) => { setBallot(d); setLoading(false) })
      .catch((e) => { setError(e.message); setLoading(false) })
  }, [voterToken, setView])

  async function onCast() {
    setSubmitting(true); setError(null)
    try {
      const d = await api.castVote(selections)
      setLastReceipts(d.receipts)
      setReceiptChannel(d.receiptChannel || null)
      setVoterToken(null); setVoterProfile(null)
      setView('success')
      toast.success('Your vote has been cast and recorded!')
    } catch (e: any) {
      setError(e.message || 'Failed to cast vote')
      setShowConfirm(false)
    } finally { setSubmitting(false) }
  }

  if (loading) {
    return <div className="mx-auto flex max-w-2xl items-center justify-center px-4 py-24"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
  }
  if (error && !ballot) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Cannot load ballot</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button variant="outline" onClick={() => setView('verify')} className="mt-4 gap-1.5"><ArrowLeft className="h-4 w-4" /> Back to verification</Button>
      </div>
    )
  }

  const positions = ballot?.positions || []
  const allAnswered = positions.every((p: any) => selections[p.id])

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <Button variant="ghost" size="sm" onClick={() => setView('home')} className="mb-4 gap-1.5">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      <Card className="afrivote-card-glow mb-6">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">Your Ballot</h1>
            <p className="text-sm text-muted-foreground">
              {ballot?.voter.fullName} · {ballot?.voter.faculty} · {ballot?.voter.level} Level
            </p>
          </div>
          <div className="flex items-center gap-2">
            {ballot?.election.votingOpen ? (
              <Badge className="gap-1 bg-emerald-100 text-emerald-700"><span className="afrivote-live-dot inline-block h-2 w-2 rounded-full bg-emerald-500" /> Voting Open</Badge>
            ) : (
              <Badge variant="destructive">Voting Not Open</Badge>
            )}
            <Badge variant="outline" className="gap-1"><Sparkles className="h-3 w-3" /> Shuffled</Badge>
          </div>
        </CardContent>
      </Card>

      <Alert className="mb-6">
        <Lock className="h-4 w-4" />
        <AlertTitle>Your vote is secret</AlertTitle>
        <AlertDescription>
          Select one candidate per position. You may choose &ldquo;None of the Above&rdquo; to abstain explicitly.
          Once submitted, your ballot cannot be changed.
        </AlertDescription>
      </Alert>

      <div className="space-y-5">
        {positions.map((p: any, idx: number) => (
          <Card key={p.id} className="overflow-hidden">
            <CardHeader className="bg-secondary/40 pb-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{idx + 1}</span>
                    <CardTitle className="font-display text-base">{p.title}</CardTitle>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 pl-8">
                    <Badge variant="outline" className="text-[10px]">{scopeLabel(p.scope)}</Badge>
                    {p.faculty && <span className="text-xs text-muted-foreground">{p.faculty.name}</span>}
                    {p.department && <span className="text-xs text-muted-foreground">{p.department.name}</span>}
                  </div>
                </div>
                {selections[p.id] && <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <RadioGroup
                value={selections[p.id] || ''}
                onValueChange={(v) => setSelections((s) => ({ ...s, [p.id]: v }))}
                className="grid gap-2"
              >
                {p.candidates.map((c: any) => {
                  const selected = selections[p.id] === c.id
                  return (
                    <Label
                      key={c.id}
                      htmlFor={`${p.id}-${c.id}`}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-all',
                        selected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-muted/50'
                      )}
                    >
                      <RadioGroupItem value={c.id} id={`${p.id}-${c.id}`} className="sr-only" />
                      <Avatar className="h-11 w-11 ring-1 ring-border">
                        {c.photoUrl ? <AvatarImage src={c.photoUrl} alt={c.fullName} /> : null}
                        <AvatarFallback><GraduationCap className="h-5 w-5" /></AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium">{c.fullName}</span>
                          {c.level && <Badge variant="secondary" className="text-[10px]">{c.level}</Badge>}
                        </div>
                        {c.slogan && <p className="truncate text-xs italic text-muted-foreground">&ldquo;{c.slogan}&rdquo;</p>}
                      </div>
                      {selected && <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />}
                    </Label>
                  )
                })}
                {p.notaEnabled && (
                  <Label
                    htmlFor={`${p.id}-nota`}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-lg border border-dashed p-3 transition-all',
                      selections[p.id] === 'NOTA' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-muted/50'
                    )}
                  >
                    <RadioGroupItem value="NOTA" id={`${p.id}-nota`} className="sr-only" />
                    <div className="grid h-11 w-11 place-items-center rounded-full bg-muted"><MinusCircle className="h-5 w-5 text-muted-foreground" /></div>
                    <div className="flex-1">
                      <span className="font-medium">None of the Above</span>
                      <p className="text-xs text-muted-foreground">I choose to abstain from this position.</p>
                    </div>
                    {selections[p.id] === 'NOTA' && <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />}
                  </Label>
                )}
              </RadioGroup>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="sticky bottom-4 z-10 mt-6">
        <Card className="afrivote-card-glow">
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div className="text-sm">
              <span className="font-semibold">{Object.keys(selections).length}</span>
              <span className="text-muted-foreground"> / {positions.length} positions answered</span>
            </div>
            <Button onClick={() => setShowConfirm(true)} disabled={!allAnswered || submitting} className="gap-2">
              <Vote className="h-4 w-4" /> Review &amp; Cast Vote
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Confirmation modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => !submitting && setShowConfirm(false)}>
          <Card className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display"><Shield className="h-5 w-5 text-primary" /> Confirm Your Vote</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">Please review your selections. This action is final and cannot be undone.</p>
              <div className="max-h-64 space-y-2 overflow-y-auto afrivote-scroll">
                {positions.map((p: any) => {
                  const sel = selections[p.id]
                  const isNota = sel === 'NOTA'
                  const cand = p.candidates.find((c: any) => c.id === sel)
                  return (
                    <div key={p.id} className="flex items-center justify-between rounded-lg bg-muted/50 p-2.5 text-sm">
                      <span className="text-muted-foreground">{p.title}</span>
                      <span className="font-medium">{isNota ? 'None of the Above' : cand?.fullName || '—'}</span>
                    </div>
                  )
                })}
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowConfirm(false)} disabled={submitting} className="flex-1">Cancel</Button>
                <Button onClick={onCast} disabled={submitting} className="flex-1 gap-2">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {submitting ? 'Casting…' : 'Cast Vote'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export function SuccessView() {
  const { setView, lastReceipts, receiptChannel } = useApp()
  const channelLabel = receiptChannel === 'EMAIL' ? 'email' : receiptChannel === 'SMS' ? 'SMS' : receiptChannel === 'WHATSAPP' ? 'WhatsApp' : 'email'
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6">
      <Card className="afrivote-card-glow overflow-hidden">
        <div className="bg-gradient-to-br from-emerald-500 to-primary p-8 text-center text-primary-foreground">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-primary-foreground/15">
            <CheckCircle2 className="h-12 w-12" />
          </div>
          <h1 className="mt-4 font-display text-3xl font-bold">Vote Recorded!</h1>
          <p className="mt-2 text-primary-foreground/85">Your ballot has been securely cast and counted.</p>
        </div>
        <CardContent className="space-y-4 p-6">
          {receiptChannel && (
            <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/30">
              <Mail className="h-4 w-4 text-blue-600" />
              <AlertTitle className="text-blue-800 dark:text-blue-300">Receipt codes forwarded</AlertTitle>
              <AlertDescription className="text-blue-700 dark:text-blue-400">
                Your receipt codes have been sent to your registered {channelLabel}. Please check your {channelLabel} and save them for your records.
              </AlertDescription>
            </Alert>
          )}
          <Alert>
            <BadgeCheck className="h-4 w-4" />
            <AlertTitle>Save your receipt codes</AlertTitle>
            <AlertDescription>
              Use any of these codes on the homepage &ldquo;Verify My Vote&rdquo; tool to confirm your ballot was counted.
              The codes do NOT reveal who you voted for — that stays secret.
            </AlertDescription>
          </Alert>
          <div className="space-y-2">
            {lastReceipts?.map((r: any) => (
              <div key={r.receiptCode} className="flex items-center justify-between rounded-lg border bg-card p-3">
                <div>
                  <div className="text-xs text-muted-foreground">{r.positionTitle}</div>
                  <div className="font-mono text-sm font-bold">{r.receiptCode}</div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard?.writeText(r.receiptCode); toast.success('Receipt copied') }}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2 pt-2 sm:flex-row">
            <Button variant="outline" onClick={() => setView('verify-receipt')} className="flex-1 gap-2">
              <BadgeCheck className="h-4 w-4" /> Verify a Receipt
            </Button>
            <Button onClick={() => setView('home')} className="flex-1 gap-2">
              <Trophy className="h-4 w-4" /> View Live Results
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function ReceiptVerifyView() {
  const { setView } = useApp()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  async function onVerify() {
    setLoading(true); setResult(null)
    try {
      const d = await api.verifyReceipt(code)
      setResult(d)
    } catch (e: any) {
      setResult({ valid: false, message: e.message })
    } finally { setLoading(false) }
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-10 sm:px-6">
      <Button variant="ghost" size="sm" onClick={() => setView('home')} className="mb-4 gap-1.5">
        <ArrowLeft className="h-4 w-4" /> Back to home
      </Button>
      <Card className="afrivote-card-glow">
        <CardHeader>
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary"><BadgeCheck className="h-6 w-6" /></div>
          <CardTitle className="mt-3 font-display">Verify Your Vote</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="receipt">Enter your receipt code</Label>
            <Input id="receipt" placeholder="AV-XXXX-XXXX-XXXX" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="font-mono" />
          </div>
          <Button onClick={onVerify} disabled={loading || !code} className="w-full gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
            Verify Receipt
          </Button>
          {result && (
            <div className={cn('rounded-lg border p-4', result.valid ? 'border-emerald-200 bg-emerald-50' : 'border-destructive/30 bg-destructive/5')}>
              {result.valid ? (
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" />
                  <div>
                    <div className="font-semibold text-emerald-800">Vote confirmed &amp; counted</div>
                    <p className="mt-1 text-sm text-emerald-700">Position: <span className="font-medium">{result.position}</span></p>
                    <p className="text-sm text-emerald-700">Recorded at: <span className="font-mono">{new Date(result.votedAt).toLocaleString()}</span></p>
                    <p className="mt-2 text-xs text-emerald-600">{result.note}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-6 w-6 shrink-0 text-destructive" />
                  <div>
                    <div className="font-semibold text-destructive">Receipt not found</div>
                    <p className="mt-1 text-sm text-destructive/80">{result.message || 'This receipt code does not match any recorded vote.'}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function scopeLabel(s: string) {
  if (s === 'UNIVERSITY') return 'University-wide'
  if (s === 'FACULTY') return 'Faculty'
  if (s === 'DEPARTMENT') return 'Department'
  return s
}
