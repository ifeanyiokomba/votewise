'use client'

import { useEffect, useState } from 'react'
import {
  Vote, ArrowLeft, ArrowRight, CheckCircle2, Loader2, AlertCircle, Copy,
  Trophy, Shield, BadgeCheck, MinusCircle, User, Lock, Sparkles, Mail,
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
import { useTerminology } from '@/lib/terminology'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// @deprecated — VoteView is no longer rendered. The legacy single-tenant
// vote flow has been retired. Voters are redirected to the multi-tenant
// workspace flow at /workspace/elections/[id]/vote.
export function VoteView() {
  useEffect(() => {
    window.location.href = '/?view=home#organizations'
  }, [])
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <p className="text-sm text-muted-foreground">Redirecting to organization elections…</p>
    </div>
  )
}


export function SuccessView() {
  const { setView, lastReceipts, receiptChannel } = useApp()
  const channelLabel = receiptChannel === 'EMAIL' ? 'email' : receiptChannel === 'SMS' ? 'SMS' : receiptChannel === 'WHATSAPP' ? 'WhatsApp' : 'email'
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6">
      <Card className="vw-lift overflow-hidden">
        {/* Premium success header */}
        <div className="relative overflow-hidden bg-primary p-8 text-center text-primary-foreground">
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <div className="votewise-orb absolute -left-10 top-0 h-40 w-40 rounded-full bg-primary-foreground/10 blur-2xl" />
            <div className="votewise-orb votewise-orb-delay absolute -right-10 bottom-0 h-40 w-40 rounded-full bg-accent/15 blur-2xl" />
          </div>
          <div className="relative">
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-primary-foreground/12 ring-1 ring-primary-foreground/20">
              <CheckCircle2 className="h-11 w-11" />
            </div>
            <h1 className="mt-4 font-display text-3xl font-medium tracking-[-0.025em]">
              Vote Recorded!<span className="vw-dot">.</span>
            </h1>
            <p className="mt-2 text-primary-foreground/80">Your ballot has been securely cast and counted.</p>
          </div>
        </div>
        <CardContent className="space-y-4 p-6">
          {receiptChannel && (
            <Alert className="border-sky-200 bg-sky-50 dark:border-sky-900/40 dark:bg-sky-950/20">
              <Mail className="h-4 w-4 text-sky-600" />
              <AlertTitle className="text-sky-800 dark:text-sky-300">Receipt codes forwarded</AlertTitle>
              <AlertDescription className="text-sky-700 dark:text-sky-400">
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
              <div key={r.receiptCode} className="vw-lift flex items-center justify-between rounded-lg border border-border bg-card p-3">
                <div>
                  <div className="text-xs text-muted-foreground">{r.positionTitle}</div>
                  <div className="font-mono text-sm font-medium">{r.receiptCode}</div>
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
      const d = await api.publicVerifyReceipt(code)
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
      <Card className="vw-lift">
        <CardHeader>
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/8 text-primary ring-1 ring-primary/10"><BadgeCheck className="h-6 w-6" /></div>
          <CardTitle className="mt-3 font-display text-xl font-medium">
            Verify Your Vote<span className="vw-dot">.</span>
          </CardTitle>
          <p className="text-sm text-muted-foreground">Enter your receipt code to confirm your ballot was counted.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="receipt">Enter your receipt code</Label>
            <Input id="receipt" placeholder="VW-2026-XXXXXXXX" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="font-mono" />
          </div>
          <Button onClick={onVerify} disabled={loading || !code} className="w-full gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
            Verify Receipt
          </Button>
          {result && (
            <div className={cn('rounded-lg border p-4', result.valid ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20' : 'border-destructive/30 bg-destructive/5')}>
              {result.valid ? (
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-emerald-800 dark:text-emerald-200">Vote confirmed &amp; counted</div>
                    {result.electionName && (
                      <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">Election: <span className="font-medium">{result.electionName}</span></p>
                    )}
                    {(result.positionTitle || result.position) && (
                      <p className="text-sm text-emerald-700 dark:text-emerald-300">Position: <span className="font-medium">{result.positionTitle || result.position}</span></p>
                    )}
                    {result.recordedAt && (
                      <p className="text-sm text-emerald-700 dark:text-emerald-300">Recorded at: <span className="font-mono">{new Date(result.recordedAt).toLocaleString()}</span></p>
                    )}
                    {result.isSimulation && (
                      <p className="mt-2 inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                        <AlertCircle className="h-3 w-3" /> Simulation vote (not counted)
                      </p>
                    )}
                    {result.message && (
                      <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">{result.message}</p>
                    )}
                    {result.note && !result.message && (
                      <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">{result.note}</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-6 w-6 shrink-0 text-destructive" />
                  <div>
                    <div className="font-medium text-destructive">Receipt not found</div>
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

function scopeLabel(s: string, t: any) {
  if (s === 'UNIVERSITY') return `${t.organizationLabel}-wide`
  if (s === 'FACULTY') return t.workspaceLabel
  if (s === 'DEPARTMENT') return t.voterGroupLabel
  return s
}
