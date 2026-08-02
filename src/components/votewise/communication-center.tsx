'use client'

// VoteWise — CNSE Communication Center
// The centralized hub for organization communication: delivery analytics,
// notifications inbox, message templates, announcements, and the unified
// communication timeline.
//
// Palette: emerald / gold / amber / zinc / red only — NO indigo or blue.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Mail, Send, Inbox as InboxIcon, FileText, Megaphone, Clock, CheckCircle2,
  AlertCircle, TrendingUp, Bell, Pin, Search, Plus, Trash2, Edit,
  MessageSquare, RefreshCw, Loader2, Smartphone, MessageCircle, Filter,
  Sparkles, AlertTriangle, Siren, ChevronRight, Eye, EyeOff,
} from 'lucide-react'
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle, DialogClose,
} from '@/components/ui/dialog'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ---------------------------------------------------------------------------
// Palette (emerald / gold / amber / zinc / red only — NO indigo / blue)
// ---------------------------------------------------------------------------
const CHART_COLORS = {
  emerald: '#10b981',
  emeraldDark: '#15803d',
  amber: '#f59e0b',
  amberDark: '#b45309',
  gold: '#d4a017',
  zinc400: '#a1a1aa',
  zinc500: '#71717a',
  zinc600: '#52525b',
  red: '#ef4444',
}

