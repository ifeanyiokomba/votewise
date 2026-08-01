'use client'

import { useEffect, useState } from 'react'
import {
  Play, RotateCcw, Eye, CheckCircle2, Loader2, AlertCircle, FlaskConical,
  Vote, Trophy, RefreshCw, Trash2, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface SimCandidate { id: string; name: string; photo?: string | null; slogan?: string | null }
interface SimPosition { positionId: string; title: string; maximumVotes: number; candidates: SimCandidate[]; allowNota: boolean }

export function BallotSimulation({ electionId, subdomain }: { electionId: string; subdomain?: string }) {
  const [tab, setTab] = useState('preview')
  const [loading, setLoading] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [ballot, setBallot] = useState<any>(null)
  const [selections, setSelections] = useState<Record<string, string>>({})
  const [result, setResult] = useState<any>(null)
  const [runs, setRuns] = useState<any[]>([])

  async function preview() {
    setLoading(true); setResult(null)
    try {
      const d = await api.simulateBallot(electionId, 'preview', undefined, subdomain)
      setBallot(d.ballot)
      setSelections({})
      setTab('preview')
      toast.success('Simulation ballot generated')
    } catch (e: any) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  async function castSim() {
    if (!ballot) { toast.error('Generate a preview ballot first'); return }
    if (Object.keys(selections).length === 0) { toast.error('Make at least one selection'); return }
    setLoading(true)
    try {
      const d = await api.simulateBallot(electionId, 'cast', selections, subdomain)
      setResult(d.simulation)
      setTab('results')
      toast.success('Simulation vote recorded')
    } catch (e: any) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  async function reset() {
    setResetting(true)
    try {
      const d = await api.simulateBallot(electionId, 'reset', undefined, subdomain)
      toast.success(d.message)
      setResult(null); setSelections({}); setBallot(null)
      listRuns()
    } catch (e: any) { toast.error(e.message) }
    finally { setResetting(false) }
  }

  async function listRuns() {
    try {
      const d = await api.simulateBallot(electionId, 'list', undefined, subdomain)
      setRuns(d.runs || [])
    } catch {}
  }

  useEffect(() => { listRuns() }, [electionId])

  function select(positionId: string, candidateId: string) {
    setSelections((s) => ({ ...s, [positionId]: candidateId }))
  }

  const positions: SimPosition[] = ballot?.content?.positions || []

  return (
    <div className="space-y-4">
      <Alert className="border-amber-500/30 bg-amber-500/5">
        <FlaskConical className="h-4 w-4 text-amber-600" />
        <AlertTitle className="flex items-center gap-2">Ballot Preview &amp; Simulation</AlertTitle>
        <AlertDescription>
          Test the entire voting process before going live. Simulation votes are marked <code className="rounded bg-muted px-1 text-xs">isSimulation=true</code> and do <strong>not</strong> affect real results. Use this to verify ballot layout, candidate order, voting rules, and result calculations.
        </AlertDescription>
      </Alert>

      <div className="flex flex-wrap gap-2">
        <Button onClick={preview} disabled={loading} variant="outline" className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />} Preview Ballot
        </Button>
        <Button onClick={castSim} disabled={loading || !ballot} className="gap-2">
          <Play className="h-4 w-4" /> Cast Test Vote
        </Button>
        <Button onClick={reset} disabled={resetting} variant="outline" className="gap-2 text-destructive hover:text-destructive">
          {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} Reset Simulation
        </Button>
        <Button onClick={listRuns} variant="ghost" size="sm" className="gap-1 ml-auto">
          <RefreshCw className="h-3 w-3" /> Refresh runs
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="preview" className="gap-1"><Eye className="h-3 w-3" /> Preview</TabsTrigger>
          <TabsTrigger value="results" className="gap-1"><Trophy className="h-3 w-3" /> Results</TabsTrigger>
          <TabsTrigger value="runs" className="gap-1"><Vote className="h-3 w-3" /> Runs ({runs.length})</TabsTrigger>
        </TabsList>

        {/* Preview tab */}
        <TabsContent value="preview" className="space-y-3">
          {!ballot && (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
              <Eye className="mx-auto mb-2 h-8 w-8 opacity-40" />
              Click "Preview Ballot" to see exactly what voters will see. No vote is recorded.
            </CardContent></Card>
          )}
          {ballot && positions.map((pos, idx) => (
            <Card key={pos.positionId}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="grid h-7 w-7 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{idx + 1}</div>
                  <CardTitle className="text-base">{pos.title}</CardTitle>
                  <Badge variant="outline" className="text-[10px]">{pos.maximumVotes > 1 ? `Choose ${pos.maximumVotes}` : 'Choose 1'}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <RadioGroup value={selections[pos.positionId] || ''} onValueChange={(v) => select(pos.positionId, v)}>
                  {pos.candidates.map((c) => (
                    <div key={c.id} className="flex items-center gap-3 rounded-lg border p-2 hover:bg-muted/50">
                      <RadioGroupItem value={c.id} id={`sim-${pos.positionId}-${c.id}`} />
                      <Label htmlFor={`sim-${pos.positionId}-${c.id}`} className="flex-1 cursor-pointer">
                        <span className="font-medium">{c.name}</span>
                        {c.slogan && <span className="block text-xs italic text-muted-foreground">&ldquo;{c.slogan}&rdquo;</span>}
                      </Label>
                    </div>
                  ))}
                  <div className="flex items-center gap-3 rounded-lg border border-dashed p-2 hover:bg-muted/50">
                    <RadioGroupItem value="NOTA" id={`sim-nota-${pos.positionId}`} />
                    <Label htmlFor={`sim-nota-${pos.positionId}`} className="cursor-pointer text-sm">None of the Above</Label>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Results tab */}
        <TabsContent value="results" className="space-y-3">
          {!result && (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
              <Trophy className="mx-auto mb-2 h-8 w-8 opacity-40" />
              Cast a test vote to see simulated results.
            </CardContent></Card>
          )}
          {result && (
            <>
              <Alert className="border-emerald-500/30 bg-emerald-500/5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <AlertTitle>Simulation Complete</AlertTitle>
                <AlertDescription>
                  {result.receipts.length} receipt{result.receipts.length === 1 ? '' : 's'} generated. Results below are from simulation data only.
                </AlertDescription>
              </Alert>
              {result.results.map((r: any) => {
                const max = Math.max(...r.candidates.map((c: any) => c.votes), 0)
                return (
                  <Card key={r.positionId}>
                    <CardHeader><CardTitle className="text-base">{r.title}</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      {r.candidates.map((c: any, i: number) => (
                        <div key={i} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className={cn('font-medium', c.votes === max && c.votes > 0 && 'text-emerald-600')}>{c.name}</span>
                            <span className="text-muted-foreground">{c.votes} ({c.percentage}%)</span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                            <div className={cn('h-full rounded-full transition-all', c.votes === max && c.votes > 0 ? 'bg-emerald-500' : 'bg-primary')} style={{ width: `${c.percentage}%` }} />
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )
              })}
              <div className="flex justify-end">
                <Button onClick={reset} variant="outline" size="sm" className="gap-1 text-destructive">
                  <Trash2 className="h-3 w-3" /> Clear simulation data
                </Button>
              </div>
            </>
          )}
        </TabsContent>

        {/* Runs tab */}
        <TabsContent value="runs" className="space-y-2">
          {runs.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
              No simulation runs yet.
            </CardContent></Card>
          ) : (
            runs.map((r) => (
              <Card key={r.id}>
                <CardContent className="flex items-center justify-between p-3 text-sm">
                  <div>
                    <div className="font-medium font-mono text-xs">{r.id}</div>
                    <div className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{r.voteCount} votes</Badge>
                    <Badge variant={r.status === 'SUBMITTED' ? 'default' : 'secondary'}>{r.status}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
