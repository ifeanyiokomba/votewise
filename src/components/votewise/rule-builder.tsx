'use client'

import { useEffect, useState } from 'react'
import {
  ArrowLeft, Shield, Plus, Loader2, CheckCircle2, XCircle, Zap, Eye,
  Copy, Sparkles, ChevronRight, AlertCircle, FileText,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const CATEGORIES = ['ELIGIBILITY', 'ACCREDITATION', 'AUTHENTICATION', 'VOTING', 'CANDIDATES', 'RESULTS', 'NOTIFICATIONS', 'OBSERVERS', 'SUPPORT', 'SECURITY', 'AUTOMATION']
const OPERATORS = ['equals', 'not_equals', 'contains', 'starts_with', 'ends_with', 'greater_than', 'less_than', 'between', 'in_list', 'not_in_list', 'exists', 'does_not_exist']
const ACTIONS = ['ALLOW', 'DENY', 'REQUIRE', 'NOTIFY', 'AUTOMATE', 'FLAG', 'REJECT']

export function RuleBuilder({ subdomain }: { subdomain?: string }) {
  const [ruleSets, setRuleSets] = useState<any[]>([])
  const [policies, setPolicies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', rules: [{ name: '', category: 'ELIGIBILITY', field: 'faculty', operator: 'equals', value: 'Engineering', action: 'ALLOW', priority: 100 }] })
  const [testResult, setTestResult] = useState<any>(null)
  const [testVoter, setTestVoter] = useState('{\n  "metadata": {\n    "faculty": "Engineering",\n    "level": "400"\n  },\n  "status": "ACTIVE",\n  "verificationStatus": "VERIFIED",\n  "accredited": true,\n  "hasVoted": false\n}')
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    let active = true
    Promise.all([
      api.ruleSets(null, subdomain).catch(() => ({ ruleSets: [] })),
      api.policies(subdomain).catch(() => ({ policies: [] })),
    ]).then(([rs, pol]) => {
      if (!active) return
      setRuleSets(rs.ruleSets || [])
      setPolicies(pol.policies || [])
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [subdomain])

  async function createRuleSet() {
    if (!form.name) { toast.error('Rule set name is required'); return }
    try {
      const rules = form.rules.map((r) => ({
        name: r.name || `${r.category} rule`,
        category: r.category,
        conditions: { logic: 'AND', groups: [{ field: r.field, operator: r.operator, value: r.value }] },
        action: r.action,
        priority: r.priority,
      }))
      const d = await api.createRuleSet({ name: form.name, rules }, subdomain)
      toast.success('Rule set created!')
      setRuleSets([d.ruleSet, ...ruleSets])
      setShowForm(false)
      setForm({ name: '', rules: [{ name: '', category: 'ELIGIBILITY', field: 'faculty', operator: 'equals', value: 'Engineering', action: 'ALLOW', priority: 100 }] })
    } catch (e: any) { toast.error(e.message) }
  }

  async function testRuleSet(ruleSetId: string) {
    setTesting(true)
    try {
      const sampleVoter = JSON.parse(testVoter)
      const d = await api.testRules(ruleSetId, sampleVoter, subdomain)
      setTestResult(d)
    } catch (e: any) { toast.error('Invalid JSON or test failed: ' + e.message) } finally { setTesting(false) }
  }

  function applyPolicy(policy: any) {
    try {
      const rules = typeof policy.policy === 'string' ? JSON.parse(policy.policy) : policy.policy
      setForm({ name: `${policy.name} (Customized)`, rules: rules.map((r: any) => ({
        name: r.name, category: r.category, field: r.conditions?.groups?.[0]?.field || 'faculty',
        operator: r.conditions?.groups?.[0]?.operator || 'equals',
        value: r.conditions?.groups?.[0]?.value || '', action: r.action, priority: r.priority,
      })) })
      setShowForm(true)
      toast.success(`Applied policy: ${policy.name}`)
    } catch { toast.error('Failed to apply policy') }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <Button variant="ghost" size="sm" onClick={() => { window.location.href = `/workspace?org=${subdomain || ''}` }} className="mb-4 gap-1.5">
        <ArrowLeft className="h-4 w-4" /> Back to Dashboard
      </Button>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2"><Shield className="h-6 w-6 text-primary" /> Rules Engine</h1>
          <p className="text-sm text-muted-foreground">Configure election behavior without code changes. The brain of VoteWise.</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="gap-1.5"><Plus className="h-4 w-4" /> Create Rule Set</Button>
      </div>

      {/* Rule Builder Form */}
      {showForm && (
        <Card className="mb-6 votewise-card-glow">
          <CardHeader><CardTitle className="font-display text-base">Rule Builder</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5"><Label>Rule Set Name</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="2027 Engineering Election Rules" /></div>
            {form.rules.map((r, i) => (
              <div key={i} className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <span>IF</span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  <Input value={r.name} onChange={(e) => setForm((f) => ({ ...f, rules: f.rules.map((rr, j) => j === i ? { ...rr, name: e.target.value } : rr) }))} placeholder="Rule name" className="text-xs" />
                  <Select value={r.category} onValueChange={(v) => setForm((f) => ({ ...f, rules: f.rules.map((rr, j) => j === i ? { ...rr, category: v } : rr) }))}><SelectTrigger className="text-xs"><SelectValue /></SelectTrigger><SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}</SelectContent></Select>
                  <Input value={r.field} onChange={(e) => setForm((f) => ({ ...f, rules: f.rules.map((rr, j) => j === i ? { ...rr, field: e.target.value } : rr) }))} placeholder="field (e.g. faculty)" className="text-xs font-mono" />
                  <Select value={r.operator} onValueChange={(v) => setForm((f) => ({ ...f, rules: f.rules.map((rr, j) => j === i ? { ...rr, operator: v } : rr) }))}><SelectTrigger className="text-xs"><SelectValue /></SelectTrigger><SelectContent>{OPERATORS.map((o) => <SelectItem key={o} value={o} className="text-xs">{o.replace(/_/g, ' ')}</SelectItem>)}</SelectContent></Select>
                  <Input value={r.value} onChange={(e) => setForm((f) => ({ ...f, rules: f.rules.map((rr, j) => j === i ? { ...rr, value: e.target.value } : rr) }))} placeholder="value" className="text-xs" />
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <span>THEN</span>
                  <Select value={r.action} onValueChange={(v) => setForm((f) => ({ ...f, rules: f.rules.map((rr, j) => j === i ? { ...rr, action: v } : rr) }))}><SelectTrigger className="w-32 text-xs"><SelectValue /></SelectTrigger><SelectContent>{ACTIONS.map((a) => <SelectItem key={a} value={a} className="text-xs">{a}</SelectItem>)}</SelectContent></Select>
                  <span className="text-muted-foreground">Priority:</span>
                  <Input type="number" value={r.priority} onChange={(e) => setForm((f) => ({ ...f, rules: f.rules.map((rr, j) => j === i ? { ...rr, priority: parseInt(e.target.value) || 0 } : rr) }))} className="w-16 text-xs" />
                  <Button size="sm" variant="ghost" className="ml-auto text-xs" onClick={() => setForm((f) => ({ ...f, rules: [...f.rules, { name: '', category: 'ELIGIBILITY', field: '', operator: 'equals', value: '', action: 'ALLOW', priority: 50 }] }))}><Plus className="h-3 w-3" /> Add Rule</Button>
                </div>
              </div>
            ))}
            <Button onClick={createRuleSet} className="gap-2"><CheckCircle2 className="h-4 w-4" /> Create Rule Set</Button>
          </CardContent>
        </Card>
      )}

      {/* Policy Library */}
      <h2 className="mb-3 font-display text-lg font-bold flex items-center gap-2"><Sparkles className="h-5 w-5 text-accent-foreground" /> Policy Library</h2>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {policies.map((p) => (
          <Card key={p.id} className="transition-all hover:shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                {p.isBuiltIn ? <Badge variant="secondary" className="text-[10px]">Built-in</Badge> : <Badge variant="outline" className="text-[10px]">Custom</Badge>}
                <Badge variant="outline" className="text-[10px]">{p.category}</Badge>
              </div>
              <h3 className="mt-2 font-display text-sm font-semibold">{p.name}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{p.description || 'No description.'}</p>
              <Button size="sm" variant="outline" className="mt-3 w-full gap-1 text-xs" onClick={() => applyPolicy(p)}><Copy className="h-3 w-3" /> Apply Policy</Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Rule Sets */}
      <h2 className="mb-3 font-display text-lg font-bold">Rule Sets</h2>
      {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : ruleSets.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <Shield className="mx-auto h-12 w-12 text-muted-foreground/40" />
          <p className="mt-2 text-sm font-medium">No rule sets yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Create a rule set or apply a policy from the library above.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-4">
          {ruleSets.map((rs) => (
            <Card key={rs.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-display text-sm font-semibold">{rs.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-[10px]">v{rs.version}</Badge>
                      <Badge className={cn(rs.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground')}>{rs.status}</Badge>
                      <span className="text-xs text-muted-foreground">{rs.rules?.length || 0} rules</span>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => testRuleSet(rs.id)} disabled={testing} className="gap-1 text-xs"><Eye className="h-3 w-3" /> Test</Button>
                </div>
                {/* Rules list */}
                <div className="mt-3 space-y-1">
                  {rs.rules?.slice(0, 5).map((r: any) => (
                    <div key={r.id} className="flex items-center gap-2 rounded-md bg-muted/40 px-2.5 py-1.5 text-xs">
                      <Badge variant="outline" className="text-[9px]">{r.category}</Badge>
                      <span className="font-medium">{r.name}</span>
                      <span className="text-muted-foreground">→ {r.action}</span>
                      <Badge variant="secondary" className="ml-auto text-[9px]">P{r.priority}</Badge>
                    </div>
                  ))}
                  {rs.rules?.length > 5 && <p className="text-center text-xs text-muted-foreground">+ {rs.rules.length - 5} more rules</p>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Rule Tester Result */}
      {testResult && (
        <Card className="mt-6">
          <CardHeader><CardTitle className="font-display text-base flex items-center gap-2"><Eye className="h-4 w-4 text-primary" /> Rule Test Result</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className={cn('rounded-lg border-2 p-4', testResult.allowed ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30' : 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30')}>
              <div className="flex items-center gap-2">
                {testResult.allowed ? <CheckCircle2 className="h-6 w-6 text-emerald-600" /> : <XCircle className="h-6 w-6 text-red-600" />}
                <span className="font-display text-sm font-bold">{testResult.allowed ? 'VOTER ELIGIBLE' : 'VOTER BLOCKED'}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{testResult.explanation}</p>
            </div>
            {/* Per-rule results */}
            <div className="space-y-1">
              {testResult.results?.map((r: any, i: number) => (
                <div key={i} className={cn('flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs', r.passed ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/20' : 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20')}>
                  {r.passed ? <CheckCircle2 className="h-3 w-3 text-emerald-600" /> : <XCircle className="h-3 w-3 text-red-600" />}
                  <Badge variant="outline" className="text-[9px]">{r.category}</Badge>
                  <span className="font-medium">{r.ruleName}</span>
                  <span className="text-muted-foreground ml-auto">{r.explanation}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Test voter input */}
      <Card className="mt-4">
        <CardHeader><CardTitle className="font-display text-base">Sample Voter (for testing)</CardTitle></CardHeader>
        <CardContent>
          <Textarea value={testVoter} onChange={(e) => setTestVoter(e.target.value)} rows={8} className="font-mono text-xs" />
          <p className="mt-2 text-xs text-muted-foreground">Edit this JSON to test different voter scenarios. Click "Test" on any rule set above.</p>
        </CardContent>
      </Card>
    </div>
  )
}
