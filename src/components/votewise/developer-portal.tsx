'use client'

// =============================================================================
// VoteWise — AIDP Developer Portal
// Chapter 16 — API Keys · Webhooks · Integrations · API Stats UI
// =============================================================================
// 4 tabs in a single Developer Portal surface.
// Palette: emerald / gold / amber / zinc / red ONLY — no indigo, no blue.
// Default theme is DARK — all badges have explicit dark: variants.
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Code2, KeyRound, Webhook, Plug, BarChart3, Loader2, RefreshCw, Plus, Trash2,
  Copy, CheckCircle2, AlertTriangle, AlertCircle, ShieldAlert, Send, Zap,
  Activity, Clock, Server, Cpu, ExternalLink, ChevronDown, ChevronUp,
  CheckCheck, XCircle, Radio, Layers, Settings2, Sparkles, ShieldCheck,
} from 'lucide-react'
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ---------------------------------------------------------------------------
// Palette + helpers
// ---------------------------------------------------------------------------

const ENV_BADGE: Record<string, string> = {
  production: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  sandbox: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
}

const STATUS_BADGE: Record<string, string> = {
  CONNECTED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  DISCONNECTED: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-300',
  ERROR: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  SYNCING: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
}

const DELIVERY_BADGE: Record<string, string> = {
  DELIVERED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  PENDING: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-300',
  RETRYING: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  FAILED: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
}

const INTEGRATION_TYPES = ['SIS', 'HR', 'IDENTITY', 'MEMBERSHIP', 'LMS', 'ERP', 'CUSTOM'] as const

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return 'Never'
  try {
    const diff = Date.now() - new Date(iso).getTime()
    const sec = Math.floor(diff / 1000)
    if (sec < 60) return `${sec}s ago`
    const min = Math.floor(sec / 60)
    if (min < 60) return `${min}m ago`
    const hr = Math.floor(min / 60)
    if (hr < 24) return `${hr}h ago`
    const day = Math.floor(hr / 24)
    if (day < 30) return `${day}d ago`
    return formatDateTime(iso)
  } catch {
    return iso
  }
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
    } else {
      // Fallback for older browsers / non-secure contexts
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    return true
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Types — mirror AIDP backend
// ---------------------------------------------------------------------------

interface ApiKey {
  id: string
  name: string
  keyPrefix: string
  scopes: string[]
  environment: string
  expiresAt: string | null
  lastUsedAt: string | null
  lastUsedIp?: string | null
  createdAt: string
}

interface ApiKeyCreated extends ApiKey {
  fullKey: string
}

interface Webhook {
  id: string
  url: string
  name: string
  events: string[]
  isActive: boolean
  totalSent: number
  totalDelivered: number
  totalFailed: number
  lastSentAt: string | null
  lastStatus: number | null
  createdAt: string
}

interface WebhookCreated extends Webhook {
  secret: string
}

interface WebhookDelivery {
  id: string
  webhookId: string
  eventId: string
  eventType: string
  status: string
  attempts: number
  responseCode: number | null
  deliveredAt: string | null
  createdAt: string
}

interface Integration {
  id: string
  name: string
  type: string
  provider: string | null
  status: string
  config: Record<string, any> | null
  lastSyncAt: string | null
  lastSyncStatus?: string | null
  lastError?: string | null
  syncCount: number
  createdAt: string
}

interface IntegrationHealth {
  total: number
  connected: number
  disconnected: number
  error: number
  syncing: number
}

interface ApiStats {
  totalRequests: number
  totalErrors: number
  avgLatencyMs: number
  errorRate: number
  topEndpoints: Array<{ endpoint: string; count: number; avgLatency: number }>
  requestsPerHour: number
}

interface ScopeCatalog {
  scopes: string[]
  webhookEvents: Array<{ event: string; description: string }>
}

// ===========================================================================
// Main Developer Portal
// ===========================================================================

export function DeveloperPortal({ subdomain }: { subdomain?: string }) {
  const [tab, setTab] = useState<'keys' | 'webhooks' | 'integrations' | 'stats'>('keys')

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
      {/* ---- Header ---- */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-6"
      >
        <Card className="votewise-card-glow overflow-hidden">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
                <Code2 className="h-6 w-6" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-bold sm:text-3xl">Developer Portal</h1>
                <p className="text-sm text-muted-foreground">
                  Manage API keys, webhooks, integrations and monitor API usage for your workspace.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1.5 font-mono text-[10px]">
                <Radio className="h-3 w-3 text-emerald-500" /> v1
              </Badge>
              <Badge className="bg-accent text-accent-foreground gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" /> HMAC-signed
              </Badge>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ---- Tabs ---- */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="mb-6 grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="keys" className="gap-1.5"><KeyRound className="h-4 w-4" /> API Keys</TabsTrigger>
          <TabsTrigger value="webhooks" className="gap-1.5"><Webhook className="h-4 w-4" /> Webhooks</TabsTrigger>
          <TabsTrigger value="integrations" className="gap-1.5"><Plug className="h-4 w-4" /> Integrations</TabsTrigger>
          <TabsTrigger value="stats" className="gap-1.5"><BarChart3 className="h-4 w-4" /> Stats</TabsTrigger>
        </TabsList>

        <TabsContent value="keys" className="mt-0">
          <ApiKeysTab subdomain={subdomain} />
        </TabsContent>
        <TabsContent value="webhooks" className="mt-0">
          <WebhooksTab subdomain={subdomain} />
        </TabsContent>
        <TabsContent value="integrations" className="mt-0">
          <IntegrationsTab subdomain={subdomain} />
        </TabsContent>
        <TabsContent value="stats" className="mt-0">
          <StatsTab subdomain={subdomain} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ===========================================================================
// Shared sub-components
// ===========================================================================

function EmptyState({ icon: Icon, title, hint }: { icon: any; title: string; hint: string }) {
  return (
    <div className="py-12 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-muted/60 text-muted-foreground">
        <Icon className="h-7 w-7" />
      </div>
      <p className="mt-3 font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="py-10 text-center">
      <AlertCircle className="mx-auto h-10 w-10 text-destructive/50" />
      <p className="mt-3 font-medium">Something went wrong</p>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button onClick={onRetry} size="sm" variant="outline" className="mt-3 gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </Button>
      )}
    </div>
  )
}

function LoadingRow() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      <span className="ml-2 text-sm text-muted-foreground">Loading…</span>
    </div>
  )
}

