'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Settings as SettingsIcon, Save, Shield, AlertTriangle, Trash2, Pause, X,
  Lock, Eye, EyeOff, ToggleLeft, Loader2, RotateCw, CheckCircle2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { StatusBadge } from '@/components/votewise/shared'

interface ElectionSettingsData {
  election: {
    id: string
    name: string
    description: string | null
    visibility: string
    status: string
    startTime: string
    endTime: string
  }
  settings: Record<string, boolean>
  locked: boolean
}

interface ElectionSettingsProps {
  electionId: string
  subdomain?: string
  /** The election object from the parent workspace — used for immediate UI
   * rendering and as a fallback for the status badge while we fetch. */
  election?: any
}

// Voting-settings toggle descriptors. Each entry maps a settings key to its
// human-readable label, description, and icon.
const SETTING_DEFS: Array<{
  key: string
  label: string
  description: string
  icon: any
}> = [
  { key: 'requireAccreditation', label: 'Require Accreditation', description: 'Voters must be accredited before they can cast a ballot.', icon: Shield },
  { key: 'requireOTVP', label: 'Require OTVP', description: 'One-Time Voting Pass — voters must claim a per-election pass to vote.', icon: ToggleLeft },
  { key: 'showLiveTurnout', label: 'Show Live Turnout', description: 'Publicly display real-time turnout counts during voting.', icon: Eye },
  { key: 'showLiveResults', label: 'Show Live Results', description: 'Publicly display real-time candidate tallies during voting.', icon: Eye },
  { key: 'hideResultsUntilEnd', label: 'Hide Results Until End', description: 'Suppress all result displays until the voting window closes.', icon: EyeOff },
  { key: 'allowResultDownload', label: 'Allow Result Download', description: 'Permit officials to export the results as CSV/JSON after tally.', icon: Save },
  { key: 'requireObserverApproval', label: 'Require Observer Approval', description: 'An observer must sign off on the tally before results are released.', icon: Shield },
  { key: 'enableAuditMode', label: 'Enable Audit Mode', description: 'Record extra-granular audit entries for every privileged action.', icon: Lock },
  { key: 'notaEnabled', label: 'Enable NOTA', description: 'Include a None Of The Above option on every position ballot.', icon: ToggleLeft },
]

const DEFAULT_SETTINGS: Record<string, boolean> = {
  requireAccreditation: true,
  requireOTVP: false,
  showLiveTurnout: true,
  showLiveResults: false,
  hideResultsUntilEnd: false,
  allowResultDownload: true,
  requireObserverApproval: false,
  enableAuditMode: true,
  notaEnabled: false,
}

