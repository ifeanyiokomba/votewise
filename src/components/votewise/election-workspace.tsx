'use client'

import { useEffect, useState } from 'react'
import {
  ArrowLeft, Loader2, Vote, Trophy, Users, Eye, Headphones, CheckCircle2,
  TrendingUp, FileCheck2, ScrollText, Settings as SettingsIcon, Building2,
  Clock, Shield, ShieldCheck, Copy, Zap, Lock, LayoutTemplate, Sparkles, Siren, Bell,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { api } from '@/lib/api'
import { StatusBadge } from '@/components/votewise/shared'
import { BallotSimulation } from '@/components/votewise/ballot-simulation'
import { LiveVoteMonitor } from '@/components/votewise/live-vote-monitor'
import { ElectionVerification } from '@/components/votewise/election-verification'
import { RiskLimitingAudit } from '@/components/votewise/risk-limiting-audit'
import { ElectionExports } from '@/components/votewise/election-exports'
import { AuditLogs } from '@/components/votewise/audit-logs'
import { ElectionSettings } from '@/components/votewise/election-settings'
import { ElectionSupport } from '@/components/votewise/election-support'
import { ElectionCandidates } from '@/components/votewise/election-candidates'
import { ElectionPositions } from '@/components/votewise/election-positions'
import { ElectionObservers } from '@/components/votewise/election-observers'
import { ElectionVoters } from '@/components/votewise/election-voters'
import { DuplicateElectionDialog } from '@/components/votewise/duplicate-election-dialog'
import { ElectionNotifications } from '@/components/votewise/election-notifications'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const TABS = [
  { label: 'Overview', icon: TrendingUp },
  { label: 'Positions', icon: Vote },
  { label: 'Candidates', icon: Trophy },
  { label: 'Voters', icon: Users },
  { label: 'Observers', icon: Eye },
  { label: 'Accreditation', icon: CheckCircle2 },
  { label: 'Voting', icon: Shield },
  { label: 'Results', icon: TrendingUp },
  { label: 'Support', icon: Headphones },
  { label: 'Notifications', icon: Bell },
  { label: 'Reports', icon: FileCheck2 },
  { label: 'Audit Logs', icon: ScrollText },
  { label: 'Settings', icon: SettingsIcon },
]

export function ElectionWorkspace({ electionId, subdomain }: { electionId: string; subdomain?: string }) {
  const [election, setElection] = useState<any>(null)
  const [validation, setValidation] = useState<any>(null)
  const [timeline, setTimeline] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('Overview')

  // Save-as-template dialog state.
  const [tplOpen, setTplOpen] = useState(false)
  const [tplName, setTplName] = useState('')
  const [tplDesc, setTplDesc] = useState('')
  const [tplSaving, setTplSaving] = useState(false)

  // Duplicate-election dialog state.
  const [dupOpen, setDupOpen] = useState(false)

  // Open-incident count for the header badge (fetched from the incident stats
  // endpoint every 30s). When > 0 we render a red badge button in the header
  // that jumps to the Observers tab (which now hosts the IncidentDashboard).
  const [openIncidents, setOpenIncidents] = useState<number | null>(null)
  const [criticalIncidents, setCriticalIncidents] = useState<number>(0)

  useEffect(() => {
    let active = true
    async function loadIncidentCount() {
      try {
        const s = await api.getElectionIncidentStats(electionId, subdomain)
        if (!active) return
        setOpenIncidents(s.open ?? 0)
        setCriticalIncidents(s.critical ?? 0)
      } catch {
        // Silently ignore — header badge is non-critical.
        if (!active) return
        setOpenIncidents(null)
      }
    }
    loadIncidentCount()
    const interval = setInterval(loadIncidentCount, 30000)
    return () => { active = false; clearInterval(interval) }
  }, [electionId, subdomain])

  useEffect(() => {
    let active = true
    Promise.all([
      api.getElection(electionId, subdomain),
      api.validateElection(electionId, subdomain).catch(() => ({ checks: [] })),
      api.electionTimeline(electionId, subdomain).catch(() => ({ events: [] })),
    ]).then(([e, v, t]) => {
      if (!active) return
      setElection(e.election)
      setValidation(v)
      setTimeline(t.events || [])
    }).catch(() => {}).finally(() => { if (active) setLoading(false) })
    const interval = setInterval(() => {
      api.getElection(electionId, subdomain).then((d) => { if (active) setElection(d.election) }).catch(() => {})
    }, 15000)
    return () => { active = false; clearInterval(interval) }
  }, [electionId, subdomain])

  function duplicate() {
    // Opens the duplicate dialog (no longer a one-click action — the dialog
    // lets the user pick new dates / shift by N days before duplicating).
    setDupOpen(true)
  }

  function openSaveTemplate() {
    // Pre-fill the template name with the election name + " Template".
    setTplName(election ? `${election.name} Template` : '')
    setTplDesc('')
    setTplOpen(true)
  }

  async function saveTemplate() {
    if (!tplName.trim()) { toast.error('Template name is required'); return }
    setTplSaving(true)
    try {
      const res = await api.saveElectionTemplate(
        {
          electionId,
          templateName: tplName.trim(),
          templateDescription: tplDesc.trim() || undefined,
        },
        subdomain,
      )
      toast.success(`Saved as template "${res?.template?.name || tplName.trim()}"`)
      setTplOpen(false)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save template')
    } finally {
      setTplSaving(false)
    }
  }

  if (loading) return <div className="grid min-h-[60vh] place-items-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  if (!election) return <div className="py-16 text-center text-muted-foreground">Election not found.</div>

  const e = election
  const checks = validation?.checks || []
  const canGoLive = validation?.canGoLive || false

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
      <Button variant="ghost" size="sm" onClick={() => { window.location.href = `/workspace/elections?org=${subdomain || ''}` }} className="mb-4 gap-1.5">
        <ArrowLeft className="h-4 w-4" /> Back to Election Center
      </Button>

      {/* Election header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary"><Vote className="h-6 w-6" /></div>
          <div>
            <h1 className="font-display text-2xl font-bold">{e.name}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {e.workspace && <span>{e.workspace.name} ·</span>}
              <span>{e.category || 'General'}</span>
              <span>·</span>
              <span>{new Date(e.startTime).toLocaleDateString()} → {new Date(e.endTime).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={e.status} />
          {openIncidents !== null && openIncidents > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setTab('Observers')}
              className="gap-1.5 border-red-300 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50"
              aria-label={`${openIncidents} open incident${openIncidents === 1 ? '' : 's'}`}
              title={`${openIncidents} open incident${openIncidents === 1 ? '' : 's'}${criticalIncidents > 0 ? ` · ${criticalIncidents} critical` : ''} — open the Incident Dashboard`}
            >
              <Siren className={cn('h-3.5 w-3.5', criticalIncidents > 0 && 'animate-pulse')} />
              <span className="tabular-nums">{openIncidents}</span>
              <span className="hidden md:inline">Incident{openIncidents === 1 ? '' : 's'}</span>
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => window.open(`/results/${electionId}`, '_blank')} className="gap-1"><Eye className="h-3.5 w-3.5" /> Public Results</Button>
          <Button size="sm" variant="ghost" onClick={duplicate} className="gap-1"><Copy className="h-3.5 w-3.5" /> Duplicate</Button>
          <Button size="sm" variant="ghost" onClick={openSaveTemplate} className="gap-1"><LayoutTemplate className="h-3.5 w-3.5" /> Save as Template</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <StatBox icon={Users} label="Voters" value={e._count?.voters || 0} colour="bg-purple-100 text-purple-700" />
        <StatBox icon={Trophy} label="Candidates" value={e._count?.candidates || 0} colour="bg-amber-100 text-amber-700" />
        <StatBox icon={Vote} label="Positions" value={e._count?.positions || 0} colour="bg-primary/10 text-primary" />
        <StatBox icon={CheckCircle2} label="Accreditations" value={e._count?.accreditations || 0} colour="bg-emerald-100 text-emerald-700" />
        <StatBox icon={ScrollText} label="Timeline Events" value={e._count?.timeline || 0} colour="bg-blue-100 text-blue-700" />
        <StatBox icon={Eye} label="Visibility" value={e.visibility} colour="bg-muted text-muted-foreground" />
      </div>

      {/* Validation + Go Live */}
      {checks.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="font-display text-base flex items-center gap-2"><Shield className="h-4 w-4 text-primary" /> Validation Engine</CardTitle>
              <Badge variant={canGoLive ? 'default' : 'secondary'}>{validation?.overallPct || 0}% ready</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {checks.map((c: any) => (
                <div key={c.key} className="flex items-center gap-2 text-sm">
                  {c.passed ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Lock className="h-4 w-4 text-muted-foreground" />}
                  <span className={cn(c.passed ? 'text-foreground' : 'text-muted-foreground')}>{c.label}</span>
                  {!c.required && <Badge variant="outline" className="text-[9px]">Optional</Badge>}
                </div>
              ))}
            </div>
            <div className={cn('flex items-center gap-3 rounded-lg border-2 p-3', canGoLive ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30' : 'border-muted bg-muted/30')}>
              {canGoLive ? <Zap className="h-6 w-6 text-emerald-600" /> : <Lock className="h-6 w-6 text-muted-foreground" />}
              <div className="flex-1">
                <div className="text-sm font-bold">{canGoLive ? 'Ready to Go Live!' : 'Go Live Locked'}</div>
                <div className="text-xs text-muted-foreground">{canGoLive ? 'All required checks passed.' : `Complete ${validation?.requiredChecks - validation?.passedRequired} more required check(s).`}</div>
              </div>
              <Button disabled={!canGoLive} size="sm" className={cn(canGoLive && 'bg-emerald-600 hover:bg-emerald-700')}>{canGoLive ? 'Go Live' : 'Locked'}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <div className="mb-4 flex gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.label} onClick={() => setTab(t.label)} className={cn('flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors', tab === t.label ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground')}>
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'Overview' && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader><CardTitle className="font-display text-base">Election Details</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span className="font-medium">{e.name}</span></div>
                {e.description && <div className="flex justify-between"><span className="text-muted-foreground">Description</span><span className="font-medium">{e.description}</span></div>}
                <div className="flex justify-between"><span className="text-muted-foreground">Category</span><span className="font-medium">{e.category || '—'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span className="font-medium">{e.electionType || 'General'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Voting Method</span><span className="font-medium">{e.votingMethod || 'Single Choice'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Visibility</span><span className="font-medium">{e.visibility}</span></div>
                {e.workspace && <div className="flex justify-between"><span className="text-muted-foreground">Unit</span><span className="font-medium">{e.workspace.name}</span></div>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="font-display text-base">Timeline</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Voting Opens</span><span className="font-medium">{new Date(e.startTime).toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Voting Closes</span><span className="font-medium">{new Date(e.endTime).toLocaleString()}</span></div>
                {e.candidateRegStart && <div className="flex justify-between"><span className="text-muted-foreground">Candidate Reg Opens</span><span className="font-medium">{new Date(e.candidateRegStart).toLocaleString()}</span></div>}
                {e.candidateRegEnd && <div className="flex justify-between"><span className="text-muted-foreground">Candidate Reg Closes</span><span className="font-medium">{new Date(e.candidateRegEnd).toLocaleString()}</span></div>}
                {e.accreditationStart && <div className="flex justify-between"><span className="text-muted-foreground">Accreditation Opens</span><span className="font-medium">{new Date(e.accreditationStart).toLocaleString()}</span></div>}
                {e.resultsReleaseAt && <div className="flex justify-between"><span className="text-muted-foreground">Results Release</span><span className="font-medium">{new Date(e.resultsReleaseAt).toLocaleString()}</span></div>}
              </CardContent>
            </Card>
          </div>
          <div>
            <Card>
              <CardHeader><CardTitle className="font-display text-base">Event Timeline</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {timeline.length === 0 ? <p className="text-sm text-muted-foreground">No events yet.</p> : timeline.slice(0, 10).map((ev: any) => (
                  <div key={ev.id} className="flex items-start gap-2 text-sm">
                    <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><Clock className="h-3 w-3" /></div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium">{ev.description || ev.eventType}</div>
                      <div className="text-[10px] text-muted-foreground">{new Date(ev.createdAt).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {tab === 'Positions' && (
        <ElectionPositions electionId={electionId} subdomain={subdomain} />
      )}

      {tab === 'Candidates' && (
        <ElectionCandidates electionId={electionId} subdomain={subdomain} />
      )}

      {tab === 'Voters' && (
        <ElectionVoters electionId={electionId} subdomain={subdomain} />
      )}

      {tab === 'Observers' && (
        <ElectionObservers electionId={electionId} subdomain={subdomain} />
      )}

      {tab === 'Accreditation' && (
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-base font-semibold">Accreditation Rules</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Accreditation is configured per-election via the Settings tab. Use the Accreditation
                  Rules in Organization Settings to define eligibility rules — who can vote, what ID is
                  accepted, when accreditation opens/closes, and which channels (matric, biometric, QR)
                  are valid.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 shrink-0"
                onClick={() => {
                  const q = subdomain ? `?org=${encodeURIComponent(subdomain)}&tab=accreditation` : '?tab=accreditation'
                  window.location.href = `/workspace/settings${q}`
                }}
              >
                Open Accreditation Settings <ArrowLeft className="h-3.5 w-3.5 rotate-180" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === 'Voting' && (
        <div className="space-y-4">
          {/* Vote now button (for voters) */}
          {e.status === 'LIVE' && (
            <Card className="votewise-card-glow border-emerald-500/30">
              <CardContent className="flex flex-col items-center justify-between gap-3 p-5 sm:flex-row">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-emerald-100 text-emerald-600">
                    <Vote className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-medium">Voting is Live</div>
                    <div className="text-xs text-muted-foreground">The election is open. Eligible voters can cast their ballots now.</div>
                  </div>
                </div>
                <Button onClick={() => window.location.href = `/workspace/elections/${e.id}/vote?org=${subdomain || ''}`} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                  <Vote className="h-4 w-4" /> Cast Your Vote
                </Button>
              </CardContent>
            </Card>
          )}
          <BallotSimulation electionId={electionId} subdomain={subdomain} />
        </div>
      )}

      {tab === 'Results' && (
        <div className="space-y-4">
          <LiveVoteMonitor electionId={electionId} subdomain={subdomain} />
          <ElectionVerification electionId={electionId} subdomain={subdomain} canTally={e.status === 'COMPLETED' || e.status === 'CERTIFIED' || e.status === 'LIVE'} />
        </div>
      )}

      {tab === 'Reports' && (
        <div className="space-y-6">
          <ElectionExports electionId={electionId} subdomain={subdomain} election={e ? { id: e.id, name: e.name, status: e.status, startTime: e.startTime, endTime: e.endTime } : null} />
          <ElectionVerification electionId={electionId} subdomain={subdomain} canTally={false} />
          <div>
            <div className="mb-3 flex items-center gap-2">
              <div className="grid h-7 w-7 place-items-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <h3 className="font-display text-lg font-semibold tracking-tight">Risk-Limiting Audit</h3>
            </div>
            <RiskLimitingAudit electionId={electionId} subdomain={subdomain} />
          </div>
        </div>
      )}

      {tab === 'Audit Logs' && (
        <AuditLogs electionId={electionId} subdomain={subdomain} />
      )}

      {tab === 'Settings' && (
        <ElectionSettings electionId={electionId} subdomain={subdomain} election={e} />
      )}

      {tab === 'Support' && (
        <ElectionSupport electionId={electionId} subdomain={subdomain} />
      )}

      {tab === 'Notifications' && (
        <ElectionNotifications electionId={electionId} subdomain={subdomain} />
      )}

      {tab !== 'Overview' && tab !== 'Positions' && tab !== 'Candidates' && tab !== 'Voters' && tab !== 'Observers' && tab !== 'Accreditation' && tab !== 'Voting' && tab !== 'Results' && tab !== 'Reports' && tab !== 'Audit Logs' && tab !== 'Settings' && tab !== 'Support' && tab !== 'Notifications' && (
        <Card><CardContent className="py-12 text-center">
          {(() => { const Icon = TABS.find(t => t.label === tab)?.icon || Vote; return <Icon className="mx-auto h-12 w-12 text-muted-foreground/40" /> })()}
          <p className="mt-3 text-sm text-muted-foreground">{tab} — this section is part of the election workspace.</p>
          <p className="mt-1 text-xs text-muted-foreground">Full functionality for this tab will be available as the platform evolves.</p>
        </CardContent></Card>
      )}

      {/* Save-as-template dialog */}
      <Dialog open={tplOpen} onOpenChange={(o) => !tplSaving && setTplOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <LayoutTemplate className="h-5 w-5 text-primary" /> Save as Template
            </DialogTitle>
            <DialogDescription>
              Snapshot this election&apos;s positions, candidates, and configuration into a reusable template you can apply to future elections.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-name-input">Template Name</Label>
              <Input
                id="tpl-name-input"
                value={tplName}
                onChange={(e) => setTplName(e.target.value)}
                placeholder="e.g. Annual SUG Elections Template"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-desc-input">Description (optional)</Label>
              <Textarea
                id="tpl-desc-input"
                value={tplDesc}
                onChange={(e) => setTplDesc(e.target.value)}
                placeholder="Short note about what this template is for…"
                rows={3}
              />
            </div>
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
              <Sparkles className="mb-1 inline h-3.5 w-3.5" />{' '}
              <span className="font-semibold">What gets saved:</span>{' '}
              election config (category, type, voting method, visibility, settings), all positions and candidates.
              <br />
              <span className="font-semibold">What&apos;s stripped:</span> IDs, dates, voter data, and audit logs.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTplOpen(false)} disabled={tplSaving}>Cancel</Button>
            <Button onClick={saveTemplate} disabled={tplSaving || !tplName.trim()} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
              {tplSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <LayoutTemplate className="h-4 w-4" />}
              Save Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate election dialog */}
      <DuplicateElectionDialog
        open={dupOpen}
        onOpenChange={setDupOpen}
        election={election}
        subdomain={subdomain}
      />
    </div>
  )
}

function StatBox({ icon: Icon, label, value, colour }: any) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className={cn('grid h-8 w-8 place-items-center rounded-lg', colour)}><Icon className="h-4 w-4" /></div>
        <div className="mt-2 font-display text-xl font-bold">{typeof value === 'string' ? value : value.toLocaleString()}</div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  )
}