// Channel → icon + colour
const CHANNEL_STYLE: Record<string, { icon: any; cls: string; label: string }> = {
  EMAIL: { icon: Mail, cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', label: 'Email' },
  SMS: { icon: Smartphone, cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300', label: 'SMS' },
  WHATSAPP: { icon: MessageCircle, cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', label: 'WhatsApp' },
  IN_APP: { icon: Bell, cls: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300', label: 'In-App' },
}

const CHANNEL_CHART_COLOR: Record<string, string> = {
  EMAIL: CHART_COLORS.emerald,
  SMS: CHART_COLORS.amber,
  WHATSAPP: CHART_COLORS.emeraldDark,
  IN_APP: CHART_COLORS.zinc500,
}

const CATEGORY_STYLE: Record<string, string> = {
  AUTHENTICATION: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  ELECTION: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  RESULTS: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-600/20 dark:text-emerald-200',
  SUPPORT: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300',
  BILLING: 'bg-amber-100 text-amber-800 dark:bg-amber-600/20 dark:text-amber-200',
  SECURITY: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  SYSTEM: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-400',
  MARKETING: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
}

const MESSAGE_STATUS_STYLE: Record<string, string> = {
  QUEUED: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-300',
  SENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  DELIVERED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  OPENED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-600/20 dark:text-emerald-200',
  CLICKED: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-700/30 dark:text-emerald-100',
  FAILED: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  RETRYING: 'bg-amber-100 text-amber-800 dark:bg-amber-600/20 dark:text-amber-200',
}

const STATUS_CHART_COLOR: Record<string, string> = {
  DELIVERED: CHART_COLORS.emerald,
  OPENED: CHART_COLORS.emeraldDark,
  CLICKED: CHART_COLORS.gold,
  QUEUED: CHART_COLORS.zinc500,
  SENDING: CHART_COLORS.amber,
  RETRYING: CHART_COLORS.amberDark,
  FAILED: CHART_COLORS.red,
}

const ANNOUNCEMENT_TYPE_STYLE: Record<string, string> = {
  INFO: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300',
  NOTICE: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  WARNING: 'bg-amber-100 text-amber-800 dark:bg-amber-600/20 dark:text-amber-200',
  EMERGENCY: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  RESULT: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
}

const NOTIFICATION_TYPE_STYLE: Record<string, string> = {
  INFO: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300',
  SUCCESS: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  WARNING: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  SECURITY: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
}

const TIMELINE_TYPE_STYLE: Record<string, { icon: any; dot: string; badge: string; label: string }> = {
  MESSAGE: {
    icon: MessageSquare,
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    label: 'Message',
  },
  ANNOUNCEMENT: {
    icon: Megaphone,
    dot: 'bg-amber-500',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    label: 'Announcement',
  },
  TICKET: {
    icon: AlertCircle,
    dot: 'bg-zinc-500',
    badge: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-300',
    label: 'Ticket',
  },
  NOTIFICATION: {
    icon: Bell,
    dot: 'bg-emerald-400',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    label: 'Notification',
  },
  REMINDER: {
    icon: Clock,
    dot: 'bg-amber-400',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    label: 'Reminder',
  },
  EMERGENCY: {
    icon: Siren,
    dot: 'bg-red-500',
    badge: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
    label: 'Emergency',
  },
}

const CATEGORIES = ['AUTHENTICATION', 'ELECTION', 'RESULTS', 'SUPPORT', 'BILLING', 'SECURITY', 'SYSTEM', 'MARKETING'] as const
const CHANNELS = ['EMAIL', 'SMS', 'WHATSAPP', 'IN_APP'] as const
const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const
const ANNOUNCEMENT_TYPES = ['INFO', 'NOTICE', 'WARNING', 'EMERGENCY', 'RESULT'] as const
const AUDIENCES = ['ALL', 'VOTERS', 'ADMINS', 'OBSERVERS', 'CANDIDATES'] as const

// ---------------------------------------------------------------------------
// Type aliases (API shapes)
// ---------------------------------------------------------------------------
interface DeliveryStats {
  total: number
  queued: number
  delivered: number
  opened: number
  clicked: number
  failed: number
  deliveryRate: number
  openRate: number
  clickRate: number
}

interface TemplateItem {
  id: string
  name: string
  category: string
  channel: string
  language?: string
  subject?: string | null
  body: string
  variables?: string | null
  isBuiltIn?: boolean
  isActive?: boolean
  createdByName?: string | null
  updatedAt?: string
}

interface AnnouncementItem {
  id: string
  title: string
  body: string
  type: string
  targetAudience: string
  isPinned: boolean
  isPublished: boolean
  publishedAt: string
  createdByName?: string | null
}

interface NotificationItem {
  id: string
  title: string
  message: string
  type: string
  readAt: string | null
  createdAt: string
}

interface TimelineItem {
  id: string
  type: string
  channel?: string
  category?: string
  title: string
  description: string
  recipient?: string
  status?: string
  timestamp: string
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function CommunicationCenter({ subdomain }: { subdomain?: string }) {
  const [tab, setTab] = useState<string>('overview')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
      {/* Header */}
      <Header subdomain={subdomain} lastUpdated={lastUpdated} />

      <Tabs value={tab} onValueChange={setTab} className="mt-6 w-full">
        <TabsList className="votewise-scroll h-auto w-full max-w-full overflow-x-auto rounded-xl bg-muted/60 p-1 sm:w-fit">
          <TabsTrigger value="overview" className="gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" /> Overview
          </TabsTrigger>
          <TabsTrigger value="inbox" className="gap-1.5">
            <InboxIcon className="h-3.5 w-3.5" /> Inbox
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Templates
          </TabsTrigger>
          <TabsTrigger value="announcements" className="gap-1.5">
            <Megaphone className="h-3.5 w-3.5" /> Announcements
          </TabsTrigger>
          <TabsTrigger value="timeline" className="gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Timeline
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab subdomain={subdomain} onUpdated={setLastUpdated} />
        </TabsContent>
        <TabsContent value="inbox" className="mt-4">
          <InboxTab subdomain={subdomain} onUpdated={setLastUpdated} />
        </TabsContent>
        <TabsContent value="templates" className="mt-4">
          <TemplatesTab subdomain={subdomain} onUpdated={setLastUpdated} />
        </TabsContent>
        <TabsContent value="announcements" className="mt-4">
          <AnnouncementsTab subdomain={subdomain} onUpdated={setLastUpdated} />
        </TabsContent>
        <TabsContent value="timeline" className="mt-4">
          <TimelineTab subdomain={subdomain} onUpdated={setLastUpdated} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------
function Header({ subdomain, lastUpdated }: { subdomain?: string; lastUpdated: Date | null }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="votewise-card-glow border-primary/20">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Mail className="h-6 w-6" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-bold leading-tight">Communication Center</h1>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Centralized hub for delivery analytics, notifications, templates, announcements,
                  and the unified audit timeline.
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="outline" className="gap-1">
                    <Sparkles className="h-3 w-3 text-primary" />
                    CNSE Engine
                  </Badge>
                  {subdomain && (
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {subdomain}.votewise.com.ng
                    </Badge>
                  )}
                  {lastUpdated && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      Updated {formatRelative(lastUpdated)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ===========================================================================
// TAB 1 — Overview (delivery analytics)
// ===========================================================================
function OverviewTab({
  subdomain,
  onUpdated,
}: {
  subdomain?: string
  onUpdated: (d: Date) => void
}) {
  const [stats, setStats] = useState<DeliveryStats | null>(null)
  const [timeline, setTimeline] = useState<TimelineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sendOpen, setSendOpen] = useState(false)
  const [refreshTick, setRefreshTick] = useState(0)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [s, t]: any = await Promise.all([
        api.cnseGetAnalytics('', subdomain),
        api.cnseGetTimeline('limit=100', subdomain),
      ])
      setStats(s as DeliveryStats)
      setTimeline((t?.timeline || []) as TimelineItem[])
      onUpdated(new Date())
    } catch (e: any) {
      setError(e?.message || 'Failed to load delivery analytics')
    } finally {
      setLoading(false)
    }
  }, [subdomain, onUpdated])

  useEffect(() => {
    load()
    // Auto-refresh every 15s
    const id = setInterval(() => setRefreshTick((n) => n + 1), 15_000)
    return () => clearInterval(id)
  }, [load])

  useEffect(() => {
    if (refreshTick > 0) load()
  }, [refreshTick, load])

  // Derive chart data from timeline (filter MESSAGE type only)
  const messageEntries = useMemo(
    () => timeline.filter((t) => t.type === 'MESSAGE'),
    [timeline],
  )

  const byCategory = useMemo(() => {
    const map: Record<string, number> = {}
    for (const m of messageEntries) {
      const k = m.category || 'OTHER'
      map[k] = (map[k] || 0) + 1
    }
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [messageEntries])

  const byStatus = useMemo(() => {
    const map: Record<string, number> = {}
    for (const m of messageEntries) {
      const k = m.status || 'QUEUED'
      map[k] = (map[k] || 0) + 1
    }
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [messageEntries])

  const recentMessages = useMemo(
    () => messageEntries.slice(0, 20),
    [messageEntries],
  )

  if (loading) {
    return (
      <LoadingBlock label="Loading delivery analytics…" />
    )
  }

  if (error || !stats) {
    return (
      <ErrorBlock message={error || 'No data available'} onRetry={load} />
    )
  }

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard icon={Send} label="Total Sent" value={stats.total} colour="text-primary" />
        <StatCard icon={CheckCircle2} label="Delivered" value={stats.delivered} colour="text-emerald-600 dark:text-emerald-400" />
        <StatCard icon={AlertCircle} label="Failed" value={stats.failed} colour="text-red-600 dark:text-red-400" />
        <StatCard
          icon={TrendingUp}
          label="Delivery Rate"
          value={`${stats.deliveryRate}%`}
          colour="text-emerald-700 dark:text-emerald-300"
          progress={stats.deliveryRate}
        />
        <StatCard
          icon={Eye}
          label="Open Rate"
          value={`${stats.openRate}%`}
          colour="text-amber-600 dark:text-amber-400"
          progress={stats.openRate}
        />
        <StatCard
          icon={MessageSquare}
          label="Click Rate"
          value={`${stats.clickRate}%`}
          colour="text-amber-700 dark:text-amber-300"
          progress={stats.clickRate}
        />
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setSendOpen(true)} className="gap-1.5">
          <Send className="h-4 w-4" /> Send Message
        </Button>
        <Button onClick={load} variant="outline" size="sm" className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          Auto-refresh every 15s
        </span>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Bar chart — messages by category */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-base flex items-center gap-2">
              <BarChart3Icon /> Messages by Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            {byCategory.length === 0 ? (
              <EmptyHint icon={Mail} label="No messages yet" hint="Send a message to populate analytics." />
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byCategory} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10, fill: '#71717a' }}
                      tickLine={false}
                      axisLine={{ stroke: 'rgba(0,0,0,0.08)' }}
                      interval={0}
                      angle={-12}
                      textAnchor="end"
                      height={56}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#71717a' }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(16,185,129,0.08)' }}
                      contentStyle={{
                        borderRadius: 10,
                        border: '1px solid rgba(0,0,0,0.08)',
                        fontSize: 12,
                        background: 'rgba(255,255,255,0.98)',
                      }}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={48}>
                      {byCategory.map((entry, i) => (
                        <Cell key={i} fill={categoryColor(entry.name)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Donut chart — delivery status distribution */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-base flex items-center gap-2">
              <PieIcon /> Delivery Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {byStatus.length === 0 ? (
              <EmptyHint icon={PieIcon} label="No status data" hint="Delivery statuses will appear here." />
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={byStatus}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={92}
                      paddingAngle={2}
                      stroke="rgba(255,255,255,0.6)"
                    >
                      {byStatus.map((entry, i) => (
                        <Cell key={i} fill={STATUS_CHART_COLOR[entry.name] || CHART_COLORS.zinc500} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: 10,
                        border: '1px solid rgba(0,0,0,0.08)',
                        fontSize: 12,
                        background: 'rgba(255,255,255,0.98)',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            {/* Legend */}
            {byStatus.length > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-1.5 text-xs">
                {byStatus.map((s) => (
                  <div key={s.name} className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-sm"
                      style={{ backgroundColor: STATUS_CHART_COLOR[s.name] || CHART_COLORS.zinc500 }}
                    />
                    <span className="text-muted-foreground">{s.name}</span>
                    <span className="ml-auto font-mono font-medium">{s.value}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent messages */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-base flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" /> Recent Messages
            <Badge variant="outline" className="ml-1 text-[10px]">Last 20</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recentMessages.length === 0 ? (
            <div className="py-10">
              <EmptyHint icon={Mail} label="No recent messages" hint="Sent messages will appear here." />
            </div>
          ) : (
            <div className="votewise-scroll max-h-96 overflow-y-auto">
              <ol className="divide-y divide-border">
                {recentMessages.map((m, i) => {
                  const ch = CHANNEL_STYLE[m.channel || 'IN_APP'] || CHANNEL_STYLE.IN_APP
                  const ChIcon = ch.icon
                  return (
                    <motion.li
                      key={m.id}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.25, delay: Math.min(i * 0.02, 0.4) }}
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30"
                    >
                      <div className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-lg', ch.cls)}>
                        <ChIcon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium">{m.title || m.category}</p>
                          {m.category && (
                            <Badge variant="outline" className={cn('text-[9px]', CATEGORY_STYLE[m.category] || '')}>
                              {m.category}
                            </Badge>
                          )}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {m.recipient ? `To: ${maskRecipient(m.recipient)}` : 'Broadcast'} · {m.description}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {m.status && (
                          <Badge variant="outline" className={cn('text-[9px]', MESSAGE_STATUS_STYLE[m.status] || '')}>
                            {m.status}
                          </Badge>
                        )}
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {formatRelative(m.timestamp)}
                        </span>
                      </div>
                    </motion.li>
                  )
                })}
              </ol>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Send Message dialog */}
      <SendMessageDialog open={sendOpen} onOpenChange={setSendOpen} subdomain={subdomain} onSent={load} />
    </div>
  )
}

// ===========================================================================
// TAB 2 — Inbox (notification center)
// ===========================================================================
function InboxTab({
  subdomain,
  onUpdated,
}: {
  subdomain?: string
  onUpdated: (d: Date) => void
}) {
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all')
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const r: any = await api.cnseGetNotifications('filter=all', subdomain)
      setItems((r?.notifications || []) as NotificationItem[])
      setUnreadCount(r?.unreadCount || 0)
      onUpdated(new Date())
    } catch (e: any) {
      setError(e?.message || 'Failed to load notifications')
    } finally {
      setLoading(false)
    }
  }, [subdomain, onUpdated])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    let list = items
    if (filter === 'unread') list = list.filter((n) => !n.readAt)
    if (filter === 'read') list = list.filter((n) => n.readAt)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (n) => n.title.toLowerCase().includes(q) || n.message.toLowerCase().includes(q),
      )
    }
    return list
  }, [items, filter, search])

  const markAllRead = useCallback(async () => {
    try {
      await api.cnseMarkNotificationRead({ action: 'markAllRead' }, subdomain)
      toast.success('All notifications marked as read')
      load()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to mark all as read')
    }
  }, [subdomain, load])

  const markRead = useCallback(
    async (id: string) => {
      try {
        await api.cnseMarkNotificationRead({ notificationId: id, action: 'read' }, subdomain)
        // Optimistic update
        setItems((prev) =>
          prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)),
        )
        setUnreadCount((c) => Math.max(0, c - 1))
      } catch (e: any) {
        toast.error(e?.message || 'Failed to mark notification as read')
      }
    },
    [subdomain],
  )

  if (loading) return <LoadingBlock label="Loading notifications…" />
  if (error) return <ErrorBlock message={error} onRetry={load} />

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-72">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search notifications…"
                className="h-9 pl-8 text-sm"
                aria-label="Search notifications"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 sm:ml-auto">
            <div className="inline-flex items-center rounded-lg border border-border bg-muted/40 p-0.5">
              {(['all', 'unread', 'read'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    'rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors',
                    filter === f
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {f}
                  {f === 'unread' && unreadCount > 0 && (
                    <Badge className="ml-1.5 bg-red-500 text-white text-[9px]">{unreadCount}</Badge>
                  )}
                </button>
              ))}
            </div>
            <Button onClick={markAllRead} variant="outline" size="sm" className="gap-1.5" disabled={unreadCount === 0}>
              <CheckCircle2 className="h-3.5 w-3.5" /> Mark All Read
            </Button>
            <Button onClick={load} variant="ghost" size="sm" className="gap-1.5" aria-label="Refresh inbox">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notifications list */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-base flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" /> Inbox
            <Badge variant="outline" className="ml-1 text-[10px]">
              {filtered.length} {filter !== 'all' ? `· ${filter}` : ''}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="py-12">
              <EmptyHint
                icon={Bell}
                label={search.trim() ? 'No matching notifications' : 'Inbox zero'}
                hint={search.trim() ? 'Try a different search term.' : 'New notifications will appear here.'}
              />
            </div>
          ) : (
            <div className="votewise-scroll max-h-[600px] overflow-y-auto">
              <ol className="divide-y divide-border">
                {filtered.map((n, i) => {
                  const isUnread = !n.readAt
                  const typeCls = NOTIFICATION_TYPE_STYLE[n.type] || NOTIFICATION_TYPE_STYLE.INFO
                  return (
                    <motion.li
                      key={n.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: Math.min(i * 0.02, 0.4) }}
                      className={cn(
                        'group flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/40',
                        isUnread && 'bg-primary/[0.03]',
                      )}
                      onClick={() => isUnread && markRead(n.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if ((e.key === 'Enter' || e.key === ' ') && isUnread) {
                          e.preventDefault()
                          markRead(n.id)
                        }
                      }}
                    >
                      {/* Read indicator */}
                      <span
                        className={cn(
                          'mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full',
                          isUnread ? 'bg-emerald-500' : 'bg-transparent',
                        )}
                        aria-label={isUnread ? 'Unread' : 'Read'}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className={cn('text-sm', isUnread ? 'font-semibold' : 'font-medium text-muted-foreground')}>
                            {n.title}
                          </p>
                          <Badge variant="outline" className={cn('text-[9px]', typeCls)}>
                            {n.type}
                          </Badge>
                          {isUnread && (
                            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 text-[9px]">
                              New
                            </Badge>
                          )}
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.message}</p>
                        <span className="mt-1 flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatRelative(n.createdAt)}
                        </span>
                      </div>
                      <ChevronRight className="mt-1.5 h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </motion.li>
                  )
                })}
              </ol>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ===========================================================================
// TAB 3 — Templates
// ===========================================================================
function TemplatesTab({
  subdomain,
  onUpdated,
}: {
  subdomain?: string
  onUpdated: (d: Date) => void
}) {
  const [items, setItems] = useState<TemplateItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterChannel, setFilterChannel] = useState<string>('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<TemplateItem | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const r: any = await api.cnseGetTemplates('', subdomain)
      setItems((r?.templates || []) as TemplateItem[])
      onUpdated(new Date())
    } catch (e: any) {
      setError(e?.message || 'Failed to load templates')
    } finally {
      setLoading(false)
    }
  }, [subdomain, onUpdated])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    return items.filter((t) => {
      if (filterCategory !== 'all' && t.category !== filterCategory) return false
      if (filterChannel !== 'all' && t.channel !== filterChannel) return false
      return true
    })
  }, [items, filterCategory, filterChannel])

  const grouped = useMemo(() => {
    const map: Record<string, TemplateItem[]> = {}
    for (const t of filtered) {
      const k = t.category || 'OTHER'
      if (!map[k]) map[k] = []
      map[k].push(t)
    }
    return map
  }, [filtered])

  if (loading) return <LoadingBlock label="Loading templates…" />
  if (error) return <ErrorBlock message={error} onRetry={load} />

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Filter className="h-4 w-4" /> Filters
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-1 sm:items-center sm:gap-2">
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="h-9 text-xs sm:w-44">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c.charAt(0) + c.slice(1).toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterChannel} onValueChange={setFilterChannel}>
              <SelectTrigger className="h-9 text-xs sm:w-40">
                <SelectValue placeholder="Channel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All channels</SelectItem>
                {CHANNELS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CHANNEL_STYLE[c]?.label || c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 sm:ml-auto">
            <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" /> Create Template
            </Button>
            <Button onClick={load} variant="ghost" size="sm" className="gap-1.5" aria-label="Refresh templates">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Template cards grouped by category */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <EmptyHint
              icon={FileText}
              label="No templates"
              hint="Create a reusable message template with variables."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([cat, list]) => (
            <div key={cat}>
              <div className="mb-2 flex items-center gap-2">
                <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  {cat}
                </h3>
                <Badge variant="outline" className="text-[10px]">{list.length}</Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((t, i) => (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.4) }}
                  >
                    <TemplateCard template={t} onEdit={() => setEditTarget(t)} />
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit dialog (shared) */}
      <TemplateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        subdomain={subdomain}
        onSaved={load}
        mode="create"
      />
      <TemplateDialog
        open={!!editTarget}
        onOpenChange={(o) => !o && setEditTarget(null)}
        subdomain={subdomain}
        onSaved={load}
        mode="edit"
        template={editTarget}
      />
    </div>
  )
}