export function ElectionSettings({ electionId, subdomain, election }: ElectionSettingsProps) {
  const [data, setData] = useState<ElectionSettingsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // General-information form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState('Private')
  const [savingGeneral, setSavingGeneral] = useState(false)
  const [generalDirty, setGeneralDirty] = useState(false)

  // Settings form state
  const [settings, setSettings] = useState<Record<string, boolean>>(DEFAULT_SETTINGS)
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsDirty, setSettingsDirty] = useState(false)

  // Danger-zone confirmation dialog
  const [dangerAction, setDangerAction] = useState<null | 'pause' | 'cancel' | 'delete'>(null)
  const [dangerPending, setDangerPending] = useState(false)

  async function load(showSpinner = true) {
    if (showSpinner) setLoading(true); else setRefreshing(true)
    try {
      const d = (await api.getElectionSettings(electionId, subdomain)) as ElectionSettingsData
      setData(d)
      setName(d.election.name)
      setDescription(d.election.description || '')
      setVisibility(d.election.visibility)
      setSettings({ ...DEFAULT_SETTINGS, ...d.settings })
      setGeneralDirty(false)
      setSettingsDirty(false)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load election settings')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [electionId, subdomain])

  // Sync from the parent's election prop (in case it polls and changes).
  useEffect(() => {
    if (!election || !data) return
    if (election.status && election.status !== data.election.status) {
      setData((prev) => prev ? { ...prev, election: { ...prev.election, status: election.status } } : prev)
    }
  }, [election])

  const locked = data?.locked || data?.election?.status === 'CERTIFIED' || data?.election?.status === 'ARCHIVED'
  const status = data?.election?.status || election?.status || 'DRAFT'

  async function saveGeneral() {
    setSavingGeneral(true)
    try {
      const res: any = await api.updateElectionSettings(electionId, subdomain, {
        name, description, visibility,
      })
      if (res?.election) {
        setData((prev) => prev ? { ...prev, election: res.election } : prev)
      }
      setGeneralDirty(false)
      if (res?.changed === false) {
        toast.info('No changes to save.')
      } else {
        toast.success('General information saved.')
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save general information')
    } finally {
      setSavingGeneral(false)
    }
  }

  async function saveSettings() {
    setSavingSettings(true)
    try {
      const res: any = await api.updateElectionSettings(electionId, subdomain, { settings })
      if (res?.settings) {
        setSettings({ ...DEFAULT_SETTINGS, ...res.settings })
        setData((prev) => prev ? { ...prev, settings: res.settings } : prev)
      }
      setSettingsDirty(false)
      if (res?.changed === false) {
        toast.info('No settings changes to save.')
      } else {
        toast.success('Voting settings saved.')
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save voting settings')
    } finally {
      setSavingSettings(false)
    }
  }

  function toggleSetting(key: string, value: boolean) {
    setSettings((prev) => ({ ...prev, [key]: value }))
    setSettingsDirty(true)
  }

  async function executeDanger() {
    if (!dangerAction) return
    setDangerPending(true)
    try {
      // The PATCH endpoint at /api/workspace/elections/[id] already accepts
      // status updates and creates timeline events. We use it for pause /
      // cancel / delete (delete is treated as a status flip to ARCHIVED,
      // since the schema doesn't have a hard delete endpoint we can call
      // here without cascading votes — for DRAFT elections, ARCHIVED is a
      // safe soft-delete that hides the election from the active list).
      const statusMap: Record<string, string> = {
        pause: 'PAUSED',
        cancel: 'CANCELLED',
        delete: 'ARCHIVED',
      }
      const nextStatus = statusMap[dangerAction]
      await api.updateElection(electionId, { status: nextStatus }, subdomain)
      toast.success({
        pause: 'Election paused. Voters can no longer cast ballots until you resume.',
        cancel: 'Election cancelled.',
        delete: 'Election archived.',
      }[dangerAction] || 'Action complete.')
      setDangerAction(null)
      // Reload settings + status.
      await load(true)
      // Ask the parent workspace to refresh the election header as well.
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('votewise:election-status-changed', { detail: { id: electionId, status: nextStatus } }))
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to perform action')
    } finally {
      setDangerPending(false)
    }
  }

  const visibilityOptions = useMemo(() => ([
    { value: 'Public', label: 'Public', hint: 'Anyone with the link can view this election.' },
    { value: 'Private', label: 'Private', hint: 'Only authenticated voters in this org can see it.' },
    { value: 'Invite Only', label: 'Invite Only', hint: 'Only voters explicitly invited can access it.' },
  ]), [])

  if (loading) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header card — status + locked banner */}
      <Card className={cn('votewise-card-glow', locked && 'border-amber-300/60')}>
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <SettingsIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-lg font-bold">Election Settings</h2>
                <StatusBadge status={status} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Manage election configuration, voting rules, and lifecycle actions.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => load(false)} disabled={refreshing} className="gap-1.5 self-start sm:self-auto">
            {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
            Refresh
          </Button>
        </CardContent>
      </Card>

      {locked && (
        <Alert className="border-amber-400/50 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <Lock className="h-4 w-4" />
          <AlertTitle>Settings are locked</AlertTitle>
          <AlertDescription>
            This election is <span className="font-semibold">{status}</span>. Once an election is certified or archived,
            its configuration cannot be modified. Create a duplicate if you need to start a new round.
          </AlertDescription>
        </Alert>
      )}

      {/* Section A — General Information */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="font-display text-base flex items-center gap-2">
              <SettingsIcon className="h-4 w-4 text-primary" /> General Information
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Edit the name, description, and visibility of this election.</p>
          </div>
          {generalDirty && (
            <Badge variant="outline" className="border-amber-400 text-amber-700">Unsaved changes</Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="settings-name">Election Name</Label>
            <Input
              id="settings-name"
              value={name}
              onChange={(e) => { setName(e.target.value); setGeneralDirty(true) }}
              disabled={locked || savingGeneral}
              placeholder="e.g. SUG General Elections 2025/2026"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="settings-description">Description</Label>
            <Textarea
              id="settings-description"
              value={description}
              onChange={(e) => { setDescription(e.target.value); setGeneralDirty(true) }}
              disabled={locked || savingGeneral}
              placeholder="A short description shown to voters on the ballot page."
              rows={3}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Visibility</Label>
            <Select
              value={visibility}
              onValueChange={(v) => { setVisibility(v); setGeneralDirty(true) }}
              disabled={locked || savingGeneral}
            >
              <SelectTrigger className="w-full sm:w-[280px]" id="settings-visibility">
                <SelectValue placeholder="Select visibility" />
              </SelectTrigger>
              <SelectContent>
                {visibilityOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div className="flex flex-col">
                      <span className="font-medium">{opt.label}</span>
                      <span className="text-[10px] text-muted-foreground">{opt.hint}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Separator />
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (data) {
                  setName(data.election.name)
                  setDescription(data.election.description || '')
                  setVisibility(data.election.visibility)
                  setGeneralDirty(false)
                }
              }}
              disabled={locked || savingGeneral || !generalDirty}
            >
              Reset
            </Button>
            <Button
              size="sm"
              onClick={saveGeneral}
              disabled={locked || savingGeneral || !generalDirty}
              className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {savingGeneral ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Section B — Voting Settings */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="font-display text-base flex items-center gap-2">
              <ToggleLeft className="h-4 w-4 text-primary" /> Voting Settings
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Toggles that control accreditation, transparency, and audit behaviour.</p>
          </div>
          {settingsDirty && (
            <Badge variant="outline" className="border-amber-400 text-amber-700">Unsaved changes</Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          <AnimatePresence mode="popLayout">
            {SETTING_DEFS.map((def, idx) => {
              const Icon = def.icon
              const value = !!settings[def.key]
              return (
                <motion.div
                  key={def.key}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: Math.min(idx * 0.02, 0.15) }}
                  className={cn(
                    'flex items-start justify-between gap-3 rounded-lg border border-border/60 p-3 transition-colors',
                    value ? 'bg-primary/5' : 'bg-card',
                    locked && 'opacity-70'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg', value ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">{def.label}</div>
                      <div className="text-xs text-muted-foreground">{def.description}</div>
                    </div>
                  </div>
                  <Switch
                    checked={value}
                    onCheckedChange={(v) => toggleSetting(def.key, v)}
                    disabled={locked || savingSettings}
                    aria-label={def.label}
                  />
                </motion.div>
              )
            })}
          </AnimatePresence>
          <Separator />
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (data) {
                  setSettings({ ...DEFAULT_SETTINGS, ...data.settings })
                  setSettingsDirty(false)
                }
              }}
              disabled={locked || savingSettings || !settingsDirty}
            >
              Reset
            </Button>
            <Button
              size="sm"
              onClick={saveSettings}
              disabled={locked || savingSettings || !settingsDirty}
              className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {savingSettings ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Section C — Danger Zone */}
      <Card className="border-red-200 dark:border-red-900/50">
        <CardHeader>
          <CardTitle className="font-display text-base flex items-center gap-2 text-red-700 dark:text-red-400">
            <AlertTriangle className="h-4 w-4" /> Danger Zone
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Irreversible and destructive actions. Confirm carefully.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {status === 'LIVE' && (
            <>
              <DangerRow
                icon={Pause}
                title="Pause Election"
                description="Temporarily suspend voting. Voters cannot cast ballots until you resume. No data is lost."
                buttonLabel="Pause Election"
                onClick={() => setDangerAction('pause')}
                disabled={locked}
              />
              <Separator />
              <DangerRow
                icon={X}
                title="Cancel Election"
                description="Permanently cancel this election. The election record remains for audit, but no further voting or tally is possible."
                buttonLabel="Cancel Election"
                onClick={() => setDangerAction('cancel')}
                disabled={locked}
                destructive
              />
            </>
          )}
          {status === 'DRAFT' && (
            <DangerRow
              icon={Trash2}
              title="Delete Election"
              description="Archive this draft election. It will no longer appear in your active election list. This action can be reversed by an org owner."
              buttonLabel="Delete Election"
              onClick={() => setDangerAction('delete')}
              disabled={locked}
              destructive
            />
          )}
          {(status === 'COMPLETED' || status === 'CERTIFIED' || status === 'ARCHIVED' || status === 'CANCELLED' || status === 'PAUSED' || status === 'PUBLISHED' || status === 'READY' || status === 'ACCREDITATION' || status === 'SCHEDULED') && (
            <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/30 p-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
              <div className="text-sm text-muted-foreground">
                No destructive actions are available for an election in the <span className="font-semibold text-foreground">{status}</span> state.
                {status === 'PAUSED' && ' Resume the election from the workspace header to re-open voting.'}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={dangerAction !== null} onOpenChange={(o) => !o && !dangerPending && setDangerAction(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertTriangle className="h-4 w-4" />
              {dangerAction === 'pause' && 'Pause this election?'}
              {dangerAction === 'cancel' && 'Cancel this election?'}
              {dangerAction === 'delete' && 'Delete this election?'}
            </DialogTitle>
            <DialogDescription>
              {dangerAction === 'pause' && (
                <>Voting will be suspended immediately. You can resume later from the workspace header. This action is logged in the audit trail.</>
              )}
              {dangerAction === 'cancel' && (
                <>This election will be marked as <strong>CANCELLED</strong>. The record remains for audit but no further voting or tally can occur. This action cannot be undone.</>
              )}
              {dangerAction === 'delete' && (
                <>This draft election will be <strong>archived</strong> and removed from your active list. The record remains for audit. This action cannot be undone from the UI.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-red-50 p-3 text-xs text-red-900 dark:bg-red-950/30 dark:text-red-200">
            <div className="font-semibold">Election: {data?.election?.name || election?.name}</div>
            <div className="mt-0.5">Status: {status}</div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" size="sm" onClick={() => setDangerAction(null)} disabled={dangerPending}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={executeDanger}
              disabled={dangerPending}
              className="gap-1.5 bg-red-600 text-white hover:bg-red-700"
            >
              {dangerPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <AlertTriangle className="h-3.5 w-3.5" />}
              {dangerAction === 'pause' && 'Pause Election'}
              {dangerAction === 'cancel' && 'Cancel Election'}
              {dangerAction === 'delete' && 'Delete Election'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DangerRow({
  icon: Icon, title, description, buttonLabel, onClick, disabled, destructive,
}: {
  icon: any
  title: string
  description: string
  buttonLabel: string
  onClick: () => void
  disabled?: boolean
  destructive?: boolean
}) {
  return (
    <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
      <div className="flex items-start gap-3">
        <div className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg', destructive ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700')}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-medium">{title}</div>
          <div className="text-xs text-muted-foreground">{description}</div>
        </div>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={onClick}
        disabled={disabled}
        className={cn(
          'shrink-0 gap-1.5',
          destructive
            ? 'border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30'
            : 'border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-amber-800 dark:border-amber-900 dark:text-amber-400 dark:hover:bg-amber-950/30'
        )}
      >
        <Icon className="h-3.5 w-3.5" />
        {buttonLabel}
      </Button>
    </div>
  )
}
