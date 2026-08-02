'use client'

import { useState } from 'react'
import { use } from 'react'
import { CheckCircle2, XCircle, Loader2, Search, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export default function VerifyEligibilityPage({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = use(params)
  const [matric, setMatric] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  async function check() {
    if (!matric.trim()) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await fetch(`/api/voter/verify-matric?matric=${encodeURIComponent(matric)}&x-vw-org=${subdomain}`).then(r => r.json())
      setResult(res)
    } catch (e: any) {
      setError(e.message || 'Failed to verify')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border/60 bg-muted/30">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <Link href={`/o/${subdomain}`}><Button variant="ghost" size="sm" className="gap-1.5"><ArrowLeft className="h-3.5 w-3.5" /> Back</Button></Link>
          <h1 className="font-display text-sm font-bold">Verify Eligibility</h1>
        </div>
      </header>
      <main className="flex-1 py-8">
        <div className="mx-auto max-w-md px-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-center font-display text-base">Check Your Voter Eligibility</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="matric">Matric Number / Voter ID</Label>
                <Input
                  id="matric"
                  placeholder="e.g. UNILAG/2020/12345"
                  value={matric}
                  onChange={(e) => setMatric(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && check()}
                />
                <p className="text-[11px] text-muted-foreground">No login required. Your details are not stored.</p>
              </div>
              <Button onClick={check} disabled={loading || !matric.trim()} className="w-full gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Check Eligibility
              </Button>

              {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

              {result && (
                <Alert variant={result.eligible ? 'default' : 'destructive'}>
                  {result.eligible ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4" />}
                  <AlertTitle>{result.eligible ? '✓ You Are Eligible' : '✗ Not Eligible'}</AlertTitle>
                  <AlertDescription className="space-y-2 text-xs">
                    {result.eligible ? (
                      <>
                        {result.faculty && <div><strong>Faculty:</strong> {result.faculty}</div>}
                        {result.department && <div><strong>Department:</strong> {result.department}</div>}
                        {result.level && <div><strong>Level:</strong> {result.level}</div>}
                        <div className="mt-2 text-emerald-600 dark:text-emerald-400">
                          You can vote in the upcoming election.
                        </div>
                      </>
                    ) : (
                      <div>{result.message || 'You are not registered to vote. Contact the electoral committee.'}</div>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
