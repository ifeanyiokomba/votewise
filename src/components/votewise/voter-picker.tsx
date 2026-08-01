'use client'

import { useEffect, useState } from 'react'
import { User, ArrowLeft, Loader2, CheckCircle2, AlertCircle, Vote, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export function VoterPicker({ electionId, subdomain, onSelected }: { electionId: string; subdomain?: string; onSelected: (voterId: string) => void }) {
  const [voters, setVoters] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getDemoVoters(electionId, subdomain).then((d) => {
      setVoters(d.voters || [])
    }).catch((e) => setError(e.message)).finally(() => setLoading(false))
  }, [electionId, subdomain])

  async function selectVoter(voterId: string, voterName: string) {
    setStarting(voterId)
    try {
      // Start a voting session for this voter.
      const session = await api.startVotingSession(electionId, voterId, subdomain)
      toast.success(`Voting session started for ${voterName}`)
      // Store the session token for the ballot API.
      localStorage.setItem('votewise_voter_token', session.sessionToken)
      onSelected(voterId)
    } catch (e: any) {
      toast.error(e.message || 'Failed to start voting session')
    } finally {
      setStarting(null)
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <Button variant="ghost" size="sm" onClick={() => window.location.href = `/workspace/elections/${electionId}?org=${subdomain || ''}`} className="mb-4 gap-1.5">
        <ArrowLeft className="h-4 w-4" /> Back to Election
      </Button>

      <Card className="votewise-card-glow mb-6">
        <CardContent className="p-5">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            <h1 className="font-display text-xl font-bold">Secure Voter Authentication</h1>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Select your voter profile to begin. A secure voting session will be created for you.
            Your session expires in 30 minutes.
          </p>
        </CardContent>
      </Card>

      <Alert className="mb-4">
        <Vote className="h-4 w-4" />
        <AlertTitle>Demo Mode</AlertTitle>
        <AlertDescription>
          This is a demo election. In production, voters authenticate via email/SMS OTP or institutional SSO.
          Here you can pick any voter to simulate the experience.
        </AlertDescription>
      </Alert>

      {loading && <div className="grid place-items-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}

      {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}

      {!loading && voters.length === 0 && (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
          No eligible voters found for this election.
        </CardContent></Card>
      )}

      {!loading && voters.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Eligible Voters ({voters.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-96 overflow-y-auto">
            {voters.map((v) => (
              <button
                key={v.id}
                onClick={() => !v.hasVoted && selectVoter(v.id, v.name)}
                disabled={v.hasVoted || starting !== null}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all',
                  v.hasVoted
                    ? 'border-emerald-500/30 bg-emerald-500/5 opacity-70'
                    : 'border-border hover:border-primary hover:bg-primary/5',
                  starting === v.id && 'ring-2 ring-primary',
                )}
              >
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-muted text-sm font-bold">{v.name?.charAt(0) || '?'}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{v.name}</div>
                  <div className="text-xs text-muted-foreground">{v.matric} · {v.email}</div>
                </div>
                {v.hasVoted ? (
                  <Badge variant="outline" className="gap-1 text-emerald-600">
                    <CheckCircle2 className="h-3 w-3" /> Voted
                  </Badge>
                ) : starting === v.id ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : (
                  <Badge variant="outline">{v.status}</Badge>
                )}
              </button>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
