'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell, Send, Mail, MessageSquare, Users, Clock, CheckCircle2, AlertCircle,
  Filter, Search, FileText, Megaphone, Loader2, RefreshCw, Inbox, X, Shield,
  Sparkles, ChevronRight, User,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface NotificationTarget {
  kind: 'ALL_VOTERS' | 'VOTER'
  label: string
  voterId?: string | null
  voterMatric?: string | null
}

interface NotificationCampaign {
  id: string
  title: string
  message: string
  type: string // INFO | SUCCESS | WARNING | SECURITY
  createdAt: string
  officialId: string | null
  target: NotificationTarget
  recipients: number
  readCount: number
  unreadCount: number
  readPct: number
}

interface NotificationStats {
  totalSent: number
  campaigns: number
  read: number
  unread: number
  deliveryRate: number
}

interface NotificationsData {
  notifications: NotificationCampaign[]
  stats: NotificationStats
  election: { id: string; name: string; status: string }
}

interface Template {
  id: string
  title: string
  message: string
  type: string
  description: string
}

interface VoterSearchResult {
  id: string
  fullName: string
  matric: string
  email: string | null
  institutionEmail: string | null
  phone: string | null
}

// ---------------------------------------------------------------------------
// Style maps — strictly emerald/gold/amber/red/zinc palette (NO indigo/blue).
// ---------------------------------------------------------------------------
const TYPE_STYLES: Record<string, { cls: string; icon: any; dot: string; iconColor: string }> = {
  INFO:    { cls: 'bg-primary/10 text-primary border-primary/20', icon: Bell,        dot: 'bg-primary', iconColor: 'text-primary' },
  SUCCESS: { cls: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/40', icon: CheckCircle2, dot: 'bg-emerald-500', iconColor: 'text-emerald-600 dark:text-emerald-400' },
  WARNING: { cls: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/40', icon: AlertCircle, dot: 'bg-amber-500', iconColor: 'text-amber-600 dark:text-amber-400' },
  SECURITY:{ cls: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/40', icon: Shield, dot: 'bg-red-500', iconColor: 'text-red-600 dark:text-red-400' },
}

const TEMPLATE_META: Record<string, { icon: any; label: string; tint: string }> = {
  'voting-opens':      { icon: Megaphone,  label: 'Voting Opens',       tint: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' },
  'voting-closes-soon':{ icon: Clock,      label: 'Voting Closes Soon', tint: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' },
  'results-published': { icon: CheckCircle2, label: 'Results Published', tint: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' },
  'election-reminder': { icon: Bell,       label: 'Reminder',           tint: 'bg-primary/10 text-primary' },
  'custom':            { icon: FileText,   label: 'Custom',             tint: 'bg-muted text-muted-foreground' },
}

const TYPE_OPTIONS = ['INFO', 'SUCCESS', 'WARNING', 'SECURITY'] as const

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return iso }
}

function timeAgo(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime()
    if (diff < 60_000) return 'just now'
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
    if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`
    return formatTime(iso)
  } catch { return iso }
}

function typeStyle(t: string) {
  return TYPE_STYLES[t] || TYPE_STYLES.INFO
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function ElectionNotifications({ electionId, subdomain }: { electionId: string; subdomain?: string }) {
  const [data, setData] = useState<NotificationsData | null>(null)
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('ALL')
  const [unreadOnly, setUnreadOnly] = useState(false)

  // Send dialog state
  const [sendOpen, setSendOpen] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('custom')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [type, setType] = useState<string>('INFO')
  const [targetMode, setTargetMode] = useState<'ALL' | 'VOTER'>('ALL')
  const [voterQuery, setVoterQuery] = useState('')
  const [voterResults, setVoterResults] = useState<VoterSearchResult[]>([])
  const [selectedVoter, setSelectedVoter] = useState<VoterSearchResult | null>(null)
  const [searching, setSearching] = useState(false)
  const [sending, setSending] = useState(false)
  const [recipientPreview, setRecipientPreview] = useState<number | null>(null)

  async function load(showSpinner = true) {
    if (showSpinner) setLoading(true); else setRefreshing(true)
    try {
      const params = new URLSearchParams()
      if (typeFilter !== 'ALL') params.set('type', typeFilter)
      if (unreadOnly) params.set('unreadOnly', 'true')
      const paramStr = params.toString()
      const d = (await api.getElectionNotifications(electionId, paramStr, subdomain)) as NotificationsData
      setData(d)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load notifications')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  async function loadTemplates() {
    try {
      const d = (await api.getNotificationTemplates(electionId, subdomain)) as { templates: Template[] }
      setTemplates(d.templates || [])
    } catch {
      // Templates are non-critical — fail silently.
    }
  }

  useEffect(() => { load(); loadTemplates() }, [electionId, subdomain])
  useEffect(() => { load(false) }, [typeFilter, unreadOnly])

  // Voter search (debounced, 350ms)
  useEffect(() => {
    if (targetMode !== 'VOTER') return
    if (!voterQuery.trim()) { setVoterResults([]); return }
    const handle = setTimeout(async () => {
      setSearching(true)
      try {
        const res: any = await api.getElectionVoters(electionId, `search=${encodeURIComponent(voterQuery)}&pageSize=10`, subdomain)
        setVoterResults(res?.voters || [])
      } catch {
        setVoterResults([])
      } finally {
        setSearching(false)
      }
    }, 350)
    return () => clearTimeout(handle)
  }, [voterQuery, targetMode, electionId, subdomain])

  // Fetch recipient preview count when the dialog opens (for "All Voters" mode).
  useEffect(() => {
    if (!sendOpen || targetMode !== 'ALL') { setRecipientPreview(null); return }
    api.getElectionVoters(electionId, 'pageSize=1', subdomain)
      .then((res: any) => setRecipientPreview(res?.stats?.total ?? null))
      .catch(() => setRecipientPreview(null))
  }, [sendOpen, targetMode, electionId, subdomain])

  const filtered = useMemo(() => {
    if (!data) return []
    const q = search.trim().toLowerCase()
    return data.notifications.filter((n) => {
      if (!q) return true
      return (
        n.title.toLowerCase().includes(q) ||
        n.message.toLowerCase().includes(q) ||
        n.target.label.toLowerCase().includes(q)
      )
    })
  }, [data, search])

  function applyTemplate(tplId: string) {
    setSelectedTemplateId(tplId)
    const tpl = templates.find((t) => t.id === tplId)
    if (!tpl) return
    setTitle(tpl.title)
    setMessage(tpl.message)
    setType(tpl.type)
  }

  function openSendDialog(initialTemplateId?: string) {
    const tplId = initialTemplateId || 'custom'
    setSelectedTemplateId(tplId)
    const tpl = templates.find((t) => t.id === tplId)
    setTitle(tpl?.title || '')
    setMessage(tpl?.message || '')
    setType(tpl?.type || 'INFO')
    setTargetMode('ALL')
    setVoterQuery('')
    setSelectedVoter(null)
    setVoterResults([])
    setSendOpen(true)
  }

  async function send() {
    if (!title.trim()) { toast.error('A title is required'); return }
    if (!message.trim()) { toast.error('A message is required'); return }
    if (targetMode === 'VOTER' && !selectedVoter) {
      toast.error('Please select a voter to send to')
      return
    }
    setSending(true)
    try {
      const payload: any = {
        title: title.trim(),
        message: message.trim(),
        type,
      }
      if (targetMode === 'VOTER' && selectedVoter) {
        payload.targetVoterId = selectedVoter.id
      }
      const res: any = await api.sendElectionNotification(electionId, payload, subdomain)
      toast.success(res?.message || `Notification sent to ${res?.recipients ?? 0} voter(s).`)
      setSendOpen(false)
      load(false)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to send notification')
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    )
  }

  const stats = data?.stats || { totalSent: 0, campaigns: 0, read: 0, unread: 0, deliveryRate: 0 }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="votewise-card-glow">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold">Notifications</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Notify voters when voting opens, closes, and results are published. Track delivery + read rates per campaign.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button variant="outline" size="sm" onClick={() => load(false)} disabled={refreshing} className="gap-1.5">
              {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Refresh
            </Button>
            <Button size="sm" onClick={() => openSendDialog()} className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90">
              <Send className="h-3.5 w-3.5" /> Send Notification
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Megaphone} label="Total Sent" value={stats.totalSent} colour="bg-muted text-foreground" />
        <StatCard icon={CheckCircle2} label="Read" value={stats.read} colour="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" />
        <StatCard icon={Bell} label="Unread" value={stats.unread} colour="bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" />
        <StatCard
          icon={Mail}
          label="Delivery Rate"
          value={stats.deliveryRate}
          suffix="%"
          colour="bg-primary/10 text-primary"
        />
      </div>

      {/* Template Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-base">
            <Sparkles className="h-4 w-4 text-primary" /> Quick Templates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {templates.map((tpl) => {
              const meta = TEMPLATE_META[tpl.id] || TEMPLATE_META.custom
              const Icon = meta.icon
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => openSendDialog(tpl.id)}
                  className="group flex flex-col items-start gap-2 rounded-lg border border-border bg-background p-3 text-left transition-all hover:border-primary/40 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  aria-label={`Use template: ${meta.label}`}
                >
                  <div className={cn('grid h-8 w-8 place-items-center rounded-lg', meta.tint)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="text-sm font-semibold">{meta.label}</div>
                  <div className="line-clamp-2 text-[11px] text-muted-foreground">{tpl.description}</div>
                  <span className="mt-1 inline-flex items-center gap-0.5 text-[10px] font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                    Use <ChevronRight className="h-3 w-3" />
                  </span>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Toolbar — search + type filter */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by title, message, or target…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All types</SelectItem>
                {TYPE_OPTIONS.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant={unreadOnly ? 'default' : 'outline'}
              size="sm"
              onClick={() => setUnreadOnly((v) => !v)}
              className="gap-1.5"
            >
              <Inbox className="h-3.5 w-3.5" />
              Unread only
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notifications list */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
              <Bell className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium">No notifications {search || typeFilter !== 'ALL' || unreadOnly ? 'match your filters' : 'sent yet'}</p>
            <p className="text-xs text-muted-foreground">
              {search || typeFilter !== 'ALL' || unreadOnly
                ? 'Try adjusting your search or filters.'
                : 'Send a notification to all eligible voters — or a specific voter — using the button above.'}
            </p>
            {(search || typeFilter !== 'ALL' || unreadOnly) && (
              <Button variant="outline" size="sm" onClick={() => { setSearch(''); setTypeFilter('ALL'); setUnreadOnly(false) }} className="mt-2 gap-1.5">
                <X /> Clear filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="max-h-[500px] space-y-3 overflow-y-auto pr-1">
          <AnimatePresence mode="popLayout">
            {filtered.map((n, idx) => {
              const tSt = typeStyle(n.type)
              const TypeIcon = tSt.icon
              const isBroadcast = n.target.kind === 'ALL_VOTERS'
              const readPct = n.recipients > 0 ? Math.round((n.readCount / n.recipients) * 100) : 0
              return (
                <motion.div
                  key={n.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18, delay: Math.min(idx * 0.02, 0.15) }}
                >
                  <Card className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        {/* Left — type icon + content */}
                        <div className="flex flex-1 gap-3">
                          <div className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-lg border', tSt.cls)}>
                            <TypeIcon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className={cn('gap-1 border', tSt.cls)}>
                                <span className={cn('h-1.5 w-1.5 rounded-full', tSt.dot)} />
                                {n.type}
                              </Badge>
                              <Badge variant="secondary" className={cn('gap-1', isBroadcast ? 'bg-primary/10 text-primary' : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300')}>
                                {isBroadcast ? <Users className="h-3 w-3" /> : <User className="h-3 w-3" />}
                                {n.target.label}
                              </Badge>
                              <span className="text-xs text-muted-foreground">{timeAgo(n.createdAt)}</span>
                            </div>
                            <div className="text-sm font-semibold leading-tight">{n.title}</div>
                            <p className="line-clamp-2 text-sm text-muted-foreground">{n.message}</p>
                            {/* Read progress */}
                            <div className="space-y-1 pt-1">
                              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <CheckCircle2 className="h-3 w-3" />
                                  {n.readCount}/{n.recipients} read
                                </span>
                                <span className="tabular-nums">{readPct}%</span>
                              </div>
                              <Progress
                                value={readPct}
                                className={cn(
                                  'h-1.5',
                                  readPct >= 80 ? '[&_[data-slot=progress-indicator]]:bg-emerald-500'
                                  : readPct >= 40 ? '[&_[data-slot=progress-indicator]]:bg-amber-500'
                                  : '[&_[data-slot=progress-indicator]]:bg-primary'
                                )}
                              />
                            </div>
                          </div>
                        </div>
                        {/* Right — meta column */}
                        <div className="flex flex-col items-start gap-1 text-[11px] text-muted-foreground sm:w-[140px] sm:items-end sm:text-right">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {formatTime(n.createdAt)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" /> {n.recipients} recipient{n.recipients === 1 ? '' : 's'}
                          </span>
                          {n.unreadCount > 0 && (
                            <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400">
                              <Bell className="h-3 w-3" /> {n.unreadCount} unread
                            </span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Send Dialog */}
      <Dialog open={sendOpen} onOpenChange={(o) => !sending && setSendOpen(o)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <Send className="h-5 w-5 text-primary" /> Send Notification
            </DialogTitle>
            <DialogDescription>
              Compose a notification and send it to all eligible voters — or to a specific voter. Placeholders like <code className="rounded bg-muted px-1 py-0.5 text-[10px]">{`{electionName}`}</code> are pre-filled from the template.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {/* Template selector */}
            <div className="space-y-1.5">
              <Label htmlFor="tpl-select">Template</Label>
              <Select value={selectedTemplateId} onValueChange={applyTemplate}>
                <SelectTrigger id="tpl-select" className="w-full">
                  <SelectValue placeholder="Pick a template or write from scratch" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((tpl) => {
                    const meta = TEMPLATE_META[tpl.id] || TEMPLATE_META.custom
                    const TplIcon = meta.icon
                    return (
                      <SelectItem key={tpl.id} value={tpl.id}>
                        <span className="flex items-center gap-2">
                          <TplIcon className="h-3.5 w-3.5" />
                          {meta.label}
                        </span>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              {selectedTemplateId !== 'custom' && (
                <p className="text-[11px] text-muted-foreground">
                  {templates.find((t) => t.id === selectedTemplateId)?.description}
                </p>
              )}
            </div>

            {/* Quick template chips */}
            <div className="flex flex-wrap gap-1.5">
              {templates.map((tpl) => {
                const meta = TEMPLATE_META[tpl.id] || TEMPLATE_META.custom
                const Icon = meta.icon
                const active = selectedTemplateId === tpl.id
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => applyTemplate(tpl.id)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                      active
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
                    )}
                  >
                    <Icon className="h-3 w-3" /> {meta.label}
                  </button>
                )
              })}
            </div>

            <Separator />

            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="notif-title">Title</Label>
              <Input
                id="notif-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Voting is Now Open"
                maxLength={200}
              />
              <p className="text-[10px] text-muted-foreground">{title.length}/200 characters</p>
            </div>

            {/* Message */}
            <div className="space-y-1.5">
              <Label htmlFor="notif-message">Message</Label>
              <Textarea
                id="notif-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write the notification message…"
                rows={5}
                maxLength={2000}
              />
              <p className="text-[10px] text-muted-foreground">{message.length}/2000 characters</p>
            </div>

            {/* Type selector */}
            <div className="space-y-1.5">
              <Label>Type</Label>
              <RadioGroup
                value={type}
                onValueChange={setType}
                className="grid grid-cols-2 gap-2 sm:grid-cols-4"
              >
                {TYPE_OPTIONS.map((t) => {
                  const tSt = typeStyle(t)
                  const Icon = tSt.icon
                  return (
                    <Label
                      key={t}
                      htmlFor={`type-${t}`}
                      className={cn(
                        'flex cursor-pointer items-center gap-2 rounded-md border p-2.5 text-sm transition-colors',
                        type === t ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'
                      )}
                    >
                      <RadioGroupItem id={`type-${t}`} value={t} className="sr-only" />
                      <Icon className={cn('h-4 w-4', tSt.iconColor)} />
                      <span className="font-medium">{t}</span>
                    </Label>
                  )
                })}
              </RadioGroup>
            </div>

            {/* Target selector */}
            <div className="space-y-2">
              <Label>Target</Label>
              <RadioGroup
                value={targetMode}
                onValueChange={(v) => setTargetMode(v as 'ALL' | 'VOTER')}
                className="grid gap-2 sm:grid-cols-2"
              >
                <Label
                  htmlFor="target-all"
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors',
                    targetMode === 'ALL' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'
                  )}
                >
                  <RadioGroupItem id="target-all" value="ALL" className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-sm font-semibold">
                      <Users className="h-4 w-4 text-primary" /> All Eligible Voters
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Broadcast to every voter in this election&apos;s registry.
                    </p>
                    {targetMode === 'ALL' && recipientPreview !== null && (
                      <p className="mt-1 text-[11px] font-medium text-primary">
                        ≈ {recipientPreview.toLocaleString()} voter{recipientPreview === 1 ? '' : 's'} will receive this
                      </p>
                    )}
                  </div>
                </Label>
                <Label
                  htmlFor="target-voter"
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors',
                    targetMode === 'VOTER' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'
                  )}
                >
                  <RadioGroupItem id="target-voter" value="VOTER" className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-sm font-semibold">
                      <User className="h-4 w-4 text-amber-600" /> Specific Voter
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Send to a single voter (search by name, email, or matric).
                    </p>
                  </div>
                </Label>
              </RadioGroup>

              {/* Voter search (only in VOTER mode) */}
              <AnimatePresence>
                {targetMode === 'VOTER' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-2 pt-1">
                      {selectedVoter ? (
                        <div className="flex items-center justify-between rounded-md border border-primary/30 bg-primary/5 p-2.5">
                          <div className="flex items-center gap-2">
                            <div className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-primary">
                              <User className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="text-sm font-medium">{selectedVoter.fullName}</div>
                              <div className="text-[11px] text-muted-foreground">
                                {selectedVoter.matric}
                                {selectedVoter.email || selectedVoter.institutionEmail ? ` · ${selectedVoter.email || selectedVoter.institutionEmail}` : ''}
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setSelectedVoter(null); setVoterQuery('') }}
                            className="h-7 px-2"
                            aria-label="Clear selected voter"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            placeholder="Search by name, email, or matric…"
                            value={voterQuery}
                            onChange={(e) => setVoterQuery(e.target.value)}
                            className="pl-9"
                          />
                          {searching && (
                            <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
                          )}
                        </div>
                      )}

                      {/* Voter search results */}
                      {!selectedVoter && voterQuery.trim() && (
                        <div className="max-h-56 overflow-y-auto rounded-md border border-border bg-popover">
                          {voterResults.length === 0 ? (
                            <div className="p-4 text-center text-xs text-muted-foreground">
                              {searching ? 'Searching…' : 'No voters found.'}
                            </div>
                          ) : (
                            <ul className="divide-y divide-border">
                              {voterResults.map((v) => (
                                <li key={v.id}>
                                  <button
                                    type="button"
                                    onClick={() => { setSelectedVoter(v); setVoterQuery(''); setVoterResults([]) }}
                                    className="flex w-full items-center gap-2 p-2.5 text-left hover:bg-muted/50"
                                  >
                                    <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                                      <User className="h-3.5 w-3.5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="truncate text-sm font-medium">{v.fullName}</div>
                                      <div className="truncate text-[11px] text-muted-foreground">
                                        {v.matric}
                                        {v.email || v.institutionEmail ? ` · ${v.email || v.institutionEmail}` : ''}
                                      </div>
                                    </div>
                                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Preview alert */}
            <Alert className="border-primary/30 bg-primary/5">
              <MessageSquare className="h-4 w-4 text-primary" />
              <AlertTitle>Delivery Preview</AlertTitle>
              <AlertDescription>
                {targetMode === 'ALL'
                  ? recipientPreview !== null
                    ? <>This notification will be sent to <strong>all {recipientPreview.toLocaleString()} eligible voter{recipientPreview === 1 ? '' : 's'}</strong> in this election.</>
                    : 'Counting eligible voters…'
                  : selectedVoter
                    ? <>This notification will be sent to <strong>{selectedVoter.fullName}</strong> ({selectedVoter.matric}).</>
                    : 'Select a voter to see the delivery preview.'}
                <br />
                <span className="text-[11px]">In production, delivery is dispatched via the channels configured in your organization&apos;s settings (email, SMS, or WhatsApp).</span>
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setSendOpen(false)} disabled={sending}>
              Cancel
            </Button>
            <Button
              onClick={send}
              disabled={sending || !title.trim() || !message.trim() || (targetMode === 'VOTER' && !selectedVoter)}
              className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {sending ? 'Sending…' : 'Send Notification'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
function StatCard({ icon: Icon, label, value, suffix, colour }: { icon: any; label: string; value: number; suffix?: string; colour: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-lg', colour)}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <div className="font-display text-xl font-bold leading-none tabular-nums">
            {value.toLocaleString()}{suffix || ''}
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  )
}