// ===========================================================================
// Tab 1: API Keys
// ===========================================================================

function ApiKeysTab({ subdomain }: { subdomain?: string }) {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [catalog, setCatalog] = useState<ScopeCatalog>({ scopes: [], webhookEvents: [] })

  const [createOpen, setCreateOpen] = useState(false)
  const [newKey, setNewKey] = useState<ApiKeyCreated | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null)
  const [revoking, setRevoking] = useState(false)

  const [form, setForm] = useState({
    name: '',
    scopes: [] as string[],
    environment: 'production' as 'production' | 'sandbox',
    expiresAt: '',
  })
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [keysRes, scopesRes] = await Promise.all([
        api.aidpGetApiKeys(subdomain) as Promise<{ keys: ApiKey[] }>,
        api.aidpGetScopes() as Promise<ScopeCatalog>,
      ])
      setKeys(keysRes.keys || [])
      setCatalog(scopesRes)
    } catch (e: any) {
      setError(e.message || 'Failed to load API keys')
    } finally {
      setLoading(false)
    }
  }, [subdomain])

  useEffect(() => { load() }, [load])

  function toggleScope(scope: string) {
    setForm((f) => ({
      ...f,
      scopes: f.scopes.includes(scope) ? f.scopes.filter((s) => s !== scope) : [...f.scopes, scope],
    }))
  }

  function selectAllScopes() {
    setForm((f) => ({ ...f, scopes: [...catalog.scopes] }))
  }
  function clearScopes() {
    setForm((f) => ({ ...f, scopes: [] }))
  }

  async function handleCreate() {
    if (!form.name.trim()) { toast.error('Please give your API key a name'); return }
    if (form.scopes.length === 0) { toast.error('Select at least one scope'); return }
    setCreating(true)
    try {
      const body: any = {
        name: form.name.trim(),
        scopes: form.scopes,
        environment: form.environment,
      }
      if (form.expiresAt) body.expiresAt = new Date(form.expiresAt).toISOString()
      const res = await api.aidpCreateApiKey(body, subdomain) as { ok: boolean; key: ApiKeyCreated }
      setNewKey(res.key)
      setCreateOpen(false)
      setForm({ name: '', scopes: [], environment: 'production', expiresAt: '' })
      toast.success('API key created')
      await load()
    } catch (e: any) {
      toast.error(e.message || 'Failed to create API key')
    } finally {
      setCreating(false)
    }
  }

  async function handleRevoke() {
    if (!revokeTarget) return
    setRevoking(true)
    try {
      await api.aidpRevokeApiKey(revokeTarget.id, subdomain)
      toast.success(`Key "${revokeTarget.name}" revoked`)
      setRevokeTarget(null)
      await load()
    } catch (e: any) {
      toast.error(e.message || 'Failed to revoke key')
    } finally {
      setRevoking(false)
    }
  }

  // Group scopes by prefix for nicer display
  const groupedScopes = useMemo(() => {
    const groups: Record<string, string[]> = {}
    for (const s of catalog.scopes) {
      const [prefix] = s.split(':')
      if (!groups[prefix]) groups[prefix] = []
      groups[prefix].push(s)
    }
    return groups
  }, [catalog.scopes])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="font-display text-base flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-primary" /> API Keys
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Generate scoped keys for programmatic access. Production keys are rate-limited per your plan.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={load} className="gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </Button>
              <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Create API Key
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <LoadingRow /> :
           error ? <ErrorState message={error} onRetry={load} /> :
           keys.length === 0 ? (
             <EmptyState
               icon={KeyRound}
               title="No API keys yet"
               hint="Create your first key to start integrating with the VoteWise API."
             />
           ) : (
             <div className="votewise-scroll max-h-[28rem] space-y-3 overflow-y-auto pr-1">
               <AnimatePresence initial={false}>
                 {keys.map((k) => (
                   <motion.div
                     key={k.id}
                     layout
                     initial={{ opacity: 0, y: 6 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, x: -8 }}
                     className="rounded-xl border border-border/60 bg-card p-4 transition-colors hover:bg-muted/30"
                   >
                     <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                       <div className="min-w-0 flex-1 space-y-2">
                         <div className="flex flex-wrap items-center gap-2">
                           <span className="font-medium">{k.name}</span>
                           <Badge className={cn('text-[10px]', ENV_BADGE[k.environment] || ENV_BADGE.production)}>
                             {k.environment}
                           </Badge>
                           {k.expiresAt && new Date(k.expiresAt) < new Date() && (
                             <Badge variant="outline" className="text-[10px] border-red-300 text-red-600 dark:border-red-800 dark:text-red-300">
                               Expired
                             </Badge>
                           )}
                         </div>
                         <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                           <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">{k.keyPrefix}</code>
                           <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Last used {timeAgo(k.lastUsedAt)}</span>
                           <span className="flex items-center gap-1"><ShieldAlert className="h-3 w-3" /> Expires {k.expiresAt ? formatDateTime(k.expiresAt) : 'never'}</span>
                         </div>
                         <div className="flex flex-wrap gap-1">
                           {k.scopes.map((s) => (
                             <Badge key={s} variant="outline" className="font-mono text-[10px]">{s}</Badge>
                           ))}
                         </div>
                       </div>
                       <div className="flex shrink-0 items-center gap-2">
                         <Button
                           size="sm"
                           variant="outline"
                           onClick={() => setRevokeTarget(k)}
                           className="gap-1.5 border-red-300 text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/40"
                         >
                           <Trash2 className="h-3.5 w-3.5" /> Revoke
                         </Button>
                       </div>
                     </div>
                   </motion.div>
                 ))}
               </AnimatePresence>
             </div>
           )}
        </CardContent>
      </Card>

      {/* ---- Create dialog ---- */}
      <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) setForm({ name: '', scopes: [], environment: 'production', expiresAt: '' }) }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display"><KeyRound className="h-5 w-5 text-primary" /> Create API Key</DialogTitle>
            <DialogDescription>
              Choose a name, grant the minimum scopes needed, and pick an environment. The full key will be shown only once after creation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="ak-name">Key name</Label>
              <Input
                id="ak-name"
                placeholder="e.g. Production read-only, Slack bot, BI export…"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Environment</Label>
                <Select value={form.environment} onValueChange={(v) => setForm((f) => ({ ...f, environment: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="production">Production</SelectItem>
                    <SelectItem value="sandbox">Sandbox</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ak-expiry">Expiry (optional)</Label>
                <Input
                  id="ak-expiry"
                  type="datetime-local"
                  value={form.expiresAt}
                  onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Scopes <span className="text-xs text-muted-foreground">({form.scopes.length} selected)</span></Label>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={selectAllScopes} className="h-7 text-xs">Select all</Button>
                  <Button type="button" variant="ghost" size="sm" onClick={clearScopes} className="h-7 text-xs">Clear</Button>
                </div>
              </div>
              <div className="votewise-scroll max-h-64 space-y-3 overflow-y-auto rounded-lg border border-border/60 p-3">
                {Object.entries(groupedScopes).map(([prefix, scopes]) => (
                  <div key={prefix}>
                    <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{prefix}</div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {scopes.map((s) => (
                        <label key={s} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50">
                          <Checkbox checked={form.scopes.includes(s)} onCheckedChange={() => toggleScope(s)} />
                          <code className="font-mono text-xs">{s}</code>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating} className="gap-1.5">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Show full key ONCE ---- */}
      <Dialog open={!!newKey} onOpenChange={(o) => { if (!o) setNewKey(null) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display"><Sparkles className="h-5 w-5 text-accent-foreground" /> Your new API key</DialogTitle>
            <DialogDescription>
              Copy this key now. For security, it will not be shown again.
            </DialogDescription>
          </DialogHeader>
          <Alert className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Store it securely</AlertTitle>
            <AlertDescription className="text-xs">
              Treat this key like a password. If you lose it, you&apos;ll need to revoke and create a new one.
            </AlertDescription>
          </Alert>
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/40 p-3">
            <code className="min-w-0 flex-1 break-all font-mono text-xs">{newKey?.fullKey}</code>
            <CopyButton text={newKey?.fullKey || ''} />
          </div>
          <DialogFooter>
            <Button onClick={() => setNewKey(null)} className="gap-1.5">
              <CheckCircle2 className="h-4 w-4" /> I&apos;ve saved my key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Revoke confirmation ---- */}
      <AlertDialog open={!!revokeTarget} onOpenChange={(o) => { if (!o) setRevokeTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" /> Revoke API key?</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately invalidate <strong>{revokeTarget?.name}</strong> ({revokeTarget?.keyPrefix}). Any service using this key will lose access. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoking}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              disabled={revoking}
              className="gap-1.5 bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
            >
              {revoking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Revoke Key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ===========================================================================
// Tab 2: Webhooks
// ===========================================================================

function WebhooksTab({ subdomain }: { subdomain?: string }) {
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [catalog, setCatalog] = useState<ScopeCatalog>({ scopes: [], webhookEvents: [] })

  const [createOpen, setCreateOpen] = useState(false)
  const [newWebhook, setNewWebhook] = useState<WebhookCreated | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Webhook | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [deliveriesFor, setDeliveriesFor] = useState<Webhook | null>(null)

  const [form, setForm] = useState({ url: '', name: '', events: [] as string[] })
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [whRes, scopesRes] = await Promise.all([
        api.aidpGetWebhooks(subdomain) as Promise<{ webhooks: Webhook[] }>,
        api.aidpGetScopes() as Promise<ScopeCatalog>,
      ])
      setWebhooks(whRes.webhooks || [])
      setCatalog(scopesRes)
    } catch (e: any) {
      setError(e.message || 'Failed to load webhooks')
    } finally {
      setLoading(false)
    }
  }, [subdomain])

  useEffect(() => { load() }, [load])

  function toggleEvent(evt: string) {
    setForm((f) => ({
      ...f,
      events: f.events.includes(evt) ? f.events.filter((x) => x !== evt) : [...f.events, evt],
    }))
  }

  async function handleCreate() {
    if (!form.name.trim()) { toast.error('Please give your webhook a name'); return }
    if (!form.url.trim()) { toast.error('Please provide a destination URL'); return }
    if (!form.url.startsWith('http://') && !form.url.startsWith('https://')) {
      toast.error('URL must start with http:// or https://'); return
    }
    if (form.events.length === 0) { toast.error('Subscribe to at least one event'); return }
    setCreating(true)
    try {
      const res = await api.aidpCreateWebhook({
        name: form.name.trim(),
        url: form.url.trim(),
        events: form.events,
      }, subdomain) as { ok: boolean; webhook: WebhookCreated }
      setNewWebhook(res.webhook)
      setCreateOpen(false)
      setForm({ url: '', name: '', events: [] })
      toast.success('Webhook created')
      await load()
    } catch (e: any) {
      toast.error(e.message || 'Failed to create webhook')
    } finally {
      setCreating(false)
    }
  }

  async function handleTest(wh: Webhook) {
    setTestingId(wh.id)
    try {
      await api.aidpTestWebhook(wh.id, subdomain)
      toast.success(`Test event sent to "${wh.name}"`)
      // Give the async delivery a moment then refresh
      setTimeout(() => { load() }, 1500)
    } catch (e: any) {
      toast.error(e.message || 'Failed to send test event')
    } finally {
      setTestingId(null)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.aidpDeleteWebhook(deleteTarget.id, subdomain)
      toast.success(`Webhook "${deleteTarget.name}" deleted`)
      setDeleteTarget(null)
      await load()
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete webhook')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="font-display text-base flex items-center gap-2">
                <Webhook className="h-4 w-4 text-primary" /> Webhook Endpoints
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Receive signed event notifications at your URL. Each delivery includes an HMAC-SHA256 signature header.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={load} className="gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </Button>
              <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Create Webhook
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <LoadingRow /> :
           error ? <ErrorState message={error} onRetry={load} /> :
           webhooks.length === 0 ? (
             <EmptyState
               icon={Webhook}
               title="No webhook endpoints"
               hint="Create a webhook to receive real-time event notifications at your service."
             />
           ) : (
             <div className="votewise-scroll max-h-[32rem] space-y-3 overflow-y-auto pr-1">
               <AnimatePresence initial={false}>
                 {webhooks.map((w) => (
                   <motion.div
                     key={w.id}
                     layout
                     initial={{ opacity: 0, y: 6 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, x: -8 }}
                     className="rounded-xl border border-border/60 bg-card p-4"
                   >
                     <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                       <div className="min-w-0 flex-1 space-y-2">
                         <div className="flex flex-wrap items-center gap-2">
                           <span className="font-medium">{w.name}</span>
                           <Badge variant="outline" className={cn(
                             'text-[10px]',
                             w.isActive
                               ? 'border-emerald-300 text-emerald-600 dark:border-emerald-800 dark:text-emerald-300'
                               : 'border-zinc-300 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400'
                           )}>
                             {w.isActive ? 'Active' : 'Paused'}
                           </Badge>
                         </div>
                         <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                           <ExternalLink className="h-3 w-3 shrink-0" />
                           <code className="truncate font-mono text-[11px]">{w.url}</code>
                         </div>
                         <div className="flex flex-wrap gap-1">
                           {w.events.map((e) => (
                             <Badge key={e} variant="outline" className="font-mono text-[10px]">{e}</Badge>
                           ))}
                         </div>
                         {/* Delivery stats */}
                         <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                           <span className="flex items-center gap-1 text-muted-foreground">
                             <Send className="h-3 w-3" /> Sent <strong className="text-foreground">{w.totalSent}</strong>
                           </span>
                           <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                             <CheckCheck className="h-3 w-3" /> Delivered <strong>{w.totalDelivered}</strong>
                           </span>
                           <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                             <XCircle className="h-3 w-3" /> Failed <strong>{w.totalFailed}</strong>
                           </span>
                           <span className="flex items-center gap-1 text-muted-foreground">
                             <Clock className="h-3 w-3" /> Last {timeAgo(w.lastSentAt)}
                           </span>
                           {w.lastStatus !== null && (
                             <Badge variant="outline" className={cn(
                               'text-[10px]',
                               w.lastStatus >= 200 && w.lastStatus < 300
                                 ? 'border-emerald-300 text-emerald-600 dark:border-emerald-800 dark:text-emerald-300'
                                 : 'border-red-300 text-red-600 dark:border-red-800 dark:text-red-300'
                             )}>
                               HTTP {w.lastStatus}
                             </Badge>
                           )}
                         </div>
                       </div>
                       <div className="flex shrink-0 flex-wrap items-center gap-2">
                         <Button
                           size="sm"
                           variant="outline"
                           onClick={() => handleTest(w)}
                           disabled={testingId === w.id}
                           className="gap-1.5"
                         >
                           {testingId === w.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                           Test
                         </Button>
                         <Button
                           size="sm"
                           variant="outline"
                           onClick={() => setDeliveriesFor(w)}
                           className="gap-1.5"
                         >
                           <Activity className="h-3.5 w-3.5" /> Deliveries
                         </Button>
                         <Button
                           size="sm"
                           variant="outline"
                           onClick={() => setDeleteTarget(w)}
                           className="gap-1.5 border-red-300 text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/40"
                         >
                           <Trash2 className="h-3.5 w-3.5" /> Delete
                         </Button>
                       </div>
                     </div>
                   </motion.div>
                 ))}
               </AnimatePresence>
             </div>
           )}
        </CardContent>
      </Card>

      {/* ---- Create dialog ---- */}
      <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) setForm({ url: '', name: '', events: [] }) }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display"><Webhook className="h-5 w-5 text-primary" /> Create Webhook</DialogTitle>
            <DialogDescription>
              We&apos;ll POST signed payloads to your URL whenever subscribed events fire. Keep the secret safe — you&apos;ll need it to verify signatures.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="wh-name">Name</Label>
                <Input id="wh-name" placeholder="e.g. Slack notifier" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wh-url">Destination URL</Label>
                <Input id="wh-url" placeholder="https://example.com/webhooks/votewise" value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Events <span className="text-xs text-muted-foreground">({form.events.length} selected)</span></Label>
              <div className="votewise-scroll max-h-64 space-y-1 overflow-y-auto rounded-lg border border-border/60 p-3">
                {catalog.webhookEvents.map((we) => (
                  <label key={we.event} className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50">
                    <Checkbox
                      checked={form.events.includes(we.event)}
                      onCheckedChange={() => toggleEvent(we.event)}
                      className="mt-0.5"
                    />
                    <div className="min-w-0">
                      <code className="font-mono text-xs">{we.event}</code>
                      <p className="text-xs text-muted-foreground">{we.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating} className="gap-1.5">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create Webhook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Show webhook secret ONCE ---- */}
      <Dialog open={!!newWebhook} onOpenChange={(o) => { if (!o) setNewWebhook(null) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display"><ShieldCheck className="h-5 w-5 text-accent-foreground" /> Webhook secret</DialogTitle>
            <DialogDescription>
              Use this secret to verify the <code className="rounded bg-muted px-1 font-mono text-xs">X-VoteWise-Signature</code> header on incoming deliveries.
            </DialogDescription>
          </DialogHeader>
          <Alert className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Shown only once</AlertTitle>
            <AlertDescription className="text-xs">
              Copy this secret now. For security, it will not be shown again.
            </AlertDescription>
          </Alert>
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/40 p-3">
              <code className="min-w-0 flex-1 break-all font-mono text-xs">{newWebhook?.secret}</code>
              <CopyButton text={newWebhook?.secret || ''} />
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 p-3">
              <span className="text-xs text-muted-foreground">Endpoint URL</span>
              <code className="min-w-0 flex-1 truncate font-mono text-xs">{newWebhook?.url}</code>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setNewWebhook(null)} className="gap-1.5">
              <CheckCircle2 className="h-4 w-4" /> Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Delete confirmation ---- */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" /> Delete webhook?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.name}</strong> will stop receiving events immediately. Delivery history will be retained for audit. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="gap-1.5 bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete Webhook
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ---- Deliveries dialog ---- */}
      <DeliveriesDialog webhook={deliveriesFor} onClose={() => setDeliveriesFor(null)} subdomain={subdomain} />
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  async function handleCopy() {
    const ok = await copyToClipboard(text)
    if (ok) {
      setCopied(true)
      toast.success('Copied to clipboard')
      setTimeout(() => setCopied(false), 1800)
    } else {
      toast.error('Copy failed — please copy manually')
    }
  }
  return (
    <Button size="sm" variant="outline" onClick={handleCopy} className="shrink-0 gap-1.5">
      {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copied' : 'Copy'}
    </Button>
  )
}

function DeliveriesDialog({ webhook, onClose, subdomain }: { webhook: Webhook | null; onClose: () => void; subdomain?: string }) {
  return (
    <Dialog open={!!webhook} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-h-[90vh] sm:max-w-3xl">
        {webhook && (
          <DeliveriesContent
            key={webhook.id}
            webhook={webhook}
            subdomain={subdomain}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function DeliveriesContent({ webhook, subdomain, onClose }: { webhook: Webhook; subdomain?: string; onClose: () => void }) {
  // Initial state is loading=true so we don't trigger a synchronous setState in the effect.
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const params = new URLSearchParams({ webhookId: webhook.id, limit: '50' })
    api.aidpGetWebhookDeliveries(params.toString(), subdomain)
      .then((res: any) => { if (active) setDeliveries(res.deliveries || []) })
      .catch((e: any) => { if (active) setError(e.message || 'Failed to load deliveries') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [webhook, subdomain])

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 font-display">
          <Activity className="h-5 w-5 text-primary" /> Delivery History
        </DialogTitle>
        <DialogDescription>
          Recent deliveries for <strong>{webhook.name}</strong>. Most recent first.
        </DialogDescription>
      </DialogHeader>

      {loading ? (
        <LoadingRow />
      ) : error ? (
        <ErrorState message={error} />
      ) : deliveries.length === 0 ? (
        <EmptyState icon={Send} title="No deliveries yet" hint="Trigger an event or send a test to see deliveries here." />
      ) : (
        <div className="votewise-scroll max-h-[55vh] overflow-y-auto rounded-lg border border-border/60">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                <TableHead className="text-xs">Event</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">HTTP</TableHead>
                <TableHead className="text-xs">Attempts</TableHead>
                <TableHead className="text-xs">When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deliveries.map((d) => (
                <TableRow key={d.id}>
                  <TableCell><code className="font-mono text-[11px]">{d.eventType}</code></TableCell>
                  <TableCell>
                    <Badge className={cn('text-[10px]', DELIVERY_BADGE[d.status] || DELIVERY_BADGE.PENDING)}>{d.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {d.responseCode !== null ? (
                      <span className={cn(
                        'font-mono text-xs',
                        d.responseCode >= 200 && d.responseCode < 300 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                      )}>{d.responseCode}</span>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-xs">{d.attempts}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{timeAgo(d.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Close</Button>
      </DialogFooter>
    </>
  )
}

// ===========================================================================
// Tab 3: Integrations
// ===========================================================================

function IntegrationsTab({ subdomain }: { subdomain?: string }) {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [health, setHealth] = useState<IntegrationHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Integration | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [form, setForm] = useState({ name: '', type: 'SIS' as string, provider: '' })
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.aidpGetIntegrations(subdomain) as { integrations: Integration[]; health: IntegrationHealth }
      setIntegrations(res.integrations || [])
      setHealth(res.health)
    } catch (e: any) {
      setError(e.message || 'Failed to load integrations')
    } finally {
      setLoading(false)
    }
  }, [subdomain])

  useEffect(() => { load() }, [load])

  async function handleCreate() {
    if (!form.name.trim()) { toast.error('Please give your integration a name'); return }
    setCreating(true)
    try {
      await api.aidpCreateIntegration({
        name: form.name.trim(),
        type: form.type,
        provider: form.provider.trim() || undefined,
      }, subdomain)
      toast.success('Integration added')
      setCreateOpen(false)
      setForm({ name: '', type: 'SIS', provider: '' })
      await load()
    } catch (e: any) {
      toast.error(e.message || 'Failed to add integration')
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.aidpUpdateIntegration(deleteTarget.id, { action: 'delete' }, subdomain)
      toast.success(`Integration "${deleteTarget.name}" removed`)
      setDeleteTarget(null)
      await load()
    } catch (e: any) {
      toast.error(e.message || 'Failed to remove integration')
    } finally {
      setDeleting(false)
    }
  }

  const healthCards = health ? [
    { label: 'Connected', value: health.connected, icon: CheckCircle2, cls: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Disconnected', value: health.disconnected, icon: Plug, cls: 'text-zinc-500 dark:text-zinc-400', bg: 'bg-zinc-500/10' },
    { label: 'Error', value: health.error, icon: AlertCircle, cls: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10' },
    { label: 'Syncing', value: health.syncing, icon: RefreshCw, cls: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10' },
  ] : []

  return (
    <div className="space-y-6">
      {/* ---- Health summary ---- */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="flex items-center gap-3 py-4">
              <div className="h-11 w-11 animate-pulse rounded-xl bg-muted" />
              <div className="space-y-1.5">
                <div className="h-2.5 w-16 animate-pulse rounded bg-muted" />
                <div className="h-4 w-8 animate-pulse rounded bg-muted" />
              </div>
            </CardContent></Card>
          ))
        ) : (
          healthCards.map((h) => (
            <motion.div
              key={h.label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              <Card>
                <CardContent className="flex items-center gap-3 py-4">
                  <div className={cn('grid h-11 w-11 place-items-center rounded-xl', h.bg, h.cls)}>
                    <h.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">{h.label}</div>
                    <div className="font-display text-xl font-bold">{h.value}</div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="font-display text-base flex items-center gap-2">
                <Plug className="h-4 w-4 text-primary" /> External Integrations
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Connect external systems like SIS, HR, identity providers and LMS. Sync runs as a background job — manage connections here.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={load} className="gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </Button>
              <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Add Integration
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <LoadingRow /> :
           error ? <ErrorState message={error} onRetry={load} /> :
           integrations.length === 0 ? (
             <EmptyState
               icon={Plug}
               title="No integrations configured"
               hint="Add a connection to start syncing data with external systems."
             />
           ) : (
             <div className="votewise-scroll max-h-[32rem] space-y-3 overflow-y-auto pr-1">
               <AnimatePresence initial={false}>
                 {integrations.map((it) => (
                   <motion.div
                     key={it.id}
                     layout
                     initial={{ opacity: 0, y: 6 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, x: -8 }}
                     className="rounded-xl border border-border/60 bg-card p-4"
                   >
                     <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                       <div className="min-w-0 flex-1 space-y-2">
                         <div className="flex flex-wrap items-center gap-2">
                           <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
                             <Layers className="h-4 w-4" />
                           </div>
                           <span className="font-medium">{it.name}</span>
                           <Badge variant="outline" className="font-mono text-[10px]">{it.type}</Badge>
                           <Badge className={cn('text-[10px]', STATUS_BADGE[it.status] || STATUS_BADGE.DISCONNECTED)}>
                             {it.status}
                           </Badge>
                         </div>
                         <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                           {it.provider && (
                             <span className="flex items-center gap-1">
                               <Server className="h-3 w-3" /> Provider: <strong className="text-foreground">{it.provider}</strong>
                             </span>
                           )}
                           <span className="flex items-center gap-1">
                             <RefreshCw className="h-3 w-3" /> Last sync {timeAgo(it.lastSyncAt)}
                           </span>
                           <span className="flex items-center gap-1">
                             <Cpu className="h-3 w-3" /> {it.syncCount} {it.syncCount === 1 ? 'sync' : 'syncs'}
                           </span>
                         </div>
                         {it.lastError && it.status === 'ERROR' && (
                           <div className="flex items-start gap-1.5 rounded-md border border-red-300/60 bg-red-50 px-2.5 py-1.5 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                             <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                             <span className="break-words">{it.lastError}</span>
                           </div>
                         )}
                       </div>
                       <div className="flex shrink-0 items-center gap-2">
                         <Button
                           size="sm"
                           variant="outline"
                           onClick={() => setDeleteTarget(it)}
                           className="gap-1.5 border-red-300 text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/40"
                         >
                           <Trash2 className="h-3.5 w-3.5" /> Remove
                         </Button>
                       </div>
                     </div>
                   </motion.div>
                 ))}
               </AnimatePresence>
             </div>
           )}
        </CardContent>
      </Card>

      {/* ---- Create dialog ---- */}
      <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) setForm({ name: '', type: 'SIS', provider: '' }) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display"><Plug className="h-5 w-5 text-primary" /> Add Integration</DialogTitle>
            <DialogDescription>
              Register an external system connection. Sync is configured separately per integration type.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="it-name">Name</Label>
              <Input id="it-name" placeholder="e.g. Main Campus SIS" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INTEGRATION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="it-provider">Provider (optional)</Label>
                <Input id="it-provider" placeholder="e.g. Banner, Workday, Okta" value={form.provider} onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating} className="gap-1.5">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add Integration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Delete confirmation ---- */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" /> Remove integration?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.name}</strong> will be disconnected and removed from your workspace. Any scheduled syncs will stop. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="gap-1.5 bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Remove Integration
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ===========================================================================
// Tab 4: Stats (API Analytics)
// ===========================================================================

function StatsTab({ subdomain }: { subdomain?: string }) {
  const [stats, setStats] = useState<ApiStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await api.aidpGetStats(subdomain) as ApiStats
      setStats(res)
      setLastUpdated(new Date())
      setError(null)
    } catch (e: any) {
      setError(e.message || 'Failed to load API stats')
    } finally {
      setLoading(false)
    }
  }, [subdomain])

  useEffect(() => {
    load()
    // Auto-refresh every 15s
    const id = setInterval(load, 15000)
    return () => clearInterval(id)
  }, [load])

  if (loading && !stats) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading API stats…</p>
        </div>
      </div>
    )
  }

  if (error && !stats) {
    return (
      <Card>
        <CardContent>
          <ErrorState message={error} onRetry={load} />
        </CardContent>
      </Card>
    )
  }

  if (!stats) return null

  const statCards = [
    {
      label: 'Total Requests',
      sub: 'Last 24 hours',
      value: stats.totalRequests.toLocaleString(),
      icon: Activity,
      cls: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      label: 'Error Rate',
      sub: '% of total requests',
      value: `${stats.errorRate.toFixed(2)}%`,
      icon: AlertTriangle,
      cls: stats.errorRate > 5 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400',
      bg: stats.errorRate > 5 ? 'bg-red-500/10' : 'bg-emerald-500/10',
    },
    {
      label: 'Avg Latency',
      sub: 'Milliseconds',
      value: `${stats.avgLatencyMs}ms`,
      icon: Clock,
      cls: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-500/10',
    },
    {
      label: 'Requests / Hour',
      sub: 'Last 60 minutes',
      value: stats.requestsPerHour.toLocaleString(),
      icon: Zap,
      cls: 'text-accent-foreground',
      bg: 'bg-accent/15',
    },
  ]

  const errorPct = Math.min(100, stats.errorRate)
  const errorBarColor = stats.errorRate > 5 ? 'bg-red-500' : stats.errorRate > 1 ? 'bg-amber-500' : 'bg-emerald-500'

  return (
    <div className="space-y-6">
      {/* ---- Header bar ---- */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-bold">API Usage Analytics</h2>
          <p className="text-sm text-muted-foreground">
            Aggregated metrics across all your API keys for the last 24 hours.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">
              Updated {timeAgo(lastUpdated.toISOString())}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={load} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* ---- Stat cards ---- */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.05 }}
          >
            <Card className="votewise-card-glow">
              <CardContent className="flex items-center gap-3 py-4">
                <div className={cn('grid h-11 w-11 place-items-center rounded-xl', s.bg, s.cls)}>
                  <s.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</div>
                  <div className="font-display text-xl font-bold">{s.value}</div>
                  <div className="text-[10px] text-muted-foreground">{s.sub}</div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* ---- Error rate progress bar ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> Error Rate
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {stats.totalErrors.toLocaleString()} errors out of {stats.totalRequests.toLocaleString()} requests
            </span>
            <span className={cn('font-mono font-semibold', stats.errorRate > 5 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400')}>
              {stats.errorRate.toFixed(2)}%
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
            <motion.div
              className={cn('h-full rounded-full', errorBarColor)}
              initial={{ width: 0 }}
              animate={{ width: `${errorPct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>0%</span>
            <span>Healthy &lt; 1%</span>
            <span>Warning &lt; 5%</span>
            <span>10%+</span>
          </div>
        </CardContent>
      </Card>

      {/* ---- Top endpoints ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-primary" /> Top Endpoints
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.topEndpoints.length === 0 ? (
            <EmptyState icon={Activity} title="No API traffic yet" hint="Once your keys start making requests, the busiest endpoints will appear here." />
          ) : (
            <div className="votewise-scroll max-h-96 overflow-y-auto rounded-lg border border-border/60">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead className="text-xs">Endpoint</TableHead>
                    <TableHead className="text-xs text-right">Requests</TableHead>
                    <TableHead className="text-xs text-right">Avg Latency</TableHead>
                    <TableHead className="text-xs">Share</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.topEndpoints.map((ep) => {
                    const share = stats.totalRequests > 0 ? (ep.count / stats.totalRequests) * 100 : 0
                    return (
                      <TableRow key={ep.endpoint}>
                        <TableCell><code className="font-mono text-[11px] break-all">{ep.endpoint}</code></TableCell>
                        <TableCell className="text-right text-xs font-mono">{ep.count.toLocaleString()}</TableCell>
                        <TableCell className={cn(
                          'text-right text-xs font-mono',
                          ep.avgLatency > 800 ? 'text-red-600 dark:text-red-400'
                            : ep.avgLatency > 300 ? 'text-amber-600 dark:text-amber-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        )}>
                          {ep.avgLatency}ms
                        </TableCell>
                        <TableCell className="min-w-[80px]">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, share)}%` }} />
                            </div>
                            <span className="text-[10px] text-muted-foreground">{share.toFixed(1)}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---- Auto-refresh indicator ---- */}
      <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <span className="votewise-live-dot inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
        Auto-refreshing every 15 seconds
      </div>
    </div>
  )
}
