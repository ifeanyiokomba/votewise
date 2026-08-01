'use client'

import { useEffect, useState } from 'react'
import {
  Shield, FileCheck, Hash, Lock, Download, Loader2, Award, Users,
  Vote, TrendingUp, AlertCircle, RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Verification {
  electionId: string
  electionName: string
  totalEligible: number
  totalVotes: number
  invalidVotes: number
  blankVotes: number
  turnoutPct: number
  auditHash: string
  integritySignature: string
  generatedAt?: string
  resultsByPosition?: Array<{
    positionId: string
    title: string
    totalVotes: number
    tie: boolean
    results: Array<{ candidateId: string | null; candidateName: string; votes: number; percentage: number; isWinner: boolean }>
  }>
  message?: string
}

export function ElectionVerification({ electionId, subdomain, canTally }: { electionId: string; subdomain?: string; canTally?: boolean }) {
  const [data, setData] = useState<Verification | null>(null)
  const [loading, setLoading] = useState(true)
  const [tallying, setTallying] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const d = await api.getElectionVerification(electionId, subdomain)
      setData(d)
    } catch (e: any) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [electionId])

  async function runTally() {
    setTallying(true)
    try {
      const d = await api.tallyElection(electionId, 'SHARED', true, subdomain)
      toast.success(d.message || 'Results tallied successfully')
      load()
    } catch (e: any) { toast.error(e.message) }
    finally { setTallying(false) }
  }

  function exportPackage() {
    if (!data) return
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `votewise-verification-${data.electionId}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Verification package exported')
  }

  if (loading) {
    return <div className="grid min-h-[30vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
  }

  if (!data) return null

  return (
    <div className="space-y-4">
      <Alert className="border-primary/30 bg-primary/5">
        <FileCheck className="h-4 w-4 text-primary" />
        <AlertTitle className="flex items-center gap-2">Post-Election Verification Package</AlertTitle>
        <AlertDescription>
          Every election gets a cryptographically signed verification package. The audit hash is a SHA-256 of all vote records — any change to the votes changes this hash. The integrity signature proves the tally was produced by VoteWise.
        </AlertDescription>
      </Alert>

      {data.message && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{data.message}</AlertDescription>
        </Alert>
      )}

      {/* Action bar */}
      <div className="flex flex-wrap gap-2">
        {canTally && (
          <Button onClick={runTally} disabled={tallying} className="gap-2">
            {tallying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Award className="h-4 w-4" />} Tally &amp; Lock Results
          </Button>
        )}
        <Button onClick={load} variant="outline" size="sm" className="gap-1">
          <RefreshCw className="h-3 w-3" /> Refresh
        </Button>
        <Button onClick={exportPackage} variant="outline" size="sm" className="gap-1">
          <Download className="h-3 w-3" /> Export Package
        </Button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatBox icon={Users} label="Eligible" value={data.totalEligible.toLocaleString()} />
        <StatBox icon={Vote} label="Votes" value={data.totalVotes.toLocaleString()} />
        <StatBox icon={TrendingUp} label="Turnout" value={`${data.turnoutPct}%`} highlight />
        <StatBox icon={AlertCircle} label="Invalid" value={data.invalidVotes.toLocaleString()} />
        <StatBox icon={Hash} label="Blank" value={data.blankVotes.toLocaleString()} />
      </div>

      {/* Cryptographic proof */}
      <Card className="votewise-card-glow">
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Shield className="h-4 w-4 text-primary" /> Cryptographic Proof</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Hash className="h-3 w-3" /> Audit Hash (SHA-256 of all vote records)
            </div>
            <code className="block break-all rounded-lg bg-muted p-3 font-mono text-xs">{data.auditHash}</code>
          </div>
          <div>
            <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Lock className="h-3 w-3" /> Integrity Signature (HMAC-SHA256)
            </div>
            <code className="block break-all rounded-lg bg-muted p-3 font-mono text-xs">{data.integritySignature}</code>
          </div>
          {data.generatedAt && (
            <p className="text-xs text-muted-foreground">Generated: {new Date(data.generatedAt).toLocaleString()}</p>
          )}
        </CardContent>
      </Card>

      {/* Results by position */}
      {data.resultsByPosition && data.resultsByPosition.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Award className="h-4 w-4 text-primary" /> Results by Position</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {data.resultsByPosition.map((pos) => {
              const max = Math.max(...pos.results.map((r) => r.votes), 0)
              return (
                <div key={pos.positionId}>
                  <div className="mb-2 flex items-center gap-2">
                    <h4 className="font-medium">{pos.title}</h4>
                    <Badge variant="outline" className="text-[10px]">{pos.totalVotes} votes</Badge>
                    {pos.tie && <Badge variant="destructive" className="text-[10px]">Tie</Badge>}
                  </div>
                  <div className="space-y-1.5">
                    {pos.results.map((r, i) => (
                      <div key={i} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className={cn('font-medium', r.isWinner && 'text-emerald-600 flex items-center gap-1')}>
                            {r.isWinner && <Award className="h-3 w-3" />}
                            {r.candidateName}
                          </span>
                          <span className="text-muted-foreground">{r.votes} ({r.percentage}%)</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div className={cn('h-full rounded-full transition-all', r.isWinner ? 'bg-emerald-500' : 'bg-primary')} style={{ width: `${(r.votes / Math.max(max, 1)) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <Separator className="mt-3" />
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function StatBox({ icon: Icon, label, value, highlight }: { icon: any; label: string; value: string; highlight?: boolean }) {
  return (
    <Card className={cn(highlight && 'ring-1 ring-primary/30')}>
      <CardContent className="p-3 text-center">
        <Icon className={cn('mx-auto h-4 w-4', highlight ? 'text-primary' : 'text-muted-foreground')} />
        <div className="mt-1 text-xl font-bold tabular-nums">{value}</div>
        <div className="text-[10px] text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  )
}
