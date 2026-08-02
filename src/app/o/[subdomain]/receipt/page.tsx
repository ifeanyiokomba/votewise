'use client'

import { useState } from 'react'
import { use } from 'react'
import { CheckCircle2, XCircle, Loader2, Search, ArrowLeft, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'

export default function ReceiptPage({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = use(params)
  const [receiptId, setReceiptId] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  async function verify() {
    if (!receiptId.trim()) return
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/receipt/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiptCode: receiptId }),
      }).then(r => r.json())
      setResult(res)
    } catch {
      setResult({ valid: false })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border/60 bg-muted/30">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <Link href={`/o/${subdomain}`}><Button variant="ghost" size="sm" className="gap-1.5"><ArrowLeft className="h-3.5 w-3.5" /> Back</Button></Link>
          <h1 className="font-display text-sm font-bold">Verify Vote Receipt</h1>
        </div>
      </header>
      <main className="flex-1 py-8">
        <div className="mx-auto max-w-md px-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-center font-display text-base">Receipt Verification</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="receipt">Receipt ID</Label>
                <Input
                  id="receipt"
                  placeholder="e.g. VW-UNILAG-2028-00823918"
                  value={receiptId}
                  onChange={(e) => setReceiptId(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && verify()}
                  className="font-mono"
                />
                <p className="text-[11px] text-muted-foreground">
                  Enter the receipt ID you received after voting. This confirms your vote was recorded — it never reveals your candidate selection.
                </p>
              </div>
              <Button onClick={verify} disabled={loading || !receiptId.trim()} className="w-full gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Verify Receipt
              </Button>

              {result && (
                <Alert variant={result.valid ? 'default' : 'destructive'}>
                  {result.valid ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4" />}
                  <AlertTitle>{result.valid ? '✓ Receipt Verified' : '✗ Receipt Not Found'}</AlertTitle>
                  <AlertDescription className="space-y-2 text-xs">
                    {result.valid ? (
                      <>
                        <div><strong>Election:</strong> {result.electionName || 'Election'}</div>
                        <div><strong>Status:</strong> Vote Successfully Recorded</div>
                        <div><strong>Timestamp:</strong> {result.votedAt ? new Date(result.votedAt).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</div>
                        <div><strong>Verified:</strong> YES</div>
                        <div className="mt-2 flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                          <ShieldCheck className="h-3 w-3" />
                          Your vote was recorded and is included in the tally.
                        </div>
                        <div className="mt-2 text-[10px] text-muted-foreground">
                          For privacy, this verification never reveals which candidate you voted for.
                        </div>
                      </>
                    ) : (
                      <div>No valid receipt found. Please check your receipt ID and try again.</div>
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
