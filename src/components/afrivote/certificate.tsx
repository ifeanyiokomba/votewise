'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import {
  ArrowLeft, Award, ShieldCheck, CheckCircle2, Loader2, Printer, Share2,
  Trophy, Users, Building2, FileCheck2, AlertCircle, Download,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useApp } from '@/lib/store'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export function CertificateView() {
  const { setView } = useApp()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getCertificate().then(setData).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="mx-auto flex max-w-4xl items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
  }

  if (!data?.certified) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-16 sm:px-6">
        <Button variant="ghost" size="sm" onClick={() => setView('home')} className="mb-4 gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Button>
        <Card className="afrivote-card-glow">
          <CardContent className="py-16 text-center">
            <Award className="mx-auto h-16 w-16 text-muted-foreground/40" />
            <h1 className="mt-4 font-display text-2xl font-bold">Results Not Yet Certified</h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              {data?.message || 'The electoral committee has not yet certified the results. Certified results will appear here with a cryptographic signature for public verification.'}
            </p>
            <Button className="mt-6" onClick={() => setView('home')} variant="outline">View Live Results</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const snapshot = data.snapshot
  const election = snapshot.election
  const positions = snapshot.positions || []
  const turnout = snapshot.turnout || {}

  function print() { window.print() }

  async function share() {
    const url = window.location.href
    if (navigator.share) {
      try { await navigator.share({ title: 'AfriVote SUG — Certified Results', url }) } catch {}
    } else {
      navigator.clipboard?.writeText(url)
      toast.success('Link copied to clipboard')
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 print:py-0">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Button variant="ghost" size="sm" onClick={() => setView('home')} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={share} className="gap-1.5"><Share2 className="h-4 w-4" /> Share</Button>
          <Button variant="outline" size="sm" onClick={print} className="gap-1.5"><Printer className="h-4 w-4" /> Print</Button>
        </div>
      </div>

      {/* Certificate card */}
      <Card className="afrivote-card-glow overflow-hidden print:shadow-none print:border-0">
        {/* Certificate header */}
        <div className="relative bg-gradient-to-br from-primary to-primary/80 p-8 text-center text-primary-foreground print:bg-primary">
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 50%, white 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }} />
          <div className="relative">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary-foreground/15">
              <Award className="h-9 w-9" />
            </div>
            <h1 className="mt-3 font-display text-2xl font-bold sm:text-3xl">Official Election Certificate</h1>
            <p className="mt-1 text-primary-foreground/85">{election?.name || 'SUG General Elections'}</p>
            <p className="text-sm text-primary-foreground/70">{election?.university} · {election?.academicSession}</p>
          </div>
        </div>

        <CardContent className="p-6 sm:p-8">
          {/* Certification info */}
          <div className="mb-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg bg-muted/50 p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Certified By</div>
              <div className="mt-1 flex items-center gap-2">
                <Avatar className="h-8 w-8"><AvatarFallback>{data.certifiedBy?.name?.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                <div>
                  <div className="font-medium">{data.certifiedBy?.name}</div>
                  <div className="text-xs text-muted-foreground">{data.certifiedBy?.role?.replace(/_/g, ' ')}</div>
                </div>
              </div>
            </div>
            <div className="rounded-lg bg-muted/50 p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Certified At</div>
              <div className="mt-1 font-mono text-sm font-medium">{new Date(data.certifiedAt).toLocaleString()}</div>
            </div>
          </div>

          {/* Integrity check */}
          <Alert className={cn('mb-6', data.signatureValid ? 'border-emerald-200 bg-emerald-50' : 'border-destructive/30 bg-destructive/5')}>
            {data.signatureValid ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertCircle className="h-4 w-4 text-destructive" />}
            <AlertTitle className={data.signatureValid ? 'text-emerald-800' : 'text-destructive'}>
              {data.signatureValid ? 'Signature Verified' : 'Signature Invalid'}
            </AlertTitle>
            <AlertDescription className={data.signatureValid ? 'text-emerald-700' : 'text-destructive'}>
              {data.signatureValid
                ? 'The cryptographic signature is valid. These results have not been tampered with since certification.'
                : 'WARNING: The signature does not match. These results may have been tampered with.'}
            </AlertDescription>
          </Alert>

          {/* Turnout summary */}
          <div className="mb-6 grid grid-cols-3 gap-4">
            <div className="rounded-lg border border-border/60 p-4 text-center">
              <Users className="mx-auto h-5 w-5 text-primary" />
              <div className="mt-1 font-display text-xl font-bold">{turnout.totalVoters || 0}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Registered</div>
            </div>
            <div className="rounded-lg border border-border/60 p-4 text-center">
              <CheckCircle2 className="mx-auto h-5 w-5 text-emerald-600" />
              <div className="mt-1 font-display text-xl font-bold">{turnout.voted || 0}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Votes Cast</div>
            </div>
            <div className="rounded-lg border border-border/60 p-4 text-center">
              <Trophy className="mx-auto h-5 w-5 text-accent-foreground" />
              <div className="mt-1 font-display text-xl font-bold">{turnout.turnoutPct || 0}%</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Turnout</div>
            </div>
          </div>

          {/* Results per position */}
          <h2 className="mb-4 font-display text-lg font-bold">Certified Results</h2>
          <div className="space-y-4">
            {positions.map((p: any, i: number) => {
              const winner = p.candidates[0]
              return (
                <div key={p.id} className="rounded-lg border border-border/60 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
                      <h3 className="font-display font-semibold">{p.title}</h3>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{p.totalVotes} votes</Badge>
                  </div>
                  {winner && winner.votes > 0 ? (
                    <div className="flex items-center gap-3 rounded-lg bg-emerald-50 p-3 dark:bg-emerald-950/30">
                      <Trophy className="h-5 w-5 shrink-0 text-amber-500" />
                      <Avatar className="h-10 w-10">
                        {winner.photoUrl ? <AvatarImage src={winner.photoUrl} /> : null}
                        <AvatarFallback>{winner.fullName?.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{winner.fullName}</div>
                        <div className="text-xs text-muted-foreground">{winner.votes} votes · {winner.pct}%</div>
                      </div>
                      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">Winner</Badge>
                    </div>
                  ) : (
                    <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">No votes recorded.</div>
                  )}
                  {/* Other candidates */}
                  {p.candidates.length > 1 && (
                    <div className="mt-2 space-y-1">
                      {p.candidates.slice(1).map((c: any, j: number) => (
                        <div key={c.id} className="flex items-center gap-2 px-3 py-1 text-sm">
                          <span className="w-4 text-right text-xs text-muted-foreground">{j + 2}</span>
                          <span className="flex-1 truncate">{c.fullName}</span>
                          <span className="font-mono text-xs text-muted-foreground">{c.votes} ({c.pct}%)</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Signature footer */}
          <div className="mt-6 border-t border-border pt-4">
            <div className="flex items-start gap-2">
              <FileCheck2 className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-muted-foreground">Cryptographic Signature (HMAC-SHA256)</div>
                <div className="mt-1 break-all font-mono text-[10px] text-muted-foreground">{data.signature}</div>
                <div className="mt-1 text-[10px] text-muted-foreground">Snapshot ID: {data.snapshotId}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