function TemplateCard({ template, onEdit }: { template: TemplateItem; onEdit: () => void }) {
  const ch = CHANNEL_STYLE[template.channel] || CHANNEL_STYLE.IN_APP
  const ChIcon = ch.icon
  const variables = safeParseList(template.variables)
  return (
    <Card className="group flex h-full flex-col transition-shadow hover:shadow-md">
      <CardContent className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start gap-2">
          <div className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-lg', ch.cls)}>
            <ChIcon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate font-medium">{template.name}</p>
              {template.isBuiltIn && (
                <Badge variant="outline" className="text-[9px]">Built-in</Badge>
              )}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-1">
              <Badge variant="outline" className={cn('text-[9px]', CATEGORY_STYLE[template.category] || '')}>
                {template.category}
              </Badge>
              <Badge variant="outline" className={cn('text-[9px]', ch.cls)}>
                {ch.label}
              </Badge>
              {template.language && (
                <Badge variant="outline" className="text-[9px] font-mono">
                  {template.language}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {template.subject && (
          <div className="rounded-md bg-muted/40 px-2.5 py-1.5 text-xs">
            <span className="text-muted-foreground">Subject: </span>
            <span className="font-mono">{template.subject}</span>
          </div>
        )}
        <p className="line-clamp-3 text-xs text-muted-foreground">{template.body}</p>

        {variables.length > 0 && (
          <div className="mt-auto flex flex-wrap gap-1 pt-1">
            {variables.slice(0, 6).map((v) => (
              <Badge key={v} variant="outline" className="font-mono text-[9px]">
                {`{{${v}}}`}
              </Badge>
            ))}
            {variables.length > 6 && (
              <Badge variant="outline" className="text-[9px]">+{variables.length - 6}</Badge>
            )}
          </div>
        )}

        <div className="mt-1 flex items-center justify-between border-t border-border/60 pt-2">
          <span className="text-[10px] text-muted-foreground">
            {template.updatedAt ? `Updated ${formatRelative(template.updatedAt)}` : '—'}
          </span>
          <Button onClick={onEdit} variant="ghost" size="sm" className="h-7 gap-1.5 text-xs">
            <Edit className="h-3 w-3" /> Edit
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function TemplateDialog({
  open,
  onOpenChange,
  subdomain,
  onSaved,
  mode,
  template,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  subdomain?: string
  onSaved: () => void
  mode: 'create' | 'edit'
  template?: TemplateItem | null
}) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState<string>('ELECTION')
  const [channel, setChannel] = useState<string>('EMAIL')
  const [language, setLanguage] = useState('en')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [variables, setVariables] = useState('')
  const [saving, setSaving] = useState(false)

  // Sync form when opening
  useEffect(() => {
    if (!open) return
    if (mode === 'edit' && template) {
      setName(template.name)
      setCategory(template.category)
      setChannel(template.channel)
      setLanguage(template.language || 'en')
      setSubject(template.subject || '')
      setBody(template.body)
      setVariables(safeParseList(template.variables).join(', '))
    } else {
      setName('')
      setCategory('ELECTION')
      setChannel('EMAIL')
      setLanguage('en')
      setSubject('')
      setBody('')
      setVariables('')
    }
  }, [open, mode, template])

  const handleSave = async () => {
    if (!name.trim() || !body.trim()) {
      toast.error('Name and body are required')
      return
    }
    setSaving(true)
    try {
      const vars = variables
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
      const payload: any = {
        name: name.trim(),
        category,
        channel,
        language,
        subject: subject.trim() || undefined,
        body: body.trim(),
        variables: vars,
      }
      if (mode === 'edit' && template) {
        payload.id = template.id
        await api.cnseUpdateTemplate(payload, subdomain)
        toast.success('Template updated')
      } else {
        await api.cnseCreateTemplate(payload, subdomain)
        toast.success('Template created')
      }
      onSaved()
      onOpenChange(false)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save template')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            {mode === 'edit' ? 'Edit Template' : 'Create Template'}
          </DialogTitle>
          <DialogDescription>
            Use <code className="rounded bg-muted px-1 font-mono text-[11px]">{`{{variable}}`}</code> placeholders
            in the subject or body. They will be substituted when the template is sent.
          </DialogDescription>
        </DialogHeader>

        <div className="votewise-scroll max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-name">Name</Label>
              <Input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Voting Opens Reminder" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-lang">Language</Label>
              <Input id="tpl-lang" value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="en, yo, ha, ig…" className="font-mono" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Channel</Label>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CHANNELS.map((c) => (
                    <SelectItem key={c} value={c}>{CHANNEL_STYLE[c]?.label || c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tpl-subject">Subject (optional)</Label>
            <Input id="tpl-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Voting is now open: {{electionName}}" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tpl-body">Body</Label>
            <Textarea
              id="tpl-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              placeholder="Hello {{firstName}}, voting for {{electionName}} is now open…"
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tpl-vars">Variables (comma-separated)</Label>
            <Input
              id="tpl-vars"
              value={variables}
              onChange={(e) => setVariables(e.target.value)}
              placeholder="firstName, electionName, voteLink"
              className="font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              List the variable names used in the subject/body so they can be validated at send time.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {mode === 'edit' ? 'Save Changes' : 'Create Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ===========================================================================
// TAB 4 — Announcements
// ===========================================================================
function AnnouncementsTab({
  subdomain,
  onUpdated,
}: {
  subdomain?: string
  onUpdated: (d: Date) => void
}) {
  const [items, setItems] = useState<AnnouncementItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<string>('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const r: any = await api.cnseGetAnnouncements('', subdomain)
      setItems((r?.announcements || []) as AnnouncementItem[])
      onUpdated(new Date())
    } catch (e: any) {
      setError(e?.message || 'Failed to load announcements')
    } finally {
      setLoading(false)
    }
  }, [subdomain, onUpdated])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(
    () => (filterType === 'all' ? items : items.filter((a) => a.type === filterType)),
    [items, filterType],
  )

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await api.cnseDeleteAnnouncement(id, subdomain)
      toast.success('Announcement removed')
      load()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete announcement')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) return <LoadingBlock label="Loading announcements…" />
  if (error) return <ErrorBlock message={error} onRetry={load} />

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Filter className="h-4 w-4" /> Type
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="h-9 text-xs sm:w-48">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {ANNOUNCEMENT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 sm:ml-auto">
            <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" /> Create Announcement
            </Button>
            <Button onClick={load} variant="ghost" size="sm" className="gap-1.5" aria-label="Refresh announcements">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-base flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-primary" /> Announcements
            <Badge variant="outline" className="ml-1 text-[10px]">{filtered.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="py-12">
              <EmptyHint
                icon={Megaphone}
                label="No announcements"
                hint="Publish an announcement to all voters, admins, or observers."
              />
            </div>
          ) : (
            <div className="votewise-scroll max-h-[600px] overflow-y-auto">
              <ol className="divide-y divide-border">
                {filtered.map((a, i) => {
                  const typeCls = ANNOUNCEMENT_TYPE_STYLE[a.type] || ANNOUNCEMENT_TYPE_STYLE.INFO
                  return (
                    <motion.li
                      key={a.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: Math.min(i * 0.025, 0.4) }}
                      className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/30"
                    >
                      <div className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-lg', typeCls)}>
                        <Megaphone className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{a.title}</p>
                          {a.isPinned && (
                            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300 text-[9px] gap-0.5">
                              <Pin className="h-2.5 w-2.5" /> Pinned
                            </Badge>
                          )}
                          <Badge variant="outline" className={cn('text-[9px]', typeCls)}>{a.type}</Badge>
                          <Badge variant="outline" className="text-[9px]">{a.targetAudience}</Badge>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{a.body}</p>
                        <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {formatRelative(a.publishedAt)}
                          </span>
                          {a.createdByName && (
                            <span className="flex items-center gap-1">
                              <Edit className="h-3 w-3" /> {a.createdByName}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        onClick={() => handleDelete(a.id)}
                        variant="ghost"
                        size="sm"
                        className="h-7 shrink-0 gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                        disabled={deletingId === a.id}
                        aria-label="Delete announcement"
                      >
                        {deletingId === a.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                        Delete
                      </Button>
                    </motion.li>
                  )
                })}
              </ol>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      <AnnouncementDialog open={createOpen} onOpenChange={setCreateOpen} subdomain={subdomain} onSaved={load} />
    </div>
  )
}

function AnnouncementDialog({
  open,
  onOpenChange,
  subdomain,
  onSaved,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  subdomain?: string
  onSaved: () => void
}) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [type, setType] = useState<string>('INFO')
  const [audience, setAudience] = useState<string>('ALL')
  const [pinned, setPinned] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setTitle('')
    setBody('')
    setType('INFO')
    setAudience('ALL')
    setPinned(false)
  }, [open])

  const handleSave = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error('Title and body are required')
      return
    }
    setSaving(true)
    try {
      await api.cnseCreateAnnouncement(
        {
          title: title.trim(),
          body: body.trim(),
          type,
          targetAudience: audience,
          isPinned: pinned,
        },
        subdomain,
      )
      toast.success('Announcement published')
      onSaved()
      onOpenChange(false)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to publish announcement')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-primary" /> Create Announcement
          </DialogTitle>
          <DialogDescription>
            Publish a notice to your organization. Pinned announcements stay at the top.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="an-title">Title</Label>
            <Input
              id="an-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Voting closes in 2 hours"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ANNOUNCEMENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Target audience</Label>
              <Select value={audience} onValueChange={setAudience}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AUDIENCES.map((a) => (
                    <SelectItem key={a} value={a}>{a.charAt(0) + a.slice(1).toLowerCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="an-body">Body</Label>
            <Textarea
              id="an-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              placeholder="Write the announcement body…"
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
            <div className="flex items-center gap-2">
              <Pin className="h-4 w-4 text-amber-600" />
              <div>
                <p className="text-sm font-medium">Pin to top</p>
                <p className="text-[11px] text-muted-foreground">Pinned announcements appear first.</p>
              </div>
            </div>
            <Switch checked={pinned} onCheckedChange={setPinned} aria-label="Pin announcement" />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <Send className="h-3.5 w-3.5" /> Publish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ===========================================================================
// TAB 5 — Timeline (communication audit)
// ===========================================================================
function TimelineTab({
  subdomain,
  onUpdated,
}: {
  subdomain?: string
  onUpdated: (d: Date) => void
}) {
  const [items, setItems] = useState<TimelineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<'all' | 'MESSAGE' | 'ANNOUNCEMENT' | 'TICKET'>('all')

  const load = useCallback(async () => {
    setError(null)
    try {
      const r: any = await api.cnseGetTimeline('limit=100', subdomain)
      setItems((r?.timeline || []) as TimelineItem[])
      onUpdated(new Date())
    } catch (e: any) {
      setError(e?.message || 'Failed to load timeline')
    } finally {
      setLoading(false)
    }
  }, [subdomain, onUpdated])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(
    () => (filterType === 'all' ? items : items.filter((t) => t.type === filterType)),
    [items, filterType],
  )

  const counts = useMemo(() => {
    const c: Record<string, number> = { MESSAGE: 0, ANNOUNCEMENT: 0, TICKET: 0 }
    for (const t of items) {
      if (c[t.type] !== undefined) c[t.type]++
    }
    return c
  }, [items])

  if (loading) return <LoadingBlock label="Loading timeline…" />
  if (error) return <ErrorBlock message={error} onRetry={load} />

  return (
    <div className="space-y-4">
      {/* Header + filter */}
      <Card className="votewise-card-glow border-primary/20">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold">Communication Audit Timeline</h3>
              <p className="text-xs text-muted-foreground">
                Unified, chronological record of every message, announcement, and support ticket.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {(['all', 'MESSAGE', 'ANNOUNCEMENT', 'TICKET'] as const).map((f) => (
              <Button
                key={f}
                size="sm"
                variant={filterType === f ? 'default' : 'outline'}
                className="gap-1.5 text-xs"
                onClick={() => setFilterType(f)}
              >
                {f === 'all' && <Eye className="h-3.5 w-3.5" />}
                {f === 'MESSAGE' && <MessageSquare className="h-3.5 w-3.5" />}
                {f === 'ANNOUNCEMENT' && <Megaphone className="h-3.5 w-3.5" />}
                {f === 'TICKET' && <AlertCircle className="h-3.5 w-3.5" />}
                {f === 'all' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
                {f !== 'all' && counts[f] !== undefined && (
                  <Badge variant="outline" className="ml-0.5 text-[9px]">{counts[f]}</Badge>
                )}
              </Button>
            ))}
            <Button onClick={load} variant="ghost" size="sm" className="gap-1.5" aria-label="Refresh timeline">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" /> Chronological Timeline
            <Badge variant="outline" className="ml-1 text-[10px]">{filtered.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="py-12">
              <EmptyHint
                icon={Clock}
                label="No timeline entries"
                hint="Communications will appear here in chronological order."
              />
            </div>
          ) : (
            <div className="votewise-scroll max-h-[600px] overflow-y-auto pr-2">
              <ol className="relative ml-3 border-l-2 border-border">
                {filtered.map((entry, i) => {
                  const style = TIMELINE_TYPE_STYLE[entry.type] || TIMELINE_TYPE_STYLE.MESSAGE
                  const Icon = style.icon
                  const chStyle = entry.channel ? CHANNEL_STYLE[entry.channel] : null
                  const ChIcon = chStyle?.icon
                  return (
                    <motion.li
                      key={`${entry.id}-${i}`}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: Math.min(i * 0.025, 0.6) }}
                      className="ml-5 pb-4"
                    >
                      {/* Marker */}
                      <span
                        className={cn(
                          'absolute -left-[9px] mt-1 grid h-4 w-4 place-items-center rounded-full border-2 border-background',
                          style.dot,
                        )}
                      />

                      {/* Entry card */}
                      <div className="rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted/30">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className={cn('grid h-6 w-6 place-items-center rounded-md', style.badge)}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <Badge variant="outline" className="text-[9px] uppercase tracking-wider">
                            {style.label}
                          </Badge>
                          {entry.channel && ChIcon && (
                            <Badge variant="outline" className={cn('text-[9px] gap-0.5', chStyle?.cls || '')}>
                              <ChIcon className="h-3 w-3" />
                              {chStyle?.label || entry.channel}
                            </Badge>
                          )}
                          {entry.category && (
                            <Badge variant="outline" className={cn('text-[9px]', CATEGORY_STYLE[entry.category] || '')}>
                              {entry.category}
                            </Badge>
                          )}
                          {entry.status && (
                            <Badge variant="outline" className={cn('text-[9px]', MESSAGE_STATUS_STYLE[entry.status] || '')}>
                              {entry.status}
                            </Badge>
                          )}
                          <span className="ml-auto flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {formatTimestamp(entry.timestamp)}
                          </span>
                        </div>
                        <p className="mt-1.5 text-sm font-medium">{entry.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{entry.description}</p>
                        {entry.recipient && (
                          <div className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                            <span className="font-mono">→</span>
                            <span>To: {maskRecipient(entry.recipient)}</span>
                          </div>
                        )}
                      </div>
                    </motion.li>
                  )
                })}
              </ol>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ===========================================================================
// Send Message dialog (Overview tab)
// ===========================================================================
function SendMessageDialog({
  open,
  onOpenChange,
  subdomain,
  onSent,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  subdomain?: string
  onSent: () => void
}) {
  const [recipient, setRecipient] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [channel, setChannel] = useState<string>('EMAIL')
  const [category, setCategory] = useState<string>('ELECTION')
  const [priority, setPriority] = useState<string>('NORMAL')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!open) return
    setRecipient('')
    setRecipientName('')
    setChannel('EMAIL')
    setCategory('ELECTION')
    setPriority('NORMAL')
    setSubject('')
    setBody('')
  }, [open])

  const handleSend = async () => {
    if (!body.trim()) {
      toast.error('Message body is required')
      return
    }
    if (channel !== 'IN_APP' && !recipient.trim()) {
      toast.error('Recipient address is required for this channel')
      return
    }
    setSending(true)
    try {
      await api.cnseSend(
        {
          recipientName: recipientName.trim() || undefined,
          recipientAddress: recipient.trim() || undefined,
          channel,
          category,
          priority,
          subject: subject.trim() || undefined,
          body: body.trim(),
        },
        subdomain,
      )
      toast.success('Message queued for delivery')
      onSent()
      onOpenChange(false)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to send message')
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-4 w-4 text-primary" /> Send Message
          </DialogTitle>
          <DialogDescription>
            Compose and dispatch a single message through the CNSE engine. The message is queued,
            delivered via the selected channel, and tracked end-to-end.
          </DialogDescription>
        </DialogHeader>

        <div className="votewise-scroll max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="sm-recipient">Recipient address</Label>
              <Input
                id="sm-recipient"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="email or phone (masked at rest)"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sm-name">Recipient name (optional)</Label>
              <Input
                id="sm-name"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="e.g. Adaeze N."
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Channel</Label>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CHANNELS.map((c) => (
                    <SelectItem key={c} value={c}>{CHANNEL_STYLE[c]?.label || c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sm-subject">Subject</Label>
            <Input
              id="sm-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Optional subject line"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sm-body">Body</Label>
            <Textarea
              id="sm-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              placeholder="Write the message body…"
            />
          </div>
          <div className={cn(
            'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[11px]',
            priority === 'URGENT'
              ? 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300'
              : priority === 'HIGH'
                ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
                : 'bg-muted text-muted-foreground',
          )}>
            <AlertTriangle className="h-3.5 w-3.5" />
            {priority === 'URGENT'
              ? 'Urgent messages are sent immediately and trigger an in-app notification.'
              : priority === 'HIGH'
                ? 'High-priority messages skip the queue and dispatch first.'
                : 'Normal priority — dispatched by the queue in order.'}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleSend} disabled={sending} className="gap-1.5">
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Send Message
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ===========================================================================
// Shared UI helpers
// ===========================================================================
function StatCard({
  icon: Icon,
  label,
  value,
  colour,
  progress,
}: {
  icon: any
  label: string
  value: number | string
  colour: string
  progress?: number
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
          <Icon className={cn('h-4 w-4', colour)} />
        </div>
        <div className={cn('mt-1 font-display text-2xl font-bold tabular-nums', colour)}>{value}</div>
        {progress !== undefined && (
          <Progress value={progress} className="mt-2 h-1.5" />
        )}
      </CardContent>
    </Card>
  )
}

function LoadingBlock({ label }: { label: string }) {
  return (
    <Card>
      <CardContent className="grid place-items-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="mt-2 text-sm text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  )
}

function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card>
      <CardContent className="py-10 text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-destructive/50" />
        <p className="mt-2 text-sm font-medium">{message}</p>
        <Button onClick={onRetry} variant="outline" size="sm" className="mt-3 gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </Button>
      </CardContent>
    </Card>
  )
}

function EmptyHint({ icon: Icon, label, hint }: { icon: any; label: string; hint: string }) {
  return (
    <div className="text-center">
      <Icon className="mx-auto h-10 w-10 text-muted-foreground/40" />
      <p className="mt-2 text-sm font-medium">{label}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

// BarChart / Pie icon shims (avoids extra imports)
function BarChart3Icon() {
  return <TrendingUp className="h-4 w-4 text-primary" />
}
function PieIcon() {
  return <MessageSquare className="h-4 w-4 text-primary" />
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
function categoryColor(name: string): string {
  const map: Record<string, string> = {
    AUTHENTICATION: CHART_COLORS.amber,
    ELECTION: CHART_COLORS.emerald,
    RESULTS: CHART_COLORS.emeraldDark,
    SUPPORT: CHART_COLORS.zinc500,
    BILLING: CHART_COLORS.amberDark,
    SECURITY: CHART_COLORS.red,
    SYSTEM: CHART_COLORS.zinc400,
    MARKETING: CHART_COLORS.gold,
    OTHER: CHART_COLORS.zinc500,
  }
  return map[name] || CHART_COLORS.zinc500
}

function safeParseList(raw?: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    // Fall back to comma-separated
    return raw.split(',').map((s) => s.trim()).filter(Boolean)
  }
}

function formatRelative(input: Date | string): string {
  const d = typeof input === 'string' ? new Date(input) : input
  if (isNaN(d.getTime())) return '—'
  const diff = Date.now() - d.getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return iso
  }
}

function maskRecipient(value: string): string {
  if (!value) return '—'
  // Mask email/phone middle for privacy in UI
  if (value.length <= 3) return value
  if (value.includes('@')) {
    const [local, domain] = value.split('@')
    if (!domain) return value
    const masked = local.length <= 2 ? local[0] + '*' : local.slice(0, 2) + '*'.repeat(Math.min(local.length - 2, 4))
    return `${masked}@${domain}`
  }
  // Phone-style
  return value.slice(0, 3) + '*'.repeat(Math.max(0, value.length - 5)) + value.slice(-2)
}
